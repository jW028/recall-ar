import { getDatabase } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';
import type { Database } from '@/database/remote/types';
import * as Crypto from 'expo-crypto';

// Patient-side read of the paired caregiver's profile, so patient copy can name them instead of saying "your caregiver".
// The caregiver row is not part of pull sync (it has no patient_id to scope on), so it is fetched directly and cached in the local Caregiver table for offline reads.
// The write path below is caregiver-side and online-only for the same reason: there is no SyncLog route for this table.

interface CaregiverRow {
    caregiver_id: string;
    full_name: string;
    email: string;
    caregiver_contact: string;
    image_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface CaregiverProfile {
    caregiverId: string;
    fullName: string;
    email: string;
    contact: string;
    imageUrl: string | null;
}

export interface UpdateProfileParams {
    fullName?: string;
    contact?: string;
    imageUrl?: string | null;
}

export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

const PROFILE_COLUMNS = 'caregiver_id, full_name, email, caregiver_contact, image_url, created_at, updated_at';

async function readCachedName(caregiverId: string): Promise<string | null> {
    try {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ full_name: string }>(
            `SELECT full_name FROM Caregiver WHERE caregiver_id = ?`,
            [caregiverId]
        );
        return row?.full_name ?? null;
    } catch {
        return null;
    }
}

// Fetches the row the "paired patient reads" RLS policy exposes and caches it. Returns null when offline or when the policy denies the read.
async function fetchAndCache(caregiverId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('Caregiver')
        .select(PROFILE_COLUMNS)
        .eq('caregiver_id', caregiverId)
        .maybeSingle();

    if (error || !data) return null;

    const row = data as CaregiverRow;
    try {
        const db = getDatabase();
        await db.runAsync(
            `INSERT INTO Caregiver (caregiver_id, full_name, email, caregiver_contact, image_url, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(caregiver_id) DO UPDATE SET
                full_name = excluded.full_name,
                email = excluded.email,
                caregiver_contact = excluded.caregiver_contact,
                image_url = excluded.image_url,
                updated_at = excluded.updated_at`,
            [
                row.caregiver_id,
                row.full_name,
                row.email,
                row.caregiver_contact,
                row.image_url,
                row.created_at,
                row.updated_at,
            ]
        );
    } catch {
        // A failed cache write only costs the next offline read its name.
    }

    return row.full_name;
}

// Display name for the paired caregiver, or null when it has never been cached and cannot be fetched.
// Callers must fall back to generic copy on null. A cached name answers instantly and refreshes in the background so a rename lands on the next read.
async function getDisplayName(caregiverId: string): Promise<string | null> {
    const cached = await readCachedName(caregiverId);
    if (cached) {
        fetchAndCache(caregiverId).catch(() => {});
        return cached;
    }
    return fetchAndCache(caregiverId).catch(() => null);
}

// Uploads a local image uri to the caregiver-avatars bucket, returns the public URL.
// The {caregiverId}/ prefix is what the bucket's RLS policies scope ownership on, so it is not just namespacing here.
async function uploadProfilePicture(
    caregiverId: string,
    photoUri: string
): Promise<ServiceResult<string>> {
    try {
        const fileExt = (photoUri.split('.').pop() ?? 'jpg').toLowerCase();
        const contentType =
            fileExt === 'png' ? 'image/png' :
            fileExt === 'webp' ? 'image/webp' :
            'image/jpeg';
        const photoId = Crypto.randomUUID();
        const path = `${caregiverId}/${photoId}.${fileExt}`;

        // React Native's fetch(...).blob() yields a blob that supabase-js uploads as 0 bytes; reading an ArrayBuffer uploads the real file contents. See https://supabase.com/docs/guides/storage (Expo).
        const arrayBuffer = await fetch(photoUri).then((res) => res.arrayBuffer());
        if (arrayBuffer.byteLength === 0) {
            return { data: null, error: 'Selected photo is empty. Please choose another.' };
        }

        const { error: uploadError } = await supabase.storage
            .from('caregiver-avatars')
            .upload(path, arrayBuffer, { upsert: true, contentType });

        if (uploadError) {
            return { data: null, error: 'Failed to upload photo. Please check your connection.' };
        }

        const { data } = supabase.storage.from('caregiver-avatars').getPublicUrl(path);
        return { data: data.publicUrl, error: null };
    } catch {
        return { data: null, error: 'Failed to upload photo. Please check your connection.' };
    }
}

// Writes straight to Supabase — Caregiver is not a syncable table, so there is no offline queue to fall back on.
// Only keys present in params are patched, so an explicit null clears the photo while an absent key leaves it alone.
async function updateProfile(
    caregiverId: string,
    params: UpdateProfileParams
): Promise<ServiceResult<CaregiverProfile>> {
    if (params.fullName !== undefined && !params.fullName.trim()) {
        return { data: null, error: 'Full name is required' };
    }
    if (params.contact !== undefined && !params.contact.trim()) {
        return { data: null, error: 'Phone number is required' };
    }

    // updated_at is left out on purpose: the trg_caregiver_updated_at BEFORE UPDATE trigger sets it.
    const patch: Database['public']['Tables']['Caregiver']['Update'] = {};
    if (params.fullName !== undefined) patch.full_name = params.fullName.trim();
    if (params.contact !== undefined) patch.caregiver_contact = params.contact.trim();
    if (params.imageUrl !== undefined) patch.image_url = params.imageUrl;

    if (Object.keys(patch).length === 0) {
        return { data: null, error: 'No changes to save.' };
    }

    const { data, error } = await supabase
        .from('Caregiver')
        .update(patch)
        .eq('caregiver_id', caregiverId)
        .select(PROFILE_COLUMNS)
        .single();

    if (error || !data) {
        return { data: null, error: 'Failed to save profile. Please check your connection.' };
    }

    const row = data as CaregiverRow;
    return {
        data: {
            caregiverId: row.caregiver_id,
            fullName: row.full_name,
            email: row.email,
            contact: row.caregiver_contact,
            imageUrl: row.image_url,
        },
        error: null,
    };
}

// Supabase's updateUser({ password }) does not reverify the old password, so the current one is
// checked by re-signing in first. That just refreshes the session for the same user.
async function changePassword(
    email: string,
    currentPassword: string,
    newPassword: string
): Promise<ServiceResult> {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: currentPassword,
    });

    if (verifyError) {
        return { data: null, error: 'Current password is incorrect.' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: null, error: null };
}

export const CaregiverService = {
    getDisplayName,
    // getDisplayName answers from cache and revalidates for its side effect only, discarding the result.
    // Callers that need the value a rename produced must await this instead.
    refreshDisplayName: fetchAndCache,
    uploadProfilePicture,
    updateProfile,
    changePassword,
};
