import { getDatabase } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import type { Geofence } from '@/models/Geofence';
import type { GeofenceEvent } from '@/models/GeofenceEvent';
import * as Crypto from 'expo-crypto';

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
    let count = 0;

    await db.withExclusiveTransactionAsync(async () => {
        for (const row of rows ?? []) {
            await db.runAsync(
                `INSERT OR REPLACE INTO Geofence (geofence_id, patient_id, center_latitude, center_longitude, radius_meters, geofence_type)
                VALUES (?, ?, ?, ?, ?, ?)`,
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
    })

    return {data: count, error: null}
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
};