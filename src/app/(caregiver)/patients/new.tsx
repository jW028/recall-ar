import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/authStore';
import { usePatientListViewModel } from '@/viewmodels/usePatientViewModel';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

export default function NewPatientScreen() {
    const router = useRouter();
    const user = useAuthStore((state) => state.user);
    const { createPatient, isCreating, createError, clearCreateError } =
    usePatientListViewModel(user?.id);
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const [patientName, setPatientName] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState(''); // YYYY-MM-DD
    const [emergencyContact, setEmergencyContact] = useState('');
    const [medicalNotes, setMedicalNotes] = useState('');

    const isValid =
    patientName.trim().length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) &&
    emergencyContact.trim().length > 0;

    const handleChange = (setter: (val: string) => void) => (val: string) => {
    setter(val);
    if (createError) clearCreateError();
    };

    const handleSubmit = async () => {
    if (!isValid || !user?.id) return;

    const success = await createPatient({
        caregiverId: user.id,
        patientName: patientName.trim(),
        dateOfBirth,
        emergencyContact: emergencyContact.trim(),
        medicalNotes: medicalNotes.trim() || null,
    });

    if (success) {
        router.back();
    }
    };

    return (
    <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
        <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.title}>Add patient</Text>
        <Text style={styles.subtitle}>
            Create a profile to start memory training and AR recognition.
        </Text>

        {createError && (
            <View style={styles.errorBox}>
            <Text style={styles.errorText}>{createError}</Text>
            </View>
        )}

        <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
            style={styles.input}
            value={patientName}
            onChangeText={handleChange(setPatientName)}
            placeholder="Mary Tan"
            placeholderTextColor={theme.textFaint}
            returnKeyType="next"
            />
        </View>

        <View style={styles.field}>
            <Text style={styles.label}>Date of birth</Text>
            <TextInput
            style={styles.input}
            value={dateOfBirth}
            onChangeText={handleChange(setDateOfBirth)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textFaint}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
            />
        </View>

        <View style={styles.field}>
            <Text style={styles.label}>Emergency contact</Text>
            <TextInput
            style={styles.input}
            value={emergencyContact}
            onChangeText={handleChange(setEmergencyContact)}
            placeholder="+60 12 345 6789"
            placeholderTextColor={theme.textFaint}
            keyboardType="phone-pad"
            returnKeyType="next"
            />
        </View>

        <View style={styles.field}>
            <Text style={styles.label}>Medical notes (optional)</Text>
            <TextInput
            style={[styles.input, styles.textArea]}
            value={medicalNotes}
            onChangeText={handleChange(setMedicalNotes)}
            placeholder="e.g. Mild Alzheimer's, history of hypertension"
            placeholderTextColor={theme.textFaint}
            multiline
            numberOfLines={4}
            maxLength={2000}
            textAlignVertical="top"
            />
        </View>

        <Pressable
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isCreating}
        >
            <Text style={styles.buttonText}>
            {isCreating ? 'Saving…' : 'Save patient'}
            </Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        </ScrollView>
    </KeyboardAvoidingView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
    flex: {
    flex: 1,
    backgroundColor: theme.surface,
    },
    container: {
    padding: 24,
    paddingTop: 56,
    },
    title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.body,
    marginBottom: 4,
    },
    subtitle: {
    fontSize: 15,
    color: theme.textMuted,
    marginBottom: 28,
    },
    errorBox: {
    backgroundColor: theme.errorBackground,
    borderColor: theme.errorBorder,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    },
    errorText: {
    color: theme.error,
    fontSize: 14,
    },
    field: {
    marginBottom: 20,
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
    backgroundColor: theme.cardBackground,
    },
    textArea: {
    minHeight: 100,
    },
    button: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    },
    buttonDisabled: {
    backgroundColor: theme.primaryDisabled,
    },
    buttonText: {
    color: theme.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    },
    cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    },
    cancelButtonText: {
    color: theme.textMuted,
    fontSize: 15,
    fontWeight: '600',
    },
    });
}