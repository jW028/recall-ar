import { DatabaseProvider } from '@/database/local/db';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { AuthService } from '@/services/AuthService';
import { PairingService } from '@/services/PairingService';
import { useAuthStore } from '@/store/authStore';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { user, status, setUser } = useAuthStore();

  const [pairingChecked, setPairingChecked] = useState(false);

  // Check for persisted patient pairing
  useEffect(() => {
    PairingService.getPersistedPairing().then(async (pairingInfo) => {
      if (pairingInfo) {
        const currentUser = await AuthService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
        }
      }
      setPairingChecked(true);
    });
  }, []);

  // Subscribe to Supabase auth state changes
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((authUser) => {
      setUser(authUser);
    });
    return unsubscribe;
  }, []);

  // Route based on auth status
  useEffect(() => {
    if (!pairingChecked || status === 'loading') return;

      const inAuthGroup = segments[0] === '(auth)';
      const inCaregiverGroup = segments[0] === '(caregiver)';
      const inPatientGroup = segments[0] === '(patient)';

      // Patient device setup must stay reachable regardless of who is signed in
      const onPairScreen = segments[0] === '(auth)' && segments[1] === 'pair';
      if (onPairScreen) return;

      if (status === 'unauthenticated') {
        // Not logged in and not paired - go to login
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
        }
        return;
      }

      if (status === 'authenticated') {
        if (user?.role === 'patient') {
          // Paired patient device - always stay in patient group
          if (!inPatientGroup) {
            router.replace('/(patient)');
          }
          return;
        }
        if (user?.role === 'caregiver') {
          if (!inCaregiverGroup) {
            router.replace('/(caregiver)/home');
          }
          return;
        }
      }
    }, [status, user, segments, pairingChecked]); 
    return null;
}

export default function RootLayout() {
  useNetworkStatus(); // Auto-sync on reconnect
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <AuthGuard />
        <Stack screenOptions={{ headerShown: false}} />
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}