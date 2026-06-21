import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useARViewModel } from '@/viewmodels/useARViewModel';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Camera } from 'react-native-vision-camera';

export default function ARViewScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();

    const {
        hasPermission,
        requestPermission,
        device,
        isInitializing,
        initError,
        result,
        photoOutput,
    } = useARViewModel();

    if (!hasPermission) {
        return (
            <View style={styles.centered}>
                <Pressable style={styles.backButtonCentered} onPress={() => router.back()}>
                    <Text style={styles.backButtonCenteredText}>‹ Back</Text>
                </Pressable>
                <Text style={styles.permissionTitle}>Camera access needed</Text>
                <Text style={styles.permissionBody}>
                    RecallAR needs camera access to recognize faces and objects.
                </Text>
                <Pressable style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Allow camera</Text>
                </Pressable>
            </View>
        );
    }

    const overlayLabel = !isInitializing && !initError && result?.status === 'recognized'
        ? result.label ?? null
        : null;

    const statusText = (() => {
        if (isInitializing) return null;
        if (initError) return null;
        if (!result || result.status === 'scanning') return 'Scanning…';
        if (result.status === 'unknown') return 'No match found';
        return null;
    })();

    return (
        <View style={styles.container}>
            {device && (
                <Camera
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={!isInitializing && !initError}
                    outputs={[photoOutput]}
                />
            )}

            <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>‹ Back</Text>
            </Pressable>

            {isInitializing && (
                <View style={styles.initOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.initText}>Loading recognition model…</Text>
                </View>
            )}

            {initError && (
                <View style={styles.errorOverlay}>
                    <Text style={styles.errorText}>{initError}</Text>
                    <Pressable style={styles.retryButton} onPress={() => router.back()}>
                        <Text style={styles.retryButtonText}>Go back</Text>
                    </Pressable>
                </View>
            )}

            {!isInitializing && !initError && (
                <View style={styles.resultContainer}>
                    {overlayLabel ? (
                        <View style={styles.recognizedCard}>
                            <Text style={styles.recognizedLabel}>{overlayLabel}</Text>
                        </View>
                    ) : statusText ? (
                        <View style={styles.statusCard}>
                            <Text style={styles.statusLabel}>{statusText}</Text>
                        </View>
                    ) : null}
                </View>
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#000',
        },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.surface,
            paddingHorizontal: 32,
        },
        backButtonCentered: {
            position: 'absolute',
            top: 60,
            left: 24,
        },
        backButtonCenteredText: {
            fontSize: 16,
            color: theme.primary,
            fontWeight: '600',
        },
        permissionTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: theme.body,
            marginBottom: 12,
            textAlign: 'center',
        },
        permissionBody: {
            fontSize: 15,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 24,
        },
        button: {
            backgroundColor: theme.primary,
            borderRadius: 10,
            paddingVertical: 14,
            paddingHorizontal: 28,
            alignItems: 'center',
        },
        buttonText: {
            color: theme.onPrimary,
            fontSize: 16,
            fontWeight: '600',
        },
        backButton: {
            position: 'absolute',
            top: 60,
            left: 24,
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 20,
        },
        backButtonText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '600',
        },
        initOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        initText: {
            color: '#fff',
            fontSize: 16,
            fontWeight: '500',
        },
        errorOverlay: {
            position: 'absolute',
            bottom: 120,
            left: 24,
            right: 24,
            backgroundColor: 'rgba(180,0,0,0.85)',
            borderRadius: 12,
            padding: 20,
            alignItems: 'center',
            gap: 12,
        },
        errorText: {
            color: '#fff',
            fontSize: 14,
            textAlign: 'center',
        },
        retryButton: {
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 8,
            paddingVertical: 8,
            paddingHorizontal: 20,
        },
        retryButtonText: {
            color: '#fff',
            fontSize: 14,
            fontWeight: '600',
        },
        resultContainer: {
            position: 'absolute',
            bottom: 80,
            left: 24,
            right: 24,
            alignItems: 'center',
        },
        recognizedCard: {
            backgroundColor: 'rgba(16, 185, 129, 0.92)',
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 28,
        },
        recognizedLabel: {
            color: '#fff',
            fontSize: 22,
            fontWeight: '700',
            textAlign: 'center',
        },
        statusCard: {
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        statusLabel: {
            color: 'rgba(255,255,255,0.75)',
            fontSize: 15,
            fontWeight: '500',
        },
    });
}
