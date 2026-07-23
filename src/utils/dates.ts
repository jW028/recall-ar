// Device-local calendar-day helpers. Streak and de-dupe logic must follow the patient's wall clock, not UTC.

// Local YYYY-MM-DD for a date or ISO timestamp. Never use toISOString here — that would bucket by UTC.
export function localDayOf(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// The calendar day before a YYYY-MM-DD string. Pure Y-M-D arithmetic, immune to DST offsets.
export function previousDay(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d - 1, 12);
    return localDayOf(date);
}
