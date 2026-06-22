import type { AnalyticsDataset } from './Analytics';

// A persisted analytics snapshot, written when a caregiver exports a report (UC03)
export interface CognitiveReport {
    reportId: string;
    patientId: string;
    generatedDate: string; // ISO-8601 timestamp
    // The exact dataset that was charted and compiled into the PDF (audit/history)
    reportData: AnalyticsDataset;
}
