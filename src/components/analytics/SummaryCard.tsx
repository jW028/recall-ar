import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AnalyticsDataset } from '@/models/Analytics';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    dataset: AnalyticsDataset;
}

const TREND_LABEL = {
    improving: '↑ Improving',
    stable: '→ Stable',
    declining: '↓ Declining',
} as const;

// Headline scalars: current accuracy, current median latency, and trend direction (UC03).
export function SummaryCard({ dataset }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const accuracy =
        dataset.currentAccuracy === null ? '—' : `${Math.round(dataset.currentAccuracy * 100)}%`;
    const latency =
        dataset.currentMedianLatencyMs === null
            ? '—'
            : `${Math.round(dataset.currentMedianLatencyMs)} ms`;

    const trendColor =
        dataset.trendDirection === 'declining'
            ? theme.errorStrong
            : dataset.trendDirection === 'improving'
              ? theme.success
              : theme.textMuted;

    return (
        <View style={styles.card}>
            <View style={styles.stat}>
                <Text style={styles.label}>Accuracy</Text>
                <Text style={styles.value}>{accuracy}</Text>
            </View>
            <View style={styles.stat}>
                <Text style={styles.label}>Median latency</Text>
                <Text style={styles.value}>{latency}</Text>
            </View>
            <View style={styles.stat}>
                <Text style={styles.label}>Trend</Text>
                <Text style={[styles.value, { color: trendColor }]}>
                    {TREND_LABEL[dataset.trendDirection]}
                </Text>
            </View>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            backgroundColor: theme.cardBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            marginBottom: 16,
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
    });
}
