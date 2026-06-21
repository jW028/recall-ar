import { AR_LATENCY_BUDGET_MS } from '@/constants/config';
import { prepareImageTensor } from '@/ml/ImagePreprocessor';
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

export interface ARViewModelResult {
    hasPermission: boolean;
    requestPermission: () => Promise<boolean>;
    device: CameraDevice | undefined;
    isInitializing: boolean;
    initError: string | null;
    result: RecognitionResult | null;
    photoOutput: CameraPhotoOutput;
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

    const photoOutput = usePhotoOutput({
        targetResolution: { width: 480, height: 360 },
        qualityPrioritization: 'speed',
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
            RecognitionService.teardown();
        };
    }, [patientId]);

    const capture = useCallback(async () => {
        if (!isReadyRef.current || isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            const photoFile = await photoOutput.capturePhotoToFile({ flashMode: 'off' }, {});
            const tensor = await prepareImageTensor(`file://${photoFile.filePath}`);
            const recognitionResult = RecognitionService.processFrame(tensor);

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
        if (isInitializing || initError || !hasPermission) return;

        const interval = setInterval(capture, AR_LATENCY_BUDGET_MS);
        return () => clearInterval(interval);
    }, [isInitializing, initError, capture, hasPermission]);

    return {
        hasPermission,
        requestPermission,
        device,
        isInitializing,
        initError,
        result,
        photoOutput,
    };
}
