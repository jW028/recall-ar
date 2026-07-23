import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface MetricTileProps {
    label: string;
    value: string;
    valueColor?: string;
    // Optional delta caption: positive drives color (green good / red bad), up drives the arrow direction (actual value movement)
    delta?: { text: string; positive: boolean; up: boolean } | null;
    // When provided, the tile becomes a button (e.g. tapping a training metric opens Analytics)
    onPress?: () => void;
}

// Card showing a headline metric with an optional improving/declining delta
export function MetricTile({ label, value, valueColor, delta, onPress }: MetricTileProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const deltaColor = delta?.positive ? theme.success : theme.error;

    const content = (
        <>
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.value, { color: valueColor ?? theme.body }]}>{value}</Text>
            {delta && (
                <View style={styles.deltaRow}>
                    <Ionicons
                        name={delta.up ? 'arrow-up' : 'arrow-down'}
                        size={13}
                        color={deltaColor}
                    />
                    <Text style={[styles.deltaText, { color: deltaColor }]}>{delta.text}</Text>
                </View>
            )}
        </>
    );

    if (onPress) {
        return (
            <Pressable
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${label} ${value}`}
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
            padding: 16,
        },
        pressed: {
            opacity: 0.6,
        },
        label: {
            fontSize: 13,
            color: theme.textMuted,
            marginBottom: 6,
        },
        value: {
            fontSize: 30,
            fontWeight: '800',
        },
        deltaRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            marginTop: 4,
        },
        deltaText: {
            fontSize: 13,
            fontWeight: '600',
        },
    });
}
