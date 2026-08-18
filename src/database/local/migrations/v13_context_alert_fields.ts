export const MIGRATION_V13_CONTEXT_ALERT_FIELDS = `
    ALTER TABLE ContextAlert ADD COLUMN ctxAlert_desc TEXT;
    ALTER TABLE ContextAlert ADD COLUMN ctxAlert_type TEXT NOT NULL DEFAULT 'Reminder';
`;
