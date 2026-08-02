import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { LocationService } from '@/services/LocationService';
import { ThreatService } from '@/services/ThreatService';
import { SyncService } from '@/services/SyncService';
import { NotificationService } from '@/services/NotificationService';
import type { EventSubscription } from 'expo-modules-core';

export type SensitivityLevel = 'low' | 'normal' | 'high';

interface FallDetectionConfig {
    lowGThreshold: number;
    highGThreshold: number;
    extremeImpactThreshold: number;
}

const SENSITIVITY_CONFIGS: Record<SensitivityLevel, FallDetectionConfig> = {
    high: { lowGThreshold: 0.45, highGThreshold: 2.8, extremeImpactThreshold: 4.2 },
    normal: { lowGThreshold: 0.35, highGThreshold: 3.5, extremeImpactThreshold: 5.0 },
    low: { lowGThreshold: 0.25, highGThreshold: 4.2, extremeImpactThreshold: 6.0 },
};

let subscription: EventSubscription | null = null;
let isFreeFallDetected = false;
let freeFallTimestamp = 0;

function startMonitoring(
    onFallDetected: () => void,
    sensitivity: SensitivityLevel = 'normal'
): void {
    if (subscription) {
        return;
    }

    const config = SENSITIVITY_CONFIGS[sensitivity];
    Accelerometer.setUpdateInterval(100);

    subscription = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        // 1. Detect weightless drop / free-fall phase
        if (magnitude < config.lowGThreshold) {
            isFreeFallDetected = true;
            freeFallTimestamp = now;
            return;
        }

        // 2. Expire free-fall state if more than 1.5 seconds have elapsed
        if (isFreeFallDetected && now - freeFallTimestamp > 1500) {
            isFreeFallDetected = false;
        }

        // 3. Impact phase: Require free-fall drop + impact spike, OR extreme high impact peak
        if (magnitude > config.highGThreshold) {
            if (isFreeFallDetected || magnitude >= config.extremeImpactThreshold) {
                isFreeFallDetected = false;
                onFallDetected();
            }
        }
    });
}

function stopMonitoring(): void {
    if (subscription) {
        subscription.remove();
        subscription = null;
    }
    isFreeFallDetected = false;
}

function isMonitoring(): boolean {
    return subscription !== null;
}

async function triggerFallEmergency(
    patientId: string,
    caregiverId: string
): Promise<boolean> {
    try {
        try {
            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            await LocationService.publishLocation(patientId, {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                accuracy: loc.coords.accuracy,
            });
        } catch (locError) {
            console.warn('[FallDetectionService] Could not retrieve location for fall emergency:', locError);
        }

        await ThreatService.createThreat({
            patientId,
            threatType: 'Fall Detected',
            threatStatus: 'Critical',
            alertStatus: 'Active',
        });

        await SyncService.drainQueue().catch(e =>
            console.warn('[FallDetectionService] Sync drain failed during emergency:', e)
        );

        const pushToken = await NotificationService.getPushTokenForCaregiver(caregiverId).catch(() => null);
        await NotificationService.sendEmergencyNotification(pushToken, 'Fall Detected');

        return true;
    } catch (e) {
        console.error('[FallDetectionService] Failed to trigger fall emergency:', e);
        return false;
    }
}

export const FallDetectionService = {
    startMonitoring,
    stopMonitoring,
    isMonitoring,
    triggerFallEmergency,
};
