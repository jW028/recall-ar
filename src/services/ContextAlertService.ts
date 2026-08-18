import { getDatabase } from '@/database/local/db';
import {
    isTimeMatching,
    shouldResetAlertForFrequency,
    type ContextAlert,
    type CreateContextAlertParams,
    type UpdateContextAlertParams,
} from '@/models/ContextAlert';
import * as Crypto from 'expo-crypto';

export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

function mapRowToContextAlert(row: Record<string, unknown>): ContextAlert {
    return {
        ctxAlertId: row.ctxAlert_id as string,
        patientId: row.patient_id as string,
        assetId: (row.asset_id as string) || null,
        ctxAlertMsg: row.ctxAlert_msg as string,
        ctxAlertDesc: (row.ctxAlert_desc as string) || null,
        ctxAlertType: (row.ctxAlert_type as ContextAlert['ctxAlertType']) || 'Reminder',
        ctxAlertStatus: row.ctxAlert_status as ContextAlert['ctxAlertStatus'],
        ctxAlertTime: row.ctxAlert_time as string,
        ackTime: (row.ack_time as string) || null,
        ackStatus: row.ack_status as ContextAlert['ackStatus'],
        frequency: row.frequency as ContextAlert['frequency'],
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

async function createContextAlert(
    params: CreateContextAlertParams
): Promise<ServiceResult<ContextAlert>> {
    const db = getDatabase();
    const ctxAlertId = Crypto.randomUUID();
    const frequency = params.frequency || 'Daily';
    const type = params.ctxAlertType || 'Reminder';
    const desc = params.ctxAlertDesc || null;
    const status = 'Active';
    const ackStatus = 'Unacknowledged';

    try {
        await db.runAsync(
            `INSERT INTO ContextAlert (
                ctxAlert_id, patient_id, asset_id, ctxAlert_msg, ctxAlert_desc, ctxAlert_type, ctxAlert_status, ctxAlert_time, ack_time, ack_status, frequency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
            [
                ctxAlertId,
                params.patientId,
                params.assetId || null,
                params.ctxAlertMsg,
                desc,
                type,
                status,
                params.ctxAlertTime,
                ackStatus,
                frequency,
            ]
        );
    } catch (e) {
        console.error('[ContextAlertService] Error creating context alert', e);
        return { data: null, error: 'Failed to create contextual alert.' };
    }

    await queueSync('ContextAlert', ctxAlertId, 'INSERT');

    const alert: ContextAlert = {
        ctxAlertId,
        patientId: params.patientId,
        assetId: params.assetId || null,
        ctxAlertMsg: params.ctxAlertMsg,
        ctxAlertDesc: desc,
        ctxAlertType: type,
        ctxAlertStatus: status,
        ctxAlertTime: params.ctxAlertTime,
        ackTime: null,
        ackStatus,
        frequency,
    };

    return { data: alert, error: null };
}

async function getContextAlertsForPatient(
    patientId: string,
    now: Date = new Date()
): Promise<ServiceResult<ContextAlert[]>> {
    const db = getDatabase();

    try {
        const rows = await db.getAllAsync<Record<string, unknown>>(
            `SELECT * FROM ContextAlert WHERE patient_id = ? ORDER BY ctxAlert_time ASC`,
            [patientId]
        );
        const alerts = rows.map(mapRowToContextAlert);

        for (const alert of alerts) {
            if (shouldResetAlertForFrequency(alert, now)) {
                alert.ackStatus = 'Unacknowledged';
                alert.ctxAlertStatus = 'Active';
                alert.ackTime = null;

                await db.runAsync(
                    `UPDATE ContextAlert SET ack_status = 'Unacknowledged', ctxAlert_status = 'Active', ack_time = NULL WHERE ctxAlert_id = ?`,
                    [alert.ctxAlertId]
                );
                await queueSync('ContextAlert', alert.ctxAlertId, 'UPDATE');
            }
        }

        return { data: alerts, error: null };
    } catch (e) {
        console.error('[ContextAlertService] Error reading context alerts', e);
        return { data: null, error: 'Failed to load contextual alerts.' };
    }
}

async function updateContextAlert(
    alertId: string,
    updates: UpdateContextAlertParams
): Promise<ServiceResult<ContextAlert>> {
    const db = getDatabase();

    try {
        const existing = await db.getFirstAsync<Record<string, unknown>>(
            `SELECT * FROM ContextAlert WHERE ctxAlert_id = ?`,
            [alertId]
        );

        if (!existing) {
            return { data: null, error: 'Context alert not found.' };
        }

        const msg = updates.ctxAlertMsg ?? (existing.ctxAlert_msg as string);
        const desc = updates.ctxAlertDesc !== undefined ? updates.ctxAlertDesc : (existing.ctxAlert_desc as string | null);
        const type = updates.ctxAlertType ?? (existing.ctxAlert_type as ContextAlert['ctxAlertType']) ?? 'Reminder';
        const time = updates.ctxAlertTime ?? (existing.ctxAlert_time as string);
        const assetId = updates.assetId !== undefined ? (updates.assetId || null) : (existing.asset_id as string | null);
        const freq = updates.frequency ?? (existing.frequency as ContextAlert['frequency']);
        const status = updates.ctxAlertStatus ?? (existing.ctxAlert_status as ContextAlert['ctxAlertStatus']);
        const ackStatus = updates.ackStatus ?? (existing.ack_status as ContextAlert['ackStatus']);
        const ackTime = updates.ackTime !== undefined ? updates.ackTime : (existing.ack_time as string | null);

        await db.runAsync(
            `UPDATE ContextAlert SET
                ctxAlert_msg = ?, ctxAlert_desc = ?, ctxAlert_type = ?, ctxAlert_time = ?, asset_id = ?, frequency = ?, ctxAlert_status = ?, ack_status = ?, ack_time = ?
            WHERE ctxAlert_id = ?`,
            [msg, desc, type, time, assetId, freq, status, ackStatus, ackTime, alertId]
        );

        await queueSync('ContextAlert', alertId, 'UPDATE');

        const updated: ContextAlert = {
            ctxAlertId: alertId,
            patientId: existing.patient_id as string,
            assetId,
            ctxAlertMsg: msg,
            ctxAlertDesc: desc,
            ctxAlertType: type,
            ctxAlertStatus: status,
            ctxAlertTime: time,
            ackTime,
            ackStatus,
            frequency: freq,
        };

        return { data: updated, error: null };
    } catch (e) {
        console.error('[ContextAlertService] Error updating context alert', e);
        return { data: null, error: 'Failed to update contextual alert.' };
    }
}

async function deleteContextAlert(alertId: string): Promise<ServiceResult> {
    const db = getDatabase();

    try {
        await db.runAsync(`DELETE FROM ContextAlert WHERE ctxAlert_id = ?`, [alertId]);
        await queueSync('ContextAlert', alertId, 'DELETE');
        return { data: null, error: null };
    } catch (e) {
        console.error('[ContextAlertService] Error deleting context alert', e);
        return { data: null, error: 'Failed to delete contextual alert.' };
    }
}

async function acknowledgeContextAlert(alertId: string): Promise<ServiceResult<ContextAlert>> {
    const now = new Date().toISOString();
    return updateContextAlert(alertId, {
        ackStatus: 'Acknowledged',
        ackTime: now,
        ctxAlertStatus: 'Acknowledged',
    });
}

/**
 * Evaluates active contextual alerts for a patient against current time and detected object ID.
 */
async function evaluateContextAlerts(
    patientId: string,
    detectedAssetId?: string | null,
    now: Date = new Date(),
    timeWindowMinutes: number = 30
): Promise<ServiceResult<ContextAlert[]>> {
    const { data: alerts, error } = await getContextAlertsForPatient(patientId, now);

    if (error || !alerts) {
        return { data: [], error: error || 'Failed to fetch contextual alerts' };
    }

    const matchedAlerts: ContextAlert[] = [];

    for (const alert of alerts) {
        // Skip dismissed or already acknowledged alerts
        if (alert.ctxAlertStatus === 'Dismissed') continue;
        if (alert.ackStatus === 'Acknowledged') continue;

        // 1. Evaluate Time Condition
        const timeMatches = isTimeMatching(alert.ctxAlertTime, now, timeWindowMinutes);

        // 2. Evaluate Object Condition
        // If assetId is configured, it MUST match detectedAssetId.
        // If assetId is null/undefined, it matches any detected object (or any time trigger).
        let objectMatches = true;
        if (alert.assetId) {
            objectMatches = detectedAssetId != null && alert.assetId === detectedAssetId;
        }

        if (timeMatches && objectMatches) {
            matchedAlerts.push(alert);
        }
    }

    return { data: matchedAlerts, error: null };
}

export const ContextAlertService = {
    createContextAlert,
    getContextAlertsForPatient,
    updateContextAlert,
    deleteContextAlert,
    acknowledgeContextAlert,
    evaluateContextAlerts,
};
