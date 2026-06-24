import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface EmptyStateProps {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    body?: string;
    action?: ReactNode;
}

// Shared empty-state block: icon + title + body + optional action
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.container}>
            <View style={styles.iconCircle}>
                <Ionicons name={icon} size={36} color={theme.primary} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {body && <Text style={styles.body}>{body}</Text>}
            {action ? <View style={styles.action}>{action}</View> : null}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
            paddingVertical: 48,
        },
        iconCircle: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
        },
        title: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.heading,
            marginBottom: 8,
            textAlign: 'center',
        },
        body: {
            fontSize: 15,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 24,
        },
        action: {
            alignSelf: 'stretch',
        },
    });
}
