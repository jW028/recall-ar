import { AppTabBar } from '@/components/common/AppTabBar';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { NotificationService } from '@/services/NotificationService';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';

// Caregiver app defaults to light with an optional dark mode (persisted preference)
export default function CaregiverLayout() {
    const mode = useThemeStore((s) => s.mode);
    const user = useAuthStore((s) => s.user);

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
            <Tabs
                screenOptions={{ headerShown: false }}
                tabBar={(props) => <AppTabBar {...props} />}
            >
                <Tabs.Screen name="index" options={{ href: null }} />
                <Tabs.Screen
                    name="home"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="training"
                    options={{
                        title: 'Training',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'school' : 'school-outline'} size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="alerts"
                    options={{
                        title: 'Alerts',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'alert-circle' : 'alert-circle-outline'} size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="memories"
                    options={{
                        title: 'Memories',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'images' : 'images-outline'} size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="location"
                    options={{
                        title: 'Location',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'location' : 'location-outline'} size={size} color={color} />
                        ),
                    }}
                />
            </Tabs>
        </ThemeSchemeContext.Provider>
    );
}
