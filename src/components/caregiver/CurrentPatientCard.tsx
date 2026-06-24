import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface CurrentPatientCardProps {
    name: string;
    onViewEdit: () => void;
    onChange: () => void;
}

// Primary-colored card showing the selected patient with View/Edit and Change actions
export function CurrentPatientCard({ name, onViewEdit, onChange }: CurrentPatientCardProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <View style={styles.card}>
            <Text style={styles.label}>Current Patient</Text>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <View style={styles.actions}>
                <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onViewEdit}>
                    <Text style={styles.buttonText}>View/Edit</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onChange}>
                    <Text style={styles.buttonText}>Change</Text>
                </Pressable>
            </View>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: {
            backgroundColor: theme.primary,
            borderRadius: 20,
            padding: 20,
        },
        label: {
            color: 'rgba(255,255,255,0.85)',
            fontSize: 14,
            fontWeight: '500',
            marginBottom: 4,
        },
        name: {
            color: theme.onPrimary,
            fontSize: 26,
            fontWeight: '800',
            marginBottom: 16,
        },
        actions: {
            flexDirection: 'row',
            gap: 12,
        },
        button: {
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 18,
        },
        pressed: {
            opacity: 0.8,
        },
        buttonText: {
            color: theme.onPrimary,
            fontSize: 15,
            fontWeight: '600',
        },
    });
}
