import type { Encouragement } from '@/models/Encouragement';
import { EncouragementService } from '@/services/EncouragementService';
import { EngagementService, type RecognitionMoment } from '@/services/EngagementService';
import { PairingService } from '@/services/PairingService';
import { TrainingService } from '@/services/TrainingService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

// Matches the sync cadence so a freshly pulled encouragement surfaces within one cycle.
const REFRESH_INTERVAL_MS = 30_000;

interface UsePatientHomeViewModel {
    streakDays: number;
    // Memories waiting right now, and distinct memories already reviewed today.
    dueCount: number;
    answeredToday: number;
    recognitions: RecognitionMoment[];
    encouragement: Encouragement | null;
    dismissEncouragement: () => Promise<void>;
    refresh: () => Promise<void>;
}

// Engagement state for the patient home screen: focus-refreshed, plus a 30s interval for pulled messages.
export function usePatientHomeViewModel(): UsePatientHomeViewModel {
    const [streakDays, setStreakDays] = useState(0);
    const [dueCount, setDueCount] = useState(0);
    const [answeredToday, setAnsweredToday] = useState(0);
    const [recognitions, setRecognitions] = useState<RecognitionMoment[]>([]);
    const [encouragement, setEncouragement] = useState<Encouragement | null>(null);
    const patientIdRef = useRef<string | null>(null);

    const refresh = useCallback(async () => {
        const pairing = await PairingService.getPersistedPairing();
        if (!pairing) return;
        patientIdRef.current = pairing.patientId;
        const [streak, moments, pending, due, answered] = await Promise.all([
            EngagementService.getTrainingStreak(pairing.patientId),
            EngagementService.getTodaysRecognitions(pairing.patientId),
            EncouragementService.getPending(pairing.patientId),
            TrainingService.getDueCount(pairing.patientId),
            EngagementService.getAnsweredToday(pairing.patientId),
        ]);
        if (streak.data !== null) setStreakDays(streak.data);
        if (moments.data !== null) setRecognitions(moments.data);
        if (pending.data !== null) setEncouragement(pending.data[0] ?? null);
        if (due.data !== null) setDueCount(due.data);
        if (answered.data !== null) setAnsweredToday(answered.data);
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

    return {
        streakDays,
        dueCount,
        answeredToday,
        recognitions,
        encouragement,
        dismissEncouragement,
        refresh,
    };
}
