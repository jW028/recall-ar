// expo-sqlite provider & migration runner

import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { Suspense, type ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { CREATE_TABLES } from './schema';

const DATABASE_NAME = 'recallar.db';

// Bump this number when a new migration is added in the MIGRATIONS array
const LATEST_VERSION = 1;


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
    // Example of future migrations
      // {
    //   version: 2,
    //   description: 'Add mastery_streak column to MemoryAsset',
    //   sql: `ALTER TABLE MemoryAsset ADD COLUMN mastery_streak INTEGER NOT NULL DEFAULT 0;`,
    // },
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

export function DatabaseProvider({ children }: DatabaseProviderProps) {
    return (
        <Suspense fallback={<DatabaseLoadingFallback />}>
            <SQLiteProvider
                databaseName={DATABASE_NAME}
                onInit={runMigrations}
                useSuspense
        >
            {children}
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


