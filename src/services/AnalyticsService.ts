import {
    ANALYTICS_ACCURACY_SLOPE_DEADBAND,
    ANALYTICS_LATENCY_SLOPE_DEADBAND,
    ANALYTICS_MAX_WINDOW_DAYS,
    ANALYTICS_MIN_DAYS_FOR_TREND,
    ANALYTICS_MIN_SESSIONS_FOR_TREND,
    ANALYTICS_SMOOTHING_DAYS,
} from '@/constants/config';
import { getDatabase } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import { computeStreak } from '@/utils/streak';
import type {
    AnalyticsDataset,
    AnalyticsTimeframe,
    DailyPoint,
    TrendDirection,
} from '@/models/Analytics';

// Types
export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

// One answered question pulled from the cloud, trimmed to what the biomarkers need
interface SessionRow {
    success: boolean;
    timestamp: string;
    response_latency_ms: number | null;
}

// One queue entry pulled from the cloud, trimmed to what engagement needs
interface ReviewRow {
    queue_date: string;
    completed: boolean;
}

// ── Pure helpers (no DB) — the riskiest logic, kept independently testable ──

// Median of a numeric list. Returns null for an empty list. Caller must pre-filter nulls.
export function median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

// Trailing rolling average over `window` days, skipping nulls. A day with no values in its window stays null.
export function rollingAverage(values: (number | null)[], window: number): (number | null)[] {
    return values.map((_, i) => {
        const start = Math.max(0, i - window + 1);
        const slice = values.slice(start, i + 1).filter((v): v is number => v !== null);
        if (slice.length === 0) return null;
        return slice.reduce((sum, v) => sum + v, 0) / slice.length;
    });
}

// Least-squares slope (per x-step) of a series, ignoring null y values. Needs ≥2 points, else 0.
export function linearRegressionSlope(values: (number | null)[]): number {
    const points = values
        .map((y, x) => ({ x, y }))
        .filter((p): p is { x: number; y: number } => p.y !== null);
    if (points.length < 2) return 0;

    const n = points.length;
    const meanX = points.reduce((s, p) => s + p.x, 0) / n;
    const meanY = points.reduce((s, p) => s + p.y, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
        num += (p.x - meanX) * (p.y - meanY);
        den += (p.x - meanX) ** 2;
    }
    return den === 0 ? 0 : num / den;
}

// The UTC date portion (YYYY-MM-DD) of an ISO timestamp, used for day bucketing.
function dayOf(isoTimestamp: string): string {
    return isoTimestamp.slice(0, 10);
}

// Inclusive list of YYYY-MM-DD dates from start to end, so charts/smoothing have a continuous x-axis.
function dateRange(start: Date, end: Date): string[] {
    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}

// Last non-null value of a daily series (the current smoothed reading).
function latest(series: DailyPoint[], key: 'smoothed'): number | null {
    for (let i = series.length - 1; i >= 0; i--) {
        if (series[i][key] !== null) return series[i][key];
    }
    return null;
}

// Maps timeframe to a window length in days, clamped to the hard cap.
function windowDays(timeframe: AnalyticsTimeframe): number {
    const requested = timeframe === '7d' ? 7 : 30;
    return Math.min(requested, ANALYTICS_MAX_WINDOW_DAYS);
}

// Builds the empty-state dataset (no sessions) for UC03 A1.
function emptyDataset(rangeStart: string, rangeEnd: string): AnalyticsDataset {
    return {
        hasData: false,
        insufficientData: false,
        rangeStart,
        rangeEnd,
        accuracyByDay: [],
        latencyByDay: [],
        accuracySlope: 0,
        latencySlope: 0,
        isDegrading: false,
        currentAccuracy: null,
        currentMedianLatencyMs: null,
        trendDirection: 'stable',
        daysActive: 0,
        completionRate: 0,
        currentStreakDays: 0,
        sessionsCount: 0,
        distinctDaysCount: 0,
    };
}

// Streak lookback (days). Separate from the analytics window so a long streak isn't clamped by the 7/30d timeframe.
const STREAK_LOOKBACK_DAYS = 120;

// Consecutive-day streak from cloud TrainingSession timestamps, bucketed by UTC day.
async function fetchStreakDays(assetIds: string[]): Promise<number> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - STREAK_LOOKBACK_DAYS);
    const { data, error } = await supabase
        .from('TrainingSession')
        .select('timestamp')
        .in('asset_id', assetIds)
        .gte('timestamp', since.toISOString());
    if (error || !data) return 0;
    const days = (data as { timestamp: string }[]).map((r) => dayOf(r.timestamp));
    return computeStreak(days, new Date().toISOString().slice(0, 10));
}

// Lightweight engagement read for the caregiver Overview tab — one bounded cloud query, no full analytics run.
export interface EngagementSnapshot {
    streakDays: number;
    answeredToday: number;
    lastActiveDay: string | null;
}

async function getEngagementSnapshot(
    patientId: string
): Promise<ServiceResult<EngagementSnapshot>> {
    let assetIds: string[];
    try {
        const db = getDatabase();
        const rows = await db.getAllAsync<{ asset_id: string }>(
            `SELECT asset_id FROM MemoryAsset WHERE patient_id = ?`,
            [patientId]
        );
        assetIds = rows.map((r) => r.asset_id);
    } catch {
        return { data: null, error: 'Failed to load patient assets.' };
    }

    if (assetIds.length === 0) {
        return { data: { streakDays: 0, answeredToday: 0, lastActiveDay: null }, error: null };
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - STREAK_LOOKBACK_DAYS);
    const { data, error } = await supabase
        .from('TrainingSession')
        .select('timestamp')
        .in('asset_id', assetIds)
        .gte('timestamp', since.toISOString());
    if (error) {
        return { data: null, error: 'Failed to load engagement from cloud.' };
    }

    const days = ((data ?? []) as { timestamp: string }[]).map((r) => dayOf(r.timestamp));
    const today = new Date().toISOString().slice(0, 10);
    return {
        data: {
            streakDays: computeStreak(days, today),
            answeredToday: days.filter((d) => d === today).length,
            lastActiveDay: days.length > 0 ? days.reduce((a, b) => (a > b ? a : b)) : null,
        },
        error: null,
    };
}

// UC04: aggregate the patient's training data over the window into a charting-ready dataset.
async function generateAnalytics(
    patientId: string,
    timeframe: AnalyticsTimeframe
): Promise<ServiceResult<AnalyticsDataset>> {
    // Window: today back through N-1 days, all in UTC to match stored ISO timestamps
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - (windowDays(timeframe) - 1));
    const rangeStart = start.toISOString().slice(0, 10);
    const rangeEnd = end.toISOString().slice(0, 10);

    // Resolve the patient's assets locally — the caregiver device already holds these
    let assetIds: string[];
    try {
        const db = getDatabase();
        const rows = await db.getAllAsync<{ asset_id: string }>(
            `SELECT asset_id FROM MemoryAsset WHERE patient_id = ?`,
            [patientId]
        );
        assetIds = rows.map((r) => r.asset_id);
    } catch {
        return { data: null, error: 'Failed to load patient assets.' };
    }

    if (assetIds.length === 0) {
        return { data: emptyDataset(rangeStart, rangeEnd), error: null };
    }

    // Bounded cloud reads — training data lives in Supabase, pushed from the patient device
    const { data: sessionData, error: sessionError } = await supabase
        .from('TrainingSession')
        .select('success, timestamp, response_latency_ms')
        .in('asset_id', assetIds)
        .gte('timestamp', `${rangeStart}T00:00:00.000Z`)
        .lte('timestamp', `${rangeEnd}T23:59:59.999Z`)
        .order('timestamp', { ascending: true });

    if (sessionError) {
        return { data: null, error: 'Failed to load analytics from cloud.' };
    }

    const sessions = (sessionData ?? []) as SessionRow[];
    if (sessions.length === 0) {
        return { data: emptyDataset(rangeStart, rangeEnd), error: null };
    }

    const { data: reviewData, error: reviewError } = await supabase
        .from('DailyReviewEntry')
        .select('queue_date, completed')
        .eq('patient_id', patientId)
        .gte('queue_date', rangeStart)
        .lte('queue_date', rangeEnd);

    if (reviewError) {
        return { data: null, error: 'Failed to load analytics from cloud.' };
    }
    const reviews = (reviewData ?? []) as ReviewRow[];

    // Bucket sessions by UTC day
    const days = dateRange(start, end);
    const byDay = new Map<string, SessionRow[]>();
    for (const day of days) byDay.set(day, []);
    for (const s of sessions) {
        const day = dayOf(s.timestamp);
        byDay.get(day)?.push(s);
    }

    // Per-day raw accuracy and median latency (latency excludes null rows — never treated as 0)
    const accuracyRaw: (number | null)[] = [];
    const latencyRaw: (number | null)[] = [];
    for (const day of days) {
        const dayRows = byDay.get(day) ?? [];
        if (dayRows.length === 0) {
            accuracyRaw.push(null);
            latencyRaw.push(null);
            continue;
        }
        const correct = dayRows.filter((r) => r.success).length;
        accuracyRaw.push(correct / dayRows.length);
        const latencies = dayRows
            .map((r) => r.response_latency_ms)
            .filter((v): v is number => v !== null);
        latencyRaw.push(median(latencies));
    }

    // Smooth before any trend analysis or charting
    const accuracySmoothed = rollingAverage(accuracyRaw, ANALYTICS_SMOOTHING_DAYS);
    const latencySmoothed = rollingAverage(latencyRaw, ANALYTICS_SMOOTHING_DAYS);

    const accuracyByDay: DailyPoint[] = days.map((date, i) => ({
        date,
        raw: accuracyRaw[i],
        smoothed: accuracySmoothed[i],
    }));
    const latencyByDay: DailyPoint[] = days.map((date, i) => ({
        date,
        raw: latencyRaw[i],
        smoothed: latencySmoothed[i],
    }));

    // Trend slopes over the smoothed series
    const accuracySlope = linearRegressionSlope(accuracySmoothed);
    const latencySlope = linearRegressionSlope(latencySmoothed);

    // Data-sufficiency gates
    const sessionsCount = sessions.length;
    const distinctDaysCount = new Set(sessions.map((s) => dayOf(s.timestamp))).size;
    const enoughData =
        sessionsCount >= ANALYTICS_MIN_SESSIONS_FOR_TREND &&
        distinctDaysCount >= ANALYTICS_MIN_DAYS_FOR_TREND;
    const insufficientData = !enoughData;

    // UC04 A2 degradation flag: accuracy falling OR latency rising past the deadband, with enough data
    const accuracyDeclining = accuracySlope < -ANALYTICS_ACCURACY_SLOPE_DEADBAND;
    const latencyRising = latencySlope > ANALYTICS_LATENCY_SLOPE_DEADBAND;
    const isDegrading = enoughData && (accuracyDeclining || latencyRising);

    // Headline trend direction
    let trendDirection: TrendDirection = 'stable';
    if (isDegrading) {
        trendDirection = 'declining';
    } else if (
        enoughData &&
        (accuracySlope > ANALYTICS_ACCURACY_SLOPE_DEADBAND ||
            latencySlope < -ANALYTICS_LATENCY_SLOPE_DEADBAND)
    ) {
        trendDirection = 'improving';
    }

    const currentStreakDays = await fetchStreakDays(assetIds);

    // Engagement (adherence) from DailyReviewEntry — separate axis from the biomarkers
    const activeDays = new Set(reviews.filter((r) => r.completed).map((r) => r.queue_date));
    const completionRate =
        reviews.length === 0
            ? 0
            : reviews.filter((r) => r.completed).length / reviews.length;

    return {
        data: {
            hasData: true,
            insufficientData,
            rangeStart,
            rangeEnd,
            accuracyByDay,
            latencyByDay,
            accuracySlope,
            latencySlope,
            isDegrading,
            currentAccuracy: latest(accuracyByDay, 'smoothed'),
            currentMedianLatencyMs: latest(latencyByDay, 'smoothed'),
            trendDirection,
            daysActive: activeDays.size,
            completionRate,
            currentStreakDays,
            sessionsCount,
            distinctDaysCount,
        },
        error: null,
    };
}

export const AnalyticsService = {
    generateAnalytics,
    getEngagementSnapshot,
};
