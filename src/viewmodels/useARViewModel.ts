import {
    AR_CONTEXT_ALERT_INTERVAL_MS,
    AR_FRAME_INTERVAL_MS,
} from '@/constants/config';
import type { ContextAlert } from '@/models/ContextAlert';
import { ContextAlertService } from '@/services/ContextAlertService';
import { EngagementService } from '@/services/EngagementService';
import { PairingService } from '@/services/PairingService';
import { RecognitionService, type RecognitionResult } from '@/services/RecognitionService';
import { useAuthStore } from '@/store/authStore';
import { File } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    useCameraDevice,
    useCameraPermission,
    usePhotoOutput,
    type CameraDevice,
    type CameraPhotoOutput,
} from 'react-native-vision-camera';

// iOS resets mediaserverd under sustained capture pressure (AVErrorMediaServicesWereReset, -11819). That leaves the
// capture session permanently dead — the only recovery is a stop/start, which `isActive` drives.
const CAMERA_RECOVERY_DELAY_MS = 600;
const MAX_CAMERA_RECOVERY_ATTEMPTS = 3;

// Must be module-level. `usePhotoOutput` memoizes on this object's identity, and `<Camera outputs>` memoizes on the
// output's identity, so an inline literal would build a new native photo output and reconfigure the capture session
// on every single React render — which stalls the preview and is what drives iOS into a mediaserverd reset.
const PHOTO_TARGET_RESOLUTION = { width: 480, height: 360 };

// Only the fields the overlay draws. Recognition runs continuously, so re-rendering on an unchanged result would
// re-render the Camera several times a second for nothing.
function sameResult(a: RecognitionResult | null, b: RecognitionResult): boolean {
    if (!a) return false;
    return a.status === b.status && a.assetId === b.assetId && a.label === b.label;
}

function sameReminders(a: ContextAlert[], b: ContextAlert[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((alert, i) => alert.ctxAlertId === b[i].ctxAlertId);
}

export interface ARViewModelResult {
    hasPermission: boolean;
    requestPermission: () => Promise<boolean>;
    device: CameraDevice | undefined;
    isInitializing: boolean;
    initError: string | null;
    result: RecognitionResult | null;
    photoOutput: CameraPhotoOutput;
    // False while a dead camera session is being restarted
    isCameraActive: boolean;
    onCameraError: (error: Error) => void;
    contextReminders: ContextAlert[];
    acknowledgeReminder: (alertId: string) => Promise<void>;
}

export function useARViewModel(): ARViewModelResult {
    const patientId = useAuthStore(s => s.user?.id);
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('back');

    const [isInitializing, setIsInitializing] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const [result, setResult] = useState<RecognitionResult | null>(null);

    const isReadyRef = useRef(false);
    const isProcessingRef = useRef(false);
    const isMountedRef = useRef(true);
    // Pairing patient_id (not the auth user id) — RecognitionEvent rows FK onto Patient.patient_id.
    const pairedPatientIdRef = useRef<string | null>(null);

    const [isCameraActive, setIsCameraActive] = useState(true);
    const recoveryAttemptsRef = useRef(0);
    const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const photoOutput = usePhotoOutput({
        // Only the aspect ratio is honoured — no device offers a 480x360 still format, so this just pins 4:3.
        targetResolution: PHOTO_TARGET_RESOLUTION,
        qualityPrioritization: 'speed',
        // Defaults are 'native' (HEIC on iOS) at 0.9. Every frame is downscaled to <=160px and discarded, so
        // HEVC-encoding a full-resolution photo at high quality is wasted work on a 2Hz loop.
        containerFormat: 'jpeg',
        quality: 0.6,
    });

    useEffect(() => {
        if (!patientId) return;

        isMountedRef.current = true;

        PairingService.getPersistedPairing().then((pairing) => {
            if (isMountedRef.current) pairedPatientIdRef.current = pairing?.patientId ?? null;
        });

        RecognitionService.initialize(patientId)
            .then(() => {
                if (!isMountedRef.current) return;
                isReadyRef.current = true;
                setIsInitializing(false);
            })
            .catch((err: unknown) => {
                if (!isMountedRef.current) return;
                setInitError(err instanceof Error ? err.message : 'Failed to initialize recognition');
                setIsInitializing(false);
            });

        return () => {
            isMountedRef.current = false;
            isReadyRef.current = false;
            if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
            RecognitionService.teardown();
        };
    }, [patientId]);

    // buildIndex snapshots the local rows into memory and processFrame never reads SQLite again, so without
    // this a memory enrolled after the tab first opened is invisible until the app restarts — and one the
    // caregiver deleted or paused stays recognisable. The ready guard keeps it off a half-loaded model.
    useFocusEffect(
        useCallback(() => {
            if (!patientId || !isReadyRef.current) return;
            RecognitionService.refreshIndex(patientId).catch((err: unknown) => {
                console.warn('[ARView] Failed to refresh recognition index:', err);
            });
        }, [patientId])
    );

    // The session is dead once this fires, so restarting it is the only way back. Attempts are capped so a
    // genuinely broken camera surfaces an error instead of restarting forever.
    const onCameraError = useCallback((error: Error) => {
        console.warn(`[ARView] Camera session error: ${error.message}`);

        if (recoveryAttemptsRef.current >= MAX_CAMERA_RECOVERY_ATTEMPTS) {
            setInitError('The camera stopped responding. Please go back and open this screen again.');
            return;
        }

        recoveryAttemptsRef.current += 1;
        console.log(
            `[ARView] Restarting camera session (attempt ${recoveryAttemptsRef.current}/${MAX_CAMERA_RECOVERY_ATTEMPTS})`
        );
        setIsCameraActive(false);
        recoveryTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) setIsCameraActive(true);
        }, CAMERA_RECOVERY_DELAY_MS);
    }, []);

    const [contextReminders, setContextReminders] = useState<ContextAlert[]>([]);
    // Reminders fire on a time window, so they only need re-checking on a slow tick or when the match changes
    const lastContextEvalAtRef = useRef(0);
    const lastDetectedAssetIdRef = useRef<string | null>(null);

    const acknowledgeReminder = useCallback(async (alertId: string) => {
        await ContextAlertService.acknowledgeContextAlert(alertId);
        setContextReminders((prev) => prev.filter((a) => a.ctxAlertId !== alertId));
    }, []);

    const capture = useCallback(async () => {
        if (!isReadyRef.current || isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            const photoFile = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
            // A frame made it through, so the session is healthy again — let a future reset get a full set of retries
            recoveryAttemptsRef.current = 0;

            const frameUri = `file://${photoFile.filePath}`;
            let recognitionResult: RecognitionResult;
            try {
                recognitionResult = await RecognitionService.processFrame(frameUri);
            } finally {
                // capturePhotoToFile leaves the JPEG in a temp dir with no dispose() of its own
                try {
                    new File(frameUri).delete();
                } catch {
                    // Temp file; the OS reclaims it if the delete fails
                }
            }

            if (isMountedRef.current) {
                setResult((prev) => (sameResult(prev, recognitionResult) ? prev : recognitionResult));
            }

            const detectedAssetId =
                recognitionResult.status === 'recognized' ? recognitionResult.assetId ?? null : null;

            // Evaluate contextual reminders if patient is paired
            const pId = pairedPatientIdRef.current || patientId;
            const assetChanged = detectedAssetId !== lastDetectedAssetIdRef.current;
            const dueForEval = Date.now() - lastContextEvalAtRef.current >= AR_CONTEXT_ALERT_INTERVAL_MS;

            if (pId && (assetChanged || dueForEval)) {
                lastDetectedAssetIdRef.current = detectedAssetId;
                lastContextEvalAtRef.current = Date.now();

                const evalRes = await ContextAlertService.evaluateContextAlerts(pId, detectedAssetId);
                if (isMountedRef.current && evalRes.data) {
                    const matched = evalRes.data;
                    setContextReminders((prev) => (sameReminders(prev, matched) ? prev : matched));
                }
            }

            // Fire-and-forget engagement log; day-level de-dupe lives in the service. Never touches SRT scheduling.
            if (
                recognitionResult.status === 'recognized' &&
                recognitionResult.assetId &&
                pairedPatientIdRef.current
            ) {
                EngagementService.recordRecognitionEvent(
                    pairedPatientIdRef.current,
                    recognitionResult.assetId
                );
            }
        } catch {
            // Drop failed captures (camera not yet ready, etc.)
        } finally {
            isProcessingRef.current = false;
        }
    }, [photoOutput, patientId]);

    useEffect(() => {
        // Don't capture into a session that is stopped or being restarted
        if (isInitializing || initError || !hasPermission || !isCameraActive) return;

        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        // Chained timeouts rather than setInterval: a frame that overruns the budget would otherwise have the next
        // capture fire the instant it finishes, holding the JS thread and the capture pipeline at full tilt.
        const tick = async () => {
            await capture();
            if (cancelled) return;
            timer = setTimeout(tick, AR_FRAME_INTERVAL_MS);
        };
        tick();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [isInitializing, initError, capture, hasPermission, isCameraActive]);

    return {
        hasPermission,
        requestPermission,
        device,
        isInitializing,
        initError,
        result,
        photoOutput,
        isCameraActive,
        onCameraError,
        contextReminders,
        acknowledgeReminder,
    };
}
