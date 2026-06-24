import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useDevicePairingViewModel } from '@/viewmodels/useDevicePairingViewModel';
import { usePatientDetailViewModel } from '@/viewmodels/usePatientViewModel';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Clipboard, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PairDeviceScreen() {
    const id = useCurrentPatientId() ?? undefined;
    const router = useRouter();
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const { patient } = usePatientDetailViewModel(id);
    const {
    pairingToken,
    isGenerating,
    error,
    secondsRemaining,
    isExpired,
    generateToken,
    } = useDevicePairingViewModel(id);

    // Auto-regenerate a fresh token when the old one expires
    useEffect(() => {
    if (isExpired) {
        generateToken();
    }
    }, [isExpired, generateToken]);

    return (
    <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>Pair {patient?.patientName ?? 'patient'}'s device</Text>
        <Text style={styles.body}>
        On the patient's phone, open RecallAR and tap{' '}
        <Text style={styles.bold}>"Set up a patient device"</Text> on the
        sign-in screen. Then hold this code up to their camera.
        </Text>

        <View style={styles.qrWrapper}>
        {isGenerating && !pairingToken && (
            <ActivityIndicator size="large" color={theme.primary} />
        )}

        {pairingToken && !isGenerating && (
            <QRCode
            value={pairingToken.token}
            size={220}
            backgroundColor={theme.surface}
            color={theme.body}
            />
        )}

        {error && (
            <Text style={styles.errorText}>{error}</Text>
        )}
        </View>

        {pairingToken && (
        <View style={styles.statusRow}>
            <View style={[styles.statusDot, isExpired && styles.statusDotExpired]} />
            <Text style={styles.statusText}>
            {isExpired
                ? 'Code expired — generating a new one…'
                : `Expires in ${formatCountdown(secondsRemaining)}`}
            </Text>
        </View>
        )}

        {__DEV__ && pairingToken && (
        <Pressable
            style={styles.devCopyButton}
            onPress={() => Clipboard.setString(pairingToken.token)}
        >
            <Text style={styles.devCopyText}>⚙ DEV: Copy token</Text>
        </Pressable>
        )}

        <Pressable
        style={styles.refreshButton}
        onPress={generateToken}
        disabled={isGenerating}
        >
        <Text style={styles.refreshButtonText}>
            {isGenerating ? 'Generating…' : 'Generate new code'}
        </Text>
        </Pressable>

        <Text style={styles.hint}>
        This only needs to be done once per device. The patient won't need
        to scan this again unless they get a new phone.
        </Text>
    </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: theme.surface,
    paddingHorizontal: 32,
    paddingTop: 56,
    alignItems: 'center',
    },
    backButton: {
    alignSelf: 'flex-start',
    marginBottom: 24,
    },
    backButtonText: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: '600',
    },
    title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.body,
    textAlign: 'center',
    marginBottom: 12,
    },
    body: {
    fontSize: 15,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    },
    bold: {
    fontWeight: '700',
    color: theme.body,
    },
    qrWrapper: {
    width: 260,
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    },
    errorText: {
    color: theme.error,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    },
    statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
    },
    statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.success,
    },
    statusDotExpired: {
    backgroundColor: theme.warning,
    },
    statusText: {
    fontSize: 14,
    color: theme.textMuted,
    },
    refreshButton: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginBottom: 24,
    },
    refreshButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.label,
    },
    hint: {
    fontSize: 13,
    color: theme.textFaint,
    textAlign: 'center',
    paddingHorizontal: 16,
    },
    devCopyButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    },
    devCopyText: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
    },
    });
}