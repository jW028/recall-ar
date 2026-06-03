import { Redirect } from 'expo-router';

export default function Index() {
  const { session, role } = useAuthStore();

  if (!session) return <Redirect href="/(auth)/login" />;
  if (role === 'caregiver') return <Redirect href="/(caregiver)" />;
  return <Redirect href="/(patient)" />;
}