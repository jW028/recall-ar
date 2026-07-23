import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
    imageUrl?: string | null;
    name: string;
    size?: number;
}

// Circular patient avatar: shows the photo when set, otherwise the name's first initial
export function Avatar({ imageUrl, name, size = 48 }: AvatarProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const dimensions = { width: size, height: size, borderRadius: size / 2 };
    const initial = name.trim().charAt(0).toUpperCase() || '?';

    if (imageUrl) {
        return <Image source={{ uri: imageUrl }} style={[styles.image, dimensions]} />;
    }

    return (
        <View style={[styles.fallback, dimensions]}>
            <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        image: {
            backgroundColor: theme.primarySoft,
        },
        fallback: {
            backgroundColor: theme.primarySoft,
            justifyContent: 'center',
            alignItems: 'center',
        },
        initial: {
            fontWeight: '700',
            color: theme.primary,
        },
    });
}
