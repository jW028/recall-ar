import { getDatabase } from '@/database/local/db';
import type { Database } from '@/database/remote/types';

// Types

export type SyncableTable = 'Patient' | 'MemoryAsset' | 'TrainingSession';

interface SyncTableConfig<TLocalRow = any, TSupabaseRow = any> {
  supabaseTable: keyof Database['public']['Tables'];

  primaryKey: string;

  readLocalRow: (rowId: string) => Promise<TLocalRow | null>;

  toSupabaseRow: (localRow: TLocalRow) => TSupabaseRow;
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
        // SQLite stores embedding as a JSON string; Supabase expects a
        // pgvector-compatible array, so it must be parsed before upserting.
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
    }),
    },
};