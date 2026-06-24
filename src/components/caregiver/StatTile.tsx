import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatTileProps {
    value: number | string;
    label: string;
}

// Compact card showing a single count (e.g. Objects, People)
export function StatTile({ value, label }: StatTileProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.tile}>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        tile: {
            flex: 1,
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            paddingVertical: 24,
            alignItems: 'center',
        },
        value: {
            fontSize: 34,
            fontWeight: '800',
            color: theme.primary,
        },
        label: {
            fontSize: 15,
            color: theme.textMuted,
            marginTop: 2,
        },
    });
}
