// Caregiver-selectable analytics window (UC03)
export type AnalyticsTimeframe = '7d' | '30d';

// Which way a biomarker is moving over the window
export type TrendDirection = 'improving' | 'stable' | 'declining';

// One day's value for a biomarker: raw daily figure plus its 7-day smoothed value
export interface DailyPoint {
    date: string; // YYYY-MM-DD
    raw: number | null; // null when no answered questions that day (latency) or no data
    smoothed: number | null; // rolling-average value, null until enough history exists
}

// The complete computed dataset UC04 returns and UC03 charts (and ReportService re-renders)
export interface AnalyticsDataset {
    // False triggers the UC03 A1 empty state ("complete at least one Memory Quiz session")
    hasData: boolean;
    // True when sessions exist but fall below the minimum for a trustworthy trend
    insufficientData: boolean;

    rangeStart: string; // YYYY-MM-DD inclusive
    rangeEnd: string; // YYYY-MM-DD inclusive

    // Biomarker 1: recognition accuracy per day (0..1), raw + smoothed
    accuracyByDay: DailyPoint[];
    // Biomarker 2: median response latency per day (ms), raw + smoothed, null-aware
    latencyByDay: DailyPoint[];

    // Least-squares slope of the smoothed series over the window
    accuracySlope: number; // negative = declining recognition
    latencySlope: number; // positive = slowing responses

    // UC04 A2 degradation flag: accuracy trending down OR latency trending up, past the deadband, with enough data
    isDegrading: boolean;

    // Summary scalars for the dashboard header
    currentAccuracy: number | null; // most recent smoothed accuracy
    currentMedianLatencyMs: number | null; // most recent smoothed latency
    trendDirection: TrendDirection;

    // Engagement (adherence) — from DailyReviewEntry, shown distinctly from biomarkers
    daysActive: number;
    completionRate: number; // 0..1
    // Consecutive-day training streak (UTC days; may differ ±1 from the patient's device-local chip)
    currentStreakDays: number;

    // Data-sufficiency counters (also surfaced to the caregiver)
    sessionsCount: number;
    distinctDaysCount: number;
}
