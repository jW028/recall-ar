import { getDatabase } from '@/database/local/db';
import { isOnline } from '@/utils/connectivity';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Environment attached to a new support ticket, so "it doesn't work" arrives with something actionable.
// Descriptive only — no patient names, no medical notes, nothing the account does not already hold.
export interface Diagnostics {
    appVersion: string | null;
    sdkVersion: string | null;
    platform: string;
    osName: string | null;
    osVersion: string | null;
    deviceModel: string | null;
    online: boolean;
    pendingSyncCount: number | null;
    patientCount: number | null;
}

// A stuck sync queue is the single most useful signal here: it explains a whole class of
// "my changes vanished" reports without a round trip.
async function pendingSyncCount(): Promise<number | null> {
    try {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM SyncLog WHERE synced = 0`
        );
        return row?.count ?? 0;
    } catch {
        return null;
    }
}

async function patientCount(caregiverId: string): Promise<number | null> {
    try {
        const db = getDatabase();
        const row = await db.getFirstAsync<{ count: number }>(
            `SELECT COUNT(*) as count FROM Patient WHERE caregiver_id = ?`,
            [caregiverId]
        );
        return row?.count ?? 0;
    } catch {
        return null;
    }
}

export async function collectDiagnostics(caregiverId: string): Promise<Diagnostics> {
    return {
        appVersion: Constants.expoConfig?.version ?? null,
        sdkVersion: Constants.expoConfig?.sdkVersion ?? null,
        platform: Platform.OS,
        osName: Device.osName ?? null,
        osVersion: Device.osVersion ?? null,
        deviceModel: Device.modelName ?? null,
        online: isOnline(),
        pendingSyncCount: await pendingSyncCount(),
        patientCount: await patientCount(caregiverId),
    };
}
