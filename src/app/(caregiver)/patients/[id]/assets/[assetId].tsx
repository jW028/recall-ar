import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPerson } from '@/models/MemoryAsset';
import { useMemoryAssetDetailViewModel } from '@/viewmodels/useMemoryAssetViewModel';
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

    const {
        asset,
        isLoading,
        error,
        updateAsset,
        isUpdating,
        updateError,
        clearUpdateError,
        deleteAsset,
        isDeleting,
    } = useMemoryAssetDetailViewModel(assetId);

    const [isEditing, setIsEditing] = useState(false);
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
        if (!asset) return;
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
        const success = await updateAsset(params);
        if (success) setIsEditing(false);
    };

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

            {/* ── View mode ───────────────────── */}
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

            {/* ── Edit mode ───────────────────── */}
            {isEditing && (
                <View style={styles.card}>
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
                        <Pressable style={styles.cancelButton} onPress={() => setIsEditing(false)}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable style={styles.saveButton} onPress={handleSave} disabled={isUpdating}>
                            <Text style={styles.saveButtonText}>
                                {isUpdating ? 'Saving…' : 'Save'}
                            </Text>
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
        saveButtonText: { color: theme.onPrimary, fontSize: 15, fontWeight: '600' },
        deleteButton: {
            paddingVertical: 16,
            alignItems: 'center',
        },
        deleteButtonText: { color: theme.errorStrong, fontSize: 15, fontWeight: '600' },
    });
}
