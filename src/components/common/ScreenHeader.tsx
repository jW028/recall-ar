import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    right?: ReactNode;
}

// Consistent screen header with safe-area top padding and optional back button
export function ScreenHeader({ title, subtitle, showBack, onBack, right }: ScreenHeaderProps) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const handleBack = onBack ?? (() => router.back());

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            <View style={styles.row}>
                {showBack && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        onPress={handleBack}
                        hitSlop={8}
                        style={styles.backButton}
                    >
                        <Ionicons name="chevron-back" size={26} color={theme.primary} />
                    </Pressable>
                )}
                <View style={styles.titleBlock}>
                    <Text style={styles.title} numberOfLines={1}>
                        {title}
                    </Text>
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
                {right ? <View style={styles.right}>{right}</View> : null}
            </View>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            paddingHorizontal: 20,
            paddingBottom: 12,
            backgroundColor: theme.surface,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        backButton: {
            marginLeft: -6,
        },
        titleBlock: {
            flex: 1,
        },
        title: {
            fontSize: 28,
            fontWeight: '700',
            color: theme.heading,
        },
        subtitle: {
            fontSize: 14,
            color: theme.textMuted,
            marginTop: 2,
        },
        right: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
    });
}
