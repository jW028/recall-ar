import { Avatar } from '@/components/common/Avatar';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Patient } from '@/models/Patient';
import { useAuthStore } from '@/store/authStore';
import { useCurrentPatientId, useCurrentPatientStore } from '@/store/currentPatientStore';
import { usePatientListViewModel } from '@/viewmodels/usePatientViewModel';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PatientSwitcherSheetProps {
    onClose: () => void;
}

// Bottom sheet the patient chip drops down, so switching patients keeps the caregiver on the current screen
export function PatientSwitcherSheet({ onClose }: PatientSwitcherSheetProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const user = useAuthStore((s) => s.user);
    const currentPatientId = useCurrentPatientId();
    const setCurrentPatient = useCurrentPatientStore((s) => s.setCurrentPatient);
    const syncFromList = useCurrentPatientStore((s) => s.syncFromList);

    const { patients, isLoading, error } = usePatientListViewModel(user?.id);

    const sortedPatients = useMemo(
        () => [...patients].sort((a, b) => a.patientName.localeCompare(b.patientName)),
        [patients]
    );

    // Refresh the cached name and photo while the list is in hand
    useEffect(() => {
        if (patients.length > 0) syncFromList(patients);
    }, [patients, syncFromList]);

    const selectPatient = (patient: Patient) => {
        setCurrentPatient(patient.patientId, {
            patientName: patient.patientName,
            imageUrl: patient.imageUrl,
        });
        onClose();
    };

    // Adding a patient is a deliberate detour, so it leaves the current screen for the home stack
    const goToNewPatient = () => {
        onClose();
        router.push('/(caregiver)/home/new-patient');
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close patient picker">
                <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]} onPress={() => {}}>
                    <View style={styles.grabber} />
                    <Text style={styles.title}>Switch patient</Text>

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    {isLoading && patients.length === 0 ? (
                        <ActivityIndicator style={styles.loading} color={theme.primary} />
                    ) : (
                        <FlatList
                            data={sortedPatients}
                            keyExtractor={(item) => item.patientId}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={<Text style={styles.empty}>No patients yet.</Text>}
                            renderItem={({ item }) => {
                                const selected = item.patientId === currentPatientId;
                                return (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.row,
                                            selected && styles.rowSelected,
                                            pressed && styles.rowPressed,
                                        ]}
                                        onPress={() => selectPatient(item)}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected }}
                                    >
                                        <Avatar imageUrl={item.imageUrl} name={item.patientName} size={40} />
                                        <Text style={styles.rowName} numberOfLines={1}>
                                            {item.patientName}
                                        </Text>
                                        {selected ? (
                                            <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                                        ) : null}
                                    </Pressable>
                                );
                            }}
                        />
                    )}

                    <Pressable
                        style={({ pressed }) => [styles.addRow, pressed && styles.rowPressed]}
                        onPress={goToNewPatient}
                        accessibilityRole="button"
                    >
                        <View style={styles.addIcon}>
                            <Ionicons name="add" size={20} color={theme.primary} />
                        </View>
                        <Text style={styles.addLabel}>Add patient</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: theme.overlay,
            justifyContent: 'flex-end',
        },
        sheet: {
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 10,
            maxHeight: '75%',
        },
        grabber: {
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: theme.border,
            marginBottom: 12,
        },
        title: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.heading,
            marginBottom: 12,
        },
        error: {
            color: theme.error,
            fontSize: 14,
            marginBottom: 8,
        },
        loading: {
            paddingVertical: 24,
        },
        listContent: {
            paddingBottom: 8,
        },
        empty: {
            color: theme.textMuted,
            fontSize: 14,
            paddingVertical: 16,
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.cardBackground,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: 10,
        },
        rowSelected: {
            borderColor: theme.primary,
            backgroundColor: theme.primaryMuted,
        },
        rowPressed: {
            opacity: 0.7,
        },
        rowName: {
            flex: 1,
            fontSize: 16,
            fontWeight: '600',
            color: theme.body,
        },
        addRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
        },
        addIcon: {
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.primaryMuted,
        },
        addLabel: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.primary,
        },
    });
}
