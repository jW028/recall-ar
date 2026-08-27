// The degradation flag, computed here exactly as the caregiver's own Analytics tab computes it.
//
// The constants and the three statistical helpers are imported from the Expo app rather than copied,
// so there is one definition of "declining" on the platform. If the app's deadbands or smoothing
// window change, this changes with them. Reimplementing the same shape in SQL with regr_slope would
// have been faster to query and would have quietly disagreed with what the caregiver sees.

import {
    ANALYTICS_ACCURACY_SLOPE_DEADBAND,
    ANALYTICS_LATENCY_SLOPE_DEADBAND,
    ANALYTICS_MIN_DAYS_FOR_TREND,
    ANALYTICS_MIN_SESSIONS_FOR_TREND,
    ANALYTICS_SMOOTHING_DAYS,
} from '@app/constants/config';
import type { DailyPoint, TrendDirection } from '@app/models/Analytics';
import { linearRegressionSlope, rollingAverage } from '@app/utils/stats';
import { computeStreak } from '@app/utils/streak';

// One row of admin_patient_daily.
export interface PatientDailyRow {
    patient_id: string;
    day: string;
    sessions: number;
    correct: number;
    accuracy: number;
    median_latency_ms: number | null;
}

export interface PatientBiomarkers {
    patientId: string;
    hasData: boolean;
    insufficientData: boolean;
    accuracyByDay: DailyPoint[];
    latencyByDay: DailyPoint[];
    accuracySlope: number;
    latencySlope: number;
    isDegrading: boolean;
    currentAccuracy: number | null;
    currentMedianLatencyMs: number | null;
    trendDirection: TrendDirection;
    sessionsCount: number;
    distinctDaysCount: number;
    currentStreakDays: number;
}

// Inclusive YYYY-MM-DD range, so smoothing sees a continuous axis with gaps as nulls rather than
// as absent points. A day with no training must not be treated as a day with zero accuracy.
function dateRange(days: number): string[] {
    const dates: string[] = [];
    const cursor = new Date();
    cursor.setUTCHours(0, 0, 0, 0);
    cursor.setUTCDate(cursor.getUTCDate() - (days - 1));
    for (let i = 0; i < days; i++) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}

function latest(series: DailyPoint[]): number | null {
    for (let i = series.length - 1; i >= 0; i--) {
        if (series[i].smoothed !== null) return series[i].smoothed;
    }
    return null;
}

export function computeBiomarkers(
    patientId: string,
    rows: PatientDailyRow[],
    windowDays: number
): PatientBiomarkers {
    const days = dateRange(windowDays);
    const earliest = days[0];
    const inWindow = rows.filter((r) => r.day >= earliest);
    const byDay = new Map(inWindow.map((r) => [r.day, r]));

    const accuracyRaw = days.map((d) => byDay.get(d)?.accuracy ?? null);
    const latencyRaw = days.map((d) => byDay.get(d)?.median_latency_ms ?? null);

    const accuracySmoothed = rollingAverage(accuracyRaw, ANALYTICS_SMOOTHING_DAYS);
    const latencySmoothed = rollingAverage(latencyRaw, ANALYTICS_SMOOTHING_DAYS);

    const accuracyByDay: DailyPoint[] = days.map((date, i) => ({
        date, raw: accuracyRaw[i], smoothed: accuracySmoothed[i],
    }));
    const latencyByDay: DailyPoint[] = days.map((date, i) => ({
        date, raw: latencyRaw[i], smoothed: latencySmoothed[i],
    }));

    const accuracySlope = linearRegressionSlope(accuracySmoothed);
    const latencySlope = linearRegressionSlope(latencySmoothed);

    const sessionsCount = inWindow.reduce((sum, r) => sum + Number(r.sessions), 0);
    const distinctDaysCount = inWindow.length;
    const enoughData =
        sessionsCount >= ANALYTICS_MIN_SESSIONS_FOR_TREND &&
        distinctDaysCount >= ANALYTICS_MIN_DAYS_FOR_TREND;

    const isDegrading =
        enoughData &&
        (accuracySlope < -ANALYTICS_ACCURACY_SLOPE_DEADBAND || latencySlope > ANALYTICS_LATENCY_SLOPE_DEADBAND);

    let trendDirection: TrendDirection = 'stable';
    if (isDegrading) {
        trendDirection = 'declining';
    } else if (
        enoughData &&
        (accuracySlope > ANALYTICS_ACCURACY_SLOPE_DEADBAND || latencySlope < -ANALYTICS_LATENCY_SLOPE_DEADBAND)
    ) {
        trendDirection = 'improving';
    }

    // Streak uses every day the view returned, not just the selected window, so a 40-day streak is
    // not clipped to 7 by the timeframe toggle. Matches AnalyticsService's separate lookback.
    const currentStreakDays = computeStreak(
        rows.map((r) => r.day),
        new Date().toISOString().slice(0, 10)
    );

    return {
        patientId,
        hasData: sessionsCount > 0,
        insufficientData: !enoughData,
        accuracyByDay,
        latencyByDay,
        accuracySlope,
        latencySlope,
        isDegrading,
        currentAccuracy: latest(accuracyByDay),
        currentMedianLatencyMs: latest(latencyByDay),
        trendDirection,
        sessionsCount,
        distinctDaysCount,
        currentStreakDays,
    };
}

// Groups the flat view output by patient and runs the biomarkers over each.
export function computeAllBiomarkers(rows: PatientDailyRow[], windowDays: number): Map<string, PatientBiomarkers> {
    const grouped = new Map<string, PatientDailyRow[]>();
    for (const row of rows) {
        const list = grouped.get(row.patient_id);
        if (list) list.push(row);
        else grouped.set(row.patient_id, [row]);
    }
    const result = new Map<string, PatientBiomarkers>();
    for (const [patientId, patientRows] of grouped) {
        result.set(patientId, computeBiomarkers(patientId, patientRows, windowDays));
    }
    return result;
}
