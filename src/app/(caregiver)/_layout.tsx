import { AppTabBar, TAB_ICON_SIZE } from '@/components/common/AppTabBar';
import { SwipeTabs } from '@/components/common/SwipeTabs';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { NotificationService } from '@/services/NotificationService';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// Caregiver app defaults to light with an optional dark mode (persisted preference)
export default function CaregiverLayout() {
    const mode = useThemeStore((s) => s.mode);
    const user = useAuthStore((s) => s.user);
    const segments = useSegments();
    const router = useRouter();

    // Only the root of each tab swipes, so the gesture never fights a detail screen's back swipe
    const swipeEnabled = segments.length <= 2;

    useEffect(() => {
        const userId = user?.id;
        if (!userId) return;

        let saved = false;

        // Register for push notifications when the caregiver logs in/opens the app
        async function setupPushNotifications(uid: string) {
            if (saved) return;
            try {
                const token = await NotificationService.registerForPushNotifications();
                if (token) {
                    saved = await NotificationService.savePushTokenForCaregiver(uid, token);
                    if (saved) console.log('[CaregiverLayout] Push token registered and saved:', token);
                }
            } catch (err) {
                console.warn('[CaregiverLayout] Error setting up push notifications:', err);
            }
        }

        setupPushNotifications(userId);

        // The save legitimately fails while offline or before the session settles, and every emergency push the patient sends depends on that row existing. Retry on the way back to the foreground rather than leaving the caregiver unreachable until the next cold start.
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') setupPushNotifications(userId);
        });

        return () => subscription.remove();
    }, [user?.id]);

    // Tapping a push should land on the thing it is about — a support reply opens that ticket.
    useEffect(() => {
        return NotificationService.addNotificationTapHandler((url) => {
            router.push(url as Parameters<typeof router.push>[0]);
        });
    }, [router]);

    return (
        <ThemeSchemeContext.Provider value={mode}>
            <SwipeTabs
                tabBarPosition="bottom"
                screenOptions={{ swipeEnabled, lazy: true }}
                // The bar reads the same props from either navigator, which type-check separately
                tabBar={(props) => <AppTabBar {...(props as unknown as BottomTabBarProps)} />}
            >
                <SwipeTabs.Screen
                    name="home"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ focused, color }) => (
                            <Ionicons
                                name={focused ? 'home' : 'home-outline'}
                                size={TAB_ICON_SIZE}
                                color={color}
                            />
                        ),
                    }}
                />
                <SwipeTabs.Screen
                    name="training"
                    options={{
                        title: 'Training',
                        tabBarIcon: ({ focused, color }) => (
                            <Ionicons
                                name={focused ? 'school' : 'school-outline'}
                                size={TAB_ICON_SIZE}
                                color={color}
                            />
                        ),
                    }}
                />
                <SwipeTabs.Screen
                    name="alerts"
                    options={{
                        title: 'Alerts',
                        tabBarIcon: ({ focused, color }) => (
                            <Ionicons
                                name={focused ? 'alert-circle' : 'alert-circle-outline'}
                                size={TAB_ICON_SIZE}
                                color={color}
                            />
                        ),
                    }}
                />
                <SwipeTabs.Screen
                    name="memories"
                    options={{
                        title: 'Memories',
                        tabBarIcon: ({ focused, color }) => (
                            <Ionicons
                                name={focused ? 'images' : 'images-outline'}
                                size={TAB_ICON_SIZE}
                                color={color}
                            />
                        ),
                    }}
                />
                <SwipeTabs.Screen
                    name="location"
                    options={{
                        title: 'Location',
                        tabBarIcon: ({ focused, color }) => (
                            <Ionicons
                                name={focused ? 'location' : 'location-outline'}
                                size={TAB_ICON_SIZE}
                                color={color}
                            />
                        ),
                    }}
                />
            </SwipeTabs>
        </ThemeSchemeContext.Provider>
    );
}
