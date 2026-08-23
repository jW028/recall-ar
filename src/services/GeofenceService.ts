import { getDatabase } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import type { Geofence } from '@/models/Geofence';
import type { GeofenceEvent } from '@/models/GeofenceEvent';
import * as Crypto from 'expo-crypto';
import { SyncService } from './SyncService';

export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

export interface CreateGeofenceParams {
    patientId: string;
    centerLatitude: number;
    centerLongitude: number;
    radiusMeters: number;
    geofenceType: string;
}

export interface UpdateGeofenceParams {
    centerLatitude: number;
    centerLongitude: number;
    radiusMeters: number;
    geofenceType: string;
}

function mapRowToGeofence(row: Record<string, unknown>): Geofence {
    return {
        geofenceId: row.geofence_id as string,
        patientId: row.patient_id as string,
        centerLatitude: row.center_latitude as number,
        centerLongitude: row.center_longitude as number,
        radiusMeters: row.radius_meters as number,
        geofenceType: row.geofence_type as string,
    };
}

function mapRowToGeofenceEvent(row: Record<string, unknown>): GeofenceEvent {
    return {
        geoEventId: row.geoEvent_id as string,
        geofenceId: row.geofence_id as string,
        eventType: row.event_type as "Enter" | "Exit",
        eventTime: row.event_time as string,
    }
}

async function queueSync(
    tableName: string,
    rowId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
): Promise<void> {
    const db = getDatabase();
    const syncId = Crypto.randomUUID();
    await db.runAsync(
        `INSERT OR REPLACE INTO SyncLog (sync_id, table_name, row_id, operation, synced, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now'))`,
        [syncId, tableName, rowId, operation]
    );
}


// CRUD
async function createGeofence(
    params: CreateGeofenceParams
): Promise<ServiceResult<Geofence>> {
    if (!params.geofenceType.trim()) {
        return {data: null, error: 'Geofence type is required.'};
    };
    if (params.radiusMeters <= 0) {
        return {data: null, error: 'Radius must be greater than 0.'};
    };

    const db = getDatabase();
    const geofenceId = Crypto.randomUUID();

    try {
        await db.runAsync(
            `INSERT INTO Geofence (geofence_id, patient_id, center_latitude, center_longitude, radius_meters, geofence_type)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                geofenceId,
                params.patientId,
                params.centerLatitude,
                params.centerLongitude,
                params.radiusMeters,
                params.geofenceType.trim(),
            ]
        );
    } catch {
        return { data: null, error: 'Failed to save geofence. Please try again.' };
    }

    await queueSync('Geofence', geofenceId, 'INSERT');
    await SyncService.drainQueue().catch(() => {});
    
    const geofence: Geofence = {
        geofenceId,
        patientId: params.patientId,
        centerLatitude: params.centerLatitude,
        centerLongitude: params.centerLongitude,
        radiusMeters: params.radiusMeters,
        geofenceType: params.geofenceType.trim(),
    };

    return { data: geofence, error: null };
}

async function getGeofencesByPatient(
    patientId:string
): Promise<ServiceResult<Geofence[]>> {
    const db = getDatabase();

    try {
        const rows = await db.getAllAsync<Record<string, unknown>>(
            `SELECT * FROM Geofence WHERE patient_id = ?`, [patientId]
        );
        return { data: rows.map(mapRowToGeofence), error: null};
    } catch {
        return { data: null, error: 'Failed to load geofences,'};
    }
}


async function deleteGeofence(geofenceId: string): Promise<ServiceResult> {
    const db = getDatabase();

    try {
        await db.runAsync(`DELETE FROM Geofence WHERE geofence_id = ?`, [geofenceId]);
    } catch {
        return { data: null, error: 'Failed to delete geofence.' };
    }

    await queueSync('Geofence', geofenceId, 'DELETE');
    await SyncService.drainQueue().catch(() => {});
    return { data: null, error: null };
}

async function getGeofenceById(
    geofenceId: string
): Promise<ServiceResult<Geofence>> {
    const db = getDatabase();
    try {
        const row = await db.getFirstAsync<Record<string, unknown>>(
            `SELECT * FROM Geofence WHERE geofence_id = ?`, [geofenceId]
        );
        if (!row) return { data: null, error: 'Geofence not found.' };
        return { data: mapRowToGeofence(row), error: null };
    } catch {
        return { data: null, error: 'Failed to load geofence.' };
    }
}

async function updateGeofence(
    geofenceId: string,
    params: UpdateGeofenceParams
): Promise<ServiceResult<Geofence>> {
    if (!params.geofenceType.trim()) {
        return { data: null, error: 'Geofence type is required.' };
    }
    if (params.radiusMeters <= 0) {
        return { data: null, error: 'Radius must be greater than 0.' };
    }

    const db = getDatabase();
    try {
        await db.runAsync(
            `UPDATE Geofence
             SET center_latitude = ?, center_longitude = ?, radius_meters = ?, geofence_type = ?
             WHERE geofence_id = ?`,
            [
                params.centerLatitude,
                params.centerLongitude,
                params.radiusMeters,
                params.geofenceType.trim(),
                geofenceId,
            ]
        );
    } catch {
        return { data: null, error: 'Failed to update geofence. Please try again.' };
    }

    await queueSync('Geofence', geofenceId, 'UPDATE');
    await SyncService.drainQueue().catch(() => {});

    // Re-fetch to return the up-to-date row
    return getGeofenceById(geofenceId);
}

async function recordGeofenceEvent(
    geofenceId: string,
    eventType: 'Enter' | 'Exit'
): Promise<ServiceResult<GeofenceEvent>> {
    const db = getDatabase();
    const geoEventId = Crypto.randomUUID();
    const eventTime = new Date().toISOString();

    try {
        await db.runAsync(
            `INSERT INTO GeofenceEvent (geoEvent_id, geofence_id, event_type, event_time)
            VALUES (?, ?, ?, ?)`,
            [geoEventId, geofenceId, eventType, eventTime]
        );
    } catch {
        return { data: null, error: 'Failed to record geofence event.'};
    }
    
    await queueSync('GeofenceEvent', geoEventId, 'INSERT');

    const event: GeofenceEvent = { geoEventId, geofenceId, eventType, eventTime };

    return { data: event, error: null };
}

async function getEventsByGeofence(
    geofenceId: string
): Promise<ServiceResult<GeofenceEvent[]>> {
    const db = getDatabase();

    try {
        const rows = await db.getAllAsync<Record<string, unknown>>(
            `SELECT * FROM GeofenceEvent WHERE geofence_id = ? ORDER BY event_time DESC`,
            [geofenceId]
        );
        return { data: rows.map(mapRowToGeofenceEvent), error: null};
    } catch {
        return { data: null, error: 'Failed to load geofence events.'};
    }
}

async function getEventsByPatient(
    patientId: string
): Promise<ServiceResult<{ event: GeofenceEvent, geofence: Geofence }[]>> {
    const db = getDatabase();

    try {
        const rows = await db.getAllAsync<Record<string, unknown>>(
            `SELECT 
                e.geoEvent_id, e.geofence_id, e.event_type, e.event_time,
                g.patient_id, g.center_latitude, g.center_longitude, g.radius_meters, g.geofence_type
             FROM GeofenceEvent e
             JOIN Geofence g ON e.geofence_id = g.geofence_id
             WHERE g.patient_id = ?
             ORDER BY e.event_time DESC`,
            [patientId]
        );
        const mapped = rows.map(row => ({
            event: mapRowToGeofenceEvent(row),
            geofence: mapRowToGeofence(row)
        }));
        return { data: mapped, error: null };
    } catch {
        return { data: null, error: 'Failed to load patient geofence events.'};
    }
}

async function pullGeofencesFromCloud(
    patientId: string
): Promise<ServiceResult<number>> {
    const { data: rows, error: fetchError } = await supabase
        .from('Geofence')
        .select('*')
        .eq('patient_id', patientId);

    if (fetchError) {
        return { data: null, error: 'Failed to sync geofences from cloud.'};
    }

    const db = getDatabase();

    // Check SyncLog for any unsynced local pending operations
    const pendingLogs = await db.getAllAsync<{ row_id: string; operation: string }>(
        `SELECT row_id, operation FROM SyncLog WHERE table_name = 'Geofence' AND synced = 0`
    );
    const pendingDeleteIds = new Set(
        pendingLogs.filter(l => l.operation === 'DELETE').map(l => l.row_id)
    );
    const pendingUpsertIds = new Set(
        pendingLogs.filter(l => l.operation === 'INSERT' || l.operation === 'UPDATE').map(l => l.row_id)
    );

    const remoteGeofenceIds = new Set<string>();
    let count = 0;

    await db.withExclusiveTransactionAsync(async () => {
        for (const row of rows ?? []) {
            remoteGeofenceIds.add(row.geofence_id);

            // Skip resurrecting geofences that were deleted locally but not yet pushed to cloud
            if (pendingDeleteIds.has(row.geofence_id)) {
                continue;
            }
            // Skip overwriting local changes if there's an unsynced local edit
            if (pendingUpsertIds.has(row.geofence_id)) {
                continue;
            }

            // ON CONFLICT DO UPDATE, never INSERT OR REPLACE: the latter deletes and reinserts the row, which would cascade away child GeofenceEvent rows once foreign keys are enforced.
            await db.runAsync(
                `INSERT INTO Geofence (geofence_id, patient_id, center_latitude, center_longitude, radius_meters, geofence_type)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(geofence_id) DO UPDATE SET
                    patient_id = excluded.patient_id,
                    center_latitude = excluded.center_latitude,
                    center_longitude = excluded.center_longitude,
                    radius_meters = excluded.radius_meters,
                    geofence_type = excluded.geofence_type`,
                [
                    row.geofence_id,
                    row.patient_id,
                    row.center_latitude,
                    row.center_longitude,
                    row.radius_meters,
                    row.geofence_type,
                ]
            );
            count++;
        }

        // Clean up local geofences for this patient that no longer exist remotely and are not pending local creation/update
        const localRows = await db.getAllAsync<{ geofence_id: string }>(
            `SELECT geofence_id FROM Geofence WHERE patient_id = ?`,
            [patientId]
        );

        for (const localRow of localRows) {
            if (!remoteGeofenceIds.has(localRow.geofence_id) && !pendingUpsertIds.has(localRow.geofence_id)) {
                await db.runAsync(`DELETE FROM Geofence WHERE geofence_id = ?`, [localRow.geofence_id]);
            }
        }
    });

    return { data: count, error: null };
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dp / 2) * Math.sin(dp / 2) +
        Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Evaluates patient's current location against all geofences for that patient.
 * Records 'Enter' or 'Exit' events if boundary transitions occurred since the last recorded event.
 */
async function evaluatePatientLocationAndRecordEvents(
    patientId: string,
    latitude: number,
    longitude: number
): Promise<ServiceResult<{ event: GeofenceEvent; geofence: Geofence }[]>> {
    const { data: geofences, error: geoError } = await getGeofencesByPatient(patientId);
    if (geoError || !geofences || geofences.length === 0) {
        return { data: [], error: null };
    }

    const newEvents: { event: GeofenceEvent; geofence: Geofence }[] = [];

    for (const fence of geofences) {
        const dist = getDistanceInMeters(latitude, longitude, fence.centerLatitude, fence.centerLongitude);
        const isInside = dist <= fence.radiusMeters;

        const { data: recentEvents } = await getEventsByGeofence(fence.geofenceId);
        const lastEvent = recentEvents && recentEvents.length > 0 ? recentEvents[0] : null;

        if (isInside) {
            // Patient is inside fence. Record Enter if last event was Exit or no event recorded yet.
            if (!lastEvent || lastEvent.eventType === 'Exit') {
                const res = await recordGeofenceEvent(fence.geofenceId, 'Enter');
                if (res.data) {
                    newEvents.push({ event: res.data, geofence: fence });
                }
            }
        } else {
            // Patient is outside fence. Record Exit if last event was Enter.
            if (lastEvent && lastEvent.eventType === 'Enter') {
                const res = await recordGeofenceEvent(fence.geofenceId, 'Exit');
                if (res.data) {
                    newEvents.push({ event: res.data, geofence: fence });
                }
            }
        }
    }

    return { data: newEvents, error: null };
}

export const GeofenceService = {
    createGeofence,
    getGeofenceById,
    updateGeofence,
    getGeofencesByPatient,
    deleteGeofence,
    recordGeofenceEvent,
    getEventsByGeofence,
    getEventsByPatient,
    pullGeofencesFromCloud,
    evaluatePatientLocationAndRecordEvents,
};