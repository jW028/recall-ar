import {
    EMBEDDING_DIM,
    MAX_ENROLLMENT_PHOTOS,
    MIN_ENROLLMENT_PHOTOS,
} from '@/constants/config';
import { getDatabase } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import type {
    EnrolledObject,
    EnrolledPerson,
    MemoryAsset,
} from '@/models/MemoryAsset';
import * as Crypto from 'expo-crypto';
import type { SQLiteBindValue } from 'expo-sqlite';

// Types
export interface CreatePersonParams {
    patientId: string;
    name: string;
    photoUris: string[]; // local file URIs, MIN_ENROLLMENT_PHOTOS to MAX_ENROLLMENT_PHOTOS
    embedding: number[]; // averaged embedding computed from photoUris by the caller
    notes: string;
    dateOfBirth?: string | null;
    relationship?: string | null;
}

export interface CreateObjectParams {
    patientId: string;
    name: string;
    photoUris: string[];
    embedding: number[];
    notes: string;
    category?: string | null;
    reminderText?: string | null;
}

export interface UpdateMemoryAssetParams {
    name?: string;
    notes?: string;
    // Person-only
    dateOfBirth?: string | null;
    relationship?: string | null;
    // Object-only
    category?: string | null;
    reminderText?: string | null;
}

export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

// Helpers

function mapRowToAsset(row: any): MemoryAsset {
    const base = {
        assetId: row.asset_id,
        patientId: row.patient_id,
        name: row.name,
        status: row.status,
        imageUrl: row.image_url,
        embedding: JSON.parse(row.embedding),
        notes: row.notes,
        currentIntervalMinutes: row.current_interval_minutes,
        nextReview: row.next_review,
        reviewCount: row.review_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };

    if (row.type === 'Person') {
        return {
            ...base,
            type: 'Person',
            dateOfBirth: row.date_of_birth,
            relationship: row.relationship,
        } satisfies EnrolledPerson;
    }

    return {
        ...base,
        type: 'Object',
        category: row.category,
        reminderText: row.reminder_text,
    } satisfies EnrolledObject;
}

async function queueSync(
  rowId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
): Promise<void> {
    const db = getDatabase();
    const syncId = Crypto.randomUUID();
    await db.runAsync(
        `INSERT OR REPLACE INTO SyncLog (sync_id, table_name, row_id, operation, synced, created_at)
        VALUES (?, 'MemoryAsset', ?, ?, 0, datetime('now'))`,
    [syncId, rowId, operation]);
}

function validatePhotos(photoUris: string[]): string | null {
    if (photoUris.length < MIN_ENROLLMENT_PHOTOS) {
        return `Please upload at least ${MIN_ENROLLMENT_PHOTOS} photos in .jpg, .png, or .webp`;
    }
    if (photoUris.length > MAX_ENROLLMENT_PHOTOS) {
        return `Please upload no more than ${MAX_ENROLLMENT_PHOTOS} photos`;
    }
    return null;
}

function validateEmbedding(embedding: number[]): string | null {
    if (embedding.length !== EMBEDDING_DIM) {
        return `Embedding has invalid dimension (expected ${EMBEDDING_DIM}, got ${embedding.length})`;
    }
    return null;
}

async function uploadDisplayPhoto(
    patientId: string,
    assetId: string,
    photoUri: string
): Promise<ServiceResult<string>> {
    try {
        const response = await fetch(photoUri);
        const blob = await response.blob();
        const fileExt = photoUri.split('.').pop() ?? 'jpg';
        const path = `${patientId}/${assetId}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('memory-assets')
            .upload(path, blob, { upsert: true });

        if (uploadError) {
            return { data: null, error: 'Failed to upload photo. Please check your connection.' };
        }

        const { data } = supabase.storage.from('memory-assets').getPublicUrl(path);
        return { data: data.publicUrl, error: null };
    } catch {
        return { data: null, error: 'Failed to upload photo. Please check your connection.' };
    }
}

// Create memory asset

async function createPerson(
    params: CreatePersonParams
): Promise<ServiceResult<EnrolledPerson>> {
    if (!params.name.trim()) {
        return { data: null, error: 'Name is required' };
    }

    const photoError = validatePhotos(params.photoUris);
    if (photoError) return { data: null, error: photoError };

    const embeddingError = validateEmbedding(params.embedding);
    if (embeddingError) return { data: null, error: embeddingError };

    const assetId = Crypto.randomUUID();

    const uploadResult = await uploadDisplayPhoto(
        params.patientId,
        assetId,
        params.photoUris[0]
    );
    if (uploadResult.error || !uploadResult.data) {
        return { data: null, error: uploadResult.error };
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const nextReview = now; // due immediately — onboarding starts on first session

    try {
        await db.runAsync(
        `INSERT INTO MemoryAsset
            (asset_id, patient_id, name, type, status, image_url, embedding, notes,
            current_interval_minutes, next_review, review_count,
            date_of_birth, relationship, category, reminder_text,
            created_at, updated_at)
        VALUES (?, ?, ?, 'Person', 'Onboarding', ?, ?, ?, 1, ?, 0, ?, ?, NULL, NULL, ?, ?)`,
        [
            assetId,
            params.patientId,
            params.name.trim(),
            uploadResult.data,
            JSON.stringify(params.embedding),
            params.notes,
            nextReview,
            params.dateOfBirth ?? null,
            params.relationship ?? null,
            now,
            now,
        ]
        );
    } catch {
        return { data: null, error: 'Failed to save entity. Please try again.' };
    }

    await queueSync(assetId, 'INSERT');

    return {
        data: {
        assetId,
        patientId: params.patientId,
        name: params.name.trim(),
        type: 'Person',
        status: 'Onboarding',
        imageUrl: uploadResult.data,
        embedding: params.embedding,
        notes: params.notes,
        currentIntervalMinutes: 1,
        nextReview,
        reviewCount: 0,
        dateOfBirth: params.dateOfBirth ?? null,
        relationship: params.relationship ?? null,
        createdAt: now,
        updatedAt: now,
        },
        error: null,
    };
}

async function createObject(
    params: CreateObjectParams
): Promise<ServiceResult<EnrolledObject>> {
    if (!params.name.trim()) {
        return { data: null, error: 'Name is required' };
    }

    const photoError = validatePhotos(params.photoUris);
    if (photoError) return { data: null, error: photoError };

    const embeddingError = validateEmbedding(params.embedding);
    if (embeddingError) return { data: null, error: embeddingError };

    const assetId = Crypto.randomUUID();

    const uploadResult = await uploadDisplayPhoto(
        params.patientId,
        assetId,
        params.photoUris[0]
    );
    if (uploadResult.error || !uploadResult.data) {
        return { data: null, error: uploadResult.error };
    }

    const db = getDatabase();
    const now = new Date().toISOString();
    const nextReview = now;

    try {
        await db.runAsync(
        `INSERT INTO MemoryAsset
            (asset_id, patient_id, name, type, status, image_url, embedding, notes,
            current_interval_minutes, next_review, review_count,
            date_of_birth, relationship, category, reminder_text,
            created_at, updated_at)
        VALUES (?, ?, ?, 'Object', 'Onboarding', ?, ?, ?, 1, ?, 0, NULL, NULL, ?, ?, ?, ?)`,
        [
            assetId,
            params.patientId,
            params.name.trim(),
            uploadResult.data,
            JSON.stringify(params.embedding),
            params.notes,
            nextReview,
            params.category ?? null,
            params.reminderText ?? null,
            now,
            now,
        ]
        );
    } catch {
        return { data: null, error: 'Failed to save entity. Please try again.' };
    }

    await queueSync(assetId, 'INSERT');

    return {
        data: {
        assetId,
        patientId: params.patientId,
        name: params.name.trim(),
        type: 'Object',
        status: 'Onboarding',
        imageUrl: uploadResult.data,
        embedding: params.embedding,
        notes: params.notes,
        currentIntervalMinutes: 1,
        nextReview,
        reviewCount: 0,
        category: params.category ?? null,
        reminderText: params.reminderText ?? null,
        createdAt: now,
        updatedAt: now,
        },
        error: null,
    };
}

// Retrieve memory asset

async function getAssetsByPatient(
  patientId: string,
  type?: MemoryAsset['type']
): Promise<ServiceResult<MemoryAsset[]>> {
  const db = getDatabase();

  try {
    const rows = type
      ? await db.getAllAsync(
          `SELECT * FROM MemoryAsset WHERE patient_id = ? AND type = ? ORDER BY name ASC`,
          [patientId, type]
        )
      : await db.getAllAsync(
          `SELECT * FROM MemoryAsset WHERE patient_id = ? ORDER BY name ASC`,
          [patientId]
        );

    return { data: rows.map(mapRowToAsset), error: null };
  } catch {
    return { data: null, error: 'Failed to load memories.' };
  }
}

async function getAssetById(
  assetId: string
): Promise<ServiceResult<MemoryAsset>> {
  const db = getDatabase();

  try {
    const row = await db.getFirstAsync(
      `SELECT * FROM MemoryAsset WHERE asset_id = ?`,
      [assetId]
    );
    if (!row) return { data: null, error: 'Memory not found.' };
    return { data: mapRowToAsset(row), error: null };
  } catch {
    return { data: null, error: 'Failed to load memory.' };
  }
}

async function getAssetsForRecognition(
  patientId: string
): Promise<MemoryAsset[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync(
    `SELECT * FROM MemoryAsset WHERE patient_id = ?`,
    [patientId]
  );
  return rows.map(mapRowToAsset);
}

// Update memory asset


async function updateAsset(
    assetId: string,
    params: UpdateMemoryAssetParams
): Promise<ServiceResult<MemoryAsset>> {
    if (params.name !== undefined && !params.name.trim()) {
        return { data: null, error: 'Name is required' };
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: SQLiteBindValue[] = [];

    if (params.name !== undefined) {
        fields.push('name = ?');
        values.push(params.name.trim());
    }
    if (params.notes !== undefined) {
        fields.push('notes = ?');
        values.push(params.notes);
    }
    if (params.dateOfBirth !== undefined) {
        fields.push('date_of_birth = ?');
        values.push(params.dateOfBirth);
    }
    if (params.relationship !== undefined) {
        fields.push('relationship = ?');
        values.push(params.relationship);
    }
    if (params.category !== undefined) {
        fields.push('category = ?');
        values.push(params.category);
    }
    if (params.reminderText !== undefined) {
        fields.push('reminder_text = ?');
        values.push(params.reminderText);
    }

    if (fields.length === 0) {
        return { data: null, error: 'No fields to update.' };
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(assetId);

    try {
        await db.runAsync(
        `UPDATE MemoryAsset SET ${fields.join(', ')} WHERE asset_id = ?`,
        values
        );
    } catch {
        return { data: null, error: 'Failed to update memory. Please try again.' };
    }

    await queueSync(assetId, 'UPDATE');

    return getAssetById(assetId);
}

// Delete memory asset
async function deleteAsset(assetId: string): Promise<ServiceResult> {
  const db = getDatabase();

  try {
    await db.runAsync(`DELETE FROM MemoryAsset WHERE asset_id = ?`, [assetId]);
  } catch {
    return { data: null, error: 'Failed to delete memory. Please try again.' };
  }

  await queueSync(assetId, 'DELETE');

  return { data: null, error: null };
}

// Export
export const MemoryAssetService = {
  createPerson,
  createObject,
  getAssetsByPatient,
  getAssetById,
  getAssetsForRecognition,
  updateAsset,
  deleteAsset,
};