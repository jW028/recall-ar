import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type BadgeTone = 'neutral' | 'open' | 'resolved' | 'attention';

interface StatusBadgeProps {
    label: string;
    tone?: BadgeTone;
}

// Small pill for a row's state. The codebase has no generic Badge — memories/index.tsx redeclares
// badgePerson/badgeObject/badgePaused locally — so this is the shared version of that shape.
// The label always carries the meaning; colour only reinforces it.
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={[styles.badge, styles[tone]]}>
            <Text style={[styles.text, styles[`${tone}Text`]]}>{label}</Text>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        badge: {
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            alignSelf: 'flex-start',
        },
        text: {
            fontSize: 12,
            fontWeight: '600',
        },
        neutral: { backgroundColor: theme.backgroundElement },
        neutralText: { color: theme.textMuted },
        open: { backgroundColor: theme.primarySoft },
        openText: { color: theme.primary },
        resolved: { backgroundColor: theme.success + '1F' },
        resolvedText: { color: theme.success },
        attention: { backgroundColor: theme.errorBackground },
        attentionText: { color: theme.error },
    });
}
