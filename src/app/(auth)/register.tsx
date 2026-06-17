import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuthViewModel } from '@/viewmodels/useAuthViewModel';
import { Link } from 'expo-router';
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

export default function RegisterScreen() {
  const { register, isSubmitting, error, clearError, confirmationPending } = useAuthViewModel();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const isValid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    contact.trim().length > 0 &&
    password.length >= 8 &&
    passwordsMatch;

  const handleSubmit = () => {
    if (!isValid) return;
    register({
      email,
      password,
      fullName: fullName.trim(),
      contact: contact.trim(),
      role: 'caregiver',
    });
  };

  const handleChange = (setter: (val: string) => void) => (val: string) => {
    setter(val);
    if (error) clearError();
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

        <View style={styles.field}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={handleChange(setFullName)}
            placeholder="Jane Doe"
            placeholderTextColor={theme.textFaint}
            autoComplete="name"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={handleChange(setEmail)}
            placeholder="you@example.com"
            placeholderTextColor={theme.textFaint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={contact}
            onChangeText={handleChange(setContact)}
            placeholder="+60 12 345 6789"
            placeholderTextColor={theme.textFaint}
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={handleChange(setPassword)}
            placeholder="At least 8 characters"
            placeholderTextColor={theme.textFaint}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={handleChange(setConfirmPassword)}
            placeholder="Re-enter your password"
            placeholderTextColor={theme.textFaint}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <Text style={styles.fieldError}>Passwords do not match</Text>
          )}
        </View>

        <Pressable
          style={[styles.button, !isValid && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
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
    header: {
      marginBottom: 32,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.body,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: theme.textMuted,
    },
    confirmBox: {
      backgroundColor: theme.primaryMuted,
      borderColor: theme.primaryMutedBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
    },
    confirmText: {
      color: theme.primaryText,
      fontSize: 14,
      lineHeight: 20,
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
    fieldError: {
      fontSize: 13,
      color: theme.error,
      marginTop: 6,
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
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: 24,
    },
    footerText: {
      fontSize: 14,
      color: theme.textMuted,
    },
    link: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.primary,
    },
  });
}