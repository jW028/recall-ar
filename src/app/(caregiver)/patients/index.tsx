import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Patient } from '@/models/Patient';
import { AuthService } from '@/services/AuthService';
import { useAuthStore } from '@/store/authStore';
import { usePatientListViewModel } from '@/viewmodels/usePatientViewModel';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function PatientCard({
  patient,
  onPress,
  styles,
}: {
  patient: Patient;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {patient.patientName.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{patient.patientName}</Text>
        <Text style={styles.cardMeta}>
          {calculateAge(patient.dateOfBirth)} years old
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function EmptyState({
  onAddPatient,
  styles,
}: {
  onAddPatient: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No patients yet</Text>
      <Text style={styles.emptyBody}>
        Add a patient profile to start setting up memory training and AR
        recognition.
      </Text>
      <Pressable style={styles.emptyButton} onPress={onAddPatient}>
        <Text style={styles.emptyButtonText}>Add patient</Text>
      </Pressable>
    </View>
  );
}

export default function PatientListScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { patients, isLoading, error, refresh } = usePatientListViewModel(
    user?.id
  );

  const sortedPatients = useMemo(
    () => [...patients].sort((a, b) => a.patientName.localeCompare(b.patientName)),
    [patients]
  );

  const goToNewPatient = () => router.push('/(caregiver)/patients/new');
  const goToPatientDetail = (patientId: string) =>
    router.push(`/(caregiver)/patients/${patientId}`);

  const handleSignOut = async () => {
    await AuthService.signOut();
    clearAuth();
  };

  if (isLoading && patients.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Patients</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.addButton} onPress={goToNewPatient}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={sortedPatients}
        keyExtractor={(item) => item.patientId}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
        renderItem={({ item }) => (
          <PatientCard
            patient={item}
            onPress={() => goToPatientDetail(item.patientId)}
            styles={styles}
          />
        )}
        ListEmptyComponent={
          <EmptyState onAddPatient={goToNewPatient} styles={styles} />
        }
      />
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.surface,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 56,
      paddingBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.body,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    addButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    addButtonText: {
      color: theme.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    signOutButton: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    signOutButtonText: {
      color: theme.textMuted,
      fontSize: 15,
      fontWeight: '500',
    },
    errorBox: {
      backgroundColor: theme.errorBackground,
      borderColor: theme.errorBorder,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginHorizontal: 20,
      marginBottom: 12,
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
    },
    listContent: {
      paddingHorizontal: 20,
      paddingBottom: 24,
      flexGrow: 1,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primarySoft,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.primary,
    },
    cardInfo: {
      flex: 1,
    },
    cardName: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.body,
      marginBottom: 2,
    },
    cardMeta: {
      fontSize: 14,
      color: theme.textMuted,
    },
    chevron: {
      fontSize: 24,
      color: theme.borderStrong,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingTop: 80,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.body,
      marginBottom: 8,
    },
    emptyBody: {
      fontSize: 15,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    emptyButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingHorizontal: 24,
      paddingVertical: 14,
    },
    emptyButtonText: {
      color: theme.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}