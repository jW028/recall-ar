export const MIGRATION_V4_SYNC_STATE = `

  -- Per-table high-water mark for the pull side of sync. The pull only asks Supabase for rows whose watermark column (e.g. updated_at) is strictly greater than last_pulled_at, then advances it to the newest row seen. Push state lives in SyncLog; this is its read-side counterpart.
  CREATE TABLE IF NOT EXISTS SyncState (
    table_name      TEXT PRIMARY KEY NOT NULL,
    last_pulled_at  TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'
  );

`;
