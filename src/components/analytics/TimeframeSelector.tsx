import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AnalyticsTimeframe } from '@/models/Analytics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const OPTIONS: { value: AnalyticsTimeframe; label: string }[] = [
    { value: '7d', label: 'Past 7 Days' },
    { value: '30d', label: 'Past Month' },
];

interface Props {
    value: AnalyticsTimeframe;
    onChange: (value: AnalyticsTimeframe) => void;
}

// Segmented control letting the caregiver pick the analytics window (UC03).
export function TimeframeSelector({ value, onChange }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.row}>
            {OPTIONS.map((option) => {
                const active = option.value === value;
                return (
                    <Pressable
                        key={option.value}
                        style={[styles.segment, active && styles.segmentActive]}
                        onPress={() => onChange(option.value)}
                    >
                        <Text style={[styles.label, active && styles.labelActive]}>
                            {option.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        row: {
            flexDirection: 'row',
            backgroundColor: theme.backgroundElement,
            borderRadius: 10,
            padding: 4,
            marginBottom: 20,
        },
        segment: {
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 8,
        },
        segmentActive: {
            backgroundColor: theme.surface,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.textMuted,
        },
        labelActive: {
            color: theme.primaryText,
        },
    });
}
