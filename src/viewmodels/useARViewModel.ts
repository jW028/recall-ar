import { AR_LATENCY_BUDGET_MS } from '@/constants/config';
import { RecognitionService, type RecognitionResult } from '@/services/RecognitionService';
import { useAuthStore } from '@/store/authStore';
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

    const [isCameraActive, setIsCameraActive] = useState(true);
    const recoveryAttemptsRef = useRef(0);
    const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const photoOutput = usePhotoOutput({
        // Only the aspect ratio is honoured — no device offers a 480x360 still format, so this just pins 4:3.
        targetResolution: { width: 480, height: 360 },
        qualityPrioritization: 'speed',
        // Defaults are 'native' (HEIC on iOS) at 0.9. Every frame is downscaled to <=160px and discarded, so
        // HEVC-encoding a full-resolution photo at high quality is wasted work on a 2Hz loop.
        containerFormat: 'jpeg',
        quality: 0.6,
    });

    useEffect(() => {
        if (!patientId) return;

        isMountedRef.current = true;

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

    const capture = useCallback(async () => {
        if (!isReadyRef.current || isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            const photoFile = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
            // A frame made it through, so the session is healthy again — let a future reset get a full set of retries
            recoveryAttemptsRef.current = 0;

            const frameUri = `file://${photoFile.filePath}`;
            const recognitionResult = await RecognitionService.processFrame(frameUri);

            if (isMountedRef.current) {
                setResult(recognitionResult);
            }
        } catch {
            // Drop failed captures (camera not yet ready, etc.)
        } finally {
            isProcessingRef.current = false;
        }
    }, [photoOutput]);

    useEffect(() => {
        // Don't capture into a session that is stopped or being restarted
        if (isInitializing || initError || !hasPermission || !isCameraActive) return;

        const interval = setInterval(capture, AR_LATENCY_BUDGET_MS);
        return () => clearInterval(interval);
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
    };
}
