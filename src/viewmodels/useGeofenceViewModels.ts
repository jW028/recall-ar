import type { Geofence } from '@/models/Geofence';
import type { GeofenceEvent } from '@/models/GeofenceEvent';
import {
    GeofenceService,
    type CreateGeofenceParams,
    type UpdateGeofenceParams,
} from '@/services/GeofenceService';
import { LocationService, type PatientLocationData } from '@/services/LocationService';
import { useCallback, useEffect, useState } from 'react';


// ── Geofence List ─────────────────────────────────────────────────
interface UseGeofenceListViewModel {
    geofences: Geofence[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createGeofence: (params: CreateGeofenceParams) => Promise<boolean>;
    isCreating: boolean;
    createError: string | null;
    clearCreateError: () => void;
    deleteGeofence: (geofenceId: string) => Promise<boolean>;
}

export function useGeofenceListViewModel(
    patientId: string | undefined
): UseGeofenceListViewModel {
    const [geofences, setGeofences] = useState<Geofence[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!patientId) return;
        setIsLoading(true);
        setError(null);
        const result = await GeofenceService.getGeofencesByPatient(patientId);
        if (result.error) {
            setError(result.error);
        } else {
            setGeofences(result.data ?? []);
        }
        setIsLoading(false);
    }, [patientId]);

    useEffect(() => { refresh(); }, [refresh]);

    const createGeofence = useCallback(
        async (params: CreateGeofenceParams): Promise<boolean> => {
            setIsCreating(true);
            setCreateError(null);
            const result = await GeofenceService.createGeofence(params);
            if (result.error || !result.data) {
                setCreateError(result.error ?? 'Failed to create geofence.');
                setIsCreating(false);
                return false;
            }
            setGeofences(prev => [...prev, result.data!]);
            setIsCreating(false);
            return true;
        },
        []
    );

    const deleteGeofence = useCallback(async (geofenceId: string): Promise<boolean> => {
        const result = await GeofenceService.deleteGeofence(geofenceId);
        if (result.error) return false;
        setGeofences(prev => prev.filter(g => g.geofenceId !== geofenceId));
        return true;
    }, []);

    const clearCreateError = useCallback(() => setCreateError(null), []);

    return {
        geofences, isLoading, error, refresh,
        createGeofence, isCreating, createError, clearCreateError,
        deleteGeofence,
    };
}

// ── Geofence Events (for detail screen) ──────────────────────────
interface UseGeofenceEventsViewModel {
    events: GeofenceEvent[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useGeofenceEventsViewModel(
    geofenceId: string | undefined
): UseGeofenceEventsViewModel {
    const [events, setEvents] = useState<GeofenceEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!geofenceId) return;
        setIsLoading(true);
        setError(null);
        const result = await GeofenceService.getEventsByGeofence(geofenceId);
        if (result.error) {
            setError(result.error);
        } else {
            setEvents(result.data ?? []);
        }
        setIsLoading(false);
    }, [geofenceId]);

    useEffect(() => { refresh(); }, [refresh]);

    return { events, isLoading, error, refresh };
}

// ── Geofence Config (edit single geofence) ────────────────────────
interface UseGeofenceConfigViewModel {
    geofence: Geofence | null;
    events: GeofenceEvent[];
    isLoading: boolean;
    error: string | null;
    updateGeofence: (params: UpdateGeofenceParams) => Promise<boolean>;
    isUpdating: boolean;
    updateError: string | null;
    clearUpdateError: () => void;
}

export function useGeofenceConfigViewModel(
    geofenceId: string | undefined
): UseGeofenceConfigViewModel {
    const [geofence, setGeofence] = useState<Geofence | null>(null);
    const [events, setEvents] = useState<GeofenceEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    useEffect(() => {
        if (!geofenceId) return;
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            setError(null);
            const [geoResult, eventsResult] = await Promise.all([
                GeofenceService.getGeofenceById(geofenceId),
                GeofenceService.getEventsByGeofence(geofenceId),
            ]);
            if (cancelled) return;
            if (geoResult.error) {
                setError(geoResult.error);
            } else {
                setGeofence(geoResult.data);
            }
            setEvents(eventsResult.data ?? []);
            setIsLoading(false);
        })();
        return () => { cancelled = true; };
    }, [geofenceId]);

    const updateGeofence = useCallback(
        async (params: UpdateGeofenceParams): Promise<boolean> => {
            if (!geofenceId) return false;
            setIsUpdating(true);
            setUpdateError(null);
            const result = await GeofenceService.updateGeofence(geofenceId, params);
            if (result.error || !result.data) {
                setUpdateError(result.error ?? 'Failed to update geofence.');
                setIsUpdating(false);
                return false;
            }
            setGeofence(result.data);
            setIsUpdating(false);
            return true;
        },
        [geofenceId]
    );

    const clearUpdateError = useCallback(() => setUpdateError(null), []);

    return {
        geofence, events, isLoading, error,
        updateGeofence, isUpdating, updateError, clearUpdateError,
    };
}

// ── Patient Geofence Events (for dashboard) ──────────────────────
export interface PatientGeofenceEvent {
    event: GeofenceEvent;
    geofence: Geofence;
}

interface UsePatientGeofenceEventsViewModel {
    events: PatientGeofenceEvent[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function usePatientGeofenceEventsViewModel(
    patientId: string | undefined
): UsePatientGeofenceEventsViewModel {
    const [events, setEvents] = useState<PatientGeofenceEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!patientId) return;
        setIsLoading(true);
        setError(null);
        const result = await GeofenceService.getEventsByPatient(patientId);
        if (result.error) {
            setError(result.error);
        } else {
            setEvents(result.data ?? []);
        }
        setIsLoading(false);
    }, [patientId]);

    useEffect(() => { refresh(); }, [refresh]);

    return { events, isLoading, error, refresh };
}

// ── Patient Live Location (for Track Now button) ──────────────────
export interface UsePatientLocationViewModel {
    patientLocation: PatientLocationData | null;
    isTracking: boolean;
    fetchLocation: () => Promise<{ found: boolean; isLive: boolean; location: PatientLocationData | null }>;
}

export function usePatientLocationViewModel(
    patientId: string | undefined
): UsePatientLocationViewModel {
    const [patientLocation, setPatientLocation] = useState<PatientLocationData | null>(null);
    const [isTracking, setIsTracking] = useState(false);

    /**
     * Fetches the patient's latest GPS from Supabase.
     * Returns { found, isLive, location } so callers can use the data immediately
     * without depending on a subsequent render cycle.
     */
    const fetchLocation = useCallback(async (): Promise<{ found: boolean; isLive: boolean; location: PatientLocationData | null }> => {
        if (!patientId) return { found: false, isLive: false, location: null };

        setIsTracking(true);
        const result = await LocationService.fetchLatestLocation(patientId);
        setIsTracking(false);

        if (result.error) {
            return { found: false, isLive: false, location: null };
        }

        if (result.data) {
            setPatientLocation(result.data);
            return { found: true, isLive: true, location: result.data };
        }

        return { found: false, isLive: false, location: null };
    }, [patientId]);

    return { patientLocation, isTracking, fetchLocation };
}

