import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { REMINDER_HOUR, REMINDER_MINUTE } from '@/constants/config';
import { supabase } from '@/database/remote/supabaseClient';
import { AuthService } from '@/services/AuthService';
import { isOnline } from '@/utils/connectivity';

// Sets how notifications behave when the app is open (foreground)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Registers the device for push notifications and returns the Expo push token
async function registerForPushNotifications(): Promise<string | null> {
    // Push is Android-only: iOS omits the APNs entitlement so it can build without a paid Apple account
    if (Platform.OS !== 'android') {
        return null;
    }

    await Notifications.setNotificationChannelAsync('emergency-alerts', {
        name: 'Emergency Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
        sound: 'default',
    });

    // Support replies get their own channel at DEFAULT importance. Reusing emergency-alerts would put
    // a helpdesk answer through a MAX-priority red-light vibration meant for panic buttons and falls,
    // and would let a caregiver silencing support also silence emergencies.
    await Notifications.setNotificationChannelAsync('support', {
        name: 'Support replies',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
    });

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.warn('[NotificationService] Push permission not granted');
        return null;
    }

    const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
        console.warn('[NotificationService] No EAS projectId found');
        return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
}

// Saves the caregiver's push token to Supabase so their paired patient's device can look it up.
// Returns whether the row is stored: this runs once per app open and every later emergency lookup depends on it, so a caller that gets false must try again rather than leaving the caregiver unreachable.
async function savePushTokenForCaregiver(caregiverId: string, token: string): Promise<boolean> {
    // "CaregiverPushToken: own row only" checks caregiver_id = auth.uid(), so a missing or mismatched session is a guaranteed RLS rejection — not worth the round trip.
    const authUserId = await AuthService.getAuthUserId();
    if (authUserId !== caregiverId) {
        console.warn(
            `[NotificationService] Skipping push token save — session user ${authUserId ?? 'none'} does not own caregiver ${caregiverId}.`
        );
        return false;
    }

    if (!isOnline()) {
        console.warn('[NotificationService] Offline — push token not saved yet, will retry.');
        return false;
    }

    const { error } = await supabase
        .from('CaregiverPushToken')
        .upsert({ caregiver_id: caregiverId, push_token: token, updated_at: new Date().toISOString() });

    if (error) {
        console.error('[NotificationService] Failed to save push token to Supabase:', error);
        return false;
    }

    return true;
}

// Looks up the caregiver's push token from Supabase
async function getPushTokenForCaregiver(caregiverId: string): Promise<string | null> {
    console.log(`[NotificationService] Looking up push token for caregiver: ${caregiverId}`);

    // "CaregiverPushToken: paired patient reads" resolves auth.uid() to a Patient row, so with no session this returns nothing and the emergency push is silently never sent. The callers only report "token not found", so name the real reason here.
    if (!(await AuthService.getAuthUserId())) {
        console.error(
            '[NotificationService] No Supabase session — cannot look up the caregiver push token, so no emergency push will be sent. Re-pair this device.'
        );
        return null;
    }

    // maybeSingle rather than single: no row is a legitimate outcome (the caregiver never registered), and single reports it as an error that reads like a failure.
    const { data, error } = await supabase
        .from('CaregiverPushToken')
        .select('push_token')
        .eq('caregiver_id', caregiverId)
        .maybeSingle();

    if (error) {
        console.error('[NotificationService] Error fetching push token:', error);
    }
    
    const token = data?.push_token;
    console.log('[NotificationService] Found push token:', token);
    return token ?? null;
}

export type EmergencyAlertType =
    | 'Panic Button'
    | 'Fall Detected'
    | 'Wandering Alert'
    | 'Wandering Alert: Patient Outside Safe Zone'
    | (string & {});

// Triggers an immediate local system notification (banner & sound) on the device
async function sendLocalEmergencyNotification(
    alertType: EmergencyAlertType = 'Panic Button'
): Promise<void> {
    let title = '🚨 Emergency Alert!';
    let body = 'Your SOS emergency alert has been broadcasted!';

    if (alertType === 'Fall Detected') {
        title = '🚨 Fall Detected Alert!';
        body = 'A fall was detected! Emergency alert dispatched to caregiver.';
    } else if (alertType.startsWith('Wandering Alert')) {
        title = '🚨 Wandering Alert!';
        body = 'Patient detected outside safe zone! Emergency alert dispatched to caregiver.';
    }

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                sound: 'default',
                priority: Notifications.AndroidNotificationPriority.MAX,
            },
            trigger: null,
        });
        console.log('[NotificationService] Local emergency notification scheduled successfully.');
    } catch (e) {
        console.error('[NotificationService] Failed to send local emergency notification:', e);
    }
}

// Sends an emergency push notification to the caregiver via Expo Push API (or fallback local notification if no token is available)
async function sendEmergencyNotification(
    pushToken: string | null,
    alertType: EmergencyAlertType = 'Panic Button'
): Promise<void> {
    // If no remote push token is present, trigger a local notification as a fallback
    if (!pushToken) {
        console.warn('[NotificationService] No push token provided for remote caregiver notification, falling back to local alert.');
        await sendLocalEmergencyNotification(alertType);
        return;
    }

    console.log('[NotificationService] Sending push notification to token:', pushToken, 'type:', alertType);
    let title = '🚨 Emergency Alert!';
    let body = 'Your patient has triggered the SOS panic button. Open the app to respond.';

    if (alertType === 'Fall Detected') {
        title = '🚨 Fall Detected Alert!';
        body = 'A fall was detected for your patient! Open the app to view location and respond.';
    } else if (alertType.startsWith('Wandering Alert')) {
        title = '🚨 Wandering Alert!';
        body = 'Patient detected outside safe zone! Open the app to view location and respond.';
    }

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: pushToken,
                channelId: 'emergency-alerts',
                title,
                body,
                sound: 'default',
                priority: 'high',
                data: { url: '/(caregiver)/alerts' },
            }),
        });
        
        const result = await response.json();
        console.log('[NotificationService] Expo Push API response:', result);
    } catch (e) {
        console.error('[NotificationService] Failed to send push notification via fetch:', e);
    }
}

// A stable identifier so rescheduling replaces the reminder instead of stacking up duplicates.
const DAILY_REVIEW_ID = 'daily-review-reminder';

// Schedules the patient's daily review nudge on this device.
//
// Local notification, so the stripped APNs entitlement (see plugins/withIosNoPush) does not apply —
// unlike the emergency path above, this needs no push token and no Expo Push API round trip.
//
// The copy is an invitation, never loss framing: no streak warnings, no "don't break your run". The
// patient must never be made anxious about missing a day.
async function scheduleDailyReviewReminder(): Promise<boolean> {
    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        // Declining is a valid answer; the app just stays quiet.
        if (finalStatus !== 'granted') return false;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('daily-review', {
                name: 'Daily review',
                importance: Notifications.AndroidImportance.DEFAULT,
                sound: 'default',
            });
        }

        // Replacing rather than adding, so repeated app launches cannot queue several reminders.
        await Notifications.cancelScheduledNotificationAsync(DAILY_REVIEW_ID).catch(() => {});
        await Notifications.scheduleNotificationAsync({
            identifier: DAILY_REVIEW_ID,
            content: {
                title: 'Your memories are ready',
                body: 'A few minutes of review keeps them close.',
                data: { url: '/(patient)/training' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: REMINDER_HOUR,
                minute: REMINDER_MINUTE,
                channelId: 'daily-review',
            },
        });
        return true;
    } catch (e) {
        console.warn('[NotificationService] Failed to schedule daily review reminder:', e);
        return false;
    }
}

async function cancelDailyReviewReminder(): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REVIEW_ID).catch(() => {});
}


// Routes a tapped notification to the screen named in its data.url payload.
// Both existing notification paths already set data.url, but nothing consumed it until now, so this
// makes the emergency and daily-review deep links work too, not just support replies.
function addNotificationTapHandler(navigate: (url: string) => void): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const url = response.notification.request.content.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) {
            navigate(url);
        }
    });
    return () => subscription.remove();
}

export const NotificationService = {
    addNotificationTapHandler,
    registerForPushNotifications,
    savePushTokenForCaregiver,
    getPushTokenForCaregiver,
    sendLocalEmergencyNotification,
    sendEmergencyNotification,
    scheduleDailyReviewReminder,
    cancelDailyReviewReminder,
};


