import type { Threat } from '@/models/Threat';
import { SyncService } from '@/services/SyncService';
import { ThreatService } from '@/services/ThreatService';
import type { RefreshOptions } from '@/viewmodels/useMemoryAssetViewModel';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

// Threat is push-only in sync, so the background cycle never brings new alerts down. Poll on the same
// cadence instead, otherwise a caregiver watching the Alerts tab never sees a panic alert arrive.
const POLL_INTERVAL_MS = 30_000;

interface UseThreatListViewModel {
    threats: Threat[];
    isLoading: boolean;
    error: string | null;
    refresh: (opts?: RefreshOptions) => Promise<void>;
    acknowledgeThreat: (threatId: string) => Promise<boolean>;
    resolveThreat: (threatId: string) => Promise<boolean>;
    clearHistory: () => Promise<void>;
}

export function useThreatListViewModel(
    patientId: string | undefined
): UseThreatListViewModel {
    const [threats, setThreats] = useState<Threat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const inFlightRef = useRef<Promise<void> | null>(null);

    const refresh = useCallback((opts?: RefreshOptions): Promise<void> => {
        if (!patientId) return Promise.resolve();
        // Only silent (focus/poll) reloads join an in-flight run; an explicit refresh always executes.
        if (opts?.silent && inFlightRef.current) return inFlightRef.current;

        if (!opts?.silent) setIsLoading(true);
        setError(null);

        const run = (async () => {
            // 1. Push any local updates first so they aren't overwritten by stale cloud data
            await SyncService.drainQueue();

            // 2. Pull the latest threats from Supabase
            await ThreatService.pullThreatsFromCloud(patientId);

            // 3. Load them from local SQLite
            const result = await ThreatService.getThreatsByPatient(patientId);
            if (result.error) {
                setError(result.error);
            } else {
                setThreats(result.data ?? []);
            }
            setIsLoading(false);
        })().finally(() => {
            inFlightRef.current = null;
        });

        inFlightRef.current = run;
        return run;
    }, [patientId]);

    // Focus alone isn't enough here — a caregiver can sit on the Alerts tab indefinitely waiting for an
    // alert — so poll too. The interval lives inside the focus effect because both the Alerts tab and the
    // Home dashboard hold their own copy of this viewmodel, and only one of them is ever on screen; a
    // module-level interval would run two drainQueue round trips every tick instead of one.
    useFocusEffect(
        useCallback(() => {
            refresh({ silent: true });
            const id = setInterval(() => { refresh({ silent: true }); }, POLL_INTERVAL_MS);
            return () => clearInterval(id);
        }, [refresh])
    );

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

    const resolveThreat = useCallback(async (threatId: string): Promise<boolean> => {
        const result = await ThreatService.resolveThreat(threatId);
        if (result.error) return false;

        setThreats(prev => prev.map(t =>
            t.threatId === threatId ? { ...t, alertStatus: 'Resolved', acknowledgedTime: t.acknowledgedTime || new Date().toISOString() } : t
        ));
        return true;
    }, []);

    const clearHistory = useCallback(async () => {
        await ThreatService.clearAllLocalThreats();
        setThreats([]);
    }, []);

    return { threats, isLoading, error, refresh, acknowledgeThreat, resolveThreat, clearHistory };
}
