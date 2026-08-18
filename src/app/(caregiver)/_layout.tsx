import { AppTabBar, TAB_ICON_SIZE } from '@/components/common/AppTabBar';
import { SwipeTabs } from '@/components/common/SwipeTabs';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { NotificationService } from '@/services/NotificationService';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSegments } from 'expo-router';
import { useEffect } from 'react';

// Caregiver app defaults to light with an optional dark mode (persisted preference)
export default function CaregiverLayout() {
    const mode = useThemeStore((s) => s.mode);
    const user = useAuthStore((s) => s.user);
    const segments = useSegments();

    // Only the root of each tab swipes, so the gesture never fights a detail screen's back swipe
    const swipeEnabled = segments.length <= 2;

    useEffect(() => {
        const userId = user?.id;
        if (!userId) return;

        // Register for push notifications when the caregiver logs in/opens the app
        async function setupPushNotifications(uid: string) {
            try {
                const token = await NotificationService.registerForPushNotifications();
                if (token) {
                    await NotificationService.savePushTokenForCaregiver(uid, token);
                    console.log('[CaregiverLayout] Push token registered and saved:', token);
                }
            } catch (err) {
                console.warn('[CaregiverLayout] Error setting up push notifications:', err);
            }
        }

        setupPushNotifications(userId);
    }, [user?.id]);

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
