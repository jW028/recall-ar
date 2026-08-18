import { Accelerometer, Gyroscope } from 'expo-sensors';
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
    gyroRotationThreshold: number;
}

const SENSITIVITY_CONFIGS: Record<SensitivityLevel, FallDetectionConfig> = {
    high: { lowGThreshold: 0.45, highGThreshold: 2.8, extremeImpactThreshold: 4.2, gyroRotationThreshold: 2.5 },
    normal: { lowGThreshold: 0.35, highGThreshold: 3.5, extremeImpactThreshold: 5.0, gyroRotationThreshold: 3.5 },
    low: { lowGThreshold: 0.25, highGThreshold: 4.2, extremeImpactThreshold: 6.0, gyroRotationThreshold: 5.0 },
};

let accelSubscription: EventSubscription | null = null;
let gyroSubscription: EventSubscription | null = null;
let isFreeFallDetected = false;
let freeFallTimestamp = 0;
let isHighRotationDetected = false;
let highRotationTimestamp = 0;

function startMonitoring(
    onFallDetected: () => void,
    sensitivity: SensitivityLevel = 'high'
): void {
    if (accelSubscription || gyroSubscription) {
        return;
    }

    const config = SENSITIVITY_CONFIGS[sensitivity];

    Accelerometer.setUpdateInterval(100);
    accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        // Expire high rotation state if more than 1.5 seconds have elapsed
        if (isHighRotationDetected && now - highRotationTimestamp > 1500) {
            isHighRotationDetected = false;
        }

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

        // 3. Impact phase: Require (free-fall drop OR high rotational burst) + impact spike, OR extreme high impact peak
        if (magnitude > config.highGThreshold) {
            if (isFreeFallDetected || isHighRotationDetected || magnitude >= config.extremeImpactThreshold) {
                isFreeFallDetected = false;
                isHighRotationDetected = false;
                onFallDetected();
            }
        }
    });

    Gyroscope.isAvailableAsync().then(available => {
        if (!available) {
            console.warn('[FallDetectionService] Gyroscope is not available on this device. Operating on accelerometer only.');
            return;
        }
        Gyroscope.setUpdateInterval(100);
        gyroSubscription = Gyroscope.addListener(({ x, y, z }) => {
            const rotVelocity = Math.sqrt(x * x + y * y + z * z);
            const now = Date.now();

            if (rotVelocity >= config.gyroRotationThreshold) {
                isHighRotationDetected = true;
                highRotationTimestamp = now;
            }
        });
    }).catch(err => {
        console.warn('[FallDetectionService] Failed to check Gyroscope availability:', err);
    });
}

function stopMonitoring(): void {
    if (accelSubscription) {
        accelSubscription.remove();
        accelSubscription = null;
    }
    if (gyroSubscription) {
        gyroSubscription.remove();
        gyroSubscription = null;
    }
    isFreeFallDetected = false;
    isHighRotationDetected = false;
}

function isMonitoring(): boolean {
    return accelSubscription !== null || gyroSubscription !== null;
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
