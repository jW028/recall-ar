import { getDatabase } from "@/database/local/db";
import { supabase } from "@/database/remote/supabaseClient";
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';


// Constants
const PAIRING_TOKEN_TTL_MINUTES = 10;
const SECURE_STORE_SESSION_KEY = 'recallar_patient_session';
const SECURE_STORE_PAIRING_KEY = 'recallar_pairing_info';

const EDGE_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/pair-device`;

// Types
export interface PairingToken {
    token: string;
    patientId: string;
    expiresAt: string; // ISO-8601
}

export interface PairingResult {
    success: boolean;
    patientId: string | null;
    error: string | null;
}

export interface PairingInfo {
    pairingId: string;
    patientId: string;
    caregiverId: string;
    deviceLabel: string | null;
    pairedAt: string;
}

// Caregiver side
async function generatePairingToken(
    patientId: string
): Promise<{ data: PairingToken | null; error: string | null}>
{
    const { data: sessionData } = await supabase.auth.getSession();
    const caregiverId = sessionData.session?.user.id;

    if (!caregiverId) {
        return { data: null, error: 'Not authenticated.' };
    }

    const randomBytes = await Crypto.getRandomBytesAsync(32);
    const token = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    const expiresAt = new Date(
        Date.now() + PAIRING_TOKEN_TTL_MINUTES * 60 * 1000
    ).toISOString();

    const { error } = await supabase.from('DevicePairing').insert({
        patient_id: patientId,
        caregiver_id: caregiverId,
        token,
        expires_at: expiresAt,
    });

    if (error) {
        return {
            data: null,
            error: 'Failed to generate pairing token. Please try again.',
        };
    }

    return {
        data: { token, patientId, expiresAt },
        error: null,
    };
}

// Patient side
async function pairDevice(token: string): Promise<PairingResult> {
    let response: Response;
    try {
        response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        });
    } catch {
        return {
            success: false,
            patientId: null,
            error: 'Network error. Please check your connection and try again.',
        };
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        return {
            success: false,
            patientId: null,
            error: body?.error ?? 'Invalid or expired QR code. Please generate a new one.',
        };
    }

    const body = await response.json();
    const { access_token, refresh_token, pairing_id, patient_id, caregiver_id } = body; 

    const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
    });

    if (sessionError) {
        return {
            success: false,
            patientId: null,
            error: 'Failed to establish session. Please try again.',
        };
    }

    // Persist session tokens in SecureStore across app restarts
    await SecureStore.setItemAsync(
        SECURE_STORE_SESSION_KEY,
        JSON.stringify({ access_token, refresh_token })
    );

    const pairedAt = new Date().toISOString();
    const pairingInfo: PairingInfo = {
        pairingId: pairing_id,
        patientId: patient_id,
        caregiverId: caregiver_id,
        deviceLabel: null,
        pairedAt,
    };

    // Persist pairing info to SecureStore
    await SecureStore.setItemAsync(
        SECURE_STORE_PAIRING_KEY,
        JSON.stringify(pairingInfo)
    );

    // Persist to SQLite for offline access
    try {
        const db = getDatabase();
        await db.runAsync(
            `INSERT OR REPLACE INTO DevicePairing
                (pairing_id, patient_id, caregiver_id, device_label, paired_at)
                VALUES (?, ?, ?, ?, ?)`,
                [pairing_id, patient_id, caregiver_id, null, pairedAt]
        );
    } catch (dbError) {
        console.warn('[PairingService] SQLite persist failed:', dbError);
    }

    return { success: true, patientId: patient_id, error: null };
}


// Check if device is already paired with a patient
async function getPersistedPairing(): Promise<PairingInfo | null> {
    try {
        const raw = await SecureStore.getItemAsync(SECURE_STORE_PAIRING_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PairingInfo;
    } catch {
        return null;
    }
}

// Unpair device - used to reset patient device
async function unpairDevice(): Promise<void> {
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync(SECURE_STORE_SESSION_KEY);
    await SecureStore.deleteItemAsync(SECURE_STORE_PAIRING_KEY);

    try {
        const db = getDatabase();
        await db.runAsync('DELETE FROM DevicePairing');
    } catch (e) {
        console.warn('[PairingService] SQLite unapir failed:', e);
    }
}

export const PairingService = {
    generatePairingToken,
    pairDevice,
    getPersistedPairing,
    unpairDevice,
};