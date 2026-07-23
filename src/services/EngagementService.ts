import { getDatabase } from '@/database/local/db';
import type { MemoryAssetType } from '@/models/MemoryAsset';
import { localDayOf } from '@/utils/dates';
import { computeStreak } from '@/utils/streak';
import * as Crypto from 'expo-crypto';
import type { ServiceResult } from './MemoryAssetService';
import type { SyncableTable } from './syncTableConfig';

// Patient-facing engagement: recognition-moment log and streak reads. Offline-first: local SQLite only.

// One recognized enrolled asset from today, for the home screen's "Today's moments".
export interface RecognitionMoment {
    assetId: string;
    name: string;
    type: MemoryAssetType;
}

async function queueSync(
    tableName: SyncableTable,
    rowId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
): Promise<void> {
    const db = getDatabase();
    await db.runAsync(
        `INSERT OR REPLACE INTO SyncLog (sync_id, table_name, row_id, operation, synced, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now'))`,
        [Crypto.randomUUID(), tableName, rowId, operation]
    );
}

// In-memory de-dupe so the ~2Hz AR loop costs zero DB work after an asset's first hit today.
let seenCache = new Set<string>();
let seenCacheDay = '';

// Logs one recognition per asset per local day. The UNIQUE constraint is the durable guard; never throws.
async function recordRecognitionEvent(patientId: string, assetId: string): Promise<void> {
    try {
        const now = new Date();
        const eventDate = localDayOf(now);
        if (seenCacheDay !== eventDate) {
            seenCache = new Set<string>();
            seenCacheDay = eventDate;
        }
        const key = `${assetId}:${eventDate}`;
        if (seenCache.has(key)) return;
        seenCache.add(key);

        const db = getDatabase();
        const recognitionId = Crypto.randomUUID();
        const result = await db.runAsync(
            `INSERT OR IGNORE INTO RecognitionEvent (recognition_id, patient_id, asset_id, event_date, event_time)
            VALUES (?, ?, ?, ?, ?)`,
            [recognitionId, patientId, assetId, eventDate, now.toISOString()]
        );
        if (result.changes > 0) {
            await queueSync('RecognitionEvent', recognitionId, 'INSERT');
        }
    } catch {
        // Best-effort telemetry: a failed write must never disturb the AR loop.
    }
}

// Today's recognized assets, oldest first, with names for display.
async function getTodaysRecognitions(
    patientId: string
): Promise<ServiceResult<RecognitionMoment[]>> {
    const db = getDatabase();
    try {
        const rows = await db.getAllAsync<{ asset_id: string; name: string; type: MemoryAssetType }>(
            `SELECT re.asset_id, ma.name, ma.type FROM RecognitionEvent re
            JOIN MemoryAsset ma ON ma.asset_id = re.asset_id
            WHERE re.patient_id = ? AND re.event_date = ?
            ORDER BY re.event_time ASC`,
            [patientId, localDayOf(new Date())]
        );
        return {
            data: rows.map((r) => ({ assetId: r.asset_id, name: r.name, type: r.type })),
            error: null,
        };
    } catch {
        return { data: null, error: "Failed to load today's moments." };
    }
}

// Consecutive-day training streak. Any answered question counts; local TrainingSession has no patient_id, so join through MemoryAsset.
async function getTrainingStreak(patientId: string): Promise<ServiceResult<number>> {
    const db = getDatabase();
    try {
        const rows = await db.getAllAsync<{ timestamp: string }>(
            `SELECT ts.timestamp FROM TrainingSession ts
            JOIN MemoryAsset ma ON ma.asset_id = ts.asset_id
            WHERE ma.patient_id = ?`,
            [patientId]
        );
        const days = rows.map((r) => localDayOf(r.timestamp));
        return { data: computeStreak(days, localDayOf(new Date())), error: null };
    } catch {
        return { data: null, error: 'Failed to load streak.' };
    }
}

export const EngagementService = {
    getTrainingStreak,
    recordRecognitionEvent,
    getTodaysRecognitions,
};
