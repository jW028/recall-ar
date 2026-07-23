import { EmptyState as SharedEmptyState } from '@/components/common/EmptyState';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPerson } from '@/models/MemoryAsset';
import type { MemoryAsset } from '@/models/MemoryAsset';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useMemoryAssetListViewModel } from '@/viewmodels/useMemoryAssetViewModel';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'react-native';
import { useEffect, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type TypeFilter = 'all' | 'Person' | 'Object';

function AssetCard({
    asset,
    onPress,
    styles,
}: {
    asset: MemoryAsset;
    onPress: () => void;
    styles: ReturnType<typeof createStyles>;
}) {
    const subtitle = isPerson(asset)
        ? asset.relationship ?? 'Person'
        : asset.category ?? 'Object';
    const isPaused = asset.status === 'Paused';

    return (
        <Pressable style={[styles.card, isPaused && styles.cardPaused]} onPress={onPress}>
            <Image source={{ uri: asset.imageUrl }} style={styles.thumbnail} />
            <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{asset.name}</Text>
                <Text style={styles.cardMeta}>{subtitle}</Text>
            </View>
            {isPaused ? (
                <View style={[styles.typeBadge, styles.badgePaused]}>
                    <Text style={[styles.typeBadgeText, styles.badgePausedText]}>Paused</Text>
                </View>
            ) : (
                <View style={[styles.typeBadge, asset.type === 'Person' ? styles.badgePerson : styles.badgeObject]}>
                    <Text style={styles.typeBadgeText}>{asset.type}</Text>
                </View>
            )}
            <Text style={styles.chevron}>›</Text>
        </Pressable>
    );
}

function FilterToggle({
    value,
    onChange,
    styles,
}: {
    value: TypeFilter;
    onChange: (v: TypeFilter) => void;
    styles: ReturnType<typeof createStyles>;
}) {
    const options: { label: string; value: TypeFilter }[] = [
        { label: 'All', value: 'all' },
        { label: 'People', value: 'Person' },
        { label: 'Objects', value: 'Object' },
    ];
    return (
        <View style={styles.filterRow}>
            {options.map((opt) => (
                <Pressable
                    key={opt.value}
                    style={[styles.filterChip, value === opt.value && styles.filterChipActive]}
                    onPress={() => onChange(opt.value)}
                >
                    <Text style={[styles.filterChipText, value === opt.value && styles.filterChipTextActive]}>
                        {opt.label}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

function EmptyState({
    typeFilter,
    onAdd,
    styles,
}: {
    typeFilter: TypeFilter;
    onAdd: () => void;
    styles: ReturnType<typeof createStyles>;
}) {
    const title =
        typeFilter === 'Person' ? 'No people enrolled yet' :
        typeFilter === 'Object' ? 'No objects enrolled yet' :
        'No memories enrolled yet';
    const body =
        typeFilter === 'Person' ? 'Add photos of people the patient should recognise.' :
        typeFilter === 'Object' ? 'Add photos of important objects for the patient.' :
        'Enroll people and objects to start memory training and AR recognition.';

    return (
        <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{title}</Text>
            <Text style={styles.emptyBody}>{body}</Text>
            <Pressable style={styles.emptyButton} onPress={onAdd}>
                <Text style={styles.emptyButtonText}>Add memory</Text>
            </Pressable>
        </View>
    );
}

export default function AssetListScreen() {
    const patientId = useCurrentPatientId() ?? undefined;
    const router = useRouter();
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const { filteredAssets, isLoading, error, refresh, typeFilter, setTypeFilter } =
        useMemoryAssetListViewModel(patientId);

    // Apply the filter when deep-linked from the Home stat cards (e.g. ?type=Object)
    const { type } = useLocalSearchParams<{ type?: string }>();
    useEffect(() => {
        if (type === 'Object' || type === 'Person') setTypeFilter(type);
    }, [type, setTypeFilter]);

    const goToNew = () => router.push(`/(caregiver)/memories/new`);
    const goToAsset = (assetId: string) =>
        router.push(`/(caregiver)/memories/${assetId}`);

    if (!patientId) {
        return (
            <Screen>
                <ScreenHeader title="Memories" />
                <SharedEmptyState
                    icon="people-outline"
                    title="No patient selected"
                    body="Select a patient on the Home tab to manage their memories."
                />
            </Screen>
        );
    }

    if (isLoading && filteredAssets.length === 0) {
        return (
            <Screen>
                <ScreenHeader title="Memories" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen>
            <ScreenHeader
                title="Memories"
                right={
                    <Pressable style={styles.addButton} onPress={goToNew} hitSlop={6}>
                        <Ionicons name="add" size={20} color={theme.onPrimary} />
                        <Text style={styles.addButtonText}>Add</Text>
                    </Pressable>
                }
            />

            <FilterToggle value={typeFilter} onChange={setTypeFilter} styles={styles} />

            {error && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <FlatList
                data={filteredAssets}
                keyExtractor={(item) => item.assetId}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={isLoading} onRefresh={refresh} />
                }
                renderItem={({ item }) => (
                    <AssetCard
                        asset={item}
                        onPress={() => goToAsset(item.assetId)}
                        styles={styles}
                    />
                )}
                ListEmptyComponent={
                    <EmptyState typeFilter={typeFilter} onAdd={goToNew} styles={styles} />
                }
            />
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.surface,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.surface,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 56,
            paddingBottom: 12,
            gap: 12,
        },
        backButton: {},
        backButtonText: { fontSize: 16, color: theme.primary, fontWeight: '600' },
        title: {
            flex: 1,
            fontSize: 28,
            fontWeight: '700',
            color: theme.body,
        },
        addButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: theme.primary,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 9,
        },
        addButtonText: {
            color: theme.onPrimary,
            fontSize: 15,
            fontWeight: '600',
        },
        filterRow: {
            flexDirection: 'row',
            paddingHorizontal: 20,
            paddingBottom: 12,
            gap: 8,
        },
        filterChip: {
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.cardBackground,
        },
        filterChipActive: {
            backgroundColor: theme.primarySoft,
            borderColor: theme.primaryMutedBorder,
        },
        filterChipText: {
            fontSize: 14,
            fontWeight: '500',
            color: theme.textMuted,
        },
        filterChipTextActive: {
            color: theme.primaryText,
            fontWeight: '600',
        },
        errorBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginHorizontal: 20,
            marginBottom: 12,
        },
        errorText: {
            color: theme.error,
            fontSize: 14,
        },
        listContent: {
            paddingHorizontal: 20,
            paddingBottom: 24,
            flexGrow: 1,
        },
        card: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.cardBackground,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: theme.border,
        },
        thumbnail: {
            width: 52,
            height: 52,
            borderRadius: 8,
            backgroundColor: theme.border,
            marginRight: 12,
        },
        cardInfo: {
            flex: 1,
        },
        cardName: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.body,
            marginBottom: 2,
        },
        cardMeta: {
            fontSize: 13,
            color: theme.textMuted,
        },
        typeBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            marginRight: 8,
        },
        badgePerson: {
            backgroundColor: theme.primarySoft,
        },
        badgeObject: {
            backgroundColor: theme.cardBackground,
            borderWidth: 1,
            borderColor: theme.border,
        },
        cardPaused: {
            opacity: 0.55,
        },
        badgePaused: {
            backgroundColor: theme.backgroundElement,
            borderWidth: 1,
            borderColor: theme.border,
        },
        badgePausedText: {
            color: theme.textMuted,
        },
        typeBadgeText: {
            fontSize: 11,
            fontWeight: '600',
            color: theme.primaryText,
        },
        chevron: {
            fontSize: 24,
            color: theme.borderStrong,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
            paddingTop: 80,
        },
        emptyTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.body,
            marginBottom: 8,
        },
        emptyBody: {
            fontSize: 15,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 24,
        },
        emptyButton: {
            backgroundColor: theme.primary,
            borderRadius: 10,
            paddingHorizontal: 24,
            paddingVertical: 14,
        },
        emptyButtonText: {
            color: theme.onPrimary,
            fontSize: 15,
            fontWeight: '600',
        },
    });
}
