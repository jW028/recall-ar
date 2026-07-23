import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPerson, type MemoryAsset } from '@/models/MemoryAsset';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
    asset: MemoryAsset;
    onPress: () => void;
}

// Large patient-friendly album card. Mastered assets get a star badge; never ranks, locks, or scores.
export function AlbumCard({ asset, onPress }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const subtitle = isPerson(asset)
        ? asset.relationship ?? 'Someone you know'
        : asset.category ?? asset.reminderText ?? 'Something of yours';

    return (
        <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={asset.name}
        >
            <Image source={{ uri: asset.imageUrl }} style={styles.photo} />
            <View style={styles.footer}>
                <View style={styles.textBlock}>
                    <Text style={styles.name}>{asset.name}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                </View>
                {asset.status === 'Maintenance' && (
                    <View style={styles.starBadge}>
                        <Ionicons name="star" size={20} color={theme.warning} />
                    </View>
                )}
            </View>
        </Pressable>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: {
            borderRadius: 20,
            backgroundColor: theme.cardBackground,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: 'hidden',
        },
        pressed: {
            opacity: 0.9,
        },
        photo: {
            width: '100%',
            height: 180,
            backgroundColor: theme.border,
        },
        footer: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            gap: 12,
        },
        textBlock: {
            flex: 1,
            gap: 2,
        },
        name: {
            fontSize: 22,
            fontWeight: '700',
            color: theme.heading,
        },
        subtitle: {
            fontSize: 15,
            color: theme.textMuted,
        },
        starBadge: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: theme.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
    });
}
