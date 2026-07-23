import { previousDay } from './dates';

// Current streak of consecutive active days ending today or yesterday.
// Grace rule: a streak that ended yesterday still counts until today's first answer, so it never "drops" mid-morning.
// A gap of two or more days silently restarts the count — callers must never surface a broken streak.
export function computeStreak(activeDays: Iterable<string>, today: string): number {
    const days = new Set(activeDays);
    let anchor: string;
    if (days.has(today)) {
        anchor = today;
    } else if (days.has(previousDay(today))) {
        anchor = previousDay(today);
    } else {
        return 0;
    }

    let streak = 0;
    let cursor = anchor;
    while (days.has(cursor)) {
        streak++;
        cursor = previousDay(cursor);
    }
    return streak;
}
