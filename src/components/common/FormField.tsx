import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

type Props = {
    label: string;
    error?: string | null;
    containerStyle?: StyleProp<ViewStyle>;
} & React.ComponentProps<typeof TextInput>;

export function FormField({ label, error, containerStyle, style, ...inputProps }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    return (
        <View style={[styles.field, containerStyle]}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={[styles.input, !!error && styles.inputError, style]}
                placeholderTextColor={theme.textFaint}
                {...inputProps}
            />
            {!!error && <Text style={styles.fieldError}>{error}</Text>}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        field: { marginBottom: 20 },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.label,
            marginBottom: 8,
        },
        input: {
            borderWidth: 1,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: theme.body,
            backgroundColor: theme.cardBackground,
        },
        inputError: { borderColor: theme.error },
        fieldError: {
            fontSize: 13,
            color: theme.error,
            marginTop: 6,
        },
    });
}
