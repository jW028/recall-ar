import type { Threat } from '@/models/Threat';
import { ThreatService } from '@/services/ThreatService';
import { useCallback, useEffect, useState } from 'react';

interface UseThreatListViewModel {
    threats: Threat[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    acknowledgeThreat: (threatId: string) => Promise<boolean>;
}

export function useThreatListViewModel(
    patientId: string | undefined
): UseThreatListViewModel {
    const [threats, setThreats] = useState<Threat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!patientId) return;
        setIsLoading(true);
        setError(null);
        const result = await ThreatService.getThreatsByPatient(patientId);
        if (result.error) {
            setError(result.error);
        } else {
            setThreats(result.data ?? []);
        }
        setIsLoading(false);
    }, [patientId]);

    useEffect(() => { refresh(); }, [refresh]);

    const acknowledgeThreat = useCallback(async (threatId: string): Promise<boolean> => {
        const result = await ThreatService.acknowledgeThreat(threatId);
        if (result.error) return false;
        // Optimistically update local state
        setThreats(prev => prev.map(t =>
            t.threatId === threatId
                ? { ...t, alertStatus: 'Acknowledged', acknowledgedTime: new Date().toISOString() }
                : t
        ));
        return true;
    }, []);

    return { threats, isLoading, error, refresh, acknowledgeThreat };
}
