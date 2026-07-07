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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Formats a UTC YYYY-MM-DD date as e.g. "Jul 7" without timezone drift.
function formatDate(date: string): string {
    const [, m, d] = date.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
}

// Formats a plotted value for the tooltip in the chart's own units.
function formatValue(value: number, mode: 'percent' | 'ms'): string {
    return mode === 'percent' ? `${Math.round(value)}%` : `${Math.round(value)} ms`;
}

// A single biomarker line chart over the smoothed daily series (UC03). Scrolls horizontally across the window and shows a draggable tooltip.
export function TrendChart({ title, points, color, mode }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { width } = useWindowDimensions();

    // Chart viewport width inside the card (screen minus screen/card padding).
    const viewport = width - 96;

    // Plot only days that have a smoothed value; gifted-charts cannot render gaps. Carry the real date for axis labels and the tooltip.
    const data = useMemo(() => {
        const filtered = points.filter((p) => p.smoothed !== null);
        // Thin x-axis labels to ~6 across the window so a month's worth doesn't crowd.
        const labelEvery = Math.max(1, Math.ceil(filtered.length / 6));
        return filtered.map((p, i) => ({
            value: mode === 'percent' ? (p.smoothed as number) * 100 : (p.smoothed as number),
            date: p.date,
            label: i % labelEvery === 0 ? formatDate(p.date) : '',
        }));
    }, [points, mode]);

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

    // Fill the viewport when there are few points, but clamp so a full month scrolls instead of squashing.
    const spacing = Math.max(16, viewport / data.length);

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
                xAxisLabelTextStyle={{ color: theme.textMuted, fontSize: 10 }}
                hideRules={false}
                rulesColor={theme.border}
                width={viewport}
                spacing={spacing}
                initialSpacing={spacing / 2}
                scrollToEnd
                pointerConfig={{
                    pointerColor: color,
                    pointerStripColor: theme.border,
                    pointerStripWidth: 1,
                    radius: 5,
                    pointerLabelWidth: 110,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: { value: number; date: string }[]) => {
                        const item = items[0];
                        return (
                            <View style={styles.tooltip}>
                                <Text style={styles.tooltipDate}>{formatDate(item.date)}</Text>
                                <Text style={[styles.tooltipValue, { color }]}>
                                    {formatValue(item.value, mode)}
                                </Text>
                            </View>
                        );
                    },
                }}
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
        tooltip: {
            backgroundColor: theme.surface,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 10,
            paddingVertical: 6,
        },
        tooltipDate: {
            fontSize: 11,
            color: theme.textMuted,
            marginBottom: 2,
        },
        tooltipValue: {
            fontSize: 14,
            fontWeight: '700',
        },
    });
}
