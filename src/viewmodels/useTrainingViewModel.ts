import type { MemoryAsset } from '@/models/MemoryAsset';
import type { Question } from '@/models/TrainingSession';
import { EngagementService } from '@/services/EngagementService';
import { PairingService } from '@/services/PairingService';
import { SyncService } from '@/services/SyncService';
import { TrainingService } from '@/services/TrainingService';
import { useCallback, useEffect, useRef, useState } from 'react';

type TrainingStatus = 'loading' | 'ready' | 'empty' | 'complete' | 'error';

interface AnswerResult {
    selectedAssetId: string;
    correct: boolean;
}

// Positive-only session tally shown on the completion screen. Never tracks a "wrong" count.
export interface SessionSummary {
    answered: number;
    correct: number;
    masteredNames: string[]; // assets that graduated to Maintenance during this session
}

interface UseTrainingViewModel {
    status: TrainingStatus;
    error: string | null;
    question: Question | null;
    progress: { current: number; total: number };
    lastResult: AnswerResult | null;
    summary: SessionSummary;
    streakDays: number | undefined;
    isSubmitting: boolean;
    answer: (choice: MemoryAsset) => Promise<void>;
    next: () => void;
    // Called by the UI once the answer choices have painted, to start the response-latency timer from the moment the question is actually visible.
    markRendered: () => void;
}

export function useTrainingViewModel(): UseTrainingViewModel {
    const [status, setStatus] = useState<TrainingStatus>('loading');
    const [error, setError] = useState<string | null>(null);
    const [queue, setQueue] = useState<MemoryAsset[]>([]);
    const [index, setIndex] = useState(0);
    const [question, setQuestion] = useState<Question | null>(null);
    const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
    const [summary, setSummary] = useState<SessionSummary>({
        answered: 0,
        correct: 0,
        masteredNames: [],
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [streakDays, setStreakDays] = useState<number | undefined>(undefined);

    const patientIdRef = useRef<string | null>(null);
    // Timestamp (performance.now) of when the current question's choices painted. Null until the UI reports the paint, and reset for each question.
    const renderedAtRef = useRef<number | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Loads (or rebuilds) the question for a given queue position.
    const loadQuestion = useCallback(async (asset: MemoryAsset, patientId: string) => {
        // Arm the timer for the next paint; markRendered() stamps it once the new choices are on screen. Fetch/DB time must not count as think time.
        renderedAtRef.current = null;
        setQuestion(null);
        const result = await TrainingService.generateQuestion(asset, patientId);
        if (!mountedRef.current) return;
        if (result.error || !result.data) {
            setError(result.error ?? 'Failed to build question.');
            setStatus('error');
            return;
        }
        setQuestion(result.data);
    }, []);

    // Build the due-queue once on mount.
    useEffect(() => {
        (async () => {
            const pairing = await PairingService.getPersistedPairing();
            if (!mountedRef.current) return;
            if (!pairing) {
                setError('This device is not paired to a patient.');
                setStatus('error');
                return;
            }
            patientIdRef.current = pairing.patientId;

            // Hydrate caregiver-enrolled assets before building the queue so a freshly paired device has something to review. Best-effort: if the pull fails (offline), fall back to whatever is already local.
            await SyncService.pullAll(pairing.patientId).catch(() => {});
            if (!mountedRef.current) return;

            const result = await TrainingService.buildSessionQueue(pairing.patientId);
            if (!mountedRef.current) return;
            if (result.error || !result.data) {
                setError(result.error ?? 'Failed to load review session.');
                setStatus('error');
                return;
            }
            if (result.data.length === 0) {
                setStatus('empty');
                return;
            }
            setQueue(result.data);
            setStatus('ready');
            await loadQuestion(result.data[0], pairing.patientId);
        })();
    }, [loadQuestion]);

    // Fetch the streak for the summary screen once the session finishes; today's answers are already persisted by then.
    useEffect(() => {
        if (status !== 'complete' || !patientIdRef.current) return;
        EngagementService.getTrainingStreak(patientIdRef.current).then((result) => {
            if (mountedRef.current && result.data !== null) setStreakDays(result.data);
        });
    }, [status]);

    // Stamp the paint time once per question. Only the first paint counts; later onLayout passes (rotation, reveal) must not restart the timer.
    const markRendered = useCallback(() => {
        if (renderedAtRef.current === null) {
            renderedAtRef.current = performance.now();
        }
    }, []);

    const answer = useCallback(
        async (choice: MemoryAsset) => {
            // Stop the latency timer first, before any scoring — the UC08 evaluation budget must never bleed into the measured human time.
            const answeredAt = performance.now();

            // Guard against double-taps and answering during the reveal.
            if (!question || lastResult || isSubmitting) return;

            // Null if the paint signal never arrived (defensive); never 0.
            const responseLatencyMs =
                renderedAtRef.current !== null
                    ? Math.round(answeredAt - renderedAtRef.current)
                    : null;

            const correct = choice.assetId === question.correctAsset.assetId;
            setIsSubmitting(true);
            const result = await TrainingService.submitAnswer(
                question.correctAsset.assetId,
                correct,
                responseLatencyMs
            );
            if (!mountedRef.current) return;
            setIsSubmitting(false);

            if (result.error || !result.data) {
                // Let the patient try again rather than blocking the session.
                setError(result.error ?? 'Failed to record answer. Please try again.');
                return;
            }
            const becameMastered = result.data.becameMastered;
            setError(null);
            setSummary((prev) => ({
                answered: prev.answered + 1,
                correct: prev.correct + (correct ? 1 : 0),
                masteredNames: becameMastered
                    ? [...prev.masteredNames, question.correctAsset.name]
                    : prev.masteredNames,
            }));
            setLastResult({ selectedAssetId: choice.assetId, correct });
        },
        [question, lastResult, isSubmitting]
    );

    const next = useCallback(() => {
        const patientId = patientIdRef.current;
        if (!patientId) return;

        const nextIndex = index + 1;
        setLastResult(null);
        if (nextIndex >= queue.length) {
            setStatus('complete');
            return;
        }
        setIndex(nextIndex);
        loadQuestion(queue[nextIndex], patientId);
    }, [index, queue, loadQuestion]);

    return {
        status,
        error,
        question,
        progress: { current: index + 1, total: queue.length },
        lastResult,
        summary,
        streakDays,
        isSubmitting,
        answer,
        next,
        markRendered,
    };
}
