import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AnalyticsDataset } from '@/models/Analytics';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    dataset: AnalyticsDataset;
}

// Adherence metrics, shown distinctly from the biomarkers so missed sessions aren't read as decline.
export function EngagementCard({ dataset }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.card}>
            <Text style={styles.heading}>Engagement</Text>
            <View style={styles.row}>
                <View style={styles.stat}>
                    <Text style={styles.label}>Days active</Text>
                    <Text style={styles.value}>{dataset.daysActive}</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.label}>Completion rate</Text>
                    <Text style={styles.value}>{Math.round(dataset.completionRate * 100)}%</Text>
                </View>
                <View style={styles.stat}>
                    <Text style={styles.label}>Current streak</Text>
                    <Text style={styles.value}>
                        {dataset.currentStreakDays} {dataset.currentStreakDays === 1 ? 'day' : 'days'}
                    </Text>
                </View>
            </View>
            <Text style={styles.note}>
                Engagement is adherence, not performance — low activity makes the biomarkers above less certain.
            </Text>
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
        },
        heading: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.label,
            marginBottom: 12,
        },
        row: {
            flexDirection: 'row',
        },
        stat: {
            flex: 1,
        },
        label: {
            fontSize: 12,
            color: theme.textMuted,
            marginBottom: 4,
        },
        value: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.body,
        },
        note: {
            fontSize: 12,
            color: theme.textFaint,
            marginTop: 12,
        },
    });
}
