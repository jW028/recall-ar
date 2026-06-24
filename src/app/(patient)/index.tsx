import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LocationService } from '@/services/LocationService';
import { PairingService } from '@/services/PairingService';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>RecallAR</Text>
                <Text style={styles.subtitle}>Point the camera at a face or object to identify it.</Text>

                <Pressable
                    style={styles.arButton}
                    onPress={() => router.push('/(patient)/ar-view')}
                >
                    <Text style={styles.arButtonText}>Start AR</Text>
                </Pressable>

                <Pressable
                    style={styles.reviewButton}
                    onPress={() => router.push('/(patient)/training')}
                >
                    <Text style={styles.reviewButtonText}>Daily review</Text>
                </Pressable>
            </View>

            <Pressable
                style={styles.signOutButton}
                onPress={handleSignOut}
                disabled={isSigningOut}
            >
                <Text style={styles.signOutText}>
                    {isSigningOut ? 'Signing out…' : 'Sign out'}
                </Text>
            </Pressable>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.surface,
        },
        content: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
            gap: 16,
        },
        title: {
            fontSize: 36,
            fontWeight: '800',
            color: theme.body,
            marginBottom: 4,
        },
        subtitle: {
            fontSize: 16,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 16,
        },
        arButton: {
            backgroundColor: theme.primary,
            borderRadius: 14,
            paddingVertical: 18,
            paddingHorizontal: 48,
            alignItems: 'center',
        },
        arButtonText: {
            color: theme.onPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
        reviewButton: {
            borderRadius: 14,
            paddingVertical: 18,
            paddingHorizontal: 48,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.primary,
            backgroundColor: theme.primarySoft,
        },
        reviewButtonText: {
            color: theme.primaryText,
            fontSize: 18,
            fontWeight: '700',
        },
        signOutButton: {
            position: 'absolute',
            bottom: 40,
            alignSelf: 'center',
            paddingVertical: 12,
            paddingHorizontal: 32,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.errorBorder,
            backgroundColor: theme.errorBackground,
        },
        signOutText: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.error,
        },
    });
}
