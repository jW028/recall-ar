import { GeofenceService } from '@/services/GeofenceService';
import { LocationService } from '@/services/LocationService';
import { NotificationService } from '@/services/NotificationService';
import { SyncService } from '@/services/SyncService';
import { ThreatService } from '@/services/ThreatService';
import * as Location from 'expo-location';

export const WANDERING_CONFIG = {
    wanderingThresholdMs: 15 * 60 * 1000, // 15 minutes
    wanderingIntervalMs: 15 * 60 * 1000,
    countdownDurationSec: 30,
};

let locationSubscription: Location.LocationSubscription | null = null;
let timerSubscription: ReturnType<typeof setInterval> | null = null;

let outsideFirstTimestamp = 0;
let lastPromptTimestamp = 0;

function resetWanderingState(): void {
    outsideFirstTimestamp = 0;
    lastPromptTimestamp = 0;
}

function snoozePromptForInterval(now: number = Date.now()): void {
    lastPromptTimestamp = now;
}

function getWanderingTimestamps() {
    return {
        outsideFirstTimestamp,
        lastPromptTimestamp,
    };
}

function setWanderingTimestamps(outsideFirst: number, lastPrompt: number) {
    outsideFirstTimestamp = outsideFirst;
    lastPromptTimestamp = lastPrompt;
}

/**
 * Core evaluation logic: Given patient's current location and timestamp,
 * determine if patient has been outside safe zones for >= 15 minutes and
 * if a confirmation prompt should be triggered.
 */
async function evaluateWanderingStatus(
    patientId: string,
    latitude: number,
    longitude: number,
    now: number = Date.now(),
    config = WANDERING_CONFIG
): Promise<boolean> {
    const { data: geofences } = await GeofenceService.getGeofencesByPatient(patientId);

    // If patient has no defined geofences/safe zones, wandering monitoring cannot apply
    if (!geofences || geofences.length === 0) {
        resetWanderingState();
        return false;
    }

    // Check if patient is inside ANY safe zone
    let isInsideAnySafeZone = false;
    for (const fence of geofences) {
        const R = 6371e3; // Earth radius in meters
        const p1 = (latitude * Math.PI) / 180;
        const p2 = (fence.centerLatitude * Math.PI) / 180;
        const dp = ((fence.centerLatitude - latitude) * Math.PI) / 180;
        const dl = ((fence.centerLongitude - longitude) * Math.PI) / 180;
        const a =
            Math.sin(dp / 2) * Math.sin(dp / 2) +
            Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (dist <= fence.radiusMeters) {
            isInsideAnySafeZone = true;
            break;
        }
    }

    if (isInsideAnySafeZone) {
        // Patient returned to safe zone -> Reset wandering timer
        resetWanderingState();
        return false;
    }

    // Patient is OUTSIDE all safe zones
    if (outsideFirstTimestamp === 0) {
        outsideFirstTimestamp = now;
    }

    const timeOutside = now - outsideFirstTimestamp;

    if (timeOutside >= config.wanderingThresholdMs) {
        // Check if prompt has never been shown OR 15-minute interval has passed since last prompt
        if (
            lastPromptTimestamp === 0 ||
            (now - lastPromptTimestamp) >= config.wanderingIntervalMs
        ) {
            lastPromptTimestamp = now;
            return true; // Trigger confirmation prompt!
        }
    }

    return false;
}

async function startWanderingMonitoring(
    patientId: string,
    onWanderingPrompt: () => void,
    locationPollIntervalMs: number = 10000
): Promise<void> {
    if (locationSubscription || timerSubscription) {
        return;
    }

    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.warn('[WanderingDetectionService] Location permission denied.');
            return;
        }

        const pollLocationAndEvaluate = async () => {
            try {
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                const { latitude, longitude } = loc.coords;

                await LocationService.publishLocation(patientId, {
                    latitude,
                    longitude,
                    accuracy: loc.coords.accuracy,
                });

                const shouldPrompt = await evaluateWanderingStatus(patientId, latitude, longitude);
                if (shouldPrompt) {
                    onWanderingPrompt();
                }
            } catch (err) {
                console.warn('[WanderingDetectionService] Failed to check position:', err);
            }
        };

        // Initial check
        await pollLocationAndEvaluate();

        // Recurring evaluation poll
        timerSubscription = setInterval(pollLocationAndEvaluate, locationPollIntervalMs);
    } catch (e) {
        console.warn('[WanderingDetectionService] Error starting location watcher:', e);
    }
}

function stopWanderingMonitoring(): void {
    if (locationSubscription) {
        locationSubscription.remove();
        locationSubscription = null;
    }
    if (timerSubscription) {
        clearInterval(timerSubscription);
        timerSubscription = null;
    }
    resetWanderingState();
}

function isWanderingMonitoring(): boolean {
    return timerSubscription !== null || locationSubscription !== null;
}

async function triggerWanderingEmergency(
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
            console.warn('[WanderingDetectionService] Could not retrieve location for emergency:', locError);
        }

        await ThreatService.createThreat({
            patientId,
            threatType: 'Wandering Detected',
            threatStatus: 'Critical',
            alertStatus: 'Active',
        });

        await SyncService.drainQueue().catch(e =>
            console.warn('[WanderingDetectionService] Sync drain failed during emergency:', e)
        );

        const pushToken = await NotificationService.getPushTokenForCaregiver(caregiverId).catch(() => null);
        await NotificationService.sendEmergencyNotification(pushToken, 'Wandering Alert: Patient Outside Safe Zone');

        return true;
    } catch (e) {
        console.error('[WanderingDetectionService] Failed to trigger wandering emergency:', e);
        return false;
    }
}

export const WanderingDetectionService = {
    evaluateWanderingStatus,
    startWanderingMonitoring,
    stopWanderingMonitoring,
    isWanderingMonitoring,
    triggerWanderingEmergency,
    resetWanderingState,
    snoozePromptForInterval,
    getWanderingTimestamps,
    setWanderingTimestamps,
};
