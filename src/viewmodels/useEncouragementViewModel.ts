import { AnalyticsService, type EngagementSnapshot } from '@/services/AnalyticsService';
import { EncouragementService } from '@/services/EncouragementService';
import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useRef, useState } from 'react';

// Client-side cooldown so a caregiver can't accidentally flood the patient with taps.
const SEND_COOLDOWN_MS = 30_000;

interface UseEncouragementViewModel {
    snapshot: EngagementSnapshot | null;
    isSending: boolean;
    isCoolingDown: boolean;
    sentConfirmation: string | null;
    error: string | null;
    send: (message: string, emoji: string) => Promise<void>;
}

// Caregiver half of the encouragement feature: engagement snapshot + one-tap sends.
export function useEncouragementViewModel(patientId: string): UseEncouragementViewModel {
    const caregiverId = useAuthStore((s) => s.user?.id);
    const [snapshot, setSnapshot] = useState<EngagementSnapshot | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isCoolingDown, setIsCoolingDown] = useState(false);
    const [sentConfirmation, setSentConfirmation] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        AnalyticsService.getEngagementSnapshot(patientId).then((result) => {
            if (mountedRef.current && result.data) setSnapshot(result.data);
        });
        return () => {
            mountedRef.current = false;
        };
    }, [patientId]);

    const send = useCallback(
        async (message: string, emoji: string) => {
            if (!caregiverId || isSending || isCoolingDown) return;
            setIsSending(true);
            setError(null);
            const result = await EncouragementService.send({ patientId, caregiverId, message, emoji });
            if (!mountedRef.current) return;
            setIsSending(false);
            if (result.error) {
                setError(result.error);
                return;
            }
            setSentConfirmation(`Sent ${emoji} — it'll appear on their home screen.`);
            setIsCoolingDown(true);
            setTimeout(() => {
                if (mountedRef.current) {
                    setIsCoolingDown(false);
                    setSentConfirmation(null);
                }
            }, SEND_COOLDOWN_MS);
        },
        [patientId, caregiverId, isSending, isCoolingDown]
    );

    return { snapshot, isSending, isCoolingDown, sentConfirmation, error, send };
}
