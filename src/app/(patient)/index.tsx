import { Screen } from '@/components/common/Screen';
import { PanicButton } from '@/components/patient/PanicButton';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LocationService } from '@/services/LocationService';
import { PairingService } from '@/services/PairingService';
import { SyncService } from '@/services/SyncService';
import { ThreatService } from '@/services/ThreatService';
import { NotificationService } from '@/services/NotificationService';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';


export default function PatientHomeScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();
    const [isSigningOut, setIsSigningOut] = useState(false);

    // ── Publish GPS location every 30 s while app is open ──────────
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;
        let cancelled = false;

        (async () => {
            // Get the patientId from the persisted pairing
            const pairing = await PairingService.getPersistedPairing();
            if (!pairing || cancelled) return;

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted' || cancelled) return;

            const publish = async () => {
                if (cancelled) return;
                try {
                    const loc = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    await LocationService.publishLocation(pairing.patientId, {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        accuracy: loc.coords.accuracy,
                    });
                    // Prune table to keep last 10 entries only
                    LocationService.pruneOldLocations(pairing.patientId);
                } catch (e) {
                    console.warn('[PatientHome] GPS publish error:', e);
                }
            };

            // Publish immediately, then every 30 s
            publish();
            intervalId = setInterval(publish, 30_000);
        })();

        return () => {
            cancelled = true;
            if (intervalId !== null) clearInterval(intervalId);
        };
    }, []);

    const handleSignOut = async () => {
        setIsSigningOut(true);
        await PairingService.unpairDevice();
        router.replace('/(auth)/pair');
    };

    const handleEmergency = async () => {
        const pairing = await PairingService.getPersistedPairing();

        if (!pairing) return;

        try {
            // 1. Instantly get current location of the patient for the alert
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            await LocationService.publishLocation(pairing.patientId, {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                accuracy: loc.coords.accuracy,
            });

            // 2. Create the emergency threat
            await ThreatService.createThreat({
                patientId: pairing.patientId,
                threatType: 'Panic Button',
                threatStatus: 'Critical',
                alertStatus: 'Active'
            });

            // 3. Force an instant push to the cloud immediately
            await SyncService.drainQueue();

            // 4. Look up caregiver's push token and send Expo push notification directly
            const pushToken = await NotificationService.getPushTokenForCaregiver(pairing.caregiverId);
            if (pushToken) {
                await NotificationService.sendEmergencyNotification(pushToken);
            } else {
                console.warn('[PatientHome] Caregiver push token not found');
            }

            Alert.alert("Emergency Broadcasted", "Your caregiver has been notified of your location.");
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Could not send emergency alert.");
        }
    };

    return (
        <Screen topInset>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>RecallAR</Text>
                <Text style={styles.subtitle}>
                    Point the camera at a face or object to identify it, or review your memories.
                </Text>

                <PanicButton onTrigger={handleEmergency} />

                <Pressable
                    style={({ pressed }) => [styles.actionCard, styles.primaryCard, pressed && styles.pressed]}
                    onPress={() => router.push('/(patient)/ar-view')}
                >
                    <View style={[styles.iconBadge, styles.primaryBadge]}>
                        <Ionicons name="scan" size={32} color={theme.onPrimary} />
                    </View>
                    <Text style={[styles.actionTitle, styles.primaryTitle]}>Start AR</Text>
                    <Text style={[styles.actionBody, styles.primaryBody]}>
                        Identify people and objects around you
                    </Text>
                </Pressable>

                <Pressable
                    style={({ pressed }) => [styles.actionCard, styles.secondaryCard, pressed && styles.pressed]}
                    onPress={() => router.push('/(patient)/training')}
                >
                    <View style={[styles.iconBadge, styles.secondaryBadge]}>
                        <Ionicons name="school" size={32} color={theme.primary} />
                    </View>
                    <Text style={styles.actionTitle}>Daily review</Text>
                    <Text style={styles.actionBody}>Practice remembering your people and things</Text>
                </Pressable>
            </ScrollView>

            <Pressable
                style={styles.signOutButton}
                onPress={handleSignOut}
                disabled={isSigningOut}
                hitSlop={8}
            >
                <Text style={styles.signOutText}>
                    {isSigningOut ? 'Signing out…' : 'Unpair this device'}
                </Text>
            </Pressable>
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        content: {
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 16,
            gap: 16,
        },
        title: {
            fontSize: 36,
            fontWeight: '800',
            color: theme.heading,
        },
        subtitle: {
            fontSize: 16,
            color: theme.textMuted,
            lineHeight: 22,
            marginBottom: 8,
        },
        actionCard: {
            borderRadius: 20,
            padding: 24,
            gap: 8,
        },
        pressed: {
            opacity: 0.9,
        },
        primaryCard: {
            backgroundColor: theme.primary,
        },
        secondaryCard: {
            backgroundColor: theme.cardBackground,
            borderWidth: 1,
            borderColor: theme.border,
        },
        iconBadge: {
            width: 60,
            height: 60,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 8,
        },
        primaryBadge: {
            backgroundColor: 'rgba(255,255,255,0.18)',
        },
        secondaryBadge: {
            backgroundColor: theme.primarySoft,
        },
        actionTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: theme.heading,
        },
        primaryTitle: {
            color: theme.onPrimary,
        },
        actionBody: {
            fontSize: 15,
            color: theme.textMuted,
            lineHeight: 20,
        },
        primaryBody: {
            color: 'rgba(255,255,255,0.85)',
        },
        signOutButton: {
            alignSelf: 'center',
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        signOutText: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.textMuted,
        },
    });
}
