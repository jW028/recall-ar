import { DatabaseProvider } from '@/database/local/db';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '@/store/AuthStore';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function RootLayout() {
  const { setUser, isLoading, isAuthenticated, isCaregiver } = useAuthStore();

  useEffect(() => {
    // Subscribe to auth state
    const unsubscribe = AuthService.onAuthStateChange(setUser);
    return unsubscribe;
  }, []);

  if (isLoading) return null; // Show splash screen

  return (
    <DatabaseProvider>
      <Stack screenOptions={{ headerShown: false}} />
    </DatabaseProvider>
  );
}