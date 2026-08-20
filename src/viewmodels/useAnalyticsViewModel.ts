import type { AnalyticsDataset, AnalyticsTimeframe } from '@/models/Analytics';
import type { Patient } from '@/models/Patient';
import { AnalyticsService } from '@/services/AnalyticsService';
import { PatientService } from '@/services/PatientService';
import { ReportService } from '@/services/ReportService';
import type { RefreshOptions } from '@/viewmodels/useMemoryAssetViewModel';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type AnalyticsStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseAnalyticsViewModel {
    status: AnalyticsStatus;
    error: string | null;
    dataset: AnalyticsDataset | null;
    timeframe: AnalyticsTimeframe;
    setTimeframe: (timeframe: AnalyticsTimeframe) => void;
    refresh: (opts?: RefreshOptions) => Promise<void>;
    // Pull-to-refresh reloads without flipping status to 'loading', so the dashboard stays visible under the spinner
    isRefreshing: boolean;
    isExporting: boolean;
    exportError: string | null;
    exportMessage: string | null;
    exportReport: () => Promise<void>;
    clearExportMessage: () => void;
}

export function useAnalyticsViewModel(patientId: string | undefined): UseAnalyticsViewModel {
    const [status, setStatus] = useState<AnalyticsStatus>('loading');
    const [error, setError] = useState<string | null>(null);
    const [dataset, setDataset] = useState<AnalyticsDataset | null>(null);
    const [timeframe, setTimeframeState] = useState<AnalyticsTimeframe>('30d');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<string | null>(null);
    const [exportMessage, setExportMessage] = useState<string | null>(null);

    const patientRef = useRef<Patient | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // 'initial' shows the full-screen loading state, 'manual' shows the pull spinner, 'quiet' shows nothing —
    // the last is for focus reloads, which the user did not ask for and should not see.
    type LoadMode = 'initial' | 'manual' | 'quiet';

    const quietInFlightRef = useRef<Promise<void> | null>(null);

    const load = useCallback(
        async (tf: AnalyticsTimeframe, mode: LoadMode = 'initial') => {
            if (!patientId) {
                setError('Patient not found.');
                setStatus('error');
                return;
            }
            // Non-initial reloads keep the current dataset on screen; only the pull spinner signals activity
            if (mode === 'manual') setIsRefreshing(true);
            else if (mode === 'initial') setStatus('loading');
            setError(null);

            // Patient (name + DOB) is needed for the exported report header
            if (!patientRef.current) {
                const patientResult = await PatientService.getPatientById(patientId);
                if (patientResult.data) patientRef.current = patientResult.data;
            }

            const result = await AnalyticsService.generateAnalytics(patientId, tf);
            if (!mountedRef.current) return;
            if (result.error || !result.data) {
                setError(result.error ?? 'Failed to load analytics.');
                setStatus('error');
                if (mode === 'manual') setIsRefreshing(false);
                return;
            }
            setDataset(result.data);
            setStatus(result.data.hasData ? 'ready' : 'empty');
            if (mode === 'manual') setIsRefreshing(false);
        },
        [patientId]
    );

    useEffect(() => {
        load(timeframe);
    }, [load, timeframe]);

    const setTimeframe = useCallback((tf: AnalyticsTimeframe) => {
        setTimeframeState(tf);
    }, []);

    const refresh = useCallback(
        (opts?: RefreshOptions): Promise<void> => {
            if (!opts?.silent) return load(timeframe, 'manual');
            // Generating analytics is an expensive aggregation, so collapse a focus reload onto one already
            // running rather than starting a second pass over the same rows.
            if (quietInFlightRef.current) return quietInFlightRef.current;
            const run = load(timeframe, 'quiet').finally(() => {
                quietInFlightRef.current = null;
            });
            quietInFlightRef.current = run;
            return run;
        },
        [load, timeframe]
    );

    // Home and the Training analytics tab both stay mounted, so without this the accuracy and latency
    // figures stay frozen at whatever they were when the screen first appeared.
    useFocusEffect(
        useCallback(() => {
            refresh({ silent: true });
        }, [refresh])
    );

    const exportReport = useCallback(async () => {
        if (!dataset || !dataset.hasData || !patientRef.current) return;
        setIsExporting(true);
        setExportError(null);
        setExportMessage(null);
        const result = await ReportService.exportReport(patientRef.current, dataset);
        if (!mountedRef.current) return;
        setIsExporting(false);
        if (result.error) {
            setExportError(result.error);
            return;
        }
        setExportMessage('Report saved.');
    }, [dataset]);

    const clearExportMessage = useCallback(() => {
        setExportMessage(null);
        setExportError(null);
    }, []);

    return {
        status,
        error,
        dataset,
        timeframe,
        setTimeframe,
        refresh,
        isRefreshing,
        isExporting,
        exportError,
        exportMessage,
        exportReport,
        clearExportMessage,
    };
}
