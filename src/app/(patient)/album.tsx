import { EmptyState } from '@/components/common/EmptyState';
import { Screen } from '@/components/common/Screen';
import { AlbumCard } from '@/components/patient/AlbumCard';
import { AlbumDetailModal } from '@/components/patient/AlbumDetailModal';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MemoryAsset } from '@/models/MemoryAsset';
import { useAlbumViewModel } from '@/viewmodels/useAlbumViewModel';
import { useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';

export default function AlbumScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { status, error, mastered, learning } = useAlbumViewModel();
    const [selected, setSelected] = useState<MemoryAsset | null>(null);

    const sections = useMemo(
        () =>
            [
                { title: 'Memories you know well ⭐', data: mastered },
                { title: "Memories you're learning", data: learning },
            ].filter((s) => s.data.length > 0),
        [mastered, learning]
    );

    if (status === 'loading') {
        return (
            <Screen topInset>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            </Screen>
        );
    }

    if (status === 'error') {
        return (
            <Screen topInset>
                <View style={styles.centered}>
                    <Text style={styles.message}>{error ?? 'Something went wrong.'}</Text>
                </View>
            </Screen>
        );
    }

    if (status === 'empty') {
        return (
            <Screen topInset>
                <EmptyState
                    icon="images-outline"
                    title="Your album is waiting"
                    body="Memories your caregiver adds will appear here."
                />
            </Screen>
        );
    }

    return (
        <Screen topInset>
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.assetId}
                contentContainerStyle={styles.content}
                ListHeaderComponent={<Text style={styles.title}>Your Album</Text>}
                renderSectionHeader={({ section }) => (
                    <Text style={styles.sectionHeader}>{section.title}</Text>
                )}
                renderItem={({ item }) => (
                    <View style={styles.cardWrap}>
                        <AlbumCard asset={item} onPress={() => setSelected(item)} />
                    </View>
                )}
                stickySectionHeadersEnabled={false}
            />
            <AlbumDetailModal asset={selected} onClose={() => setSelected(null)} />
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
        },
        content: {
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 32,
        },
        title: {
            fontSize: 36,
            fontWeight: '800',
            color: theme.heading,
            marginBottom: 8,
        },
        sectionHeader: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.body,
            marginTop: 20,
            marginBottom: 12,
        },
        cardWrap: {
            marginBottom: 16,
        },
        message: {
            fontSize: 16,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 24,
        },
    });
}
