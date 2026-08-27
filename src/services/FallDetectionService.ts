import { LocationService } from '@/services/LocationService';
import { NotificationService } from '@/services/NotificationService';
import { SyncService } from '@/services/SyncService';
import { ThreatService } from '@/services/ThreatService';
import * as Location from 'expo-location';
import type { EventSubscription } from 'expo-modules-core';
import { Accelerometer, Gyroscope } from 'expo-sensors';

export type SensitivityLevel = 'low' | 'medium' | 'high';

export const FALL_DETECTION_CONFIG = {
    impactAccelThresholdMS2: 21.0,
    gyroRotationThresholdRad: 2.5,
    orientationTiltThresholdDeg: 60.0,
    triggerWindowMs: 1500,
};

let accelSubscription: EventSubscription | null = null;
let gyroSubscription: EventSubscription | null = null;

let lastImpactTimestamp = 0;
let lastRotationTimestamp = 0;
let lastTiltTimestamp = 0;

function startMonitoring(
    onFallDetected: () => void,
    _sensitivity: SensitivityLevel = 'high'
): void {
    if (accelSubscription || gyroSubscription) {
        return;
    }

    Accelerometer.setUpdateInterval(100);
    accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
        const magnitudeG = Math.sqrt(x * x + y * y + z * z);
        const magnitudeMS2 = magnitudeG * 9.80665;
        const now = Date.now();

        // 1. Impact Acceleration Condition
        if (magnitudeMS2 >= FALL_DETECTION_CONFIG.impactAccelThresholdMS2) {
            lastImpactTimestamp = now;
        }

        // 2. Orientation Tilt Condition (>= 60° tilt relative to vertical Z-axis)
        if (magnitudeG > 0) {
            const cosAngle = Math.min(1.0, Math.max(-1.0, Math.abs(z) / magnitudeG));
            const tiltDeg = Math.acos(cosAngle) * (180 / Math.PI);
            if (tiltDeg >= FALL_DETECTION_CONFIG.orientationTiltThresholdDeg) {
                lastTiltTimestamp = now;
            }
        }

        // 3. Multi-Threshold AND Gate: All 3 conditions must be satisfied within the 1.5s window
        const isImpactRecent = (now - lastImpactTimestamp) <= FALL_DETECTION_CONFIG.triggerWindowMs && lastImpactTimestamp > 0;
        const isRotationRecent = (now - lastRotationTimestamp) <= FALL_DETECTION_CONFIG.triggerWindowMs && lastRotationTimestamp > 0;
        const isTiltRecent = (now - lastTiltTimestamp) <= FALL_DETECTION_CONFIG.triggerWindowMs && lastTiltTimestamp > 0;

        if (isImpactRecent && isRotationRecent && isTiltRecent) {
            lastImpactTimestamp = 0;
            lastRotationTimestamp = 0;
            lastTiltTimestamp = 0;
            onFallDetected();
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

            if (rotVelocity >= FALL_DETECTION_CONFIG.gyroRotationThresholdRad) {
                lastRotationTimestamp = now;
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
    lastImpactTimestamp = 0;
    lastRotationTimestamp = 0;
    lastTiltTimestamp = 0;
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
