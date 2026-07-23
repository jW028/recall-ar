import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPerson, type MemoryAsset } from '@/models/MemoryAsset';
import { useMemo } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Props {
    asset: MemoryAsset | null;
    onClose: () => void;
}

// Full-screen detail card for one album memory. One photo, a few warm facts, a single Close button.
export function AlbumDetailModal({ asset, onClose }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    if (!asset) return null;

    const detailLine = isPerson(asset)
        ? asset.relationship
        : asset.reminderText ?? asset.category;

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={styles.container}>
                <ScrollView contentContainerStyle={styles.content}>
                    <Image source={{ uri: asset.imageUrl }} style={styles.photo} />
                    <Text style={styles.name}>{asset.name}</Text>
                    {detailLine ? <Text style={styles.detail}>{detailLine}</Text> : null}
                    {asset.notes ? <Text style={styles.notes}>{asset.notes}</Text> : null}
                </ScrollView>
                <Pressable style={styles.closeButton} onPress={onClose}>
                    <Text style={styles.closeButtonText}>Close</Text>
                </Pressable>
            </View>
        </Modal>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.surface,
        },
        content: {
            padding: 24,
            alignItems: 'center',
            gap: 16,
        },
        photo: {
            width: '100%',
            height: 320,
            borderRadius: 24,
            backgroundColor: theme.border,
        },
        name: {
            fontSize: 30,
            fontWeight: '800',
            color: theme.heading,
            textAlign: 'center',
        },
        detail: {
            fontSize: 18,
            color: theme.body,
            textAlign: 'center',
        },
        notes: {
            fontSize: 16,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 24,
        },
        closeButton: {
            backgroundColor: theme.primary,
            borderRadius: 14,
            paddingVertical: 18,
            alignItems: 'center',
            marginHorizontal: 24,
            marginBottom: 32,
        },
        closeButtonText: {
            color: theme.onPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
    });
}
