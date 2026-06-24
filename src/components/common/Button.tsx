import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'destructive';

interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: Variant;
    disabled?: boolean;
    loading?: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
    style?: StyleProp<ViewStyle>;
}

// Standard app button: consistent radius, variants, disabled and loading states
export function Button({
    label,
    onPress,
    variant = 'primary',
    disabled,
    loading,
    icon,
    style,
}: ButtonProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const isDisabled = disabled || loading;

    const containerStyle = [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        style,
    ];
    const textColor =
        variant === 'primary'
            ? theme.onPrimary
            : variant === 'destructive'
              ? theme.error
              : theme.primaryText;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!isDisabled }}
            disabled={isDisabled}
            onPress={onPress}
            style={({ pressed }) => [containerStyle, pressed && !isDisabled && styles.pressed]}
        >
            {loading ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <>
                    {icon && <Ionicons name={icon} size={18} color={textColor} />}
                    <Text style={[styles.label, { color: textColor }]}>{label}</Text>
                </>
            )}
        </Pressable>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        base: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 24,
        },
        primary: {
            backgroundColor: theme.primary,
        },
        secondary: {
            backgroundColor: theme.primarySoft,
            borderWidth: 1,
            borderColor: theme.primaryMutedBorder,
        },
        destructive: {
            backgroundColor: theme.errorBackground,
            borderWidth: 1,
            borderColor: theme.errorBorder,
        },
        disabled: {
            opacity: 0.5,
        },
        pressed: {
            opacity: 0.85,
        },
        label: {
            fontSize: 16,
            fontWeight: '700',
        },
    });
}
