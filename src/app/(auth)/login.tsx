import { FormField } from '@/components/common/FormField';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { validate } from '@/utils/validation';
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
    View,
} from 'react-native';

export default function LoginScreen() {
  const { login, isSubmitting, error, clearError } = useAuthViewModel();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = {
    email: validate.email(email),
    password: validate.required(password, 'Password'),
  };

  const visibleError = (field: keyof typeof errors) =>
    touched[field] || submitAttempted ? errors[field] : null;

  const touch = (field: keyof typeof touched) => () =>
    setTouched(prev => ({ ...prev, [field]: true }));

  const handleChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    if (error) clearError();
  };

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (errors.email || errors.password) return;
    login({ email, password });
  };

  const isFormValid = !errors.email && !errors.password;

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
          <Text style={styles.title}>RecallAR</Text>
          <Text style={styles.subtitle}>Caregiver sign in</Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

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
          label="Password"
          value={password}
          onChangeText={handleChange(setPassword)}
          onBlur={touch('password')}
          error={visibleError('password')}
          placeholder="Enter your password"
          secureTextEntry
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        <Pressable
          style={[styles.button, !isFormValid && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" style={styles.link}>
            Register
          </Link>
        </View>

        <View style={styles.divider} />

        <View style={styles.footer}>
          <Link href="/(auth)/pair" style={styles.link}>
            Set up a patient device
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
    header: { marginBottom: 32 },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: theme.body,
      marginBottom: 4,
    },
    subtitle: { fontSize: 16, color: theme.textMuted },
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
    divider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 24,
    },
  });
}
