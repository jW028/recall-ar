import {
    MAX_ENROLLMENT_PHOTOS,
    MIN_ENROLLMENT_PHOTOS,
} from '@/constants/config';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { validate } from '@/utils/validation';
import { FormField } from '@/components/common/FormField';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useEnrollmentViewModel } from '@/viewmodels/useMemoryAssetViewModel';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

type AssetType = 'Person' | 'Object';

export default function NewAssetScreen() {
    const patientId = useCurrentPatientId() ?? undefined;
    const router = useRouter();
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { isOnline } = useNetworkStatus();

    const { step, photoUris, addPhoto, removePhoto, canSubmit, submitPerson, submitObject, error } =
        useEnrollmentViewModel(patientId);

    const [assetType, setAssetType] = useState<AssetType>('Person');
    const [name, setName] = useState('');
    const [notes, setNotes] = useState('');
    // Person fields
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [relationship, setRelationship] = useState('');
    // Object fields
    const [category, setCategory] = useState('');
    const [reminderText, setReminderText] = useState('');
    const [touched, setTouched] = useState({ name: false, dateOfBirth: false });
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const errors = {
        name: validate.required(name, 'Name'),
        dateOfBirth: assetType === 'Person' ? validate.optionalDate(dateOfBirth) : null,
    };

    const visibleError = (field: keyof typeof errors) =>
        touched[field] || submitAttempted ? errors[field] : null;

    const touch = (field: keyof typeof touched) => () =>
        setTouched(prev => ({ ...prev, [field]: true }));

    const isFormValid = !errors.name && !errors.dateOfBirth;

    const isProcessing = step === 'processing' || step === 'saving';
    const submitLabel =
        step === 'processing' ? 'Processing photos…' :
        step === 'saving' ? 'Saving…' :
        'Enroll memory';

    const canPress = canSubmit && isOnline && !isProcessing && isFormValid;

    useEffect(() => {
        if (step === 'done') router.back();
    }, [step, router]);

    async function pickPhoto() {
        if (photoUris.length >= MAX_ENROLLMENT_PHOTOS) return;

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
                        addPhoto(result.assets[0].uri);
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
                        addPhoto(result.assets[0].uri);
                    }
                },
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    }

    async function handleSubmit() {
        setSubmitAttempted(true);
        if (!canPress) return;

        if (assetType === 'Person') {
            await submitPerson({
                name: name.trim(),
                notes: notes.trim(),
                dateOfBirth: dateOfBirth.trim() || null,
                relationship: relationship.trim() || null,
            });
        } else {
            await submitObject({
                name: name.trim(),
                notes: notes.trim(),
                category: category.trim() || null,
                reminderText: reminderText.trim() || null,
            });
        }
    }

    return (
        <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Enroll memory</Text>
                <Text style={styles.subtitle}>
                    Add {MIN_ENROLLMENT_PHOTOS}–{MAX_ENROLLMENT_PHOTOS} clear photos from different angles.
                </Text>

                {!isOnline && (
                    <View style={styles.offlineBox}>
                        <Text style={styles.offlineText}>
                            You're offline. A network connection is required to upload photos.
                        </Text>
                    </View>
                )}

                {error && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Type toggle */}
                <View style={styles.typeToggle}>
                    <Pressable
                        style={[styles.typeChip, assetType === 'Person' && styles.typeChipActive]}
                        onPress={() => setAssetType('Person')}
                    >
                        <Text style={[styles.typeChipText, assetType === 'Person' && styles.typeChipTextActive]}>
                            Person
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.typeChip, assetType === 'Object' && styles.typeChipActive]}
                        onPress={() => setAssetType('Object')}
                    >
                        <Text style={[styles.typeChipText, assetType === 'Object' && styles.typeChipTextActive]}>
                            Object
                        </Text>
                    </Pressable>
                </View>

                {/* Photo grid */}
                <View style={styles.photoGrid}>
                    {photoUris.map((uri) => (
                        <View key={uri} style={styles.photoSlot}>
                            <Image source={{ uri }} style={styles.photoThumb} />
                            <Pressable
                                style={styles.removeBtn}
                                onPress={() => removePhoto(uri)}
                                hitSlop={8}
                            >
                                <Text style={styles.removeBtnText}>×</Text>
                            </Pressable>
                        </View>
                    ))}
                    {photoUris.length < MAX_ENROLLMENT_PHOTOS && (
                        <Pressable style={styles.photoAdd} onPress={pickPhoto}>
                            <Text style={styles.photoAddIcon}>+</Text>
                            <Text style={styles.photoAddLabel}>
                                {photoUris.length}/{MAX_ENROLLMENT_PHOTOS}
                            </Text>
                        </Pressable>
                    )}
                </View>
                <Text style={styles.photoHint}>
                    {photoUris.length < MIN_ENROLLMENT_PHOTOS
                        ? `Add at least ${MIN_ENROLLMENT_PHOTOS} photos`
                        : `${photoUris.length} photo${photoUris.length !== 1 ? 's' : ''} selected`}
                </Text>

                {/* Common fields */}
                <FormField
                    label="Name"
                    value={name}
                    onChangeText={setName}
                    onBlur={touch('name')}
                    error={visibleError('name')}
                    placeholder={assetType === 'Person' ? 'e.g. Grandma Mary' : 'e.g. House keys'}
                    returnKeyType="next"
                />

                <FormField
                    label="Notes"
                    value={notes}
                    onChangeText={setNotes}
                    placeholder={
                        assetType === 'Person'
                            ? 'e.g. Favourite memories, shared history'
                            : 'e.g. Where to find it, how to use it'
                    }
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    style={styles.textArea}
                />

                {/* Type-specific fields */}
                {assetType === 'Person' && (
                    <>
                        <FormField
                            label="Date of birth (optional)"
                            value={dateOfBirth}
                            onChangeText={setDateOfBirth}
                            onBlur={touch('dateOfBirth')}
                            error={visibleError('dateOfBirth')}
                            placeholder="YYYY-MM-DD"
                            keyboardType="numbers-and-punctuation"
                        />
                        <FormField
                            label="Relationship (optional)"
                            value={relationship}
                            onChangeText={setRelationship}
                            placeholder="e.g. Daughter, Nurse"
                        />
                    </>
                )}

                {assetType === 'Object' && (
                    <>
                        <FormField
                            label="Category (optional)"
                            value={category}
                            onChangeText={setCategory}
                            placeholder="e.g. Keys, Medication"
                        />
                        <FormField
                            label="Reminder text (optional)"
                            value={reminderText}
                            onChangeText={setReminderText}
                            placeholder="e.g. Keep these on the hook by the door"
                            multiline
                            numberOfLines={2}
                            textAlignVertical="top"
                            style={styles.textArea}
                        />
                    </>
                )}

                <Pressable
                    style={[styles.submitButton, !canPress && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={!canPress}
                >
                    <Text style={styles.submitButtonText}>{submitLabel}</Text>
                </Pressable>

                <Pressable style={styles.cancelButton} onPress={() => router.back()} disabled={isProcessing}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        flex: { flex: 1, backgroundColor: theme.surface },
        container: { padding: 24, paddingTop: 56 },
        title: { fontSize: 28, fontWeight: '700', color: theme.body, marginBottom: 4 },
        subtitle: { fontSize: 15, color: theme.textMuted, marginBottom: 20 },
        offlineBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        offlineText: { color: theme.error, fontSize: 14 },
        errorBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        errorText: { color: theme.error, fontSize: 14 },
        typeToggle: { flexDirection: 'row', gap: 10, marginBottom: 20 },
        typeChip: {
            flex: 1,
            paddingVertical: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.border,
            alignItems: 'center',
            backgroundColor: theme.cardBackground,
        },
        typeChipActive: {
            backgroundColor: theme.primarySoft,
            borderColor: theme.primaryMutedBorder,
        },
        typeChipText: { fontSize: 15, fontWeight: '600', color: theme.textMuted },
        typeChipTextActive: { color: theme.primaryText },
        photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
        photoSlot: { position: 'relative' },
        photoThumb: {
            width: 76,
            height: 76,
            borderRadius: 10,
            backgroundColor: theme.border,
        },
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
            backgroundColor: theme.cardBackground,
        },
        photoAddIcon: { fontSize: 24, color: theme.textMuted },
        photoAddLabel: { fontSize: 11, color: theme.textFaint, marginTop: 2 },
        photoHint: { fontSize: 13, color: theme.textMuted, marginBottom: 20 },
        field: { marginBottom: 20 },
        label: { fontSize: 14, fontWeight: '600', color: theme.label, marginBottom: 8 },
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
        textArea: { minHeight: 80 },
        submitButton: {
            backgroundColor: theme.primary,
            borderRadius: 10,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 8,
        },
        submitButtonDisabled: { backgroundColor: theme.primaryDisabled },
        submitButtonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
        cancelButton: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
        cancelButtonText: { color: theme.textMuted, fontSize: 15, fontWeight: '600' },
    });
}
