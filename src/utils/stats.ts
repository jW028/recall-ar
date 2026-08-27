// Pure statistical helpers shared by the caregiver app's analytics and the admin dashboard.
// They live here rather than in AnalyticsService because that module imports expo-sqlite at the top,
// which no browser build can resolve — and a second copy of these would fork the biomarker definition.

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
