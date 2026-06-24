import {
    MASTERY_STREAK_THRESHOLD,
    MAX_DAILY_QUESTIONS,
    ONBOARDING_INTERVALS_MINUTES,
} from '@/constants/config';
import { getDatabase } from '@/database/local/db';
import type { MemoryAsset, MemoryAssetStatus } from '@/models/MemoryAsset';
import type { Question, TrainingSession } from '@/models/TrainingSession';
import * as Crypto from 'expo-crypto';
import { MemoryAssetService, type ServiceResult } from './MemoryAssetService';
import type { SyncableTable } from './syncTableConfig';

// Maintenance interval growth is not designed yet, so a graduated asset that is answered again is parked far in the future to leave the queue.
const MAINTENANCE_PARK_UNTIL = '9999-12-31T23:59:59.999Z';

// Helpers

function nowIso(): string {
    return new Date().toISOString();
}

// Date portion (YYYY-MM-DD) of an ISO-8601 timestamp.
function dayOf(isoTimestamp: string): string {
    return isoTimestamp.slice(0, 10);
}

function addMinutesIso(from: Date, minutes: number): string {
    return new Date(from.getTime() + minutes * 60_000).toISOString();
}

function shuffle<T>(items: T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function randomSample<T>(items: T[], count: number): T[] {
    return shuffle(items).slice(0, count);
}

// Next rung of the 1-2-4-8-16 ladder, or null once the final rung is done (asset graduates to Maintenance).
function nextOnboardingInterval(current: number): number | null {
    const idx = ONBOARDING_INTERVALS_MINUTES.indexOf(
        current as (typeof ONBOARDING_INTERVALS_MINUTES)[number]
    );
    // Unknown value (shouldn't happen) — restart the ladder.
    if (idx === -1) return ONBOARDING_INTERVALS_MINUTES[0];
    if (idx >= ONBOARDING_INTERVALS_MINUTES.length - 1) return null;
    return ONBOARDING_INTERVALS_MINUTES[idx + 1];
}

interface ScheduleUpdate {
    nextReview: string;
    intervalMinutes: number;
    status: MemoryAssetStatus;
}

// Decides the next schedule for one answer, anchored to the actual answer time.
function computeSchedule(asset: MemoryAsset, success: boolean, now: Date): ScheduleUpdate {
    // Wrong: due again now, interval reset to the first rung, status never demoted.
    if (!success) {
        return {
            nextReview: now.toISOString(),
            intervalMinutes: ONBOARDING_INTERVALS_MINUTES[0],
            status: asset.status,
        };
    }

    // Already graduated: park instead of inventing a Maintenance interval.
    if (asset.status === 'Maintenance') {
        return {
            nextReview: MAINTENANCE_PARK_UNTIL,
            intervalMinutes: asset.currentIntervalMinutes,
            status: 'Maintenance',
        };
    }

    // Onboarding + correct: schedule the earned review, then advance the ladder.
    const nextReview = addMinutesIso(now, asset.currentIntervalMinutes);
    const advanced = nextOnboardingInterval(asset.currentIntervalMinutes);

    // Final rung done: graduate but still schedule the earned review.
    if (advanced === null) {
        return {
            nextReview,
            intervalMinutes: asset.currentIntervalMinutes,
            status: 'Maintenance',
        };
    }

    return { nextReview, intervalMinutes: advanced, status: 'Onboarding' };
}

function isMasteredFrom(recent: { success: boolean; timestamp: string }[]): boolean {
    if (recent.length < MASTERY_STREAK_THRESHOLD) return false;
    if (!recent.every((r) => r.success)) return false;
    const distinctDays = new Set(recent.map((r) => dayOf(r.timestamp)));
    return distinctDays.size === MASTERY_STREAK_THRESHOLD;
}

async function queueSync(
    tableName: SyncableTable,
    rowId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
): Promise<void> {
    const db = getDatabase();
    await db.runAsync(
        `INSERT OR REPLACE INTO SyncLog (sync_id, table_name, row_id, operation, synced, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now'))`,
        [Crypto.randomUUID(), tableName, rowId, operation]
    );
}

// Public API

// Builds today's due-queue and writes one DailyReviewEntry per due asset (once per day). Returns due assets, onboarding-first.
async function buildSessionQueue(
    patientId: string
): Promise<ServiceResult<MemoryAsset[]>> {
    const db = getDatabase();
    const now = nowIso();
    const queueDate = dayOf(now);

    try {
        // Due-ness is the live next_review check; onboarding items sort first. Paused assets are
        // never queued regardless of next_review.
        const dueRows = await db.getAllAsync<{ asset_id: string; status: string }>(
            `SELECT asset_id, status FROM MemoryAsset
            WHERE patient_id = ? AND status != 'Paused' AND next_review <= ?
            ORDER BY (status = 'Onboarding') DESC, next_review ASC
            LIMIT ?`,
            [patientId, now, MAX_DAILY_QUESTIONS]
        );

        const assets: MemoryAsset[] = [];

        for (let position = 0; position < dueRows.length; position++) {
            const { asset_id } = dueRows[position];

            const assetResult = await MemoryAssetService.getAssetById(asset_id);
            if (assetResult.error || !assetResult.data) continue;
            const asset = assetResult.data;
            assets.push(asset);

            // Already queued today — write-once, don't duplicate.
            const existing = await db.getFirstAsync<{ review_id: string }>(
                `SELECT review_id FROM DailyReviewEntry WHERE asset_id = ? AND queue_date = ?`,
                [asset_id, queueDate]
            );
            if (existing) continue;

            const reviewId = Crypto.randomUUID();
            await db.runAsync(
                `INSERT INTO DailyReviewEntry
                    (review_id, patient_id, asset_id, queue_date, position, is_onboarding, completed)
                VALUES (?, ?, ?, ?, ?, ?, 0)`,
                [reviewId, patientId, asset_id, queueDate, position, asset.status === 'Onboarding' ? 1 : 0]
            );
            await queueSync('DailyReviewEntry', reviewId, 'INSERT');
        }

        return { data: assets, error: null };
    } catch {
        return { data: null, error: 'Failed to build review session.' };
    }
}

// Builds a four-choice question. Distractors are same-category only; fewer than 3 means fewer choices, never mixed categories.
async function generateQuestion(
    correctAsset: MemoryAsset,
    patientId: string
): Promise<ServiceResult<Question>> {
    const result = await MemoryAssetService.getAssetsByPatient(patientId, correctAsset.type);
    if (result.error || !result.data) {
        return { data: null, error: result.error ?? 'Failed to build question.' };
    }

    const sameCategory = result.data.filter((a) => a.assetId !== correctAsset.assetId);
    const distractors =
        sameCategory.length < 3 ? sameCategory : randomSample(sameCategory, 3);

    return {
        data: { correctAsset, choices: shuffle([correctAsset, ...distractors]) },
        error: null,
    };
}

// Mastered when the latest 3 attempts are all correct and fall on 3 distinct days.
// Reads TrainingSession only, which pausing never touches — so a pause suspends the streak (a gap),
// it does not reset it. Do not add date-continuity filtering that a paused gap would violate.
async function checkMastery(assetId: string): Promise<boolean> {
    const db = getDatabase();
    const recent = await db.getAllAsync<{ success: number; timestamp: string }>(
        `SELECT success, timestamp FROM TrainingSession
        WHERE asset_id = ? ORDER BY timestamp DESC LIMIT ?`,
        [assetId, MASTERY_STREAK_THRESHOLD]
    );
    return isMasteredFrom(recent.map((r) => ({ success: r.success === 1, timestamp: r.timestamp })));
}

// Records one answer: session insert, asset schedule update, and queue completion in a single transaction, then queues each for sync.
async function submitAnswer(
    assetId: string,
    success: boolean,
    responseLatencyMs: number | null
): Promise<ServiceResult<TrainingSession>> {
    const assetResult = await MemoryAssetService.getAssetById(assetId);
    if (assetResult.error || !assetResult.data) {
        return { data: null, error: assetResult.error ?? 'Memory not found.' };
    }
    const asset = assetResult.data;

    const now = new Date();
    const timestamp = now.toISOString();
    const intervalUsed = asset.currentIntervalMinutes; // interval active for THIS attempt
    const schedule = computeSchedule(asset, success, now);

    // Mastery includes this answer: combine the 2 most recent past attempts with it.
    const db = getDatabase();
    let status = schedule.status;
    if (success && status !== 'Maintenance') {
        const pastTwo = await db.getAllAsync<{ success: number; timestamp: string }>(
            `SELECT success, timestamp FROM TrainingSession
            WHERE asset_id = ? ORDER BY timestamp DESC LIMIT ?`,
            [assetId, MASTERY_STREAK_THRESHOLD - 1]
        );
        const combined = [
            { success, timestamp },
            ...pastTwo.map((r) => ({ success: r.success === 1, timestamp: r.timestamp })),
        ];
        if (isMasteredFrom(combined)) status = 'Maintenance';
    }

    const sessionId = Crypto.randomUUID();
    const queueDate = dayOf(timestamp);

    // Open queue entry for this asset today, if any.
    const openEntry = await db.getFirstAsync<{ review_id: string }>(
        `SELECT review_id FROM DailyReviewEntry
        WHERE asset_id = ? AND queue_date = ? AND completed = 0
        ORDER BY position ASC LIMIT 1`,
        [assetId, queueDate]
    );

    try {
        await db.withExclusiveTransactionAsync(async () => {
            await db.runAsync(
                `INSERT INTO TrainingSession (session_id, asset_id, timestamp, interval_minutes, success, response_latency_ms)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [sessionId, assetId, timestamp, intervalUsed, success ? 1 : 0, responseLatencyMs]
            );

            await db.runAsync(
                `UPDATE MemoryAsset
                SET current_interval_minutes = ?, next_review = ?, review_count = review_count + 1,
                    status = ?, updated_at = ?
                WHERE asset_id = ?`,
                [schedule.intervalMinutes, schedule.nextReview, status, timestamp, assetId]
            );

            if (openEntry) {
                await db.runAsync(
                    `UPDATE DailyReviewEntry SET completed = 1 WHERE review_id = ?`,
                    [openEntry.review_id]
                );
            }
        });
    } catch {
        return { data: null, error: 'Failed to record answer. Please try again.' };
    }

    // Queue each write for sync after the transaction commits.
    await queueSync('TrainingSession', sessionId, 'INSERT');
    await queueSync('MemoryAsset', assetId, 'UPDATE');
    if (openEntry) await queueSync('DailyReviewEntry', openEntry.review_id, 'UPDATE');

    return {
        data: { sessionId, assetId, timestamp, intervalMinutes: intervalUsed, success, responseLatencyMs },
        error: null,
    };
}

export const TrainingService = {
    buildSessionQueue,
    generateQuestion,
    submitAnswer,
    checkMastery,
};
