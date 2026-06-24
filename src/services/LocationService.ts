import { supabase } from '@/database/remote/supabaseClient';

export interface PatientLocationData {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    recordedAt: string;
}

export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

/**
 * Publishes the patient's current GPS coordinates to Supabase.
 * Called periodically by the patient device while the app is open.
 */
async function publishLocation(
    patientId: string,
    coords: { latitude: number; longitude: number; accuracy: number | null }
): Promise<ServiceResult> {
    const { error } = await supabase.from('PatientLocation').insert({
        patient_id: patientId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
    });

    if (error) {
        console.warn('[LocationService] Failed to publish location:', error.message);
        return { data: null, error: error.message };
    }

    return { data: null, error: null };
}

/**
 * Fetches the most recent GPS location for a patient.
 * Called by the caregiver when they tap "Track Now".
 */
async function fetchLatestLocation(
    patientId: string
): Promise<ServiceResult<PatientLocationData>> {
    const { data, error } = await supabase
        .from('PatientLocation')
        .select('latitude, longitude, accuracy, recorded_at')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        return { data: null, error: 'Failed to fetch patient location.' };
    }

    if (!data) {
        return { data: null, error: null }; // No location yet — not an error
    }

    return {
        data: {
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy,
            recordedAt: data.recorded_at,
        },
        error: null,
    };
}

/**
 * Deletes old location entries, keeping only the 10 most recent per patient.
 * Optionally called after publishing to avoid table bloat.
 */
async function pruneOldLocations(patientId: string): Promise<void> {
    // Fetch the 11th oldest location_id (to keep the 10 newest)
    const { data } = await supabase
        .from('PatientLocation')
        .select('location_id, recorded_at')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: false })
        .range(10, 10)
        .maybeSingle();

    if (!data) return; // Fewer than 11 rows — nothing to prune

    await supabase
        .from('PatientLocation')
        .delete()
        .eq('patient_id', patientId)
        .lt('recorded_at', data.recorded_at);
}

export const LocationService = {
    publishLocation,
    fetchLatestLocation,
    pruneOldLocations,
};
