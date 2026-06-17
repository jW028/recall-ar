import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePatientDetailViewModel } from '@/viewmodels/usePatientViewModel';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function PatientDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const {
    patient,
    isLoading,
    error,
    updatePatient,
    isUpdating,
    updateError,
    clearUpdateError,
    deletePatient,
    isDeleting,
    } = usePatientDetailViewModel(id);

    const [isEditing, setIsEditing] = useState(false);
    const [patientName, setPatientName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [medicalNotes, setMedicalNotes] = useState('');

    // Sync local form state when patient loads or edit mode toggles on
    useEffect(() => {
    if (patient && isEditing) {
        setPatientName(patient.patientName);
        setDateOfBirth(patient.dateOfBirth);
        setEmergencyContact(patient.emergencyContact);
        setMedicalNotes(patient.medicalNotes ?? '');
    }
    }, [patient, isEditing]);

    const handleChange = (setter: (val: string) => void) => (val: string) => {
    setter(val);
    if (updateError) clearUpdateError();
    };

    const handleSave = async () => {
    const success = await updatePatient({
        patientName,
        dateOfBirth,
        emergencyContact,
        medicalNotes: medicalNotes.trim() || null,
    });
    if (success) setIsEditing(false);
    };

    const handleCancel = () => setIsEditing(false);

    const handleDelete = () => {
    Alert.alert(
        'Delete patient?',
        `Are you sure you want to delete ${patient?.patientName}? This will permanently remove this patient.`,
        [
        { text: 'Cancel', style: 'cancel' },
        {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
            const success = await deletePatient();
            if (success) router.back();
            },
        },
        ]
    );
    };

    const goToPairDevice = () => {
    router.push(`/(caregiver)/patients/${id}/pair-device`);
    };

    const goToAssets = () => {
    router.push(`/(caregiver)/patients/${id}/assets`);
    };

    if (isLoading && !patient) {
    return (
        <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );
    }

    if (error || !patient) {
    return (
        <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error ?? 'Patient not found.'}</Text>
        </View>
    );
    }

    return (
    <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        <View style={styles.header}>
        <Text style={styles.title}>{patient.patientName}</Text>
        {!isEditing && (
            <Pressable onPress={() => setIsEditing(true)}>
            <Text style={styles.editLink}>Edit</Text>
            </Pressable>
        )}
        </View>

        {updateError && (
        <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{updateError}</Text>
        </View>
        )}

        {/* ── View mode ───────────────────── */}
        {!isEditing && (
        <View style={styles.detailsCard}>
            <DetailRow label="Date of birth" value={patient.dateOfBirth} styles={styles} />
            <DetailRow
            label="Emergency contact"
            value={patient.emergencyContact}
            styles={styles}
            />
            <DetailRow
            label="Medical notes"
            value={patient.medicalNotes ?? '—'}
            styles={styles}
            />
        </View>
        )}

        {/* ── Edit mode ───────────────────── */}
        {isEditing && (
        <View style={styles.detailsCard}>
            <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
                style={styles.input}
                value={patientName}
                onChangeText={handleChange(setPatientName)}
            />
            </View>

            <View style={styles.field}>
            <Text style={styles.label}>Date of birth</Text>
            <TextInput
                style={styles.input}
                value={dateOfBirth}
                onChangeText={handleChange(setDateOfBirth)}
                placeholder="YYYY-MM-DD"
            />
            </View>

            <View style={styles.field}>
            <Text style={styles.label}>Emergency contact</Text>
            <TextInput
                style={styles.input}
                value={emergencyContact}
                onChangeText={handleChange(setEmergencyContact)}
            />
            </View>

            <View style={styles.field}>
            <Text style={styles.label}>Medical notes</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={medicalNotes}
                onChangeText={handleChange(setMedicalNotes)}
                multiline
                numberOfLines={4}
                maxLength={2000}
                textAlignVertical="top"
            />
            </View>

            <View style={styles.editActions}>
            <Pressable style={styles.cancelButton} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
                style={styles.saveButton}
                onPress={handleSave}
                disabled={isUpdating}
            >
                <Text style={styles.saveButtonText}>
                {isUpdating ? 'Saving…' : 'Save'}
                </Text>
            </Pressable>
            </View>
        </View>
        )}

        {/* ── Actions ─────────────────────── */}
        {!isEditing && (
        <>
            <Pressable style={styles.pairButton} onPress={goToAssets}>
            <Text style={styles.pairButtonText}>Memory assets</Text>
            </Pressable>

            <Pressable style={styles.pairButton} onPress={goToPairDevice}>
            <Text style={styles.pairButtonText}>📱 Pair patient device</Text>
            </Pressable>

            <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={isDeleting}
            >
            <Text style={styles.deleteButtonText}>
                {isDeleting ? 'Deleting…' : 'Delete patient'}
            </Text>
            </Pressable>
        </>
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
    marginBottom: 20,
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
    errorBox: {
    backgroundColor: theme.errorBackground,
    borderColor: theme.errorBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    },
    errorBoxText: {
    color: theme.error,
    fontSize: 14,
    },
    errorText: {
    color: theme.error,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
    },
    detailsCard: {
    backgroundColor: theme.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 20,
    },
    detailRow: {
    marginBottom: 16,
    },
    detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textMuted,
    marginBottom: 4,
    },
    detailValue: {
    fontSize: 16,
    color: theme.body,
    },
    field: {
    marginBottom: 16,
    },
    label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.label,
    marginBottom: 8,
    },
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
    textArea: {
    minHeight: 100,
    },
    editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    },
    cancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.borderStrong,
    },
    cancelButtonText: {
    color: theme.label,
    fontSize: 15,
    fontWeight: '600',
    },
    saveButton: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    },
    saveButtonText: {
    color: theme.onPrimary,
    fontSize: 15,
    fontWeight: '600',
    },
    pairButton: {
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryMutedBorder,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    },
    pairButtonText: {
    color: theme.primaryText,
    fontSize: 16,
    fontWeight: '600',
    },
    deleteButton: {
    paddingVertical: 16,
    alignItems: 'center',
    },
    deleteButtonText: {
    color: theme.errorStrong,
    fontSize: 15,
    fontWeight: '600',
    },
    });
}