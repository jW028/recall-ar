import { AppTabBar } from '@/components/common/AppTabBar';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

// Patient app is always light mode
export default function PatientLayout() {
    return (
        <ThemeSchemeContext.Provider value="light">
            <Tabs
                screenOptions={{ headerShown: false }}
                tabBar={(props) => <AppTabBar {...props} />}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="ar-view"
                    options={{
                        title: 'Identify',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'scan' : 'scan-outline'} size={size} color={color} />
                        ),
                    }}
                />
                <Tabs.Screen
                    name="training"
                    options={{
                        title: 'Review',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'school' : 'school-outline'} size={size} color={color} />
                        ),
                    }}
                />
            </Tabs>
        </ThemeSchemeContext.Provider>
    );
}
