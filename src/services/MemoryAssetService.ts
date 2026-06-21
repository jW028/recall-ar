import {
    EMBEDDING_DIM,
    MAX_ENROLLMENT_PHOTOS,
    MAX_MONTHLY_POOL_SIZE,
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

// Editing the photo pool: some existing pool URLs are kept, some new local photos are added. The embedding is re-averaged over the resulting pool by the caller, so photos and embedding are always supplied together.
export interface UpdatePoolParams {
    keepUrls: string[]; // existing pool URLs to retain
    newPhotoUris: string[]; // local file URIs to upload and append
    embedding: number[]; // averaged over keepUrls + newPhotoUris
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
        // Assets created before the photo-pool column existed have no pool — fall back to a single-photo pool of the display image so the UI stays uniform.
        photoUrls: row.photo_urls ? JSON.parse(row.photo_urls) : [row.image_url],
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

function validatePhotoCount(count: number): string | null {
    if (count < MIN_ENROLLMENT_PHOTOS) {
        return `Please upload at least ${MIN_ENROLLMENT_PHOTOS} photos in .jpg, .png, or .webp`;
    }
    if (count > MAX_ENROLLMENT_PHOTOS) {
        return `Please upload no more than ${MAX_ENROLLMENT_PHOTOS} photos`;
    }
    return null;
}

function validatePhotos(photoUris: string[]): string | null {
    return validatePhotoCount(photoUris.length);
}

function validateEmbedding(embedding: number[]): string | null {
    if (embedding.length !== EMBEDDING_DIM) {
        return `Embedding has invalid dimension (expected ${EMBEDDING_DIM}, got ${embedding.length})`;
    }
    return null;
}

// UC02 cap enforcement: every asset in Onboarding/Maintenance is in the active pool. Blocks a new enrollment once the patient is already at the cap.
async function assertPoolCapacity(patientId: string): Promise<string | null> {
    const db = getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM MemoryAsset
        WHERE patient_id = ? AND status IN ('Onboarding', 'Maintenance')`,
        [patientId]
    );
    if ((row?.count ?? 0) >= MAX_MONTHLY_POOL_SIZE) {
        return `Cannot add asset. The active training pool is limited to ${MAX_MONTHLY_POOL_SIZE} items per month to prevent cognitive fatigue.`;
    }
    return null;
}

// Uploads a single pool photo to a unique per-photo path so the pool can hold multiple images per asset: {patientId}/{assetId}/{photoId}.{ext}.
async function uploadPoolPhoto(
    patientId: string,
    assetId: string,
    photoUri: string
): Promise<ServiceResult<string>> {
    try {
        const fileExt = (photoUri.split('.').pop() ?? 'jpg').toLowerCase();
        const contentType =
            fileExt === 'png' ? 'image/png' :
            fileExt === 'webp' ? 'image/webp' :
            'image/jpeg';
        const photoId = Crypto.randomUUID();
        const path = `${patientId}/${assetId}/${photoId}.${fileExt}`;

        // React Native's fetch(...).blob() yields a blob that supabase-js uploads as 0 bytes; reading an ArrayBuffer uploads the real file contents. See https://supabase.com/docs/guides/storage (Expo).
        const arrayBuffer = await fetch(photoUri).then((res) => res.arrayBuffer());
        if (arrayBuffer.byteLength === 0) {
            return { data: null, error: 'Selected photo is empty. Please choose another.' };
        }

        const { error: uploadError } = await supabase.storage
            .from('memory-assets')
            .upload(path, arrayBuffer, { upsert: true, contentType });

        if (uploadError) {
            return { data: null, error: 'Failed to upload photo. Please check your connection.' };
        }

        const { data } = supabase.storage.from('memory-assets').getPublicUrl(path);
        return { data: data.publicUrl, error: null };
    } catch {
        return { data: null, error: 'Failed to upload photo. Please check your connection.' };
    }
}

// Uploads each local photo in order, failing fast on the first error.
async function uploadPoolPhotos(
    patientId: string,
    assetId: string,
    photoUris: string[]
): Promise<ServiceResult<string[]>> {
    const urls: string[] = [];
    for (const uri of photoUris) {
        const result = await uploadPoolPhoto(patientId, assetId, uri);
        if (result.error || !result.data) {
            return { data: null, error: result.error ?? 'Failed to upload photo.' };
        }
        urls.push(result.data);
    }
    return { data: urls, error: null };
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

    const capError = await assertPoolCapacity(params.patientId);
    if (capError) return { data: null, error: capError };

    const assetId = Crypto.randomUUID();

    const uploadResult = await uploadPoolPhotos(
        params.patientId,
        assetId,
        params.photoUris
    );
    if (uploadResult.error || !uploadResult.data) {
        return { data: null, error: uploadResult.error };
    }
    const photoUrls = uploadResult.data;
    const imageUrl = photoUrls[0]; // first photo is the default thumbnail

    const db = getDatabase();
    const now = new Date().toISOString();
    const nextReview = now; // due immediately — onboarding starts on first session

    try {
        await db.runAsync(
        `INSERT INTO MemoryAsset
            (asset_id, patient_id, name, type, status, image_url, photo_urls, embedding, notes,
            current_interval_minutes, next_review, review_count,
            date_of_birth, relationship, category, reminder_text,
            created_at, updated_at)
        VALUES (?, ?, ?, 'Person', 'Onboarding', ?, ?, ?, ?, 1, ?, 0, ?, ?, NULL, NULL, ?, ?)`,
        [
            assetId,
            params.patientId,
            params.name.trim(),
            imageUrl,
            JSON.stringify(photoUrls),
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
        imageUrl,
        photoUrls,
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

    const capError = await assertPoolCapacity(params.patientId);
    if (capError) return { data: null, error: capError };

    const assetId = Crypto.randomUUID();

    const uploadResult = await uploadPoolPhotos(
        params.patientId,
        assetId,
        params.photoUris
    );
    if (uploadResult.error || !uploadResult.data) {
        return { data: null, error: uploadResult.error };
    }
    const photoUrls = uploadResult.data;
    const imageUrl = photoUrls[0]; // first photo is the default thumbnail

    const db = getDatabase();
    const now = new Date().toISOString();
    const nextReview = now;

    try {
        await db.runAsync(
        `INSERT INTO MemoryAsset
            (asset_id, patient_id, name, type, status, image_url, photo_urls, embedding, notes,
            current_interval_minutes, next_review, review_count,
            date_of_birth, relationship, category, reminder_text,
            created_at, updated_at)
        VALUES (?, ?, ?, 'Object', 'Onboarding', ?, ?, ?, ?, 1, ?, 0, NULL, NULL, ?, ?, ?, ?)`,
        [
            assetId,
            params.patientId,
            params.name.trim(),
            imageUrl,
            JSON.stringify(photoUrls),
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
        imageUrl,
        photoUrls,
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

// Replaces the asset's photo pool: keeps the given existing URLs, uploads and appends the new local photos, and stores the re-averaged embedding. The thumbnail (image_url) is preserved if it survives in the new pool, otherwise it falls back to the first photo. Requires a connection (uploads + model).
async function updateAssetPool(
    assetId: string,
    params: UpdatePoolParams
): Promise<ServiceResult<MemoryAsset>> {
    const finalCount = params.keepUrls.length + params.newPhotoUris.length;
    const photoError = validatePhotoCount(finalCount);
    if (photoError) return { data: null, error: photoError };

    const embeddingError = validateEmbedding(params.embedding);
    if (embeddingError) return { data: null, error: embeddingError };

    const db = getDatabase();

    const existing = await db.getFirstAsync<{ patient_id: string; image_url: string }>(
        `SELECT patient_id, image_url FROM MemoryAsset WHERE asset_id = ?`,
        [assetId]
    );
    if (!existing) return { data: null, error: 'Memory not found.' };

    const uploadResult = await uploadPoolPhotos(
        existing.patient_id,
        assetId,
        params.newPhotoUris
    );
    if (uploadResult.error || !uploadResult.data) {
        return { data: null, error: uploadResult.error };
    }

    const photoUrls = [...params.keepUrls, ...uploadResult.data];
    // Keep the current thumbnail if it survives the edit; otherwise default to the first remaining photo.
    const imageUrl = photoUrls.includes(existing.image_url)
        ? existing.image_url
        : photoUrls[0];

    const now = new Date().toISOString();

    try {
        await db.runAsync(
            `UPDATE MemoryAsset
            SET photo_urls = ?, image_url = ?, embedding = ?, updated_at = ?
            WHERE asset_id = ?`,
            [
                JSON.stringify(photoUrls),
                imageUrl,
                JSON.stringify(params.embedding),
                now,
                assetId,
            ]
        );
    } catch {
        return { data: null, error: 'Failed to update photos. Please try again.' };
    }

    await queueSync(assetId, 'UPDATE');

    return getAssetById(assetId);
}

// Sets which pool photo is the display thumbnail. Pure metadata change (no upload, no embedding change), so it works offline.
async function setThumbnail(
    assetId: string,
    thumbnailUrl: string
): Promise<ServiceResult<MemoryAsset>> {
    const db = getDatabase();

    const existing = await db.getFirstAsync<{ photo_urls: string | null }>(
        `SELECT photo_urls FROM MemoryAsset WHERE asset_id = ?`,
        [assetId]
    );
    if (!existing) return { data: null, error: 'Memory not found.' };

    const pool: string[] = existing.photo_urls ? JSON.parse(existing.photo_urls) : [];
    if (!pool.includes(thumbnailUrl)) {
        return { data: null, error: 'Selected photo is not part of this memory.' };
    }

    const now = new Date().toISOString();

    try {
        await db.runAsync(
            `UPDATE MemoryAsset SET image_url = ?, updated_at = ? WHERE asset_id = ?`,
            [thumbnailUrl, now, assetId]
        );
    } catch {
        return { data: null, error: 'Failed to update thumbnail. Please try again.' };
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
  updateAssetPool,
  setThumbnail,
  deleteAsset,
};