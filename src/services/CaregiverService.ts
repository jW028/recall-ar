import { getDatabase } from '@/database/local/db';
import { supabase } from '@/database/remote/supabaseClient';

// Patient-side read of the paired caregiver's profile, so patient copy can name them instead of saying "your caregiver".
// The caregiver row is not part of pull sync (it has no patient_id to scope on), so it is fetched directly and cached in the local Caregiver table for offline reads.

interface CaregiverRow {
    caregiver_id: string;
    full_name: string;
    email: string;
    caregiver_contact: string;
    created_at: string;
    updated_at: string;
}

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
        .select('caregiver_id, full_name, email, caregiver_contact, created_at, updated_at')
        .eq('caregiver_id', caregiverId)
        .maybeSingle();

    if (error || !data) return null;

    const row = data as CaregiverRow;
    try {
        const db = getDatabase();
        await db.runAsync(
            `INSERT INTO Caregiver (caregiver_id, full_name, email, caregiver_contact, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(caregiver_id) DO UPDATE SET
                full_name = excluded.full_name,
                email = excluded.email,
                caregiver_contact = excluded.caregiver_contact,
                updated_at = excluded.updated_at`,
            [
                row.caregiver_id,
                row.full_name,
                row.email,
                row.caregiver_contact,
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

export const CaregiverService = {
    getDisplayName,
};
