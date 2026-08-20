import { Button } from '@/components/common/Button';
import { FormField } from '@/components/common/FormField';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { validate } from '@/utils/validation';
import { useCaregiverProfileViewModel } from '@/viewmodels/useCaregiverProfileViewModel';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ChangePasswordScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();
    const { changePassword, isSaving, error, clearError } = useCaregiverProfileViewModel();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [touched, setTouched] = useState({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
    });
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const errors = {
        currentPassword: validate.required(currentPassword, 'Current password'),
        newPassword: validate.password(newPassword),
        confirmPassword: validate.confirmPassword(newPassword, confirmPassword),
    };

    const visibleError = (field: keyof typeof errors) =>
        touched[field] || submitAttempted ? errors[field] : null;

    // Confirm password shows its error while typing so users get feedback as they type to match
    const confirmPasswordError =
        confirmPassword.length > 0 || touched.confirmPassword || submitAttempted
            ? errors.confirmPassword
            : null;

    const touch = (field: keyof typeof touched) => () =>
        setTouched(prev => ({ ...prev, [field]: true }));

    const handleChange = (setter: (val: string) => void) => (val: string) => {
        setter(val);
        if (error) clearError();
    };

    const handleSubmit = async () => {
        setSubmitAttempted(true);
        if (Object.values(errors).some(e => e !== null)) return;

        const success = await changePassword(currentPassword, newPassword);
        if (success) {
            Alert.alert('Password changed', 'Use your new password the next time you sign in.');
            router.back();
        }
    };

    const isFormValid = Object.values(errors).every(e => e === null);

    return (
        <Screen>
            <ScreenHeader title="Change password" showBack />
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

                    <FormField
                        label="Current password"
                        value={currentPassword}
                        onChangeText={handleChange(setCurrentPassword)}
                        onBlur={touch('currentPassword')}
                        error={visibleError('currentPassword')}
                        placeholder="Enter your current password"
                        secureTextEntry
                        autoComplete="current-password"
                        returnKeyType="next"
                    />

                    <FormField
                        label="New password"
                        value={newPassword}
                        onChangeText={handleChange(setNewPassword)}
                        onBlur={touch('newPassword')}
                        error={visibleError('newPassword')}
                        placeholder="At least 8 characters"
                        secureTextEntry
                        autoComplete="new-password"
                        returnKeyType="next"
                    />

                    <FormField
                        label="Confirm new password"
                        value={confirmPassword}
                        onChangeText={handleChange(setConfirmPassword)}
                        onBlur={touch('confirmPassword')}
                        error={confirmPasswordError}
                        placeholder="Re-enter your new password"
                        secureTextEntry
                        autoComplete="new-password"
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
                    />

                    <Button
                        label={isSaving ? 'Saving…' : 'Change password'}
                        onPress={handleSubmit}
                        disabled={!isFormValid}
                        loading={isSaving}
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
        submit: { marginTop: 8 },
        cancel: { marginTop: 10 },
    });
}
