import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import type { FallState } from '@/viewmodels/useFallDetectionViewModel';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

interface FallAlertModalProps {
    visible: boolean;
    countdownSeconds: number;
    fallState: FallState;
    onCancel: () => void;
    onImmediateSOS: () => void;
}

export function FallAlertModal({
    visible,
    countdownSeconds,
    fallState,
    onCancel,
    onImmediateSOS,
}: FallAlertModalProps) {
    const theme = useTheme();

    useEffect(() => {
        if (visible && fallState === 'countdown') {
            Vibration.vibrate([0, 400, 400], true);
        } else {
            Vibration.cancel();
        }

        return () => {
            Vibration.cancel();
        };
    }, [visible, fallState]);

    if (!visible) return null;

    return (
        <Modal
            transparent
            animationType="fade"
            visible={visible}
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.error }]}>
                    <View style={[styles.iconContainer, { backgroundColor: theme.error + '20' }]}>
                        <Ionicons
                            name={fallState === 'triggered' ? 'checkmark-circle' : 'warning-outline'}
                            size={56}
                            color={theme.error}
                        />
                    </View>

                    <Text style={[styles.title, { color: theme.heading }]}>
                        {fallState === 'triggered'
                            ? 'Emergency Alert Dispatched'
                            : 'Fall Detected!'}
                    </Text>

                    <Text style={[styles.message, { color: theme.textMuted }]}>
                        {fallState === 'triggered'
                            ? 'Your caregiver and emergency contacts have been notified of your location.'
                            : `Are you OK? Alerting caregiver in ${countdownSeconds} seconds...`}
                    </Text>

                    {fallState === 'countdown' && (
                        <View style={[styles.timerBadge, { backgroundColor: theme.error }]}>
                            <Text style={styles.timerText}>{countdownSeconds}s</Text>
                        </View>
                    )}

                    <View style={styles.buttonContainer}>
                        {fallState === 'countdown' ? (
                            <>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.cancelButton,
                                        { backgroundColor: theme.primary },
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={onCancel}
                                >
                                    <Text style={styles.cancelButtonText}>I'm OK - Cancel Alert</Text>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.sosButton,
                                        { borderColor: theme.error },
                                        pressed && styles.pressed,
                                    ]}
                                    onPress={onImmediateSOS}
                                >
                                    <Text style={[styles.sosButtonText, { color: theme.error }]}>
                                        Send SOS Now
                                    </Text>
                                </Pressable>
                            </>
                        ) : (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.cancelButton,
                                    { backgroundColor: theme.primary },
                                    pressed && styles.pressed,
                                ]}
                                onPress={onCancel}
                            >
                                <Text style={styles.cancelButtonText}>Dismiss</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        borderRadius: 24,
        borderWidth: 2,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        width: 90,
        height: 90,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    timerBadge: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    timerText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '800',
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    cancelButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    sosButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 2,
        alignItems: 'center',
    },
    sosButtonText: {
        fontSize: 16,
        fontWeight: '700',
    },
    pressed: {
        opacity: 0.85,
    },
});
