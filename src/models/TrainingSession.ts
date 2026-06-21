import type { MemoryAsset } from './MemoryAsset';

// One recorded quiz attempt. Written once per answer.
export interface TrainingSession {
    sessionId: string;
    assetId: string;
    timestamp: string; // ISO-8601 timestamp of when the answer was submitted
    intervalMinutes: number; // the SRT interval that was active for this attempt
    success: boolean; // SQLite stores 0/1; mapped to boolean at the service layer
    // Time (ms) from question render to the patient's tap, measured before scoring. Null for attempts recorded before latency capture existed.
    responseLatencyMs: number | null;
}

// Audit record of what was queued for a day and whether it was finished.
export interface DailyReviewEntry {
    reviewId: string;
    patientId: string;
    assetId: string;
    queueDate: string; // YYYY-MM-DD
    position: number; // order within that day's queue
    isOnboarding: boolean; // whether the asset was still onboarding when queued
    completed: boolean;
}

// A four-choice question: the correct asset plus same-category distractors, shuffled. Holds 2-4 items.
export interface Question {
    correctAsset: MemoryAsset;
    choices: MemoryAsset[];
}
