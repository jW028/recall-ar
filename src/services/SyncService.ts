import { getDatabase, isDatabaseReady } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import { isOnline, isTransientNetworkError } from '@/utils/connectivity';
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
const PULL_ORDER: SyncableTable[] = ['Patient', 'MemoryAsset', 'Encouragement', 'ContextAlert'];

// The patient-scoped subset of PULL_ORDER. A caregiver device pulls Patient by caregiver_id first, then walks these per patient.
const PATIENT_SCOPED_PULL_ORDER: SyncableTable[] = ['MemoryAsset', 'Encouragement'];

const EPOCH = '1970-01-01T00:00:00.000Z';

// Tracks whether sync is currently stalled on connectivity, so an offline episode logs one line on the way in and one on the way out instead of a fresh line per queued row per 30s cycle.
let pausedForNetwork = false;

// Identifies the rows one pull is allowed to see. Patient is scoped by caregiver_id on a caregiver device and by patient_id on a patient device; every child table is scoped by patient_id.
interface PullScope {
    column: string;
    value: string;
}

// Three different timestamp shapes reach the watermark comparison: local writes use ISO-8601 ("...Z"), Postgres returns an offset form ("...+00:00"), and SQLite column defaults use datetime('now') ("YYYY-MM-DD HH:MM:SS"). Comparing those lexically is wrong, so everything is normalised to ISO-8601 UTC first.
function toIsoUtc(value: unknown): string {
    if (value == null) return EPOCH;

    const raw = String(value).trim();
    if (!raw) return EPOCH;

    // datetime('now') separates date and time with a space rather than the ISO 'T'.
    let candidate = raw.includes('T') ? raw : raw.replace(' ', 'T');

    // Without an explicit zone, Date.parse reads a date-time as device-local. Every timestamp stored by this app is UTC, so say so.
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(candidate)) candidate += 'Z';

    const parsed = Date.parse(candidate);
    return Number.isNaN(parsed) ? EPOCH : new Date(parsed).toISOString();
}

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

    const remotePk = config.remotePrimaryKey || config.primaryKey;

    try {
        if (row.operation === 'DELETE') {
            const { error } = await supabase
                .from(config.supabaseTable)
                .delete()
                .eq(remotePk, row.row_id);
            if (error) {
                if (!isTransientNetworkError(error.message)) {
                    console.error(`[SyncService] DELETE error on ${row.table_name}:`, error.message, error);
                }
                return error.message;
            }
            return null;
        }

        // INSERT and UPDATE both resolve to an upsert — this keeps the local and remote sides eventually consistent even if a row was modified twice locally before syncing (only the latest local state is pushed).
        const localRow = await config.readLocalRow(row.row_id);
        if (!localRow) {
            // Row no longer exists locally (e.g. deleted right after an update was queued) — nothing to push, treat as success.
            return null;
        }

        const supabaseRow = config.toSupabaseRow(localRow);
        const { error } = await supabase
            .from(config.supabaseTable)
            .upsert(supabaseRow, { onConflict: remotePk });

        if (error) {
            if (!isTransientNetworkError(error.message)) {
                console.error(`[SyncService] UPSERT error on ${row.table_name} (${row.row_id}):`, error.message, error);
            }
            return error.message;
        }

        console.log(`[SyncService] Successfully pushed ${row.table_name} (${row.row_id}) to Supabase`);
        return null;
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown sync error';
        if (!isTransientNetworkError(msg)) {
            console.error(`[SyncService] Exception pushing ${row.table_name}:`, msg, e);
        }
        return msg;
    }
}

// Pull helpers

// Watermarks are per (table, scope) — a caregiver with two patients must not let one patient's pull advance the other's high-water mark past its unseen rows.
async function getWatermark(table: SyncableTable, scopeKey: string): Promise<string> {
    const db = getDatabase();
    const row = await db.getFirstAsync<{ last_pulled_at: string }>(
        `SELECT last_pulled_at FROM SyncState WHERE table_name = ? AND scope_key = ?`,
        [table, scopeKey]
    );
    return row?.last_pulled_at ?? EPOCH;
}

async function setWatermark(
    table: SyncableTable,
    scopeKey: string,
    value: string
): Promise<void> {
    const db = getDatabase();
    await db.runAsync(
        `INSERT INTO SyncState (table_name, scope_key, last_pulled_at) VALUES (?, ?, ?)
        ON CONFLICT(table_name, scope_key) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
        [table, scopeKey, value]
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
    const localMapped = config.pull?.fromSupabaseRow(remote) ?? remote;
    const rowId = localMapped[config.primaryKey] as string;

    // A local edit still waiting to be pushed wins this round — don't clobber it. Push will send it up; a later pull reconciles by updated_at.
    const pending = await db.getFirstAsync<{ one: number }>(
        `SELECT 1 AS one FROM SyncLog WHERE table_name = ? AND row_id = ? AND synced = 0 LIMIT 1`,
        [table, rowId]
    );
    if (pending) return false;

    // Last-write-wins: skip if the local copy is the same age or newer. Both sides are normalised first — the local copy and the remote row store the same instant in different formats.
    const local = await config.readLocalRow(rowId);
    if (local && config.pull) {
        const col = config.pull.watermarkColumn;
        if (String(local[col]) >= String(remote[col])) return false;
    }
    return true;
}

// Pulls one table's changes since its watermark, restricted to the given scope.
async function pullTable(
    table: SyncableTable,
    scope: PullScope
): Promise<PullSummary> {
    const config = syncTableConfig[table];
    if (!config.pull) return { pulled: 0, skipped: 0 };

    const since = await getWatermark(table, scope.value);

    const { data, error } = await supabase
        .from(config.supabaseTable)
        .select('*')
        .eq(scope.column, scope.value)
        .gt(config.pull.watermarkColumn, since)
        .order(config.pull.watermarkColumn, { ascending: true });

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
        const w = toIsoUtc(remote[config.pull.watermarkColumn]);
        if (w > maxWatermark) maxWatermark = w;
    }

    if (maxWatermark !== since) await setWatermark(table, scope.value, maxWatermark);
    return { pulled, skipped };
}

// Logs the offline transition once per episode. Without this the 30s poll plus the handful of screens that drain on refresh would each re-log the same failure, which in dev keeps re-raising a LogBox entry the moment it is dismissed.
function reportPaused(queued: number): void {
    if (pausedForNetwork) return;
    pausedForNetwork = true;
    console.log(`[SyncService] Offline — push paused with ${queued} change(s) queued. They will be retried automatically.`);
}

function reportResumed(): void {
    if (!pausedForNetwork) return;
    pausedForNetwork = false;
    console.log('[SyncService] Back online — resuming push of queued changes.');
}

// Public API
async function drainQueue(): Promise<SyncSummary> {
    // The local SQLite database may not have finished initializing yet (e.g. a reconnect event fires before DatabaseProvider has mounted). Treat this as "nothing to sync yet" rather than throwing.
    if (!isDatabaseReady()) {
        return { attempted: 0, succeeded: 0, failed: 0 };
    }

    const pendingRows = await getPendingSyncRows();

    // Nothing here can succeed without a connection, and every attempt would be a doomed request. The queue is durable, so leaving the rows pending costs nothing and the next cycle picks them up.
    if (pendingRows.length > 0 && !isOnline()) {
        reportPaused(pendingRows.length);
        return { attempted: 0, succeeded: 0, failed: 0 };
    }

    let attempted = 0;
    let succeeded = 0;
    let failed = 0;
    let hitTransient = false;

    for (const row of pendingRows) {
        attempted++;
        const errorMessage = await pushRow(row);

        if (errorMessage) {
            await markFailed(row.sync_id, errorMessage);
            failed++;

            // The connection dropped mid-cycle. Every remaining row would fail identically, so stop rather than firing one more doomed request per queued change; they stay pending for the next cycle.
            if (isTransientNetworkError(errorMessage)) {
                hitTransient = true;
                reportPaused(pendingRows.length - succeeded);
                break;
            }
        } else {
            await markSynced(row.sync_id);
            succeeded++;
        }
    }

    // Clears the paused state on the first clean cycle, including an empty one — otherwise an episode that ends while the queue happens to be empty would leave it latched and swallow the next pause log.
    if (!hitTransient && isOnline()) reportResumed();

    return { attempted, succeeded, failed };
}

// Pulls all pullable tables for one patient into local SQLite. This is the patient-device entry point. Safe to call alongside drainQueue; run push first, then pull.
async function pullAll(patientId: string): Promise<PullSummary> {
    if (!isDatabaseReady() || !isOnline()) {
        return { pulled: 0, skipped: 0 };
    }

    let pulled = 0;
    let skipped = 0;
    for (const table of PULL_ORDER) {
        const scopeColumn = syncTableConfig[table].pull?.scopeColumn;
        if (!scopeColumn) continue;
        const summary = await pullTable(table, { column: scopeColumn, value: patientId });
        pulled += summary.pulled;
        skipped += summary.skipped;
    }
    return { pulled, skipped };
}

// Pulls everything a caregiver device needs. Patient is fetched by caregiver_id because on a fresh device there is no local Patient row to derive a patient_id from; only once those land can the per-patient children be scoped. Without this, a caregiver device pushed its queue up and never pulled anything back down.
async function pullAllForCaregiver(caregiverId: string): Promise<PullSummary> {
    if (!isDatabaseReady() || !isOnline()) {
        return { pulled: 0, skipped: 0 };
    }

    const patientSummary = await pullTable('Patient', {
        column: 'caregiver_id',
        value: caregiverId,
    });

    let pulled = patientSummary.pulled;
    let skipped = patientSummary.skipped;

    const db = getDatabase();
    const patients = await db.getAllAsync<{ patient_id: string }>(
        `SELECT patient_id FROM Patient WHERE caregiver_id = ?`,
        [caregiverId]
    );

    for (const { patient_id } of patients) {
        for (const table of PATIENT_SCOPED_PULL_ORDER) {
            const scopeColumn = syncTableConfig[table].pull?.scopeColumn;
            if (!scopeColumn) continue;
            const summary = await pullTable(table, { column: scopeColumn, value: patient_id });
            pulled += summary.pulled;
            skipped += summary.skipped;
        }
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

// Clears all entries from local SyncLog queue
async function clearSyncQueue(): Promise<void> {
    if (!isDatabaseReady()) {
        return;
    }
    const db = getDatabase();
    await db.runAsync(`DELETE FROM SyncLog`);
}

export const SyncService = {
    drainQueue,
    pullAll,
    pullAllForCaregiver,
    hasPendingChanges,
    clearSyncQueue,
};