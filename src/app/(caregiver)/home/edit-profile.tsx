import { AvatarPicker } from '@/components/caregiver/AvatarPicker';
import { Button } from '@/components/common/Button';
import { FormField } from '@/components/common/FormField';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/store/authStore';
import { validate } from '@/utils/validation';
import { useCaregiverProfileViewModel } from '@/viewmodels/useCaregiverProfileViewModel';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function EditProfileScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const { saveProfile, isSaving, isUploading, error, clearError } = useCaregiverProfileViewModel();

    const [fullName, setFullName] = useState(user?.fullName ?? '');
    const [contact, setContact] = useState(user?.contact ?? '');
    const [avatarUri, setAvatarUri] = useState<string | null>(user?.imageUrl ?? null);
    const [touched, setTouched] = useState({ fullName: false, contact: false });
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const errors = {
        fullName: validate.required(fullName, 'Full name'),
        contact: validate.phone(contact),
    };

    const visibleError = (field: keyof typeof errors) =>
        touched[field] || submitAttempted ? errors[field] : null;

    const touch = (field: keyof typeof touched) => () =>
        setTouched(prev => ({ ...prev, [field]: true }));

    const handleChange = (setter: (val: string) => void) => (val: string) => {
        setter(val);
        if (error) clearError();
    };

    const handleAvatarChange = (uri: string | null) => {
        setAvatarUri(uri);
        if (error) clearError();
    };

    const handleSubmit = async () => {
        setSubmitAttempted(true);
        if (Object.values(errors).some(e => e !== null)) return;

        const success = await saveProfile({
            fullName: fullName.trim(),
            contact: contact.trim(),
            avatarUri,
        });
        if (success) router.back();
    };

    const isFormValid = Object.values(errors).every(e => e === null);

    return (
        <Screen>
            <ScreenHeader title="Edit profile" showBack />
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                >
                    {error && (
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <View style={styles.avatarSection}>
                        <AvatarPicker value={avatarUri} name={fullName} onChange={handleAvatarChange} />
                    </View>

                    <FormField
                        label="Full name"
                        value={fullName}
                        onChangeText={handleChange(setFullName)}
                        onBlur={touch('fullName')}
                        error={visibleError('fullName')}
                        placeholder="Jane Doe"
                        autoComplete="name"
                        returnKeyType="next"
                    />

                    <FormField
                        label="Phone number"
                        value={contact}
                        onChangeText={handleChange(setContact)}
                        onBlur={touch('contact')}
                        error={visibleError('contact')}
                        placeholder="+60 12 345 6789"
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
                    />

                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.readOnly}>
                            <Text style={styles.readOnlyValue}>{user?.email}</Text>
                        </View>
                        <Text style={styles.hint}>Your email is used to sign in and cannot be changed here.</Text>
                    </View>

                    <Button
                        label={isUploading ? 'Uploading photo…' : isSaving ? 'Saving…' : 'Save changes'}
                        onPress={handleSubmit}
                        disabled={!isFormValid}
                        loading={isSaving || isUploading}
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
        container: { padding: 24, paddingTop: 16 },
        errorBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        errorText: { color: theme.error, fontSize: 14 },
        avatarSection: { alignItems: 'center', marginBottom: 24 },
        field: { marginBottom: 20 },
        label: { fontSize: 14, fontWeight: '600', color: theme.label, marginBottom: 8 },
        readOnly: {
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 14,
            backgroundColor: theme.pageBackground,
        },
        readOnlyValue: { fontSize: 16, color: theme.textMuted },
        hint: { fontSize: 13, color: theme.textMuted, marginTop: 6 },
        submit: { marginTop: 8 },
        cancel: { marginTop: 10 },
    });
}
