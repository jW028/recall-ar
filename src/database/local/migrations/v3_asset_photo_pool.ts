export const MIGRATION_V3_ASSET_PHOTO_POOL = `

  -- Persist the full pool of reference photos per asset (JSON array of public
  -- URLs, mirroring how embedding is stored as JSON TEXT). image_url remains the
  -- chosen thumbnail and is always one of these URLs. Nullable: pre-migration
  -- assets are treated as a single-photo pool of [image_url].
  ALTER TABLE MemoryAsset ADD COLUMN photo_urls TEXT;

`;
