// Records which model produced each embedding. People and objects use different models, so vectors from a
// previous model must be re-embedded rather than compared. Existing rows are backfilled to the face model,
// which is what every embedding was produced with before objects moved to the object model.
export const MIGRATION_V8_EMBEDDING_MODEL = `
ALTER TABLE MemoryAsset ADD COLUMN embedding_model TEXT;

UPDATE MemoryAsset SET embedding_model = 'facenet_512' WHERE embedding_model IS NULL;
`;
