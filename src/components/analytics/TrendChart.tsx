import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DailyPoint } from '@/models/Analytics';
import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

interface Props {
    title: string;
    points: DailyPoint[];
    color: string;
    // 'percent' scales 0..1 fractions to 0..100; 'ms' plots raw milliseconds.
    mode: 'percent' | 'ms';
}

// A single biomarker line chart over the smoothed daily series (UC03).
export function TrendChart({ title, points, color, mode }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { width } = useWindowDimensions();

    // Plot only days that have a smoothed value; gifted-charts cannot render gaps.
    const data = useMemo(
        () =>
            points
                .filter((p) => p.smoothed !== null)
                .map((p) => ({
                    value: mode === 'percent' ? (p.smoothed as number) * 100 : (p.smoothed as number),
                })),
        [points, mode]
    );

    if (data.length < 2) {
        return (
            <View style={styles.card}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.placeholder}>Not enough data to chart yet.</Text>
            </View>
        );
    }

    const maxValue =
        mode === 'percent' ? 100 : Math.ceil(Math.max(...data.map((d) => d.value)) * 1.15);

    return (
        <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <LineChart
                data={data}
                color={color}
                thickness={2.5}
                maxValue={maxValue}
                noOfSections={4}
                hideDataPoints
                curved
                yAxisColor={theme.border}
                xAxisColor={theme.border}
                yAxisTextStyle={{ color: theme.textMuted, fontSize: 10 }}
                yAxisLabelSuffix={mode === 'percent' ? '%' : ''}
                hideRules={false}
                rulesColor={theme.border}
                width={width - 96}
                adjustToWidth
            />
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
        title: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.label,
            marginBottom: 16,
        },
        placeholder: {
            fontSize: 13,
            color: theme.textMuted,
            paddingVertical: 24,
            textAlign: 'center',
        },
    });
}
