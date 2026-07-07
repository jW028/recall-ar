// MobileFaceNet configured with a 512-dim embedding 
export const EMBEDDING_DIM = 512;

// Confidence Threshold for match accuracy
export const CONFIDENCE_THRESHOLD = 0.55;

// Processing Latency threshold
export const AR_LATENCY_BUDGET_MS = 500;

// Training
// Maximum active memory assets in monthly training pool
export const MAX_MONTHLY_POOL_SIZE = 45;

// Maximum quiz questions per day to prevent cognitive fatigue
export const MAX_DAILY_QUESTIONS = 15;

// Answer evaluation latency
export const ANSWER_EVALUATION_BUDGET_MS = 1000;

// Consecutive correct daily sessions required to flag an asset as mastered
export const MASTERY_STREAK_THRESHOLD = 3;

// Spaced Retrieval Training onboarding intervals
export const ONBOARDING_INTERVALS_MINUTES = [1, 2, 4, 8, 16] as const;

// Validation limits
export const MAX_MEDICAL_NOTES_LENGTH = 2000;
export const MIN_ENROLLMENT_PHOTOS = 3;
export const MAX_ENROLLMENT_PHOTOS = 5;

// Enrollment suggestions — chips the caregiver can tap; custom text is still allowed
export const RELATIONSHIP_SUGGESTIONS = [
    'Spouse', 'Son', 'Daughter', 'Grandchild', 'Sibling', 'Friend', 'Nurse', 'Caregiver',
] as const;
export const OBJECT_CATEGORY_SUGGESTIONS = [
    'Keys', 'Medication', 'Glasses', 'Phone', 'Wallet', 'Remote', 'Documents',
] as const;

// Analytics (UC03/UC04)
// These thresholds are clinical-ish judgement calls — start conservative and validate against real usage data, not guesses
// Rolling-average window applied to raw daily values before trend analysis
export const ANALYTICS_SMOOTHING_DAYS = 7;
// Minimum answered questions in the window before a trend is considered valid
export const ANALYTICS_MIN_SESSIONS_FOR_TREND = 10;
// Minimum distinct active days in the window before a trend is considered valid
export const ANALYTICS_MIN_DAYS_FOR_TREND = 5;
// Accuracy slope (per day) below this magnitude is treated as stable, not declining
export const ANALYTICS_ACCURACY_SLOPE_DEADBAND = 0.005;
// Latency slope (ms per day) below this magnitude is treated as stable, not slowing
export const ANALYTICS_LATENCY_SLOPE_DEADBAND = 10;
// Hard cap on the query window to avoid unbounded reads on a long patient history
export const ANALYTICS_MAX_WINDOW_DAYS = 90;