import { PatientSwitcherSheet } from '@/components/caregiver/PatientSwitcherSheet';
import { Avatar } from '@/components/common/Avatar';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentPatient } from '@/store/currentPatientStore';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Tappable reminder of which patient the screen is acting on, shown under patient-scoped screen titles
export function CurrentPatientChip() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const patient = useCurrentPatient();

    // The picker opens in place instead of navigating so the caregiver keeps the screen they were on
    const [pickerOpen, setPickerOpen] = useState(false);
    const openPicker = () => setPickerOpen(true);
    const closePicker = () => setPickerOpen(false);

    // Mounted only while open so the patient list is fetched on demand, not on every screen
    const picker = pickerOpen ? <PatientSwitcherSheet onClose={closePicker} /> : null;

    // The summary is missing only before the first list load, where a name would be a guess
    if (!patient) {
        return (
            <>
                <Pressable
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    onPress={openPicker}
                    accessibilityRole="button"
                    accessibilityLabel="No patient selected, choose a patient"
                >
                    <View style={styles.placeholderDot} />
                    <Text style={styles.placeholderName}>No patient selected</Text>
                    <Ionicons name="chevron-down" size={15} color={theme.textMuted} />
                </Pressable>
                {picker}
            </>
        );
    }

    return (
        <>
            <Pressable
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                onPress={openPicker}
                accessibilityRole="button"
                accessibilityLabel={`Viewing ${patient.patientName}, tap to switch patient`}
            >
                <Avatar imageUrl={patient.imageUrl} name={patient.patientName} size={22} />
                <Text style={styles.name} numberOfLines={1}>
                    {patient.patientName}
                </Text>
                <Ionicons name="chevron-down" size={15} color={theme.primary} />
            </Pressable>
            {picker}
        </>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        chip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
            maxWidth: '100%',
            backgroundColor: theme.primaryMuted,
            borderRadius: 999,
            paddingLeft: 4,
            paddingRight: 10,
            paddingVertical: 4,
        },
        pressed: {
            opacity: 0.7,
        },
        name: {
            flexShrink: 1,
            fontSize: 14,
            fontWeight: '600',
            color: theme.primary,
        },
        placeholderDot: {
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.border,
        },
        placeholderName: {
            flexShrink: 1,
            fontSize: 14,
            fontWeight: '600',
            color: theme.textMuted,
        },
    });
}
