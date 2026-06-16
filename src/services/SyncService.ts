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

    // INSERT and UPDATE both resolve to an upsert — this keeps the local
    // and remote sides eventually consistent even if a row was modified
    // twice locally before syncing (only the latest local state is pushed).
    const localRow = await config.readLocalRow(row.row_id);
    if (!localRow) {
        // Row no longer exists locally (e.g. deleted right after an update
        // was queued) — nothing to push, treat as success.
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

// Public API
async function drainQueue(): Promise<SyncSummary> {
    // The local SQLite database may not have finished initializing yet
    // (e.g. a reconnect event fires before DatabaseProvider has mounted).
    // Treat this as "nothing to sync yet" rather than throwing.
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
    hasPendingChanges,
};