import { getDatabase } from '@/database/local/db';
import type { Database } from '@/database/remote/types';

// Types

export type SyncableTable =
  | 'Patient'
  | 'MemoryAsset'
  | 'TrainingSession'
  | 'DailyReviewEntry';

// The pull side of a table's config. Absent for push-only tables (e.g. the training tables flow patient -> Supabase only and are never pulled back).
interface PullConfig<TSupabaseRow = any> {
  // Column the incremental pull watermarks on. Must be monotonic per row edit (updated_at). Rows with watermarkColumn > last_pulled_at are fetched.
  watermarkColumn: string;

  // Column used to scope the remote query to the rows this device may see (always patient_id here). RLS enforces it server-side; this just trims the payload to the relevant patient.
  scopeColumn?: string;

  // Maps a Supabase row to the local SQLite column shape (primary key and watermark column included). Inverse of toSupabaseRow.
  fromSupabaseRow: (remote: TSupabaseRow) => Record<string, unknown>;
}

interface SyncTableConfig<TLocalRow = any, TSupabaseRow = any> {
  supabaseTable: keyof Database['public']['Tables'];

  primaryKey: string;

  readLocalRow: (rowId: string) => Promise<TLocalRow | null>;

  toSupabaseRow: (localRow: TLocalRow) => TSupabaseRow;

  pull?: PullConfig<TSupabaseRow>;
}

function readByPrimaryKey(tableName: string, primaryKey: string) {
  return async (rowId: string) => {
    const db = getDatabase();
    return db.getFirstAsync<Record<string, unknown>>(
      `SELECT * FROM ${tableName} WHERE ${primaryKey} = ?`,
      [rowId]
    );
  };
}

// Per-table configuration
export const syncTableConfig: Record<SyncableTable, SyncTableConfig> = {
    Patient: {
    supabaseTable: 'Patient',
    primaryKey: 'patient_id',
    readLocalRow: readByPrimaryKey('Patient', 'patient_id'),
    toSupabaseRow: (row) => ({
        patient_id: row.patient_id,
        caregiver_id: row.caregiver_id,
        patient_name: row.patient_name,
        date_of_birth: row.date_of_birth,
        medical_notes: row.medical_notes,
        emergency_contact: row.emergency_contact,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }),
    pull: {
        watermarkColumn: 'updated_at',
        scopeColumn: 'patient_id',
        fromSupabaseRow: (remote) => ({
            patient_id: remote.patient_id,
            caregiver_id: remote.caregiver_id,
            patient_name: remote.patient_name,
            date_of_birth: remote.date_of_birth,
            medical_notes: remote.medical_notes,
            emergency_contact: remote.emergency_contact,
            created_at: remote.created_at,
            updated_at: remote.updated_at,
        }),
    },
    },

    MemoryAsset: {
    supabaseTable: 'MemoryAsset',
    primaryKey: 'asset_id',
    readLocalRow: readByPrimaryKey('MemoryAsset', 'asset_id'),
    toSupabaseRow: (row) => ({
        asset_id: row.asset_id,
        patient_id: row.patient_id,
        name: row.name,
        type: row.type,
        status: row.status,
        image_url: row.image_url,
        // SQLite stores the photo pool as a JSON string; Supabase expects a jsonb array, so it must be parsed before upserting. Null for assets created before the photo-pool migration.
        photo_urls: row.photo_urls ? JSON.parse(row.photo_urls as string) : null,
        // SQLite stores embedding as a JSON string; Supabase expects a pgvector-compatible array, so it must be parsed before upserting.
        embedding: JSON.parse(row.embedding as string),
        notes: row.notes,
        current_interval_minutes: row.current_interval_minutes,
        next_review: row.next_review,
        review_count: row.review_count,
        date_of_birth: row.date_of_birth,
        relationship: row.relationship,
        category: row.category,
        reminder_text: row.reminder_text,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }),
    pull: {
        watermarkColumn: 'updated_at',
        scopeColumn: 'patient_id',
        fromSupabaseRow: (remote) => ({
            asset_id: remote.asset_id,
            patient_id: remote.patient_id,
            name: remote.name,
            type: remote.type,
            status: remote.status,
            image_url: remote.image_url,
            // Supabase returns the pgvector as a "[...]" string and photo_urls as a jsonb array; SQLite stores both as JSON TEXT, mirroring how toSupabaseRow parses them back out on push.
            embedding:
                typeof remote.embedding === 'string'
                    ? remote.embedding
                    : JSON.stringify(remote.embedding),
            photo_urls: remote.photo_urls != null ? JSON.stringify(remote.photo_urls) : null,
            notes: remote.notes,
            current_interval_minutes: remote.current_interval_minutes,
            next_review: remote.next_review,
            review_count: remote.review_count,
            date_of_birth: remote.date_of_birth,
            relationship: remote.relationship,
            category: remote.category,
            reminder_text: remote.reminder_text,
            created_at: remote.created_at,
            updated_at: remote.updated_at,
        }),
    },
    },

    TrainingSession: {
    supabaseTable: 'TrainingSession',
    primaryKey: 'session_id',
    readLocalRow: readByPrimaryKey('TrainingSession', 'session_id'),
    toSupabaseRow: (row) => ({
        session_id: row.session_id,
        asset_id: row.asset_id,
        timestamp: row.timestamp,
        interval_minutes: row.interval_minutes,
        // SQLite has no boolean type — success is stored as 0/1
        success: row.success === 1,
        // Nullable: legacy rows from before the latency patch have no value.
        response_latency_ms: row.response_latency_ms,
    }),
    },

    DailyReviewEntry: {
    supabaseTable: 'DailyReviewEntry',
    primaryKey: 'review_id',
    readLocalRow: readByPrimaryKey('DailyReviewEntry', 'review_id'),
    toSupabaseRow: (row) => ({
        review_id: row.review_id,
        patient_id: row.patient_id,
        asset_id: row.asset_id,
        queue_date: row.queue_date,
        position: row.position,
        // SQLite has no boolean type — both flags are stored as 0/1
        is_onboarding: row.is_onboarding === 1,
        completed: row.completed === 1,
    }),
    },
};