import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// Daily-streak pill. Renders nothing below 1 day — a lapsed streak must never be shown as broken or zero.
export function StreakChip({ days }: { days: number }) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    if (days < 1) return null;

    return (
        <View style={styles.chip}>
            <Ionicons name="flame" size={18} color={theme.primaryText} />
            <Text style={styles.text}>
                {days} {days === 1 ? 'day' : 'days'} in a row
            </Text>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 6,
            backgroundColor: theme.primarySoft,
            borderRadius: 999,
            paddingVertical: 8,
            paddingHorizontal: 14,
        },
        text: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.primaryText,
        },
    });
}
