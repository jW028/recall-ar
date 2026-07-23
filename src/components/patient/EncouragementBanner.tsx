import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Encouragement } from '@/models/Encouragement';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

interface Props {
    encouragement: Encouragement | null;
    onDismiss: () => void;
}

// Warm banner for a caregiver message on the patient home screen. Gone once dismissed; never nags.
export function EncouragementBanner({ encouragement, onDismiss }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.96);

    useEffect(() => {
        if (encouragement) {
            opacity.value = withTiming(1, { duration: 300 });
            scale.value = withSpring(1, { damping: 14 });
        }
    }, [encouragement, opacity, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    if (!encouragement) return null;

    return (
        <Animated.View style={[styles.card, animatedStyle]}>
            <View style={styles.headerRow}>
                <Ionicons name="heart" size={18} color={theme.primary} />
                <Text style={styles.heading}>A message from your caregiver</Text>
            </View>
            <Text style={styles.message}>
                {encouragement.emoji ? `${encouragement.emoji} ` : ''}
                {encouragement.message}
            </Text>
            <Pressable style={styles.thanksButton} onPress={onDismiss}>
                <Text style={styles.thanksButtonText}>Thanks!</Text>
            </Pressable>
        </Animated.View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: {
            backgroundColor: theme.primarySoft,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.primaryMutedBorder,
            padding: 16,
            gap: 10,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        heading: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.primaryText,
        },
        message: {
            fontSize: 20,
            fontWeight: '600',
            color: theme.body,
            lineHeight: 28,
        },
        thanksButton: {
            alignSelf: 'flex-start',
            backgroundColor: theme.primary,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 24,
        },
        thanksButtonText: {
            color: theme.onPrimary,
            fontSize: 16,
            fontWeight: '700',
        },
    });
}
