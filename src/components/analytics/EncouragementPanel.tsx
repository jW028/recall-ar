import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useEncouragementViewModel } from '@/viewmodels/useEncouragementViewModel';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const PRESETS: { emoji: string; message: string }[] = [
    { emoji: '❤️', message: 'Great job!' },
    { emoji: '⭐', message: 'So proud of you!' },
    { emoji: '🌟', message: 'Keep it up!' },
];

// Caregiver panel: the patient's engagement at a glance plus one-tap encouragements.
export function EncouragementPanel({ patientId }: { patientId: string }) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { snapshot, isSending, isCoolingDown, sentConfirmation, error, send } =
        useEncouragementViewModel(patientId);

    const disabled = isSending || isCoolingDown;

    return (
        <View style={styles.card}>
            <Text style={styles.heading}>Cheer them on</Text>
            {snapshot && (
                <View style={styles.statsRow}>
                    <View style={styles.stat}>
                        <Text style={styles.statLabel}>Current streak</Text>
                        <Text style={styles.statValue}>
                            {snapshot.streakDays} {snapshot.streakDays === 1 ? 'day' : 'days'}
                        </Text>
                    </View>
                    <View style={styles.stat}>
                        <Text style={styles.statLabel}>Answered today</Text>
                        <Text style={styles.statValue}>{snapshot.answeredToday}</Text>
                    </View>
                </View>
            )}
            <View style={styles.presetRow}>
                {PRESETS.map((preset) => (
                    <Pressable
                        key={preset.emoji}
                        style={[styles.presetButton, disabled && styles.presetDisabled]}
                        disabled={disabled}
                        onPress={() => send(preset.message, preset.emoji)}
                    >
                        <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                        <Text style={styles.presetLabel}>{preset.message}</Text>
                    </Pressable>
                ))}
            </View>
            {sentConfirmation && <Text style={styles.confirmation}>{sentConfirmation}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: {
            backgroundColor: theme.cardBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            marginBottom: 16,
            gap: 12,
        },
        heading: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.label,
        },
        statsRow: {
            flexDirection: 'row',
        },
        stat: {
            flex: 1,
        },
        statLabel: {
            fontSize: 12,
            color: theme.textMuted,
            marginBottom: 4,
        },
        statValue: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.body,
        },
        presetRow: {
            flexDirection: 'row',
            gap: 8,
        },
        presetButton: {
            flex: 1,
            alignItems: 'center',
            gap: 4,
            backgroundColor: theme.primarySoft,
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 4,
        },
        presetDisabled: {
            opacity: 0.5,
        },
        presetEmoji: {
            fontSize: 20,
        },
        presetLabel: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.primaryText,
            textAlign: 'center',
        },
        confirmation: {
            fontSize: 13,
            color: theme.success,
            fontWeight: '600',
        },
        error: {
            fontSize: 13,
            color: theme.error,
            fontWeight: '600',
        },
    });
}
