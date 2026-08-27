// expo-sqlite provider & migration runner

import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { Suspense, useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MIGRATION_V10_ENCOURAGEMENT } from './migrations/v10_encouragement';
import { MIGRATION_V11_PATIENT_PROFILE_PICTURE } from './migrations/v11_patient_profile_picture';
import { MIGRATION_V12_SYNC_STATE_SCOPE } from './migrations/v12_sync_state_scope';
import { MIGRATION_V13_CONTEXT_ALERT_FIELDS } from './migrations/v13_context_alert_fields';
import { MIGRATION_V2_DEVICE_PAIRING } from './migrations/v2_device_pairing';
import { MIGRATION_V3_ASSET_PHOTO_POOL } from './migrations/v3_asset_photo_pool';
import { MIGRATION_V4_SYNC_STATE } from './migrations/v4_sync_state';
import { MIGRATION_V5_TRAINING_LATENCY } from './migrations/v5_training_latency';
import { MIGRATION_V6_UPDATE_THREAT } from './migrations/v6_update_threat';
import { MIGRATION_V7_ASSET_PAUSE } from './migrations/v7_asset_pause';
import { MIGRATION_V8_EMBEDDING_MODEL } from './migrations/v8_embedding_model';
import { MIGRATION_V9_RECOGNITION_EVENT } from './migrations/v9_recognition_event';
import { MIGRATION_V14_CAREGIVER_PROFILE_PICTURE } from './migrations/v14_caregiver_profile_picture';
import { MIGRATION_V15_CONTEXT_ALERT_NULLABLE_SCHEDULE } from './migrations/v15_context_alert_nullable_schedule';
import { CREATE_TABLES } from './schema';

const DATABASE_NAME = 'recallar.db';

// Bump this number when a new migration is added in the MIGRATIONS array
const LATEST_VERSION = 15;


interface Migration {
    version: number;
    description: string;
    sql: string;
}

const MIGRATIONS: Migration[] = [
    {
        version: 1,
        description: 'Initial schema',
        sql: CREATE_TABLES,
    },
    {
        version: 2,
        description: 'Add DevicePairing table',
        sql: MIGRATION_V2_DEVICE_PAIRING,
    },
    {
        version: 3,
        description: 'Add photo_urls pool column to MemoryAsset',
        sql: MIGRATION_V3_ASSET_PHOTO_POOL,
    },
    {
        version: 4,
        description: 'Add SyncState watermark table for pull sync',
        sql: MIGRATION_V4_SYNC_STATE,
    },
    {
        version: 5,
        description: 'Add response_latency_ms to TrainingSession',
        sql: MIGRATION_V5_TRAINING_LATENCY,
    },
    {
        version: 6,
        description: 'Remove geoEvent_id and track_id from Threat table',
        sql: MIGRATION_V6_UPDATE_THREAT,
    },
    {
        version: 7,
        description: "Allow 'Paused' status and add paused_from to MemoryAsset",
        sql: MIGRATION_V7_ASSET_PAUSE,
    },
    {
        version: 8,
        description: 'Add embedding_model to MemoryAsset',
        sql: MIGRATION_V8_EMBEDDING_MODEL,
    },
    {
        version: 9,
        description: 'Add RecognitionEvent table',
        sql: MIGRATION_V9_RECOGNITION_EVENT,
    },
    {
        version: 10,
        description: 'Add Encouragement table',
        sql: MIGRATION_V10_ENCOURAGEMENT,
    },
    {
        version: 11,
        description: 'Add image_url profile picture column to Patient',
        sql: MIGRATION_V11_PATIENT_PROFILE_PICTURE,
    },
    {
        version: 12,
        description: 'Key SyncState watermarks by pull scope',
        sql: MIGRATION_V12_SYNC_STATE_SCOPE,
    },
    {
        version: 13,
        description: 'Add ctxAlert_desc and ctxAlert_type columns to ContextAlert',
        sql: MIGRATION_V13_CONTEXT_ALERT_FIELDS,
    },
    {
        version: 14,
        description: 'Add image_url profile picture column to Caregiver',
        sql: MIGRATION_V14_CAREGIVER_PROFILE_PICTURE,
    },
    {
        version: 15,
        description: 'Allow nullable ctxAlert_time and frequency in ContextAlert',
        sql: MIGRATION_V15_CONTEXT_ALERT_NULLABLE_SCHEDULE,
    },
];

async function safeAddColumn(db: SQLiteDatabase, table: string, column: string, columnDef: string): Promise<void> {
    try {
        const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
        if (!cols.some((c) => c.name.toLowerCase() === column.toLowerCase())) {
            console.log(`[DB] Adding/backfilling column ${table}.${column}`);
            await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef};`);
        }
    } catch (e: any) {
        if (typeof e?.message === 'string' && e.message.includes('duplicate column name')) {
            return;
        }
        throw e;
    }
}

async function ensureContextAlertNullable(db: SQLiteDatabase): Promise<void> {
    try {
        const cols = await db.getAllAsync<{ name: string; notnull: number }>('PRAGMA table_info(ContextAlert)');
        if (cols.length === 0) return;

        const timeCol = cols.find((c) => c.name.toLowerCase() === 'ctxalert_time');
        const freqCol = cols.find((c) => c.name.toLowerCase() === 'frequency');

        if (timeCol?.notnull === 1 || freqCol?.notnull === 1) {
            console.log('[DB] Migrating ContextAlert schema to allow nullable time and frequency');
            const hasDesc = cols.some((c) => c.name.toLowerCase() === 'ctxalert_desc');
            const hasType = cols.some((c) => c.name.toLowerCase() === 'ctxalert_type');
            const descExpr = hasDesc ? 'ctxAlert_desc' : 'NULL';
            const typeExpr = hasType ? "COALESCE(ctxAlert_type, 'Reminder')" : "'Reminder'";

            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS ContextAlert_new (
                    ctxAlert_id       TEXT PRIMARY KEY NOT NULL,
                    patient_id        TEXT NOT NULL,
                    asset_id          TEXT,
                    ctxAlert_msg      TEXT NOT NULL,
                    ctxAlert_desc     TEXT,
                    ctxAlert_type     TEXT NOT NULL DEFAULT 'Reminder',
                    ctxAlert_status   TEXT NOT NULL,
                    ctxAlert_time     TEXT,
                    ack_time          TEXT,
                    ack_status        TEXT NOT NULL,
                    frequency         TEXT,
                    FOREIGN KEY (patient_id) REFERENCES Patient(patient_id) ON DELETE CASCADE,
                    FOREIGN KEY (asset_id)   REFERENCES MemoryAsset(asset_id) ON DELETE SET NULL
                );

                INSERT OR IGNORE INTO ContextAlert_new
                    (ctxAlert_id, patient_id, asset_id, ctxAlert_msg, ctxAlert_desc, ctxAlert_type, ctxAlert_status, ctxAlert_time, ack_time, ack_status, frequency)
                SELECT
                    ctxAlert_id,
                    patient_id,
                    asset_id,
                    ctxAlert_msg,
                    ${descExpr},
                    ${typeExpr},
                    ctxAlert_status,
                    ctxAlert_time,
                    ack_time,
                    ack_status,
                    frequency
                FROM ContextAlert;

                DROP TABLE ContextAlert;
                ALTER TABLE ContextAlert_new RENAME TO ContextAlert;
            `);
        }
    } catch (e) {
        console.warn('[DB] Failed to ensure ContextAlert nullable schema:', e);
    }
}

// Migration runner, called by SQLiteProvider's onInit
async function runMigrations(db: SQLiteDatabase): Promise<void> {
    const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const currentVersion = result?.user_version ?? 0;

    if (currentVersion >= LATEST_VERSION) {
        return; // database up to date
    }
    console.log(`[DB] Migrating from v${currentVersion} to v${LATEST_VERSION}`);

    // Run pending migrations in a single transaction
    await db.withExclusiveTransactionAsync(async () => {
        for (const migration of MIGRATIONS) {
            if (migration.version > currentVersion) {
                console.log(`[DB] Running migration v${migration.version}: ${migration.description}`);
                if (migration.version === 13) {
                    await safeAddColumn(db, 'ContextAlert', 'ctxAlert_desc', 'TEXT');
                    await safeAddColumn(db, 'ContextAlert', 'ctxAlert_type', "TEXT NOT NULL DEFAULT 'Reminder'");
                } else if (migration.version === 15) {
                    await ensureContextAlertNullable(db);
                } else {
                    await db.execAsync(migration.sql);
                }
            }
        }
        await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
    });
    console.log(`[DB] Migration complete. Current schema: v${LATEST_VERSION}`);
}

// Defensive backfill for column drift: ensures SyncState table has scope_key column regardless of PRAGMA user_version.
async function ensureSyncStateScope(db: SQLiteDatabase): Promise<void> {
    try {
        const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(SyncState)');
        if (cols.length === 0 || !cols.some((c) => c.name.toLowerCase() === 'scope_key')) {
            console.log('[DB] Upgrading SyncState schema to include scope_key');
            await db.execAsync(`
                DROP TABLE IF EXISTS SyncState;
                CREATE TABLE SyncState (
                    table_name      TEXT NOT NULL,
                    scope_key       TEXT NOT NULL DEFAULT '',
                    last_pulled_at  TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
                    PRIMARY KEY (table_name, scope_key)
                );
            `);
        }
    } catch (e) {
        console.warn('[DB] Failed to ensure SyncState scope:', e);
    }
}

// Defensive backfill for column drift: some dev DBs reached user_version 5 before the response_latency_ms ALTER was wired into v5, so the migration was skipped and the column is missing. Add it if absent — idempotent and safe on healthy DBs.
async function ensureColumns(db: SQLiteDatabase): Promise<void> {
    await ensureSyncStateScope(db);
    await safeAddColumn(db, 'TrainingSession', 'response_latency_ms', 'INTEGER');
    await safeAddColumn(db, 'MemoryAsset', 'paused_from', 'TEXT');
    await safeAddColumn(db, 'MemoryAsset', 'embedding_model', 'TEXT');
    await safeAddColumn(db, 'Patient', 'image_url', 'TEXT');
    await safeAddColumn(db, 'ContextAlert', 'ctxAlert_desc', 'TEXT');
    await safeAddColumn(db, 'ContextAlert', 'ctxAlert_type', "TEXT NOT NULL DEFAULT 'Reminder'");
    await ensureContextAlertNullable(db);
}

// onInit entry point: run versioned migrations, then reconcile any column drift.
async function initDatabase(db: SQLiteDatabase): Promise<void> {
    await runMigrations(db);
    await ensureColumns(db);
}

// DB initialization UI
function DatabaseLoadingFallback() {
    return (
        <View style={styles.fallback}>
            <ActivityIndicator size="large" />
            <Text style={styles.fallbackText}>Loading...</Text>
        </View>
    );
}
// DatabaseProvider
interface DatabaseProviderProps {
    children: ReactNode;
}

// Bridges the SQLite context into the module-level `_db` ref so that non-component code (services) can call getDatabase() outside of React. Rendered as a child of SQLiteProvider, so useSQLiteContext() is only reached once the database has finished initializing (post-Suspense).
function DatabaseRefBridge({ children }: { children: ReactNode }) {
    const db = useSQLiteContext();

    useEffect(() => {
        initDatabaseRef(db);
    }, [db]);

    return children;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
    return (
        <Suspense fallback={<DatabaseLoadingFallback />}>
            <SQLiteProvider
                databaseName={DATABASE_NAME}
                onInit={initDatabase}
                useSuspense
            >
                <DatabaseRefBridge>{children}</DatabaseRefBridge>
            </SQLiteProvider>
        </Suspense>
    );
}

export const useDatabase = useSQLiteContext;

let _db: SQLiteDatabase | null = null;

export async function initDatabaseRef(db: SQLiteDatabase): Promise<void> {
    _db = db;
}

export function getDatabase(): SQLiteDatabase {
    if (!_db) {
        throw new Error(
            `[DB] getDatabase() called before DatabaseProvider has mounted. Make sure DatabaseProvider wraps root layout.`
        );
    }
    return _db;
}

// Lets callers outside of React (e.g. services triggered by event listeners) check readiness before calling getDatabase(), instead of relying on a try/catch.
export function isDatabaseReady(): boolean {
    return _db !== null;
}

const styles = StyleSheet.create({
    fallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    fallbackText: {
        fontSize: 14,
        opacity: 0.5,
    }
});


