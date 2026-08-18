import type {
    ContextAlert,
    CreateContextAlertParams,
    UpdateContextAlertParams,
} from '@/models/ContextAlert';
import { ContextAlertService } from '@/services/ContextAlertService';
import { SyncService } from '@/services/SyncService';
import { useCallback, useEffect, useState } from 'react';

export interface UseContextAlertViewModel {
    alerts: ContextAlert[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createAlert: (params: Omit<CreateContextAlertParams, 'patientId'>) => Promise<boolean>;
    updateAlert: (alertId: string, updates: UpdateContextAlertParams) => Promise<boolean>;
    deleteAlert: (alertId: string) => Promise<boolean>;
    acknowledgeAlert: (alertId: string) => Promise<boolean>;
}

export function useContextAlertViewModel(
    patientId: string | undefined
): UseContextAlertViewModel {
    const [alerts, setAlerts] = useState<ContextAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!patientId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);

        // Sync local queue first
        await SyncService.drainQueue();

        const result = await ContextAlertService.getContextAlertsForPatient(patientId);
        if (result.error) {
            setError(result.error);
        } else {
            setAlerts(result.data ?? []);
        }
        setIsLoading(false);
    }, [patientId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const createAlert = useCallback(
        async (params: Omit<CreateContextAlertParams, 'patientId'>): Promise<boolean> => {
            if (!patientId) return false;
            const res = await ContextAlertService.createContextAlert({
                ...params,
                patientId,
            });
            if (res.error || !res.data) {
                setError(res.error || 'Failed to create alert');
                return false;
            }
            await refresh();
            return true;
        },
        [patientId, refresh]
    );

    const updateAlert = useCallback(
        async (alertId: string, updates: UpdateContextAlertParams): Promise<boolean> => {
            const res = await ContextAlertService.updateContextAlert(alertId, updates);
            if (res.error) {
                setError(res.error);
                return false;
            }
            await refresh();
            return true;
        },
        [refresh]
    );

    const deleteAlert = useCallback(
        async (alertId: string): Promise<boolean> => {
            const res = await ContextAlertService.deleteContextAlert(alertId);
            if (res.error) {
                setError(res.error);
                return false;
            }
            setAlerts((prev) => prev.filter((a) => a.ctxAlertId !== alertId));
            return true;
        },
        []
    );

    const acknowledgeAlert = useCallback(
        async (alertId: string): Promise<boolean> => {
            const res = await ContextAlertService.acknowledgeContextAlert(alertId);
            if (res.error) {
                setError(res.error);
                return false;
            }
            await refresh();
            return true;
        },
        [refresh]
    );

    return {
        alerts,
        isLoading,
        error,
        refresh,
        createAlert,
        updateAlert,
        deleteAlert,
        acknowledgeAlert,
    };
}
