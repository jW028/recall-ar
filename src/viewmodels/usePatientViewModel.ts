import type { Patient } from '@/models/Patient';
import {
    PatientService,
    type CreatePatientParams,
    type UpdatePatientParams,
} from '@/services/PatientService';
import { useCallback, useEffect, useState } from 'react';

interface UsePatientListViewModel {
    patients: Patient[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
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

    const refresh = useCallback(async () => {
        if (!caregiverId) return;

        setIsLoading(true);
        setError(null);

        const result = await PatientService.getPatientsByCaregiver(caregiverId);

        if (result.error) {
        setError(result.error);
        } else {
        setPatients(result.data ?? []);
        }
        setIsLoading(false);
    }, [caregiverId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

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
