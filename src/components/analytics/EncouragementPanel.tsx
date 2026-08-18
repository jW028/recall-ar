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
    const daysSince = daysSinceLastReview(snapshot?.lastActiveDay ?? null);
    // Two days is a gap worth a nudge; one is just a day off.
    const needsNudge = daysSince !== null && daysSince >= 2;

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
                    <View style={styles.stat}>
                        <Text style={styles.statLabel}>Last reviewed</Text>
                        <Text style={[styles.statValue, needsNudge && styles.statValueAttention]}>
                            {lastReviewedLabel(snapshot.lastActiveDay)}
                        </Text>
                    </View>
                </View>
            )}
            {/* The at-risk signal lives here and nowhere else: the patient's own screens stay purely
                encouraging, and this panel is exactly where a caregiver can act on it. */}
            {needsNudge && (
                <Text style={styles.nudge}>
                    It has been a few days — a message from you often helps.
                </Text>
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

// Whole days between the patient's last recorded review and today. Null when they have never trained.
function daysSinceLastReview(lastActiveDay: string | null): number | null {
    if (!lastActiveDay) return null;
    const last = Date.parse(`${lastActiveDay}T00:00:00Z`);
    if (Number.isNaN(last)) return null;
    const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    return Math.max(0, Math.round((today - last) / 86_400_000));
}

function lastReviewedLabel(lastActiveDay: string | null): string {
    const days = daysSinceLastReview(lastActiveDay);
    if (days === null) return 'Not yet';
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
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
        // Attention, not alarm — a gap in adherence is not a clinical finding
        statValueAttention: {
            color: theme.warning,
        },
        nudge: {
            fontSize: 13,
            color: theme.bodySecondary,
            lineHeight: 18,
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
