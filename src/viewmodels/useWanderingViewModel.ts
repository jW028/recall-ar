import { PairingService } from '@/services/PairingService';
import { WanderingDetectionService, WANDERING_CONFIG } from '@/services/WanderingDetectionService';
import { useCallback, useEffect, useRef, useState } from 'react';

export type WanderingState = 'idle' | 'countdown' | 'triggered';

export interface UseWanderingViewModel {
    isMonitoring: boolean;
    wanderingState: WanderingState;
    countdownSeconds: number;
    enableWanderingMonitoring: () => void;
    disableWanderingMonitoring: () => void;
    confirmPatientOK: () => void;
    triggerImmediateWanderingSOS: () => Promise<void>;
}

export function useWanderingViewModel(): UseWanderingViewModel {
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [wanderingState, setWanderingState] = useState<WanderingState>('idle');
    const [countdownSeconds, setCountdownSeconds] = useState(WANDERING_CONFIG.countdownDurationSec);

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

    const isDispatchingRef = useRef(false);

    const clearCountdownTimer = useCallback(() => {
        if (timerRef.current !== null) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const onWanderingPromptTriggered = useCallback(() => {
        setWanderingState(prev => {
            if (prev !== 'idle') return prev;
            isDispatchingRef.current = false;
            setCountdownSeconds(WANDERING_CONFIG.countdownDurationSec);
            return 'countdown';
        });
    }, []);

    const enableWanderingMonitoring = useCallback(async () => {
        let pId = patientIdRef.current;
        if (!pId) {
            const pairing = await PairingService.getPersistedPairing();
            if (pairing) {
                pId = pairing.patientId;
                patientIdRef.current = pId;
                caregiverIdRef.current = pairing.caregiverId;
            }
        }

        const activePatientId = pId || 'default-patient-id';
        await WanderingDetectionService.startWanderingMonitoring(activePatientId, onWanderingPromptTriggered);
        setIsMonitoring(true);
    }, [onWanderingPromptTriggered]);

    const disableWanderingMonitoring = useCallback(() => {
        WanderingDetectionService.stopWanderingMonitoring();
        setIsMonitoring(false);
    }, []);

    const confirmPatientOK = useCallback(() => {
        clearCountdownTimer();
        isDispatchingRef.current = false;
        WanderingDetectionService.snoozePromptForInterval();
        setWanderingState('idle');
        setCountdownSeconds(WANDERING_CONFIG.countdownDurationSec);
    }, [clearCountdownTimer]);

    const dispatchEmergency = useCallback(async () => {
        if (isDispatchingRef.current) return;
        isDispatchingRef.current = true;

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

        await WanderingDetectionService.triggerWanderingEmergency(finalPatientId, finalCaregiverId);
    }, []);

    const triggerImmediateWanderingSOS = useCallback(async () => {
        clearCountdownTimer();
        setWanderingState('triggered');
        await dispatchEmergency();
    }, [clearCountdownTimer, dispatchEmergency]);

    useEffect(() => {
        if (wanderingState === 'countdown') {
            timerRef.current = setInterval(() => {
                setCountdownSeconds(prev => {
                    if (prev <= 1) {
                        clearCountdownTimer();
                        setWanderingState('triggered');
                        setTimeout(() => {
                            dispatchEmergency();
                        }, 0);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            clearCountdownTimer();
        };
    }, [wanderingState, clearCountdownTimer, dispatchEmergency]);

    return {
        isMonitoring,
        wanderingState,
        countdownSeconds,
        enableWanderingMonitoring,
        disableWanderingMonitoring,
        confirmPatientOK,
        triggerImmediateWanderingSOS,
    };
}
