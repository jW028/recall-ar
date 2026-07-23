import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SessionSummary } from '@/viewmodels/useTrainingViewModel';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
    summary: SessionSummary;
    streakDays?: number;
    onDone: () => void;
    onBrowseAlbum?: () => void;
}

// End-of-session celebration. Counts only positives — there is no wrong-answer tally anywhere on this screen.
export function SessionSummaryView({ summary, streakDays, onDone, onBrowseAlbum }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const rememberedLine =
        summary.correct > 0
            ? `You remembered ${summary.correct} ${summary.correct === 1 ? 'memory' : 'memories'} today ⭐`
            : `You practiced ${summary.answered} ${summary.answered === 1 ? 'memory' : 'memories'} today — every review helps.`;

    return (
        <View style={styles.centered}>
            <View style={styles.iconBadge}>
                <Ionicons name="star" size={40} color={theme.warning} />
            </View>
            <Text style={styles.title}>Great work today</Text>
            <Text style={styles.message}>{rememberedLine}</Text>
            {summary.masteredNames.length > 0 && (
                <Text style={styles.mastered}>
                    {summary.masteredNames.join(' and ')}{' '}
                    {summary.masteredNames.length === 1 ? 'is' : 'are'} now a memory you know well!
                </Text>
            )}
            {streakDays !== undefined && streakDays >= 1 && (
                <Text style={styles.streak}>
                    That&apos;s {streakDays} {streakDays === 1 ? 'day' : 'days'} in a row ⭐
                </Text>
            )}
            {onBrowseAlbum && summary.masteredNames.length > 0 && (
                <Pressable onPress={onBrowseAlbum} hitSlop={8}>
                    <Text style={styles.albumLink}>See it in your album</Text>
                </Pressable>
            )}
            <Pressable style={styles.primaryButton} onPress={onDone}>
                <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.surface,
            paddingHorizontal: 32,
            gap: 16,
        },
        iconBadge: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
        title: {
            fontSize: 28,
            fontWeight: '800',
            color: theme.body,
        },
        message: {
            fontSize: 18,
            color: theme.body,
            textAlign: 'center',
            lineHeight: 26,
        },
        mastered: {
            fontSize: 16,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 24,
        },
        streak: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.primaryText,
            textAlign: 'center',
        },
        albumLink: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.primary,
        },
        primaryButton: {
            backgroundColor: theme.primary,
            borderRadius: 14,
            paddingVertical: 18,
            paddingHorizontal: 48,
            alignItems: 'center',
            marginTop: 8,
        },
        primaryButtonText: {
            color: theme.onPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
    });
}
