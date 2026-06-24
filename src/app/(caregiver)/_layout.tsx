import { AppTabBar } from '@/components/common/AppTabBar';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { useThemeStore } from '@/store/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

// Caregiver app defaults to light with an optional dark mode (persisted preference)
export default function CaregiverLayout() {
    const mode = useThemeStore((s) => s.mode);

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
