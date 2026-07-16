import { Button } from '@/components/common/Button';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useARViewModel } from '@/viewmodels/useARViewModel';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera } from 'react-native-vision-camera';

export default function ARViewScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
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
        isCameraActive,
        onCameraError,
    } = useARViewModel();

    // Screen is already inset above the tab bar; small gap is enough
    const overlayBottom = 24;

    if (!hasPermission) {
        return (
            <View style={[styles.centered, { paddingTop: insets.top + 16 }]}>
                <Text style={styles.permissionTitle}>Camera access needed</Text>
                <Text style={styles.permissionBody}>
                    RecallAR needs camera access to recognize faces and objects.
                </Text>
                <Button label="Allow camera" icon="camera-outline" onPress={requestPermission} />
            </View>
        );
    }

    const ready = !isInitializing && !initError;

    const recognizedLabel = ready && result?.status === 'recognized' ? result.label ?? null : null;
    // Ambiguous look-alikes show a shared category (e.g. "Keys") without asserting a specific item
    const ambiguousLabel = ready && result?.status === 'ambiguous' ? result.label ?? null : null;

    const statusText = (() => {
        if (isInitializing) return null;
        if (initError) return null;
        if (!isCameraActive) return 'Reconnecting camera…';
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
                    isActive={ready && isCameraActive}
                    outputs={[photoOutput]}
                    onError={onCameraError}
                />
            )}

            {isInitializing && (
                <View style={styles.initOverlay}>
                    <ActivityIndicator size="large" color={theme.onPrimary} />
                    <Text style={styles.initText}>Loading recognition model…</Text>
                </View>
            )}

            {initError && (
                <View style={[styles.errorOverlay, { bottom: overlayBottom }]}>
                    <Text style={styles.errorText}>{initError}</Text>
                    <Button label="Go back" variant="secondary" onPress={() => router.replace('/(patient)')} />
                </View>
            )}

            {/* Recognition only looks at the centre of the frame, so show the patient where to aim */}
            {ready && (
                <View style={styles.guideBox} pointerEvents="none">
                    <Text style={styles.guideHint}>Point at the object</Text>
                </View>
            )}

            {ready && (
                <View style={[styles.resultContainer, { bottom: overlayBottom }]}>
                    {recognizedLabel ? (
                        <View style={styles.recognizedCard}>
                            <Text style={styles.recognizedLabel}>{recognizedLabel}</Text>
                        </View>
                    ) : ambiguousLabel ? (
                        <View style={styles.ambiguousCard}>
                            <Text style={styles.ambiguousLabel}>{ambiguousLabel}</Text>
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
            backgroundColor: theme.scrim,
        },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.surface,
            paddingHorizontal: 32,
            gap: 12,
        },
        permissionTitle: {
            fontSize: 22,
            fontWeight: '700',
            color: theme.heading,
            textAlign: 'center',
        },
        permissionBody: {
            fontSize: 15,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 12,
        },
        initOverlay: {
            // Dark scrim over the live camera feed
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
        },
        initText: {
            color: theme.onPrimary,
            fontSize: 16,
            fontWeight: '500',
        },
        errorOverlay: {
            position: 'absolute',
            left: 24,
            right: 24,
            backgroundColor: theme.errorStrong,
            borderRadius: 16,
            padding: 20,
            alignItems: 'center',
            gap: 12,
        },
        errorText: {
            color: theme.onPrimary,
            fontSize: 14,
            textAlign: 'center',
        },
        resultContainer: {
            position: 'absolute',
            left: 24,
            right: 24,
            alignItems: 'center',
        },
        recognizedCard: {
            backgroundColor: theme.success,
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 28,
        },
        recognizedLabel: {
            color: theme.onPrimary,
            fontSize: 22,
            fontWeight: '700',
            textAlign: 'center',
        },
        ambiguousCard: {
            // Neutral (not the confident green) — the shared category without a specific claim
            backgroundColor: theme.surface,
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 28,
        },
        ambiguousLabel: {
            color: theme.heading,
            fontSize: 22,
            fontWeight: '700',
            textAlign: 'center',
        },
        guideBox: {
            // Mirrors AR_LIVE_CROP_FRACTION: the region the object model actually sees
            position: 'absolute',
            left: '20%',
            top: '20%',
            width: '60%',
            height: '60%',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.7)',
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'flex-start',
        },
        guideHint: {
            color: 'rgba(255,255,255,0.9)',
            fontSize: 15,
            fontWeight: '600',
            marginTop: -30,
            textShadowColor: 'rgba(0,0,0,0.8)',
            textShadowRadius: 4,
        },
        statusCard: {
            // Neutral scrim chip over the camera feed
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 24,
        },
        statusLabel: {
            color: 'rgba(255,255,255,0.85)',
            fontSize: 15,
            fontWeight: '500',
        },
    });
}
