import { FormField } from '@/components/common/FormField';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { validate } from '@/utils/validation';
import { useAuthViewModel } from '@/viewmodels/useAuthViewModel';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function RegisterScreen() {
  const { register, isSubmitting, error, clearError, confirmationPending } = useAuthViewModel();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    contact: false,
    password: false,
    confirmPassword: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = {
    fullName: validate.required(fullName, 'Full name'),
    email: validate.email(email),
    contact: validate.phone(contact),
    password: validate.password(password),
    confirmPassword: validate.confirmPassword(password, confirmPassword),
  };

  const visibleError = (field: keyof typeof errors) =>
    touched[field] || submitAttempted ? errors[field] : null;

  // Confirm password shows error immediately while typing (before blur) so users
  // get real-time feedback as they type to match.
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

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (Object.values(errors).some(e => e !== null)) return;
    register({
      email,
      password,
      fullName: fullName.trim(),
      contact: contact.trim(),
      role: 'caregiver',
    });
  };

  const isFormValid = Object.values(errors).every(e => e === null);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>For caregivers managing patient profiles</Text>
        </View>

        {confirmationPending && (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              Account created! Check your email and click the confirmation link to activate your account.
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

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
          label="Email"
          value={email}
          onChangeText={handleChange(setEmail)}
          onBlur={touch('email')}
          error={visibleError('email')}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
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
          returnKeyType="next"
        />

        <FormField
          label="Password"
          value={password}
          onChangeText={handleChange(setPassword)}
          onBlur={touch('password')}
          error={visibleError('password')}
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="next"
        />

        <FormField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={handleChange(setConfirmPassword)}
          onBlur={touch('confirmPassword')}
          error={confirmPasswordError}
          placeholder="Re-enter your password"
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <Pressable
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" style={styles.link}>
            Sign in
          </Link>
        </View>
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
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 48,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    backButton: { alignSelf: 'flex-start', marginBottom: 24 },
    backButtonText: { fontSize: 16, color: theme.primary, fontWeight: '600' },
    header: { marginBottom: 32 },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.body,
      marginBottom: 4,
    },
    subtitle: { fontSize: 16, color: theme.textMuted },
    confirmBox: {
      backgroundColor: theme.primaryMuted,
      borderColor: theme.primaryMutedBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    confirmText: { color: theme.primaryText, fontSize: 14, lineHeight: 20 },
    errorBox: {
      backgroundColor: theme.errorBackground,
      borderColor: theme.errorBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    errorText: { color: theme.error, fontSize: 14 },
    button: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    buttonDisabled: { backgroundColor: theme.primaryDisabled },
    buttonText: { color: theme.onPrimary, fontSize: 16, fontWeight: '600' },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
    },
    footerText: { fontSize: 14, color: theme.textMuted },
    link: { fontSize: 14, fontWeight: '600', color: theme.primary },
  });
}
