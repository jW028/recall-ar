import type { MemoryAsset } from '@/models/MemoryAsset';
import type {
    QuizFormat,
    SessionAttempt,
    SessionStep,
    SessionSummary,
} from '@/models/TrainingSession';

// Pure session-planning helpers. No database, no React — the viewmodel sequences what these produce.

// nameToPhoto is the harder retrieval direction, so it is reserved for assets that have already
// graduated. Changing the task shape on something still being learned adds load where it hurts most.
export function quizFormatFor(asset: MemoryAsset): QuizFormat {
    return asset.status === 'Maintenance' ? 'nameToPhoto' : 'photoToName';
}

// An asset that has never been attempted is taught before it is tested, so the patient's first
// retrieval is never a cold guess. reviewCount counts attempts, so 0 means "never seen".
export function needsTeach(asset: MemoryAsset): boolean {
    return asset.reviewCount === 0;
}

// Expands the due-asset queue into the session's steps. Each teach sits immediately before its own
// quiz — batching the intros up front would turn teach-then-probe into a study list.
export function buildSteps(assets: MemoryAsset[]): SessionStep[] {
    const steps: SessionStep[] = [];
    for (const asset of assets) {
        if (needsTeach(asset)) {
            steps.push({ kind: 'teach', stepId: `${asset.assetId}#teach`, asset });
        }
        steps.push({
            kind: 'quiz',
            stepId: `${asset.assetId}#quiz`,
            asset,
            format: quizFormatFor(asset),
            isRetry: false,
        });
    }
    return steps;
}

// Appends at most one retry per asset, at the end of the session. A missed answer is already due
// again immediately (computeSchedule sets next_review = now), so this just closes that loop before
// the patient leaves. Idempotent: a retapped answer after a failed submit cannot queue a second one.
export function appendRetry(steps: SessionStep[], step: SessionStep): SessionStep[] {
    if (step.kind !== 'quiz' || step.isRetry) return steps;
    const alreadyRetried = steps.some(
        (s) => s.kind === 'quiz' && s.isRetry && s.asset.assetId === step.asset.assetId
    );
    if (alreadyRetried) return steps;
    return [
        ...steps,
        {
            kind: 'quiz',
            stepId: `${step.asset.assetId}#retry`,
            asset: step.asset,
            // Copied, not recomputed: switching retrieval direction would make the retry a different
            // cognitive task on a row the analytics treat as comparable to the first attempt.
            format: step.format,
            isRetry: true,
        },
    ];
}

// Counts distinct assets, not attempts. Per-attempt counting would let "you remembered 6 memories"
// exceed the memories actually reviewed, and would encode the misses in a number the patient reads.
// A retry that lands earns the credit — the patient did remember it.
export function summarizeAttempts(
    attempts: SessionAttempt[],
    masteredNames: string[]
): SessionSummary {
    const seen = new Set<string>();
    const remembered = new Set<string>();
    for (const attempt of attempts) {
        seen.add(attempt.assetId);
        if (attempt.correct) remembered.add(attempt.assetId);
    }
    return {
        answered: seen.size,
        correct: remembered.size,
        masteredNames: [...new Set(masteredNames)],
    };
}

// Session progress only ever moves forward. Appending a retry grows the denominator, and the bar
// must not slide back for it — the one step that visibly stalls would be the one just missed.
export function nextFraction(previous: number, completed: number, total: number): number {
    if (total <= 0) return previous;
    return Math.max(previous, Math.min(completed / total, 1));
}
