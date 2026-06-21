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