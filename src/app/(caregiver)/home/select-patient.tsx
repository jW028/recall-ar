import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Patient } from '@/models/Patient';
import { useAuthStore } from '@/store/authStore';
import { useCurrentPatientId, useCurrentPatientStore } from '@/store/currentPatientStore';
import { usePatientListViewModel } from '@/viewmodels/usePatientViewModel';
import { Ionicons } from '@expo/vector-icons';
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
  selected,
  onPress,
  styles,
  theme,
}: {
  patient: Patient;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <Avatar imageUrl={patient.imageUrl} name={patient.patientName} size={48} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{patient.patientName}</Text>
        <Text style={styles.cardMeta}>
          {calculateAge(patient.dateOfBirth)} years old
        </Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'chevron-forward'}
        size={22}
        color={selected ? theme.primary : theme.textFaint}
      />
    </Pressable>
  );
}

export default function PatientListScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const currentPatientId = useCurrentPatientId();
  const setCurrentPatient = useCurrentPatientStore((s) => s.setCurrentPatient);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { patients, isLoading, error, refresh } = usePatientListViewModel(
    user?.id
  );

  const sortedPatients = useMemo(
    () => [...patients].sort((a, b) => a.patientName.localeCompare(b.patientName)),
    [patients]
  );

  const goToNewPatient = () => router.push('/(caregiver)/home/new-patient');
  // Choose the active patient and return to the dashboard
  const selectPatient = (patientId: string) => {
    setCurrentPatient(patientId);
    router.back();
  };

  if (isLoading && patients.length === 0) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Select patient"
        showBack
        right={
          <Pressable style={styles.addButton} onPress={goToNewPatient} hitSlop={6}>
            <Ionicons name="add" size={20} color={theme.onPrimary} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        }
      />

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
            selected={item.patientId === currentPatientId}
            onPress={() => selectPatient(item.patientId)}
            styles={styles}
            theme={theme}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No patients yet"
            body="Add a patient profile to start setting up memory training and AR recognition."
            action={<Button label="Add patient" icon="add" onPress={goToNewPatient} />}
          />
        }
      />
    </Screen>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.surface,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: theme.primary,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    addButtonText: {
      color: theme.onPrimary,
      fontSize: 15,
      fontWeight: '600',
    },
    errorBox: {
      backgroundColor: theme.errorBackground,
      borderColor: theme.errorBorder,
      borderWidth: 1,
      borderRadius: 12,
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
      paddingTop: 4,
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
    cardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryMuted,
    },
    cardPressed: {
      opacity: 0.7,
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
  });
}
