import { AppTabBar } from '@/components/common/AppTabBar';
import { FallAlertModal } from '@/components/patient/FallAlertModal';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { useFallDetectionViewModel } from '@/viewmodels/useFallDetectionViewModel';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';


// Patient app is always light mode
export default function PatientLayout() {
    const {
        fallState,
        countdownSeconds,
        enableMonitoring,
        disableMonitoring,
        cancelFallAlert,
        triggerImmediateSOS,
    } = useFallDetectionViewModel();

    useEffect(() => {
        enableMonitoring();
        return () => {
            disableMonitoring();
        };
    }, [enableMonitoring, disableMonitoring]);

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
                <Tabs.Screen
                    name="album"
                    options={{
                        title: 'Album',
                        tabBarIcon: ({ focused, color, size }) => (
                            <Ionicons name={focused ? 'images' : 'images-outline'} size={size} color={color} />
                        ),
                    }}
                />
            </Tabs>

            <FallAlertModal
                visible={fallState !== 'idle'}
                countdownSeconds={countdownSeconds}
                fallState={fallState}
                onCancel={cancelFallAlert}
                onImmediateSOS={triggerImmediateSOS}
            />
        </ThemeSchemeContext.Provider>
    );
}

