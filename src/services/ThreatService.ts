import { getDatabase } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import type { Threat } from '@/models/Threat';
import * as Crypto from 'expo-crypto';


// Types
export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

export interface CreateThreatParams {
    patientId: string;
    threatType: string;
    threatStatus: string;
    alertStatus: string;
}

// Helpers

function mapRowToThreat(row: Record<string, unknown>): Threat {
    return {
        threatId: row.threat_id as string,
        patientId: row.patient_id as string,
        threatType: row.threat_type as string,
        detectedTime: row.detected_time as string,
        threatStatus: row.threat_status as string,
        alertStatus: row.alert_status as string,
        alertTime: row.alert_time as string,
        acknowledgedTime: row.acknowledged_time as string | null,
    };
}

async function queueSync(
    tableName: string,
    rowId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
): Promise<void> {
    const db = getDatabase();
    const syncId = Crypto.randomUUID();

    await db.runAsync(
        `INSERT OR REPLACE INTO SyncLog
        (sync_id, table_name, row_id, operation, synced, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now'))`,
        [syncId, tableName, rowId, operation]
    );
}

// CRUD
async function createThreat(
    params: CreateThreatParams
): Promise<ServiceResult<Threat>> {
    const db = getDatabase();
    const threatId = Crypto.randomUUID();
    const now = new Date().toISOString();

    try {
        await db.runAsync(
            `INSERT INTO Threat (threat_id, patient_id, threat_type, detected_time, threat_status, alert_status, alert_time, acknowledged_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                threatId,
                params.patientId,
                params.threatType,
                now,
                params.threatStatus,
                params.alertStatus,
                now,
            ]
        );
    } catch {
        return { data: null, error: 'Failed to save threat. Please try again.' };
    }

    await queueSync('Threat', threatId, 'INSERT');

    const threat: Threat = {
        threatId,
        patientId: params.patientId,
        threatType: params.threatType,
        detectedTime: now,
        threatStatus: params.threatStatus,
        alertStatus: params.alertStatus,
        alertTime: now,
        acknowledgedTime: null,
    };

    return { data: threat, error: null };
}


async function getThreatsByPatient(
    patientId: string
): Promise<ServiceResult<Threat[]>> {
    const db = getDatabase();

    try {
        const rows = await db.getAllAsync<Record<string, unknown>>(
            `SELECT * FROM Threat WHERE patient_id = ? ORDER BY detected_time DESC`,
            [patientId]
        );
        return { data: rows.map(mapRowToThreat), error: null };
    } catch {
        return { data: null, error: 'Failed to load threats.' };
    }
}

async function acknowledgeThreat(threatId: string): Promise<ServiceResult> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
        await db.runAsync(
            `UPDATE Threat SET acknowledged_time = ?, alert_status = 'Acknowledged' WHERE threat_id = ?`,
            [now, threatId]
        );
    } catch {
        return { data: null, error: 'Failed to acknowledge threat.' };
    }

    await queueSync('Threat', threatId, 'UPDATE');
    return { data: null, error: null };
}

async function resolveThreat(threatId: string): Promise<ServiceResult> {
    const db = getDatabase();
    const now = new Date().toISOString();

    try {
        await db.runAsync(
            `UPDATE Threat SET alert_status = 'Resolved', acknowledged_time = coalesce(acknowledged_time, ?) WHERE threat_id = ?`,
            [now, threatId]
        );
    } catch {
        return { data: null, error: 'Failed to resolve threat.' };
    }

    await queueSync('Threat', threatId, 'UPDATE');
    return { data: null, error: null };
}




async function pullThreatsFromCloud(
    patientId: string
): Promise<ServiceResult<number>> {
    const { data: rows, error: fetchError } = await supabase
        .from('Threat')
        .select('*')
        .eq('patient_id', patientId);

    if (fetchError) {
        return { data: null, error: 'Failed to sync threats from cloud.' };
    }

    const db = getDatabase();
    let count = 0;

    await db.withExclusiveTransactionAsync(async () => {
        for (const row of rows ?? []) {
            await db.runAsync(
                `INSERT OR REPLACE INTO Threat (threat_id, patient_id, threat_type, detected_time, threat_status, alert_status, alert_time, acknowledged_time)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    row.threat_id,
                    row.patient_id,
                    row.threat_type,
                    row.detected_time,
                    row.threat_status,
                    row.alert_status,
                    row.alert_time,
                    row.acknowledged_time,
                ]
            );
            count++;
        }
    });

    return { data: count, error: null };
}

async function clearAllLocalThreats(): Promise<ServiceResult> {
    const db = getDatabase();
    try {
        await db.runAsync('DELETE FROM Threat');
        await db.runAsync("DELETE FROM SyncLog WHERE table_name = 'Threat'");
        return { data: null, error: null };
    } catch {
        return { data: null, error: 'Failed to clear local threats.' };
    }
}

export const ThreatService = {
    createThreat,
    getThreatsByPatient,
    acknowledgeThreat,
    resolveThreat,
    pullThreatsFromCloud,
    clearAllLocalThreats,
};