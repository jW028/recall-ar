import type { AnalyticsDataset, AnalyticsTimeframe } from '@/models/Analytics';
import type { Patient } from '@/models/Patient';
import { AnalyticsService } from '@/services/AnalyticsService';
import { PatientService } from '@/services/PatientService';
import { ReportService } from '@/services/ReportService';
import { useCallback, useEffect, useRef, useState } from 'react';

type AnalyticsStatus = 'loading' | 'ready' | 'empty' | 'error';

interface UseAnalyticsViewModel {
    status: AnalyticsStatus;
    error: string | null;
    dataset: AnalyticsDataset | null;
    timeframe: AnalyticsTimeframe;
    setTimeframe: (timeframe: AnalyticsTimeframe) => void;
    refresh: () => Promise<void>;
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

    const load = useCallback(
        async (tf: AnalyticsTimeframe) => {
            if (!patientId) {
                setError('Patient not found.');
                setStatus('error');
                return;
            }
            setStatus('loading');
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
                return;
            }
            setDataset(result.data);
            setStatus(result.data.hasData ? 'ready' : 'empty');
        },
        [patientId]
    );

    useEffect(() => {
        load(timeframe);
    }, [load, timeframe]);

    const setTimeframe = useCallback((tf: AnalyticsTimeframe) => {
        setTimeframeState(tf);
    }, []);

    const refresh = useCallback(() => load(timeframe), [load, timeframe]);

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
        isExporting,
        exportError,
        exportMessage,
        exportReport,
        clearExportMessage,
    };
}
