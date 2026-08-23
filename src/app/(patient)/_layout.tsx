import { AppTabBar } from '@/components/common/AppTabBar';
import { FallAlertModal } from '@/components/patient/FallAlertModal';
import { WanderingAlertModal } from '@/components/patient/WanderingAlertModal';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { useFallDetectionViewModel } from '@/viewmodels/useFallDetectionViewModel';
import { useWanderingViewModel } from '@/viewmodels/useWanderingViewModel';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';


// Patient app is always light mode
export default function PatientLayout() {
    const {
        fallState,
        countdownSeconds: fallCountdownSeconds,
        enableMonitoring: enableFallMonitoring,
        disableMonitoring: disableFallMonitoring,
        cancelFallAlert,
        triggerImmediateSOS: triggerImmediateFallSOS,
    } = useFallDetectionViewModel();

    const {
        wanderingState,
        countdownSeconds: wanderingCountdownSeconds,
        enableWanderingMonitoring,
        disableWanderingMonitoring,
        confirmPatientOK,
        triggerImmediateWanderingSOS,
    } = useWanderingViewModel();

    useEffect(() => {
        enableFallMonitoring();
        enableWanderingMonitoring();
        return () => {
            disableFallMonitoring();
            disableWanderingMonitoring();
        };
    }, [
        enableFallMonitoring,
        disableFallMonitoring,
        enableWanderingMonitoring,
        disableWanderingMonitoring,
    ]);

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
                countdownSeconds={fallCountdownSeconds}
                fallState={fallState}
                onCancel={cancelFallAlert}
                onImmediateSOS={triggerImmediateFallSOS}
            />

            <WanderingAlertModal
                visible={wanderingState !== 'idle'}
                countdownSeconds={wanderingCountdownSeconds}
                wanderingState={wanderingState}
                onCancel={confirmPatientOK}
                onImmediateSOS={triggerImmediateWanderingSOS}
            />
        </ThemeSchemeContext.Provider>
    );
}

