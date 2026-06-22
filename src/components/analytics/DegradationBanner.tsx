import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AnalyticsDataset } from '@/models/Analytics';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
    dataset: AnalyticsDataset;
}

// Surfaces the UC04 A2 degradation flag (or an insufficient-data notice) at the top of the dashboard.
export function DegradationBanner({ dataset }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    if (dataset.insufficientData) {
        return (
            <View style={[styles.banner, styles.neutral]}>
                <Text style={styles.neutralText}>
                    Not enough activity yet for a reliable trend ({dataset.sessionsCount} sessions over{' '}
                    {dataset.distinctDaysCount} days).
                </Text>
            </View>
        );
    }

    if (dataset.isDegrading) {
        return (
            <View style={[styles.banner, styles.warn]}>
                <Text style={styles.warnText}>⚠ Possible cognitive decline flagged for this period.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.banner, styles.ok]}>
            <Text style={styles.okText}>✓ No degradation flagged for this period.</Text>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        banner: {
            borderRadius: 10,
            borderWidth: 1,
            padding: 14,
            marginBottom: 16,
        },
        warn: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
        },
        warnText: {
            color: theme.error,
            fontSize: 14,
            fontWeight: '600',
        },
        ok: {
            backgroundColor: theme.primaryMuted,
            borderColor: theme.primaryMutedBorder,
        },
        okText: {
            color: theme.primaryText,
            fontSize: 14,
            fontWeight: '600',
        },
        neutral: {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
        },
        neutralText: {
            color: theme.textMuted,
            fontSize: 13,
        },
    });
}
