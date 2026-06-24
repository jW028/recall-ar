import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ActionRowProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    subtitle?: string;
    onPress: () => void;
    // Highlighted variant for the primary live-status card
    accent?: boolean;
}

// Tappable row card with an icon badge, used for quick actions and nav cards
export function ActionRow({ icon, label, subtitle, onPress, accent }: ActionRowProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <View style={[styles.iconBadge, accent && styles.iconBadgeAccent]}>
                <Ionicons name={icon} size={22} color={accent ? theme.onPrimary : theme.primary} />
            </View>
            <View style={styles.textBlock}>
                <Text style={styles.label}>{label}</Text>
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textFaint} />
        </Pressable>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
        },
        pressed: {
            opacity: 0.7,
        },
        iconBadge: {
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: theme.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconBadgeAccent: {
            backgroundColor: theme.primary,
        },
        textBlock: {
            flex: 1,
        },
        label: {
            fontSize: 17,
            fontWeight: '700',
            color: theme.heading,
        },
        subtitle: {
            fontSize: 14,
            color: theme.textMuted,
            marginTop: 2,
        },
    });
}
