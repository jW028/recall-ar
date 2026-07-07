import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
    suggestions: readonly string[];
    value: string;
    onSelect: (value: string) => void;
};

// Tap-to-fill chips; the chip matching the current value is highlighted, tapping it clears it
export function SuggestionChips({ suggestions, value, onSelect }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const selected = value.trim().toLowerCase();

    return (
        <View style={styles.chipRow}>
            {suggestions.map((suggestion) => {
                const isActive = suggestion.toLowerCase() === selected;
                return (
                    <Pressable
                        key={suggestion}
                        style={[styles.chip, isActive && styles.chipActive]}
                        onPress={() => onSelect(isActive ? '' : suggestion)}
                    >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                            {suggestion}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
        chip: {
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.cardBackground,
        },
        chipActive: {
            backgroundColor: theme.primarySoft,
            borderColor: theme.primaryMutedBorder,
        },
        chipText: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
        chipTextActive: { color: theme.primaryText },
    });
}
