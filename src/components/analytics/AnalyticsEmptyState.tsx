import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

// UC03 A1 empty state: no quiz sessions exist for this patient yet.
export function AnalyticsEmptyState() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.container}>
            <Text style={styles.icon}>📊</Text>
            <Text style={styles.title}>No analytics yet</Text>
            <Text style={styles.body}>
                The patient must complete at least one Memory Quiz session before cognitive analytics can be shown.
            </Text>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            alignItems: 'center',
            paddingVertical: 48,
            paddingHorizontal: 24,
        },
        icon: {
            fontSize: 40,
            marginBottom: 12,
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.body,
            marginBottom: 8,
        },
        body: {
            fontSize: 14,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 20,
        },
    });
}
