// expo-sqlite provider & migration runner

import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { Suspense, useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MIGRATION_V2_DEVICE_PAIRING } from './migrations/v2_device_pairing';
import { CREATE_TABLES } from './schema';

const DATABASE_NAME = 'recallar.db';

// Bump this number when a new migration is added in the MIGRATIONS array
const LATEST_VERSION = 2;


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

// Bridges the SQLite context into the module-level `_db` ref so that
// non-component code (services) can call getDatabase() outside of React.
// Rendered as a child of SQLiteProvider, so useSQLiteContext() is only
// reached once the database has finished initializing (post-Suspense).
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
                onInit={runMigrations}
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

// Lets callers outside of React (e.g. services triggered by event listeners)
// check readiness before calling getDatabase(), instead of relying on a try/catch.
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


