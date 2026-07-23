import type { Encouragement } from '@/models/Encouragement';
import { EncouragementService } from '@/services/EncouragementService';
import { EngagementService, type RecognitionMoment } from '@/services/EngagementService';
import { PairingService } from '@/services/PairingService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

// Matches the sync cadence so a freshly pulled encouragement surfaces within one cycle.
const REFRESH_INTERVAL_MS = 30_000;

interface UsePatientHomeViewModel {
    streakDays: number;
    recognitions: RecognitionMoment[];
    encouragement: Encouragement | null;
    dismissEncouragement: () => Promise<void>;
    refresh: () => Promise<void>;
}

// Engagement state for the patient home screen: focus-refreshed, plus a 30s interval for pulled messages.
export function usePatientHomeViewModel(): UsePatientHomeViewModel {
    const [streakDays, setStreakDays] = useState(0);
    const [recognitions, setRecognitions] = useState<RecognitionMoment[]>([]);
    const [encouragement, setEncouragement] = useState<Encouragement | null>(null);
    const patientIdRef = useRef<string | null>(null);

    const refresh = useCallback(async () => {
        const pairing = await PairingService.getPersistedPairing();
        if (!pairing) return;
        patientIdRef.current = pairing.patientId;
        const [streak, moments, pending] = await Promise.all([
            EngagementService.getTrainingStreak(pairing.patientId),
            EngagementService.getTodaysRecognitions(pairing.patientId),
            EncouragementService.getPending(pairing.patientId),
        ]);
        if (streak.data !== null) setStreakDays(streak.data);
        if (moments.data !== null) setRecognitions(moments.data);
        if (pending.data !== null) setEncouragement(pending.data[0] ?? null);
    }, []);

    // One dismissal acks every pending message so a backlog never stacks up for the patient.
    const dismissEncouragement = useCallback(async () => {
        const patientId = patientIdRef.current;
        if (!patientId) return;
        setEncouragement(null);
        await EncouragementService.acknowledgeAll(patientId);
    }, []);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    useEffect(() => {
        const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [refresh]);

    return { streakDays, recognitions, encouragement, dismissEncouragement, refresh };
}
