import { getDatabase } from '@/database/local/db';
import type { Encouragement } from '@/models/Encouragement';
import * as Crypto from 'expo-crypto';
import type { ServiceResult } from './MemoryAssetService';
import { SyncService } from './SyncService';
import type { SyncableTable } from './syncTableConfig';

// Caregiver-to-patient encouragements. Caregiver side writes + pushes; patient side reads pulled rows and acks.

interface EncouragementRow {
    encouragement_id: string;
    patient_id: string;
    caregiver_id: string;
    message: string;
    emoji: string | null;
    created_at: string;
    ack_time: string | null;
    updated_at: string;
}

function toModel(row: EncouragementRow): Encouragement {
    return {
        encouragementId: row.encouragement_id,
        patientId: row.patient_id,
        caregiverId: row.caregiver_id,
        message: row.message,
        emoji: row.emoji,
        createdAt: row.created_at,
        ackTime: row.ack_time,
        updatedAt: row.updated_at,
    };
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

// Caregiver side: record the message locally, queue it, and try to push right away so it lands within one pull cycle.
async function send(params: {
    patientId: string;
    caregiverId: string;
    message: string;
    emoji?: string;
}): Promise<ServiceResult<Encouragement>> {
    const db = getDatabase();
    const now = new Date().toISOString();
    const encouragementId = Crypto.randomUUID();
    try {
        await db.runAsync(
            `INSERT INTO Encouragement
                (encouragement_id, patient_id, caregiver_id, message, emoji, created_at, ack_time, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
            [encouragementId, params.patientId, params.caregiverId, params.message, params.emoji ?? null, now, now]
        );
        await queueSync('Encouragement', encouragementId, 'INSERT');
    } catch {
        return { data: null, error: 'Failed to send the message. Please try again.' };
    }

    // Best-effort immediate push; offline sends deliver on the next drain.
    await SyncService.drainQueue().catch(() => {});

    return {
        data: {
            encouragementId,
            patientId: params.patientId,
            caregiverId: params.caregiverId,
            message: params.message,
            emoji: params.emoji ?? null,
            createdAt: now,
            ackTime: null,
            updatedAt: now,
        },
        error: null,
    };
}

// Patient side: unacknowledged messages, newest first.
async function getPending(patientId: string): Promise<ServiceResult<Encouragement[]>> {
    const db = getDatabase();
    try {
        const rows = await db.getAllAsync<EncouragementRow>(
            `SELECT * FROM Encouragement
            WHERE patient_id = ? AND ack_time IS NULL
            ORDER BY created_at DESC`,
            [patientId]
        );
        return { data: rows.map(toModel), error: null };
    } catch {
        return { data: null, error: 'Failed to load messages.' };
    }
}

// Patient side: one dismissal acks every pending message so a backlog never stacks up.
async function acknowledgeAll(patientId: string): Promise<ServiceResult<void>> {
    const db = getDatabase();
    const now = new Date().toISOString();
    try {
        const pending = await db.getAllAsync<{ encouragement_id: string }>(
            `SELECT encouragement_id FROM Encouragement WHERE patient_id = ? AND ack_time IS NULL`,
            [patientId]
        );
        if (pending.length === 0) return { data: null, error: null };

        await db.withExclusiveTransactionAsync(async () => {
            await db.runAsync(
                `UPDATE Encouragement SET ack_time = ?, updated_at = ?
                WHERE patient_id = ? AND ack_time IS NULL`,
                [now, now, patientId]
            );
        });
        for (const row of pending) {
            await queueSync('Encouragement', row.encouragement_id, 'UPDATE');
        }
        return { data: null, error: null };
    } catch {
        return { data: null, error: 'Failed to dismiss the message.' };
    }
}

export const EncouragementService = {
    send,
    getPending,
    acknowledgeAll,
};
