import { Button } from '@/components/common/Button';
import { SuggestionChips } from '@/components/common/SuggestionChips';
import {
    MAX_ENROLLMENT_PHOTOS,
    MIN_ENROLLMENT_PHOTOS,
    OBJECT_CATEGORY_SUGGESTIONS,
    RELATIONSHIP_SUGGESTIONS,
} from '@/constants/config';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { isPerson } from '@/models/MemoryAsset';
import { useMemoryAssetDetailViewModel } from '@/viewmodels/useMemoryAssetViewModel';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function AssetDetailScreen() {
    const { assetId } = useLocalSearchParams<{ assetId: string }>();
    const router = useRouter();
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { isOnline } = useNetworkStatus();

    const {
        asset,
        isLoading,
        error,
        updateAsset,
        isUpdating,
        updateError,
        clearUpdateError,
        updatePool,
        photoStep,
        setThumbnail,
        pause,
        resume,
        isPausing,
        pauseError,
        deleteAsset,
        isDeleting,
    } = useMemoryAssetDetailViewModel(assetId);

    const [isEditing, setIsEditing] = useState(false);
    // Pool editor working state. keepUrls = existing pool photos retained, newPhotoUris = local photos to add, thumbnail = chosen display photo.
    const [keepUrls, setKeepUrls] = useState<string[]>([]);
    const [newPhotoUris, setNewPhotoUris] = useState<string[]>([]);
    const [thumbnail, setThumbnailState] = useState<string>('');
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    // Person fields
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [relationship, setRelationship] = useState('');
    // Object fields
    const [category, setCategory] = useState('');
    const [reminderText, setReminderText] = useState('');

    useEffect(() => {
        if (asset && isEditing) {
            setName(asset.name);
            setNotes(asset.notes);
            setKeepUrls(asset.photoUrls);
            setNewPhotoUris([]);
            setThumbnailState(asset.imageUrl);
            if (isPerson(asset)) {
                setDateOfBirth(asset.dateOfBirth ?? '');
                setRelationship(asset.relationship ?? '');
            } else {
                setCategory(asset.category ?? '');
                setReminderText(asset.reminderText ?? '');
            }
        }
    }, [asset, isEditing]);

    const handleChange = (setter: (v: string) => void) => (v: string) => {
        setter(v);
        if (updateError) clearUpdateError();
    };

    const handleSave = async () => {
        if (!asset || !canSave) return;
        const params = isPerson(asset)
            ? {
                name: name.trim(),
                notes: notes.trim(),
                dateOfBirth: dateOfBirth.trim() || null,
                relationship: relationship.trim() || null,
            }
            : {
                name: name.trim(),
                notes: notes.trim(),
                category: category.trim() || null,
                reminderText: reminderText.trim() || null,
            };

        // 1. Text/metadata (offline-capable).
        if (!(await updateAsset(params))) return;

        // 2. Photo pool — uploads + re-averaged embedding (requires a connection).
        if (poolChanged && !(await updatePool({ keepUrls, newPhotoUris }))) return;

        // 3. Thumbnail — offline-capable. The chosen photo is always a kept existing URL, so it survives the pool update above.
        if (thumbnailChanged && !(await setThumbnail(thumbnail))) return;

        setIsEditing(false);
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setKeepUrls([]);
        setNewPhotoUris([]);
        setThumbnailState('');
        if (updateError) clearUpdateError();
    };

    const poolCount = keepUrls.length + newPhotoUris.length;

    async function pickPhoto() {
        if (poolCount >= MAX_ENROLLMENT_PHOTOS) return;

        Alert.alert('Add photo', 'Choose a source', [
            {
                text: 'Camera',
                onPress: async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert('Camera access needed', 'Please enable camera access in Settings to take photos.');
                        return;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                        allowsEditing: true,
                        aspect: [1, 1],
                        quality: 0.85,
                    });
                    if (!result.canceled && result.assets[0]) {
                        setNewPhotoUris((prev) => [...prev, result.assets[0].uri]);
                    }
                },
            },
            {
                text: 'Photo library',
                onPress: async () => {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert('Photo library access needed', 'Please enable photo library access in Settings to pick photos.');
                        return;
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({
                        allowsEditing: true,
                        aspect: [1, 1],
                        quality: 0.85,
                    });
                    if (!result.canceled && result.assets[0]) {
                        setNewPhotoUris((prev) => [...prev, result.assets[0].uri]);
                    }
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    }

    const removeNewPhoto = (uri: string) =>
        setNewPhotoUris((prev) => prev.filter((u) => u !== uri));

    // Removing an existing pool photo; if it was the thumbnail, fall back to the first remaining existing photo (new photos aren't selectable until saved).
    const removeKeepPhoto = (url: string) =>
        setKeepUrls((prev) => {
            const next = prev.filter((u) => u !== url);
            if (thumbnail === url) setThumbnailState(next[0] ?? '');
            return next;
        });

    // Only already-uploaded (existing) pool photos can be set as the thumbnail.
    const selectThumbnail = (url: string) => {
        setThumbnailState(url);
        if (updateError) clearUpdateError();
    };

    const poolValid =
        poolCount >= MIN_ENROLLMENT_PHOTOS && poolCount <= MAX_ENROLLMENT_PHOTOS;

    // Pool composition changed if photos were added, or the kept set differs from the asset's current pool (i.e. some were removed).
    const poolChanged =
        !!asset &&
        (newPhotoUris.length > 0 ||
            keepUrls.length !== asset.photoUrls.length ||
            keepUrls.some((u) => !asset.photoUrls.includes(u)));

    const thumbnailChanged = !!asset && thumbnail !== '' && thumbnail !== asset.imageUrl;

    const saveButtonLabel =
        photoStep === 'processing' ? 'Processing photos…' :
        photoStep === 'saving' || isUpdating ? 'Saving…' :
        'Save';

    // The 3–5 rule only applies when the pool is actually being changed, so metadata/thumbnail edits on legacy single-photo assets aren't blocked.
    const canSave =
        photoStep === 'idle' &&
        !isUpdating &&
        (!poolChanged || (poolValid && isOnline));

    const handleDelete = () => {
        Alert.alert(
            'Delete memory?',
            `Are you sure you want to delete "${asset?.name}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await deleteAsset();
                        if (success) router.back();
                    },
                },
            ]
        );
    };

    if (isLoading && !asset) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (error || !asset) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>{error ?? 'Memory not found.'}</Text>
            </View>
        );
    }

    const person = isPerson(asset) ? asset : null;
    const obj = !isPerson(asset) ? asset : null;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>‹ Back</Text>
            </Pressable>

            <View style={styles.header}>
                <Text style={styles.title}>{asset.name}</Text>
                {!isEditing && (
                    <Pressable onPress={() => setIsEditing(true)}>
                        <Text style={styles.editLink}>Edit</Text>
                    </Pressable>
                )}
            </View>

            <Image source={{ uri: asset.imageUrl }} style={styles.heroImage} />

            {updateError && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>{updateError}</Text>
                </View>
            )}

            {/* View mode */}
            {!isEditing && (
                <View style={styles.card}>
                    <DetailRow label="Type" value={asset.type} styles={styles} />
                    <DetailRow label="Notes" value={asset.notes || '—'} styles={styles} />
                    {person && (
                        <>
                            {person.dateOfBirth && (
                                <DetailRow label="Date of birth" value={person.dateOfBirth} styles={styles} />
                            )}
                            {person.relationship && (
                                <DetailRow label="Relationship" value={person.relationship} styles={styles} />
                            )}
                        </>
                    )}
                    {obj && (
                        <>
                            {obj.category && (
                                <DetailRow label="Category" value={obj.category} styles={styles} />
                            )}
                            {obj.reminderText && (
                                <DetailRow label="Reminder" value={obj.reminderText} styles={styles} />
                            )}
                        </>
                    )}
                    <DetailRow label="Status" value={asset.status} styles={styles} />
                </View>
            )}

            {/* Pause/resume training — reversible, kept separate from Edit and the destructive Delete */}
            {!isEditing && (
                <View style={styles.pauseSection}>
                    <Button
                        label={asset.status === 'Paused' ? 'Resume training' : 'Pause training'}
                        variant="secondary"
                        loading={isPausing}
                        onPress={asset.status === 'Paused' ? resume : pause}
                    />
                    {asset.status === 'Paused' && (
                        <Text style={styles.pauseHint}>
                            This memory won't appear in training until resumed.
                        </Text>
                    )}
                    {pauseError && <Text style={styles.errorText}>{pauseError}</Text>}
                </View>
            )}

            {/* Edit mode */}
            {isEditing && (
                <View style={styles.card}>
                    <View style={styles.field}>
                        <Text style={styles.label}>Photos</Text>
                        <Text style={styles.photoHint}>
                            Keep {MIN_ENROLLMENT_PHOTOS}–{MAX_ENROLLMENT_PHOTOS} clear photos
                            from different angles. Remove or add photos, and tap a photo to make
                            it the thumbnail. Adding or removing photos re-runs recognition.
                        </Text>
                        {poolChanged && !isOnline && (
                            <Text style={styles.offlineHint}>
                                You're offline. A connection is required to change which photos
                                are used.
                            </Text>
                        )}
                        <View style={styles.photoGrid}>
                            {/* Existing pool photos — selectable as thumbnail */}
                            {keepUrls.map((url) => {
                                const isThumb = thumbnail === url;
                                return (
                                    <Pressable
                                        key={url}
                                        style={[styles.photoSlot, isThumb && styles.photoSlotSelected]}
                                        onPress={() => selectThumbnail(url)}
                                    >
                                        <Image source={{ uri: url }} style={styles.photoThumb} />
                                        {isThumb && (
                                            <View style={styles.thumbnailBadge}>
                                                <Text style={styles.thumbnailBadgeText}>Thumbnail</Text>
                                            </View>
                                        )}
                                        <Pressable
                                            style={styles.removeBtn}
                                            onPress={() => removeKeepPhoto(url)}
                                            hitSlop={8}
                                        >
                                            <Text style={styles.removeBtnText}>×</Text>
                                        </Pressable>
                                    </Pressable>
                                );
                            })}
                            {/* Newly added photos — set as thumbnail only after saving */}
                            {newPhotoUris.map((uri) => (
                                <View key={uri} style={styles.photoSlot}>
                                    <Image source={{ uri }} style={styles.photoThumb} />
                                    <View style={styles.newBadge}>
                                        <Text style={styles.newBadgeText}>New</Text>
                                    </View>
                                    <Pressable
                                        style={styles.removeBtn}
                                        onPress={() => removeNewPhoto(uri)}
                                        hitSlop={8}
                                    >
                                        <Text style={styles.removeBtnText}>×</Text>
                                    </Pressable>
                                </View>
                            ))}
                            {poolCount < MAX_ENROLLMENT_PHOTOS && (
                                <Pressable style={styles.photoAdd} onPress={pickPhoto}>
                                    <Text style={styles.photoAddIcon}>+</Text>
                                    <Text style={styles.photoAddLabel}>
                                        {poolCount}/{MAX_ENROLLMENT_PHOTOS}
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                        {poolChanged && !poolValid && (
                            <Text style={styles.offlineHint}>
                                Keep between {MIN_ENROLLMENT_PHOTOS} and {MAX_ENROLLMENT_PHOTOS} photos.
                            </Text>
                        )}
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={handleChange(setName)}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Notes</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={notes}
                            onChangeText={handleChange(setNotes)}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                        />
                    </View>

                    {person !== null && (
                        <>
                            <View style={styles.field}>
                                <Text style={styles.label}>Date of birth</Text>
                                <TextInput
                                    style={styles.input}
                                    value={dateOfBirth}
                                    onChangeText={handleChange(setDateOfBirth)}
                                    placeholder="YYYY-MM-DD"
                                    keyboardType="numbers-and-punctuation"
                                />
                            </View>
                            <View style={styles.field}>
                                <Text style={styles.label}>Relationship</Text>
                                <SuggestionChips
                                    suggestions={RELATIONSHIP_SUGGESTIONS}
                                    value={relationship}
                                    onSelect={handleChange(setRelationship)}
                                />
                                <TextInput
                                    style={styles.input}
                                    value={relationship}
                                    onChangeText={handleChange(setRelationship)}
                                />
                            </View>
                        </>
                    )}

                    {obj !== null && (
                        <>
                            <View style={styles.field}>
                                <Text style={styles.label}>Category</Text>
                                <SuggestionChips
                                    suggestions={OBJECT_CATEGORY_SUGGESTIONS}
                                    value={category}
                                    onSelect={handleChange(setCategory)}
                                />
                                <TextInput
                                    style={styles.input}
                                    value={category}
                                    onChangeText={handleChange(setCategory)}
                                />
                            </View>
                            <View style={styles.field}>
                                <Text style={styles.label}>Reminder text</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    value={reminderText}
                                    onChangeText={handleChange(setReminderText)}
                                    multiline
                                    numberOfLines={2}
                                    textAlignVertical="top"
                                />
                            </View>
                        </>
                    )}

                    <View style={styles.editActions}>
                        <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={!canSave}
                        >
                            <Text style={styles.saveButtonText}>{saveButtonLabel}</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {!isEditing && (
                <Pressable
                    style={styles.deleteButton}
                    onPress={handleDelete}
                    disabled={isDeleting}
                >
                    <Text style={styles.deleteButtonText}>
                        {isDeleting ? 'Deleting…' : 'Delete memory'}
                    </Text>
                </Pressable>
            )}
        </ScrollView>
    );
}

function DetailRow({
    label,
    value,
    styles,
}: {
    label: string;
    value: string;
    styles: ReturnType<typeof createStyles>;
}) {
    return (
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            padding: 24,
            paddingTop: 56,
            backgroundColor: theme.surface,
            flexGrow: 1,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.surface,
        },
        backButton: { alignSelf: 'flex-start', marginBottom: 16 },
        backButtonText: { fontSize: 16, color: theme.primary, fontWeight: '600' },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        title: {
            fontSize: 26,
            fontWeight: '700',
            color: theme.body,
            flex: 1,
        },
        editLink: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.primary,
        },
        heroImage: {
            width: '100%',
            height: 220,
            borderRadius: 14,
            backgroundColor: theme.border,
            marginBottom: 20,
        },
        errorBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        errorBoxText: { color: theme.error, fontSize: 14 },
        errorText: { color: theme.error, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
        card: {
            backgroundColor: theme.cardBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            marginBottom: 20,
        },
        detailRow: { marginBottom: 16 },
        detailLabel: { fontSize: 13, fontWeight: '600', color: theme.textMuted, marginBottom: 4 },
        detailValue: { fontSize: 16, color: theme.body },
        field: { marginBottom: 16 },
        label: { fontSize: 14, fontWeight: '600', color: theme.label, marginBottom: 8 },
        photoHint: { fontSize: 13, color: theme.textMuted, marginBottom: 12, lineHeight: 19 },
        offlineHint: { fontSize: 13, color: theme.error, marginBottom: 12 },
        photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
        photoSlot: {
            position: 'relative',
            borderRadius: 12,
            borderWidth: 2,
            borderColor: 'transparent',
            padding: 2,
        },
        photoSlotSelected: { borderColor: theme.primary },
        photoThumb: {
            width: 76,
            height: 76,
            borderRadius: 10,
            backgroundColor: theme.border,
        },
        thumbnailBadge: {
            position: 'absolute',
            bottom: 2,
            left: 2,
            right: 2,
            backgroundColor: theme.primary,
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
            paddingVertical: 2,
            alignItems: 'center',
        },
        thumbnailBadgeText: { color: theme.onPrimary, fontSize: 10, fontWeight: '700' },
        newBadge: {
            position: 'absolute',
            bottom: 2,
            left: 2,
            backgroundColor: theme.textMuted,
            borderRadius: 6,
            paddingHorizontal: 6,
            paddingVertical: 1,
        },
        newBadgeText: { color: theme.onPrimary, fontSize: 10, fontWeight: '700' },
        removeBtn: {
            position: 'absolute',
            top: -6,
            right: -6,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.errorStrong,
            justifyContent: 'center',
            alignItems: 'center',
        },
        removeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20 },
        photoAdd: {
            width: 76,
            height: 76,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: theme.border,
            borderStyle: 'dashed',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.surface,
        },
        photoAddIcon: { fontSize: 24, color: theme.textMuted },
        photoAddLabel: { fontSize: 11, color: theme.textFaint, marginTop: 2 },
        input: {
            borderWidth: 1,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: theme.body,
            backgroundColor: theme.surface,
        },
        textArea: { minHeight: 80 },
        editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
        cancelButton: {
            flex: 1,
            paddingVertical: 14,
            alignItems: 'center',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.borderStrong,
        },
        cancelButtonText: { color: theme.label, fontSize: 15, fontWeight: '600' },
        saveButton: {
            flex: 1,
            backgroundColor: theme.primary,
            paddingVertical: 14,
            alignItems: 'center',
            borderRadius: 10,
        },
        saveButtonDisabled: { backgroundColor: theme.primaryDisabled },
        saveButtonText: { color: theme.onPrimary, fontSize: 15, fontWeight: '600' },
        pauseSection: { marginBottom: 20, gap: 8 },
        pauseHint: { fontSize: 13, color: theme.textMuted, lineHeight: 19, textAlign: 'center' },
        deleteButton: {
            paddingVertical: 16,
            alignItems: 'center',
        },
        deleteButtonText: { color: theme.errorStrong, fontSize: 15, fontWeight: '600' },
    });
}
