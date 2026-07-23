import { getDatabase, isDatabaseReady } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import { syncTableConfig, type SyncableTable } from './syncTableConfig';

// Types

interface SyncLogRow {
    sync_id: string;
    table_name: SyncableTable;
    row_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
}

export interface SyncSummary {
    attempted: number;
    succeeded: number;
    failed: number;
}

export interface PullSummary {
    pulled: number;
    skipped: number;
}

// Tables pulled from Supabase into local SQLite, in FK-safe order (a parent before anything that references it). Push-only tables are absent.
const PULL_ORDER: SyncableTable[] = ['Patient', 'MemoryAsset', 'Encouragement'];

const EPOCH = '1970-01-01T00:00:00.000Z';

// Helpers

async function getPendingSyncRows(): Promise<SyncLogRow[]> {
    const db = getDatabase();
    return db.getAllAsync<SyncLogRow>(
    `SELECT sync_id, table_name, row_id, operation
        FROM SyncLog
        WHERE synced = 0
        ORDER BY created_at ASC`
    );
}

async function markSynced(syncId: string): Promise<void> {
    const db = getDatabase();
    await db.runAsync(
    `UPDATE SyncLog SET synced = 1, last_attempt = datetime('now') WHERE sync_id = ?`,
    [syncId]
    );
}

async function markFailed(syncId: string, errorMessage: string): Promise<void> {
    const db = getDatabase();
    await db.runAsync(
    `UPDATE SyncLog
        SET last_attempt = datetime('now'), error_message = ?
        WHERE sync_id = ?`,
    [errorMessage, syncId]
    );
}


// Pushes one queued change to Supabase using the config for its table
async function pushRow(row: SyncLogRow): Promise<string | null> {
    const config = syncTableConfig[row.table_name];

    if (!config) {
    return `No sync config registered for table "${row.table_name}"`;
    }

    try {
    if (row.operation === 'DELETE') {
        const { error } = await supabase
        .from(config.supabaseTable)
        .delete()
        .eq(config.primaryKey, row.row_id);
        return error ? error.message : null;
    }

    // INSERT and UPDATE both resolve to an upsert — this keeps the local and remote sides eventually consistent even if a row was modified twice locally before syncing (only the latest local state is pushed).
    const localRow = await config.readLocalRow(row.row_id);
    if (!localRow) {
        // Row no longer exists locally (e.g. deleted right after an update was queued) — nothing to push, treat as success.
        return null;
    }

    const { error } = await supabase
        .from(config.supabaseTable)
        .upsert(config.toSupabaseRow(localRow), { onConflict: config.primaryKey });

    return error ? error.message : null;
    } catch (e) {
    return e instanceof Error ? e.message : 'Unknown sync error';
    }
}

// Pull helpers

async function getWatermark(table: SyncableTable): Promise<string> {
    const db = getDatabase();
    const row = await db.getFirstAsync<{ last_pulled_at: string }>(
    `SELECT last_pulled_at FROM SyncState WHERE table_name = ?`,
    [table]
    );
    return row?.last_pulled_at ?? EPOCH;
}

async function setWatermark(table: SyncableTable, value: string): Promise<void> {
    const db = getDatabase();
    await db.runAsync(
    `INSERT INTO SyncState (table_name, last_pulled_at) VALUES (?, ?)
        ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
    [table, value]
    );
}

// Upserts a pulled row into local SQLite. Uses ON CONFLICT DO UPDATE — never INSERT OR REPLACE, which would delete-then-reinsert and cascade away child rows (e.g. an asset's local TrainingSession history). Deliberately does NOT queue a SyncLog entry: a pulled row must not be echoed straight back up.
async function upsertLocalRow(
    table: string,
    primaryKey: string,
    row: Record<string, unknown>
): Promise<void> {
    const db = getDatabase();
    const columns = Object.keys(row);
    const placeholders = columns.map(() => '?').join(', ');
    const assignments = columns
    .filter((c) => c !== primaryKey)
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

    await db.runAsync(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
        ON CONFLICT(${primaryKey}) DO UPDATE SET ${assignments}`,
    columns.map((c) => row[c] as any)
    );
}

// Decides whether a remote row should overwrite the local copy.
async function shouldWrite(
    table: SyncableTable,
    config: (typeof syncTableConfig)[SyncableTable],
    remote: Record<string, any>
): Promise<boolean> {
    const db = getDatabase();
    const rowId = remote[config.primaryKey];

    // A local edit still waiting to be pushed wins this round — don't clobber it. Push will send it up; a later pull reconciles by updated_at.
    const pending = await db.getFirstAsync<{ one: number }>(
    `SELECT 1 AS one FROM SyncLog WHERE table_name = ? AND row_id = ? AND synced = 0 LIMIT 1`,
    [table, rowId]
    );
    if (pending) return false;

    // Last-write-wins: skip if the local copy is the same age or newer.
    const local = await config.readLocalRow(rowId);
    if (local && config.pull) {
    const col = config.pull.watermarkColumn;
    if (String(local[col]) >= String(remote[col])) return false;
    }
    return true;
}

// Pulls one table's changes since its watermark.
async function pullTable(
    table: SyncableTable,
    patientId?: string
): Promise<PullSummary> {
    const config = syncTableConfig[table];
    if (!config.pull) return { pulled: 0, skipped: 0 };

    const since = await getWatermark(table);

    let query = supabase
    .from(config.supabaseTable)
    .select('*')
    .gt(config.pull.watermarkColumn, since)
    .order(config.pull.watermarkColumn, { ascending: true });

    if (config.pull.scopeColumn && patientId) {
    query = query.eq(config.pull.scopeColumn, patientId);
    }

    const { data, error } = await query;
    if (error || !data) return { pulled: 0, skipped: 0 };

    let pulled = 0;
    let skipped = 0;
    let maxWatermark = since;

    for (const remote of data as Record<string, any>[]) {
    if (await shouldWrite(table, config, remote)) {
        await upsertLocalRow(config.supabaseTable, config.primaryKey, config.pull.fromSupabaseRow(remote));
        pulled++;
    } else {
        skipped++;
    }
    // Advance past every row we've seen, written or not, so it isn't refetched.
    const w = String(remote[config.pull.watermarkColumn]);
    if (w > maxWatermark) maxWatermark = w;
    }

    if (maxWatermark !== since) await setWatermark(table, maxWatermark);
    return { pulled, skipped };
}

// Public API
async function drainQueue(): Promise<SyncSummary> {
    // The local SQLite database may not have finished initializing yet (e.g. a reconnect event fires before DatabaseProvider has mounted). Treat this as "nothing to sync yet" rather than throwing.
    if (!isDatabaseReady()) {
    return { attempted: 0, succeeded: 0, failed: 0 };
    }

    const pendingRows = await getPendingSyncRows();

    let succeeded = 0;
    let failed = 0;

    for (const row of pendingRows) {
    const errorMessage = await pushRow(row);

    if (errorMessage) {
        await markFailed(row.sync_id, errorMessage);
        failed++;
    } else {
        await markSynced(row.sync_id);
        succeeded++;
    }
    }

    return { attempted: pendingRows.length, succeeded, failed };
}

// Pulls all pullable tables (Patient, then MemoryAsset) for one patient into local SQLite. Safe to call alongside drainQueue; run push first, then pull.
async function pullAll(patientId: string): Promise<PullSummary> {
    if (!isDatabaseReady()) {
    return { pulled: 0, skipped: 0 };
    }

    let pulled = 0;
    let skipped = 0;
    for (const table of PULL_ORDER) {
    const summary = await pullTable(table, patientId);
    pulled += summary.pulled;
    skipped += summary.skipped;
    }
    return { pulled, skipped };
}

// Returns true if there are any changes waiting to be synced.
async function hasPendingChanges(): Promise<boolean> {
    if (!isDatabaseReady()) {
    return false;
    }

    const db = getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM SyncLog WHERE synced = 0`
    );
    return (row?.count ?? 0) > 0;
}

export const SyncService = {
    drainQueue,
    pullAll,
    hasPendingChanges,
};