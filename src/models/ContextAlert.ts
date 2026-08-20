export type ContextAlertStatus = 'Active' | 'Triggered' | 'Acknowledged' | 'Dismissed';
export type ContextAlertAckStatus = 'Unacknowledged' | 'Acknowledged';
export type ContextAlertFrequency = 'Once' | 'Daily' | 'Weekly';
export type ContextAlertType = 'Reminder' | 'Medication' | 'Safety' | 'Object';

export interface ContextAlert {
    ctxAlertId: string;
    patientId: string;
    assetId?: string | null;
    ctxAlertMsg: string;
    ctxAlertDesc?: string | null;
    ctxAlertType: ContextAlertType;
    ctxAlertStatus: ContextAlertStatus;
    ctxAlertTime: string; // Time string e.g. "08:00" or ISO timestamp
    ackTime?: string | null;
    ackStatus: ContextAlertAckStatus;
    frequency: ContextAlertFrequency;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateContextAlertParams {
    patientId: string;
    assetId?: string | null;
    ctxAlertMsg: string;
    ctxAlertDesc?: string | null;
    ctxAlertType?: ContextAlertType;
    ctxAlertTime: string;
    frequency?: ContextAlertFrequency;
}

export interface UpdateContextAlertParams {
    ctxAlertMsg?: string;
    ctxAlertDesc?: string | null;
    ctxAlertType?: ContextAlertType;
    ctxAlertTime?: string;
    assetId?: string | null;
    frequency?: ContextAlertFrequency;
    ctxAlertStatus?: ContextAlertStatus;
    ackStatus?: ContextAlertAckStatus;
    ackTime?: string | null;
}

/**
 * Formats a time string (HH:mm) or ISO date-time string into a user-friendly display string.
 */
export function formatDisplayDateTime(timeStr: string): string {
    if (!timeStr) return '';

    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
        const h24 = parseInt(timeMatch[1], 10);
        const m = parseInt(timeMatch[2], 10);
        const period = h24 >= 12 ? 'PM' : 'AM';
        const hour12 = h24 % 12 || 12;
        const hStr = String(hour12).padStart(2, '0');
        const mStr = String(m).padStart(2, '0');
        return `${hStr}:${mStr} ${period}`;
    }

    const parsedDate = new Date(timeStr);
    if (!isNaN(parsedDate.getTime())) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[parsedDate.getMonth()];
        const day = parsedDate.getDate();
        let hours = parsedDate.getHours();
        const minutes = String(parsedDate.getMinutes()).padStart(2, '0');
        const period = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const hStr = String(hours).padStart(2, '0');

        const now = new Date();
        const yearStr = parsedDate.getFullYear() !== now.getFullYear() ? `, ${parsedDate.getFullYear()}` : '';
        return `${month} ${day}${yearStr}, ${hStr}:${minutes} ${period}`;
    }

    return timeStr;
}

/**
 * Checks if a given target time (HH:mm or ISO/date-time string) matches current time within window.
 */
export function isTimeMatching(targetTimeStr: string, now: Date = new Date(), windowMinutes: number = 30): boolean {
    if (!targetTimeStr) return false;

    // Handle "HH:mm" or "HH:mm:ss" format
    const timeMatch = targetTimeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
        const targetHour = parseInt(timeMatch[1], 10);
        const targetMinute = parseInt(timeMatch[2], 10);

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const targetTotal = targetHour * 60 + targetMinute;
        const currentTotal = currentHour * 60 + currentMinute;

        const diff = Math.abs(currentTotal - targetTotal);
        // Handle wraparound near midnight (1440 minutes in a day)
        const minuteDiff = Math.min(diff, 1440 - diff);
        return minuteDiff <= windowMinutes;
    }

    // Handle ISO or YYYY-MM-DDTHH:mm date string format
    const parsedDate = new Date(targetTimeStr);
    if (!isNaN(parsedDate.getTime())) {
        const targetDayStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()).getTime();
        const nowDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        if (nowDayStart < targetDayStart) {
            // Scheduled date is in the future
            return false;
        }

        const targetHour = parsedDate.getHours();
        const targetMinute = parsedDate.getMinutes();

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const targetTotal = targetHour * 60 + targetMinute;
        const currentTotal = currentHour * 60 + currentMinute;

        const diff = Math.abs(currentTotal - targetTotal);
        const minuteDiff = Math.min(diff, 1440 - diff);
        return minuteDiff <= windowMinutes;
    }

    return false;
}

/**
 * Checks if a reminder's scheduled time has passed and it has not been acknowledged.
 */
export function checkIsAlertExpired(targetTimeStr: string, ackStatus?: string, now: Date = new Date()): boolean {
    if (ackStatus === 'Acknowledged') return false;
    if (!targetTimeStr) return false;

    const timeMatch = targetTimeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (timeMatch) {
        const targetHour = parseInt(timeMatch[1], 10);
        const targetMinute = parseInt(timeMatch[2], 10);

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const targetTotal = targetHour * 60 + targetMinute;
        const currentTotal = currentHour * 60 + currentMinute;

        return currentTotal > targetTotal;
    }

    const parsedDate = new Date(targetTimeStr);
    if (!isNaN(parsedDate.getTime())) {
        const targetDayStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate()).getTime();
        const nowDayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        if (nowDayStart < targetDayStart) {
            // Future date, not expired
            return false;
        }

        if (nowDayStart > targetDayStart) {
            // Past date, expired for scheduled date
            return true;
        }

        // Same day: compare time of day
        const targetHour = parsedDate.getHours();
        const targetMinute = parsedDate.getMinutes();

        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const targetTotal = targetHour * 60 + targetMinute;
        const currentTotal = currentHour * 60 + currentMinute;

        return currentTotal > targetTotal;
    }

    return false;
}

/**
 * Checks if an acknowledged contextual alert should reset its status back to Active / Unacknowledged based on its frequency.
 */
export function shouldResetAlertForFrequency(
    alert: Pick<ContextAlert, 'ackStatus' | 'ackTime' | 'frequency'>,
    now: Date = new Date()
): boolean {
    if (alert.ackStatus !== 'Acknowledged' || !alert.ackTime) {
        return false;
    }

    const ackDate = new Date(alert.ackTime);
    if (isNaN(ackDate.getTime())) {
        return false;
    }

    if (alert.frequency === 'Daily') {
        const isDifferentCalendarDay =
            now.getFullYear() !== ackDate.getFullYear() ||
            now.getMonth() !== ackDate.getMonth() ||
            now.getDate() !== ackDate.getDate();
        return isDifferentCalendarDay && now.getTime() > ackDate.getTime();
    }

    if (alert.frequency === 'Weekly') {
        const msDiff = now.getTime() - ackDate.getTime();
        return msDiff >= 7 * 24 * 60 * 60 * 1000;
    }

    return false;
}

