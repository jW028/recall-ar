// People are embedded with MobileFaceNet (512-dim); objects with a MobileNetV2 feature extractor (1280-dim).
// A face model cannot embed objects — measured on real frames it confused two key sets 5/5 times.
export const FACE_EMBEDDING_DIM = 512;
export const OBJECT_EMBEDDING_DIM = 1280;

// Identifies which model produced a stored embedding. Bump when a model changes so stale vectors are re-embedded rather than compared.
export const FACE_EMBEDDING_MODEL = 'facenet_512';
export const OBJECT_EMBEDDING_MODEL = 'mobilenet_v2_1280';

// Confidence thresholds are per-model: cosine scores from different embedding spaces are not comparable.
export const FACE_CONFIDENCE_THRESHOLD = 0.55;
// Measured on real AR frames: an enrolled object in view scored 0.624-0.859 (n=12), a bare surface 0.273-0.288 (n=3).
// Any value in (0.288, 0.624) separates them; 0.55 sits high in that window, biasing towards "Scanning" over a wrong label.
export const OBJECT_CONFIDENCE_THRESHOLD = 0.55;

// Two above-threshold matches within this cosine margin are treated as ambiguous.
// Measured: correct matches beat the runner-up by 0.056-0.207, so this does not fire on a confident match.
export const AMBIGUITY_MARGIN = 0.05;

// Live AR frames are wide shots; enrollment photos are square close-ups. Centre-cropping the live frame to this
// fraction closes that framing gap — measured to lift the worst-case true match from 0.470 to 0.624.
export const AR_LIVE_CROP_FRACTION = 0.6;

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