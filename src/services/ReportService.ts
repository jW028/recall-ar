import { getDatabase } from '@/database/local/db';
import type { AnalyticsDataset, DailyPoint } from '@/models/Analytics';
import type { Patient } from '@/models/Patient';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Types
export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

// Queues a write operation for SyncService to push to Supabase
async function queueSync(
    tableName: string,
    rowId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
): Promise<void> {
    const db = getDatabase();
    const syncId = Crypto.randomUUID();
    await db.runAsync(
        `INSERT OR REPLACE INTO SyncLog (sync_id, table_name, row_id, operation, synced, created_at)
        VALUES (?, ?, ?, ?, 0, datetime('now'))`,
        [syncId, tableName, rowId, operation]
    );
}

// Renders a smoothed daily series as an inline SVG line chart so the PDF matches the on-screen chart exactly.
function buildSvgChart(
    points: DailyPoint[],
    opts: { color: string; min: number; max: number }
): string {
    const width = 520;
    const height = 160;
    const pad = 8;
    const values = points.map((p) => p.smoothed);
    const hasAny = values.some((v) => v !== null);
    if (!hasAny || points.length < 2) {
        return `<svg width="${width}" height="${height}"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="#9CA3AF" font-size="13">Not enough data to chart</text></svg>`;
    }
    const span = opts.max - opts.min || 1;
    const stepX = (width - pad * 2) / (points.length - 1);
    const coords = points
        .map((p, i) => {
            if (p.smoothed === null) return null;
            const x = pad + i * stepX;
            const norm = (p.smoothed - opts.min) / span;
            const y = height - pad - norm * (height - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .filter((c): c is string => c !== null)
        .join(' ');
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <polyline points="${coords}" fill="none" stroke="${opts.color}" stroke-width="2.5" />
    </svg>`;
}

// Human-readable summary line keyed off the trend direction.
function summaryLine(dataset: AnalyticsDataset): string {
    if (dataset.insufficientData) {
        return 'Not enough training activity in this period to assess a reliable trend.';
    }
    switch (dataset.trendDirection) {
        case 'declining':
            return 'Recognition performance appears to be declining over this period.';
        case 'improving':
            return 'Recognition performance appears to be improving over this period.';
        default:
            return 'Recognition performance is stable over this period.';
    }
}

// Builds the full HTML document compiled into the PDF.
function buildHtml(patient: Patient, dataset: AnalyticsDataset): string {
    const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
    const ms = (v: number | null) => (v === null ? '—' : `${Math.round(v)} ms`);
    const accuracyChart = buildSvgChart(dataset.accuracyByDay, { color: '#2563EB', min: 0, max: 1 });

    const latVals = dataset.latencyByDay
        .map((p) => p.smoothed)
        .filter((v): v is number => v !== null);
    const latMin = latVals.length ? Math.min(...latVals) * 0.9 : 0;
    const latMax = latVals.length ? Math.max(...latVals) * 1.1 : 1;
    const latencyChart = buildSvgChart(dataset.latencyByDay, { color: '#F59E0B', min: latMin, max: latMax });

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" />
<style>
    body { font-family: -apple-system, system-ui, sans-serif; color: #111827; padding: 32px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 15px; color: #374151; margin-top: 28px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; }
    .meta { color: #6B7280; font-size: 13px; }
    .flag { display: inline-block; padding: 6px 12px; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px; }
    .flag.warn { background: #FEF2F2; color: #B91C1C; }
    .flag.ok { background: #ECFDF5; color: #047857; }
    .stat { display: inline-block; margin-right: 32px; }
    .stat .label { color: #6B7280; font-size: 12px; }
    .stat .value { font-size: 20px; font-weight: 700; }
    .summary { font-size: 14px; margin-top: 16px; }
</style>
</head>
<body>
    <h1>Cognitive Analytics Report</h1>
    <div class="meta">${patient.patientName} · DOB ${patient.dateOfBirth}</div>
    <div class="meta">Period ${dataset.rangeStart} to ${dataset.rangeEnd} · Generated ${new Date().toISOString().slice(0, 10)}</div>

    <div class="flag ${dataset.isDegrading ? 'warn' : 'ok'}">
        ${dataset.isDegrading ? '⚠ Degradation flagged' : '✓ No degradation flagged'}
    </div>
    <p class="summary">${summaryLine(dataset)}</p>

    <h2>Summary</h2>
    <div class="stat"><div class="label">Current accuracy</div><div class="value">${pct(dataset.currentAccuracy)}</div></div>
    <div class="stat"><div class="label">Current median latency</div><div class="value">${ms(dataset.currentMedianLatencyMs)}</div></div>
    <div class="stat"><div class="label">Sessions</div><div class="value">${dataset.sessionsCount}</div></div>

    <h2>Recognition accuracy (7-day smoothed)</h2>
    ${accuracyChart}

    <h2>Response latency (7-day smoothed median)</h2>
    ${latencyChart}

    <h2>Engagement</h2>
    <div class="stat"><div class="label">Days active</div><div class="value">${dataset.daysActive}</div></div>
    <div class="stat"><div class="label">Completion rate</div><div class="value">${pct(dataset.completionRate)}</div></div>
</body>
</html>`;
}

// UC03 export: compile the currently-viewed dataset into a PDF, persist it, and trigger the OS share/save dialog.
async function exportReport(
    patient: Patient,
    dataset: AnalyticsDataset
): Promise<ServiceResult<void>> {
    if (!dataset.hasData) {
        return { data: null, error: 'No analytics data to export.' };
    }

    // Generate the PDF from the same dataset the dashboard is showing
    let uri: string;
    try {
        const result = await Print.printToFileAsync({ html: buildHtml(patient, dataset) });
        uri = result.uri;
    } catch {
        return { data: null, error: 'Failed to generate the report PDF.' };
    }

    // Persist the snapshot for audit/history and queue it for sync
    try {
        const db = getDatabase();
        const reportId = Crypto.randomUUID();
        await db.runAsync(
            `INSERT INTO CognitiveReport (report_id, patient_id, generated_date, report_data)
            VALUES (?, ?, ?, ?)`,
            [reportId, patient.patientId, new Date().toISOString(), JSON.stringify(dataset)]
        );
        await queueSync('CognitiveReport', reportId, 'INSERT');
    } catch {
        // Persisting is best-effort — don't block the caregiver from sharing the PDF they just made
    }

    // Trigger the native OS share/save dialog (dismiss is a no-op, handled by the caller as cancel)
    try {
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
                mimeType: 'application/pdf',
                dialogTitle: 'Share cognitive report',
                UTI: 'com.adobe.pdf',
            });
        }
    } catch {
        return { data: null, error: 'Failed to open the share dialog.' };
    }

    return { data: null, error: null };
}

export const ReportService = {
    exportReport,
};
