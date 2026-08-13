import type { MemoryAsset } from '@/models/MemoryAsset';
import type {
    Question,
    SessionAttempt,
    SessionStep,
    SessionSummary,
} from '@/models/TrainingSession';
import { EngagementService } from '@/services/EngagementService';
import { MemoryAssetService } from '@/services/MemoryAssetService';
import { PairingService } from '@/services/PairingService';
import { SyncService } from '@/services/SyncService';
import { TrainingService } from '@/services/TrainingService';
import { appendRetry, buildSteps, nextFraction, summarizeAttempts } from '@/utils/sessionSteps';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// 'empty' means nothing is due yet, 'unenrolled' means the caregiver has added nothing to review at all
type TrainingStatus = 'loading' | 'ready' | 'empty' | 'unenrolled' | 'complete' | 'error';

interface AnswerResult {
    selectedAssetId: string;
    correct: boolean;
}

interface UseTrainingViewModel {
    status: TrainingStatus;
    error: string | null;
    step: SessionStep | null;
    // Photo the next step will show, so the view can warm it before the patient gets there.
    nextImageUrl: string | null;
    question: Question | null;
    // Monotonic 0-1 fill for the session bar. Advancing is the only thing that moves it.
    progress: { fraction: number };
    lastResult: AnswerResult | null;
    summary: SessionSummary;
    streakDays: number | undefined;
    isSubmitting: boolean;
    // Whether there are graduated memories available for optional extra practice.
    practiceAvailable: boolean;
    // Starts a practice session over graduated memories. Nothing here was due, so nothing is owed.
    startPractice: () => Promise<void>;
    answer: (choice: MemoryAsset) => Promise<void>;
    // Advances the session. Also the teach card's "Got it" handler — one advance path is easier to keep correct than two.
    next: () => void;
    // Called by the UI once the answer choices are actually visible, to start the response-latency timer from that moment.
    markRendered: () => void;
}

export function useTrainingViewModel(): UseTrainingViewModel {
    const [status, setStatus] = useState<TrainingStatus>('loading');
    const [error, setError] = useState<string | null>(null);
    const [steps, setSteps] = useState<SessionStep[]>([]);
    const [index, setIndex] = useState(0);
    const [question, setQuestion] = useState<Question | null>(null);
    const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
    const [attempts, setAttempts] = useState<SessionAttempt[]>([]);
    const [masteredNames, setMasteredNames] = useState<string[]>([]);
    const [progressFraction, setProgressFraction] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [streakDays, setStreakDays] = useState<number | undefined>(undefined);
    const [practiceAvailable, setPracticeAvailable] = useState(false);

    const patientIdRef = useRef<string | null>(null);
    // Timestamp (performance.now) of when the current question's choices became visible. Null until the UI reports it, and reset for each step.
    const renderedAtRef = useRef<number | null>(null);
    // Guards against a slow generateQuestion from a previous step resolving after the next one loaded.
    const loadTokenRef = useRef(0);
    // A teach step must never leave a latency stamp behind for the quiz that follows it.
    const currentStepKindRef = useRef<SessionStep['kind'] | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Loads whatever the given step needs. Teach steps fetch nothing and are never timed.
    const loadStep = useCallback(async (step: SessionStep, patientId: string) => {
        const token = ++loadTokenRef.current;
        // Arm the timer for the next paint; markRendered() stamps it once the new choices are visible. Fetch/DB time must not count as think time.
        renderedAtRef.current = null;
        currentStepKindRef.current = step.kind;
        setQuestion(null);
        if (step.kind === 'teach') return;

        const result = await TrainingService.generateQuestion(step.asset, patientId);
        // A teach card can be acknowledged instantly, so a stale fetch could otherwise overwrite the current question and desync the latency stamp from what is on screen.
        if (!mountedRef.current || token !== loadTokenRef.current) return;
        if (result.error || !result.data) {
            setError(result.error ?? 'Failed to build question.');
            setStatus('error');
            return;
        }
        setQuestion(result.data);
    }, []);

    // Build the session's steps once on mount.
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
                // An empty queue with no enrolled assets is an unfinished setup, not a completed review
                const enrolled = await MemoryAssetService.getAssetsByPatient(pairing.patientId);
                if (!mountedRef.current) return;
                // Offer extra practice only when there is actually something to practise, so the
                // button is never a dead end.
                const practice = await TrainingService.buildPracticeQueue(pairing.patientId);
                if (!mountedRef.current) return;
                setPracticeAvailable((practice.data?.length ?? 0) > 0);
                setStatus(enrolled.data && enrolled.data.length > 0 ? 'empty' : 'unenrolled');
                return;
            }
            const planned = buildSteps(result.data);
            setSteps(planned);
            setStatus('ready');
            await loadStep(planned[0], pairing.patientId);
        })();
    }, [loadStep]);

    // Fetch the streak for the summary screen once the session finishes; today's answers are already persisted by then.
    useEffect(() => {
        if (status !== 'complete' || !patientIdRef.current) return;
        const patientId = patientIdRef.current;
        EngagementService.getTrainingStreak(patientId).then((result) => {
            if (mountedRef.current && result.data !== null) setStreakDays(result.data);
        });
        // Re-checked here so the summary can offer to keep going, not just the empty state.
        TrainingService.buildPracticeQueue(patientId).then((result) => {
            if (mountedRef.current) setPracticeAvailable((result.data?.length ?? 0) > 0);
        });
    }, [status]);

    // Stamp the visible-at time once per step. Only the first signal counts; later passes must not restart the timer.
    const markRendered = useCallback(() => {
        if (currentStepKindRef.current !== 'quiz') return;
        if (renderedAtRef.current === null) {
            renderedAtRef.current = performance.now();
        }
    }, []);

    const answer = useCallback(
        async (choice: MemoryAsset) => {
            // Stop the latency timer first, before any scoring — the UC08 evaluation budget must never bleed into the measured human time.
            const answeredAt = performance.now();

            const step = steps[index];
            // A teach step has nothing to submit.
            if (!step || step.kind !== 'quiz') return;
            // Guard against double-taps and answering during the reveal.
            if (!question || lastResult || isSubmitting) return;

            // Null if the visibility signal never arrived (defensive); never 0.
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
            setError(null);
            // Appended only once the write has landed, so a retap after a transient failure cannot queue two retries. appendRetry is idempotent regardless.
            if (!correct) setSteps((prev) => appendRetry(prev, step));
            setAttempts((prev) => [...prev, { assetId: step.asset.assetId, correct }]);
            if (result.data.becameMastered) {
                setMasteredNames((prev) => [...prev, question.correctAsset.name]);
            }
            setLastResult({ selectedAssetId: choice.assetId, correct });
        },
        [steps, index, question, lastResult, isSubmitting]
    );

    const next = useCallback(() => {
        const patientId = patientIdRef.current;
        if (!patientId) return;

        const completed = index + 1;
        setLastResult(null);
        // `steps` here already includes any retry appended by the answer that preceded this tap, so the denominator is settled before the bar moves.
        setProgressFraction((prev) => nextFraction(prev, completed, steps.length));
        if (completed >= steps.length) {
            setStatus('complete');
            return;
        }
        setIndex(completed);
        loadStep(steps[completed], patientId);
    }, [index, steps, loadStep]);

    // Optional extra practice over graduated memories. Resets the session in place rather than
    // navigating, so "keep going" costs the patient one tap.
    const startPractice = useCallback(async () => {
        const patientId = patientIdRef.current;
        if (!patientId) return;
        setStatus('loading');
        const result = await TrainingService.buildPracticeQueue(patientId);
        if (!mountedRef.current) return;
        if (result.error || !result.data || result.data.length === 0) {
            setPracticeAvailable(false);
            setStatus('empty');
            return;
        }
        const planned = buildSteps(result.data);
        setSteps(planned);
        setIndex(0);
        setAttempts([]);
        setMasteredNames([]);
        setProgressFraction(0);
        setLastResult(null);
        setError(null);
        setStatus('ready');
        await loadStep(planned[0], patientId);
    }, [loadStep]);

    const summary = useMemo(
        () => summarizeAttempts(attempts, masteredNames),
        [attempts, masteredNames]
    );

    return {
        status,
        error,
        step: steps[index] ?? null,
        nextImageUrl: steps[index + 1]?.asset.imageUrl ?? null,
        question,
        progress: { fraction: progressFraction },
        lastResult,
        summary,
        streakDays,
        isSubmitting,
        practiceAvailable,
        startPractice,
        answer,
        next,
        markRendered,
    };
}
