import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { REMINDER_HOUR, REMINDER_MINUTE } from '@/constants/config';
import { supabase } from '@/database/remote/supabaseClient';

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

// Saves the caregiver's push token to Supabase so the patient can look it up
// Note: Requires a table `CaregiverPushToken` with columns `caregiver_id`, `push_token`, `updated_at`
async function savePushTokenForCaregiver(caregiverId: string, token: string): Promise<void> {
    const { error } = await supabase
        .from('CaregiverPushToken' as any)
        .upsert({ caregiver_id: caregiverId, push_token: token, updated_at: new Date().toISOString() });
    
    if (error) {
        console.error('[NotificationService] Failed to save push token to Supabase:', error);
    }
}

// Looks up the caregiver's push token from Supabase
async function getPushTokenForCaregiver(caregiverId: string): Promise<string | null> {
    console.log(`[NotificationService] Looking up push token for caregiver: ${caregiverId}`);
    const { data, error } = await supabase
        .from('CaregiverPushToken' as any)
        .select('push_token')
        .eq('caregiver_id', caregiverId)
        .single();
        
    if (error) {
        console.error('[NotificationService] Error fetching push token:', error);
    }
    
    const token = (data as any)?.push_token;
    console.log('[NotificationService] Found push token:', token);
    return token ?? null;
}

// Sends an emergency push notification to the caregiver via Expo Push API
async function sendEmergencyNotification(pushToken: string): Promise<void> {
    console.log('[NotificationService] Sending push notification to token:', pushToken);
    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: pushToken,
                channelId: 'emergency-alerts',
                title: '🚨 Emergency Alert!',
                body: 'Your patient has triggered the SOS panic button. Open the app to respond.',
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

export const NotificationService = {
    registerForPushNotifications,
    savePushTokenForCaregiver,
    getPushTokenForCaregiver,
    sendEmergencyNotification,
    scheduleDailyReviewReminder,
    cancelDailyReviewReminder,
};
