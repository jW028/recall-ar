export const MIGRATION_V5_TRAINING_LATENCY = `

  -- Response latency (ms) for one quiz answer: the time from the question's choices painting to the patient's tap, captured BEFORE scoring. Feeds the UC03/UC04/UC08 latency biomarker. Nullable on purpose — rows written before this patch have no recorded latency, and a missing value must read as "unknown", never 0 (0ms would corrupt average-latency math in UC04).
  ALTER TABLE TrainingSession ADD COLUMN response_latency_ms INTEGER;

`;
