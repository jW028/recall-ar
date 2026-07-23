// expo-sqlite provider & migration runner

import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { Suspense, useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MIGRATION_V2_DEVICE_PAIRING } from './migrations/v2_device_pairing';
import { MIGRATION_V3_ASSET_PHOTO_POOL } from './migrations/v3_asset_photo_pool';
import { MIGRATION_V4_SYNC_STATE } from './migrations/v4_sync_state';
import { MIGRATION_V5_TRAINING_LATENCY } from './migrations/v5_training_latency';
import { MIGRATION_V6_UPDATE_THREAT } from './migrations/v6_update_threat';
import { MIGRATION_V7_ASSET_PAUSE } from './migrations/v7_asset_pause';
import { MIGRATION_V8_EMBEDDING_MODEL } from './migrations/v8_embedding_model';
import { MIGRATION_V9_RECOGNITION_EVENT } from './migrations/v9_recognition_event';
import { MIGRATION_V10_ENCOURAGEMENT } from './migrations/v10_encouragement';
import { MIGRATION_V11_PATIENT_PROFILE_PICTURE } from './migrations/v11_patient_profile_picture';
import { CREATE_TABLES } from './schema';

const DATABASE_NAME = 'recallar.db';

// Bump this number when a new migration is added in the MIGRATIONS array
const LATEST_VERSION = 11;


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
]

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
                await db.execAsync(migration.sql);
            }
        }
        await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
    });
    console.log(`[DB] Migration complete. Current schema: v${LATEST_VERSION}`);
}

// Defensive backfill for column drift: some dev DBs reached user_version 5 before the response_latency_ms ALTER was wired into v5, so the migration was skipped and the column is missing. Add it if absent — idempotent and safe on healthy DBs.
async function ensureColumns(db: SQLiteDatabase): Promise<void> {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(TrainingSession)`);
    if (!cols.some((c) => c.name === 'response_latency_ms')) {
        console.log('[DB] Backfilling missing column TrainingSession.response_latency_ms');
        await db.execAsync(`ALTER TABLE TrainingSession ADD COLUMN response_latency_ms INTEGER;`);
    }

    // paused_from is added in v7; backfill the column on DBs that reached v7 before it was wired in.
    const assetCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(MemoryAsset)`);
    if (!assetCols.some((c) => c.name === 'paused_from')) {
        console.log('[DB] Backfilling missing column MemoryAsset.paused_from');
        await db.execAsync(`ALTER TABLE MemoryAsset ADD COLUMN paused_from TEXT;`);
    }

    // embedding_model is added in v8; backfill on DBs that reached v8 before it was wired in.
    if (!assetCols.some((c) => c.name === 'embedding_model')) {
        console.log('[DB] Backfilling missing column MemoryAsset.embedding_model');
        await db.execAsync(`ALTER TABLE MemoryAsset ADD COLUMN embedding_model TEXT;`);
    }

    // image_url is added in v11; backfill on DBs that reached v11 before it was wired in.
    const patientCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(Patient)`);
    if (!patientCols.some((c) => c.name === 'image_url')) {
        console.log('[DB] Backfilling missing column Patient.image_url');
        await db.execAsync(`ALTER TABLE Patient ADD COLUMN image_url TEXT;`);
    }
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


