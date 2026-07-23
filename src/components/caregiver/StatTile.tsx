import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface StatTileProps {
    value: number | string;
    label: string;
    // When provided, the tile becomes a button (e.g. tapping Objects opens the filtered list)
    onPress?: () => void;
}

// Compact card showing a single count (e.g. Objects, People)
export function StatTile({ value, label, onPress }: StatTileProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const content = (
        <>
            <Text style={styles.value}>{value}</Text>
            <Text style={styles.label}>{label}</Text>
        </>
    );

    if (onPress) {
        return (
            <Pressable
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${value} ${label}`}
            >
                {content}
            </Pressable>
        );
    }

    return <View style={styles.tile}>{content}</View>;
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
        pressed: {
            opacity: 0.6,
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
