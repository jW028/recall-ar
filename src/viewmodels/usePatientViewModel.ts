import type { Patient } from '@/models/Patient';
import {
    PatientService,
    type CreatePatientParams,
    type UpdatePatientParams,
} from '@/services/PatientService';
import { SyncService } from '@/services/SyncService';
import type { RefreshOptions } from '@/viewmodels/useMemoryAssetViewModel';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePatientListViewModel {
    patients: Patient[];
    isLoading: boolean;
    error: string | null;
    refresh: (opts?: RefreshOptions) => Promise<void>;
    createPatient: (params: CreatePatientParams) => Promise<boolean>;
    isCreating: boolean;
    createError: string | null;
    clearCreateError: () => void;
}

export function usePatientListViewModel(
caregiverId: string | undefined
): UsePatientListViewModel {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const inFlightRef = useRef<Promise<void> | null>(null);

    const refresh = useCallback((opts?: RefreshOptions): Promise<void> => {
        if (!caregiverId) return Promise.resolve();
        // Only silent (focus) reloads join an in-flight run; an explicit refresh always executes.
        if (opts?.silent && inFlightRef.current) return inFlightRef.current;

        if (!opts?.silent) setIsLoading(true);
        setError(null);

        const run = (async () => {
            const result = await PatientService.getPatientsByCaregiver(caregiverId);
            if (result.error) {
                setError(result.error);
            } else {
                setPatients(result.data ?? []);
            }
            setIsLoading(false);
        })().finally(() => {
            inFlightRef.current = null;
        });

        inFlightRef.current = run;
        return run;
    }, [caregiverId]);

    // The dashboard stays mounted, so focus is what picks up a patient created, renamed or deleted on a
    // pushed screen — including one whose own copy of this viewmodel was unmounted before it could matter.
    useFocusEffect(
        useCallback(() => {
            refresh({ silent: true });
        }, [refresh])
    );

    // Hydrate this device when the caregiverId is first set (new device / multi-device),
    // rather than waiting for the next background sync cycle. Goes through SyncService so
    // pulled rows get the pending-write guard and last-write-wins check, and so the
    // patients' memory assets arrive with them. Errors are silently ignored so the app
    // continues to work fully offline.
    useEffect(() => {
        if (!caregiverId) return;
        SyncService.pullAllForCaregiver(caregiverId)
            .then(() => refresh())
            .catch(() => {});
    }, [caregiverId, refresh]);

    const createPatient = useCallback(
        async (params: CreatePatientParams): Promise<boolean> => {
        setIsCreating(true);
        setCreateError(null);

        try {
            const result = await PatientService.createPatient(params);

            if (result.error || !result.data) {
                setCreateError(result.error ?? 'Failed to create patient.');
                setIsCreating(false);
                return false;
            }

            // Optimistically insert into local list — no need to refetch
            setPatients((prev) =>
                [...prev, result.data!].sort((a, b) =>
                a.patientName.localeCompare(b.patientName)
                )
            );
            setIsCreating(false);
            return true;
        } catch {
            setCreateError('Failed to create patient. Please try again.');
            setIsCreating(false);
            return false;
        }
        },
        []
    );

    const clearCreateError = useCallback(() => setCreateError(null), []);

    return {
        patients,
        isLoading,
        error,
        refresh,
        createPatient,
        isCreating,
        createError,
        clearCreateError,
    };
}

interface UsePatientDetailViewModel {
    patient: Patient | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
   
    updatePatient: (params: UpdatePatientParams) => Promise<boolean>;
    isUpdating: boolean;
    updateError: string | null;
    clearUpdateError: () => void;
   
    deletePatient: () => Promise<boolean>;
    isDeleting: boolean;
    deleteError: string | null;
}

export function usePatientDetailViewModel(
    patientId: string | undefined
): UsePatientDetailViewModel {
    const [patient, setPatient] = useState<Patient | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!patientId) return;

        setIsLoading(true);
        setError(null);

        const result = await PatientService.getPatientById(patientId);

        if (result.error) {
        setError(result.error);
        } else {
        setPatient(result.data);
        }
        setIsLoading(false);
    }, [patientId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const updatePatient = useCallback(
        async (params: UpdatePatientParams): Promise<boolean> => {
        if (!patientId) return false;

        setIsUpdating(true);
        setUpdateError(null);

        const result = await PatientService.updatePatient(patientId, params);

        if (result.error || !result.data) {
            setUpdateError(result.error ?? 'Failed to update patient.');
            setIsUpdating(false);
            return false;
        }

        setPatient(result.data);
        setIsUpdating(false);
        return true;
        },
        [patientId]
    );

    const deletePatient = useCallback(async (): Promise<boolean> => {
        if (!patientId) return false;

        setIsDeleting(true);
        setDeleteError(null);

        const result = await PatientService.deletePatient(patientId);

        if (result.error) {
        setDeleteError(result.error);
        setIsDeleting(false);
        return false;
        }

        setIsDeleting(false);
        return true;
    }, [patientId]);

    const clearUpdateError = useCallback(() => setUpdateError(null), []);

    return {
        patient,
        isLoading,
        error,
        refresh,
        updatePatient,
        isUpdating,
        updateError,
        clearUpdateError,
        deletePatient,
        isDeleting,
        deleteError,
    };
}
