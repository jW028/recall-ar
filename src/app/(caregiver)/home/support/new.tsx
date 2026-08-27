import { Button } from '@/components/common/Button';
import { FormField } from '@/components/common/FormField';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/use-theme';
import { validate } from '@/utils/validation';
import { useCreateTicketViewModel } from '@/viewmodels/useSupportViewModel';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

// Mirrors the CHECK constraints on the table so the limit shows inline rather than as a rejection.
const SUBJECT_MIN = 3;
const SUBJECT_MAX = 120;
const BODY_MIN = 10;
const BODY_MAX = 4000;

export default function NewTicketScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();
    const { isOnline } = useNetworkStatus();
    const { isCreating, createError, clearCreateError, createTicket } = useCreateTicketViewModel();

    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [touched, setTouched] = useState({ subject: false, body: false });
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const errors = {
        subject: validate.length(subject, SUBJECT_MIN, SUBJECT_MAX, 'Subject'),
        body: validate.length(body, BODY_MIN, BODY_MAX, 'Description'),
    };

    const visibleError = (field: keyof typeof errors) =>
        touched[field] || submitAttempted ? errors[field] : null;

    const touch = (field: keyof typeof touched) => () =>
        setTouched((prev) => ({ ...prev, [field]: true }));

    const handleChange = (setter: (val: string) => void) => (val: string) => {
        setter(val);
        if (createError) clearCreateError();
    };

    const isFormValid = Object.values(errors).every((e) => e === null);

    const handleSubmit = async () => {
        setSubmitAttempted(true);
        if (!isFormValid) return;
        const ticketId = await createTicket(subject, body);
        if (ticketId) router.replace(`/(caregiver)/home/support/${ticketId}`);
    };

    return (
        <Screen>
            <ScreenHeader title="Contact support" subtitle="Tell us what went wrong" showBack />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                    {!isOnline && (
                        <View style={styles.offlineBox}>
                            <Ionicons name="cloud-offline-outline" size={18} color={theme.textMuted} />
                            <Text style={styles.offlineText}>
                                You are offline. Your draft is kept — send once you reconnect.
                            </Text>
                        </View>
                    )}

                    {createError && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{createError}</Text>
                        </View>
                    )}

                    <FormField
                        label="Subject"
                        value={subject}
                        onChangeText={handleChange(setSubject)}
                        onBlur={touch('subject')}
                        error={visibleError('subject')}
                        placeholder="Pairing QR code will not scan"
                        maxLength={SUBJECT_MAX}
                        returnKeyType="next"
                    />

                    <FormField
                        label="What happened?"
                        value={body}
                        onChangeText={handleChange(setBody)}
                        onBlur={touch('body')}
                        error={visibleError('body')}
                        placeholder="Describe what you were doing and what you expected to happen."
                        multiline
                        numberOfLines={6}
                        textAlignVertical="top"
                        maxLength={BODY_MAX}
                        style={styles.textArea}
                    />

                    <View style={styles.noteBox}>
                        <Ionicons name="information-circle-outline" size={16} color={theme.textFaint} />
                        <Text style={styles.noteText}>
                            Your app version and device model are attached automatically to help us
                            diagnose the problem. No patient information is included.
                        </Text>
                    </View>

                    <Button
                        label={isCreating ? 'Sending…' : 'Send to support'}
                        onPress={handleSubmit}
                        disabled={!isFormValid || !isOnline}
                        loading={isCreating}
                        style={styles.submit}
                    />
                    <Button
                        label="Cancel"
                        variant="outline"
                        onPress={() => router.back()}
                        style={styles.cancel}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        flex: { flex: 1 },
        container: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
        textArea: { minHeight: 140 },
        submit: { marginTop: 8 },
        cancel: { marginTop: 12 },
        errorBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        errorText: { color: theme.error, fontSize: 14 },
        offlineBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.backgroundElement,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        offlineText: { color: theme.textMuted, fontSize: 13, flex: 1 },
        noteBox: { flexDirection: 'row', gap: 8, marginBottom: 20, paddingHorizontal: 2 },
        noteText: { color: theme.textFaint, fontSize: 13, flex: 1, lineHeight: 18 },
    });
}
