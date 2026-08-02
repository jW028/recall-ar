import { FallDetectionService, type SensitivityLevel } from '@/services/FallDetectionService';
import { PairingService } from '@/services/PairingService';
import { useCallback, useEffect, useRef, useState } from 'react';

export type FallState = 'idle' | 'countdown' | 'triggered';

const INITIAL_COUNTDOWN_SECONDS = 15;

export interface UseFallDetectionViewModel {
    isMonitoring: boolean;
    fallState: FallState;
    countdownSeconds: number;
    sensitivity: SensitivityLevel;
    setSensitivity: (level: SensitivityLevel) => void;
    enableMonitoring: () => void;
    disableMonitoring: () => void;
    cancelFallAlert: () => void;
    triggerImmediateSOS: () => Promise<void>;
}

export function useFallDetectionViewModel(): UseFallDetectionViewModel {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [fallState, setFallState] = useState<FallState>('idle');
    const [countdownSeconds, setCountdownSeconds] = useState(INITIAL_COUNTDOWN_SECONDS);
    const [sensitivity, setSensitivity] = useState<SensitivityLevel>('normal');
    
    const patientIdRef = useRef<string | null>(null);
    const caregiverIdRef = useRef<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        (async () => {
            const pairing = await PairingService.getPersistedPairing();
            if (pairing) {
                patientIdRef.current = pairing.patientId;
                caregiverIdRef.current = pairing.caregiverId;
            }
        })();
    }, []);

    const clearCountdownTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const onPotentialFallDetected = useCallback(() => {
        setFallState(prev => {
            if (prev !== 'idle') return prev;
            setCountdownSeconds(INITIAL_COUNTDOWN_SECONDS);
            return 'countdown';
        });
    }, []);

    const enableMonitoring = useCallback(() => {
        FallDetectionService.startMonitoring(onPotentialFallDetected, sensitivity);
        setIsMonitoring(true);
    }, [onPotentialFallDetected, sensitivity]);

    const disableMonitoring = useCallback(() => {
        FallDetectionService.stopMonitoring();
        setIsMonitoring(false);
    }, []);

    const cancelFallAlert = useCallback(() => {
        clearCountdownTimer();
        setFallState('idle');
        setCountdownSeconds(INITIAL_COUNTDOWN_SECONDS);
    }, [clearCountdownTimer]);

    const dispatchEmergency = useCallback(async () => {
        let pId = patientIdRef.current;
        let cId = caregiverIdRef.current;

        if (!pId || !cId) {
            const pairing = await PairingService.getPersistedPairing();
            if (pairing) {
                pId = pairing.patientId;
                cId = pairing.caregiverId;
                patientIdRef.current = pId;
                caregiverIdRef.current = cId;
            }
        }

        const finalPatientId = pId || 'default-patient-id';
        const finalCaregiverId = cId || 'default-caregiver-id';

        await FallDetectionService.triggerFallEmergency(finalPatientId, finalCaregiverId);
    }, []);

    const triggerImmediateSOS = useCallback(async () => {
        clearCountdownTimer();
        setFallState('triggered');
        await dispatchEmergency();
    }, [clearCountdownTimer, dispatchEmergency]);

    useEffect(() => {
        if (fallState === 'countdown') {
            timerRef.current = setInterval(() => {
                setCountdownSeconds(prev => {
                    if (prev <= 1) {
                        clearCountdownTimer();
                        setFallState('triggered');
                        dispatchEmergency();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            clearCountdownTimer();
        };
    }, [fallState, clearCountdownTimer, dispatchEmergency]);

    return {
        isMonitoring,
        fallState,
        countdownSeconds,
        sensitivity,
        setSensitivity,
        enableMonitoring,
        disableMonitoring,
        cancelFallAlert,
        triggerImmediateSOS,
    };
}
