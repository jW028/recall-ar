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

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
// sm for header actions, md for screen content, lg for the patient app's larger touch targets
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: Variant;
    size?: Size;
    disabled?: boolean;
    loading?: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
    style?: StyleProp<ViewStyle>;
}

const ICON_SIZE: Record<Size, number> = { sm: 16, md: 18, lg: 20 };

// Standard app button: consistent radius, variants, sizes, disabled and loading states
export function Button({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
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
        styles[size],
        styles[variant],
        // Primary reads as disabled through its own fill; the others have too little of one to dim
        isDisabled && (variant === 'primary' ? styles.primaryDisabled : styles.disabled),
        style,
    ];
    const textColor =
        variant === 'primary'
            ? theme.onPrimary
            : variant === 'destructive'
              ? theme.error
              : variant === 'outline'
                ? theme.label
                : theme.primary;

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
            disabled={isDisabled}
            onPress={onPress}
            style={({ pressed }) => [containerStyle, pressed && !isDisabled && styles.pressed]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={textColor} />
            ) : (
                icon && <Ionicons name={icon} size={ICON_SIZE[size]} color={textColor} />
            )}
            {/* The label stays put while loading so callers can narrate progress ("Saving…") */}
            <Text style={[styles.label, styles[`${size}Label`], { color: textColor }]}>{label}</Text>
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
        },
        sm: {
            borderRadius: 12,
            paddingVertical: 9,
            paddingHorizontal: 14,
        },
        md: {
            borderRadius: 12,
            paddingVertical: 14,
            paddingHorizontal: 24,
        },
        lg: {
            borderRadius: 14,
            paddingVertical: 16,
            paddingHorizontal: 48,
        },
        primary: {
            backgroundColor: theme.primary,
        },
        secondary: {
            backgroundColor: theme.primarySoft,
            borderWidth: 1,
            borderColor: theme.primaryMutedBorder,
        },
        outline: {
            borderWidth: 1,
            borderColor: theme.borderStrong,
        },
        ghost: {},
        destructive: {
            backgroundColor: theme.errorBackground,
            borderWidth: 1,
            borderColor: theme.errorBorder,
        },
        primaryDisabled: {
            backgroundColor: theme.primaryDisabled,
        },
        disabled: {
            opacity: 0.5,
        },
        pressed: {
            opacity: 0.85,
        },
        label: {
            fontWeight: '700',
        },
        smLabel: {
            fontSize: 15,
        },
        mdLabel: {
            fontSize: 16,
        },
        lgLabel: {
            fontSize: 18,
        },
    });
}
