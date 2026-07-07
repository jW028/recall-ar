import { ActionRow } from '@/components/caregiver/ActionRow';
import { CurrentPatientCard } from '@/components/caregiver/CurrentPatientCard';
import { MetricTile } from '@/components/caregiver/MetricTile';
import { StatTile } from '@/components/caregiver/StatTile';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Screen } from '@/components/common/Screen';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isObject, isPerson } from '@/models/MemoryAsset';
import { useAuthStore } from '@/store/authStore';
import { useCurrentPatientId, useCurrentPatientStore } from '@/store/currentPatientStore';
import { useAnalyticsViewModel } from '@/viewmodels/useAnalyticsViewModel';
import { useMemoryAssetListViewModel } from '@/viewmodels/useMemoryAssetViewModel';
import { usePatientListViewModel } from '@/viewmodels/usePatientViewModel';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// First and last non-null smoothed values of a daily series, or null if too few
function smoothedEndpoints(points: { smoothed: number | null }[]) {
    const vals = points.filter((p) => p.smoothed != null).map((p) => p.smoothed as number);
    if (vals.length < 2) return null;
    return { first: vals[0], last: vals[vals.length - 1] };
}

export default function CaregiverHomeScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();

    const user = useAuthStore((s) => s.user);
    const currentPatientId = useCurrentPatientId();
    const setCurrentPatient = useCurrentPatientStore((s) => s.setCurrentPatient);

    const { patients, isLoading } = usePatientListViewModel(user?.id);

    // Auto-select a valid current patient whenever the list changes
    useEffect(() => {
        if (patients.length === 0) return;
        const stillValid = currentPatientId && patients.some((p) => p.patientId === currentPatientId);
        if (!stillValid) setCurrentPatient(patients[0].patientId);
    }, [patients, currentPatientId, setCurrentPatient]);

    const currentPatient = useMemo(
        () => patients.find((p) => p.patientId === currentPatientId) ?? null,
        [patients, currentPatientId]
    );

    const { assets, refresh } = useMemoryAssetListViewModel(currentPatient?.patientId);
    const { dataset } = useAnalyticsViewModel(currentPatient?.patientId);

    // Re-fetch counts when returning to this screen (e.g. after enrolling a memory) since the home stays mounted
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    const peopleCount = assets.filter(isPerson).length;
    const objectCount = assets.filter(isObject).length;

    const accuracy = useMemo(() => {
        if (!dataset?.hasData || dataset.currentAccuracy == null) return null;
        const value = `${Math.round(dataset.currentAccuracy * 100)}%`;
        const ends = dataset.insufficientData ? null : smoothedEndpoints(dataset.accuracyByDay);
        if (!ends) return { value, delta: null };
        const pp = Math.round((ends.last - ends.first) * 100);
        // Higher accuracy is better, so an increase is both good (green) and an up arrow
        const delta = pp === 0 ? null : { text: `${Math.abs(pp)}% vs prior`, positive: pp > 0, up: pp > 0 };
        return { value, delta };
    }, [dataset]);

    const latency = useMemo(() => {
        if (!dataset?.hasData || dataset.currentMedianLatencyMs == null) return null;
        const value = `${(dataset.currentMedianLatencyMs / 1000).toFixed(1)}s`;
        const ends = dataset.insufficientData ? null : smoothedEndpoints(dataset.latencyByDay);
        if (!ends) return { value, delta: null };
        const diffSec = (ends.last - ends.first) / 1000;
        // Lower latency is better, so a decrease is good (green) but points the arrow down to match the value
        const delta =
            Math.abs(diffSec) < 0.05
                ? null
                : { text: `${Math.abs(diffSec).toFixed(1)}s ${diffSec < 0 ? 'faster' : 'slower'}`, positive: diffSec < 0, up: diffSec > 0 };
        return { value, delta };
    }, [dataset]);

    // Loading the patient list for the first time
    if (isLoading && patients.length === 0) {
        return (
            <Screen topInset>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            </Screen>
        );
    }

    // Caregiver has no patients yet
    if (patients.length === 0) {
        return (
            <Screen topInset>
                <EmptyState
                    icon="person-add-outline"
                    title="Add your first patient"
                    body="Create a patient profile to start enrolling memories, training, and tracking location."
                    action={
                        <Button
                            label="Add patient"
                            icon="add"
                            onPress={() => router.push('/(caregiver)/home/new-patient')}
                        />
                    }
                />
            </Screen>
        );
    }

    return (
        <Screen>
            <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
                <View style={styles.headerText}>
                    <Text style={styles.welcome}>Welcome back,</Text>
                    <Text style={styles.name}>{user?.fullName || 'Caregiver'}</Text>
                </View>
                <Pressable
                    style={styles.gear}
                    onPress={() => router.push('/(caregiver)/home/account')}
                    hitSlop={8}
                    accessibilityLabel="Account settings"
                >
                    <Ionicons name="settings-outline" size={24} color={theme.bodySecondary} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <CurrentPatientCard
                    name={currentPatient?.patientName ?? '—'}
                    onViewEdit={() => router.push('/(caregiver)/home/patient')}
                    onChange={() => router.push('/(caregiver)/home/select-patient')}
                />

                <View style={styles.row}>
                    <StatTile value={objectCount} label="Objects" />
                    <StatTile value={peopleCount} label="People" />
                </View>

                <View style={styles.row}>
                    <MetricTile
                        label="Avg accuracy"
                        value={accuracy?.value ?? '—'}
                        valueColor={accuracy ? theme.success : theme.textFaint}
                        delta={accuracy?.delta}
                    />
                    <MetricTile
                        label="Avg response time"
                        value={latency?.value ?? '—'}
                        valueColor={latency ? theme.primary : theme.textFaint}
                        delta={latency?.delta}
                    />
                </View>

                <ActionRow
                    icon="pulse"
                    label="Check Live Status"
                    subtitle="Monitor location & activity"
                    onPress={() => router.push('/(caregiver)/location')}
                    accent
                />

                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actions}>
                    <ActionRow
                        icon="add-circle-outline"
                        label="Enroll Memory"
                        onPress={() => router.push('/(caregiver)/memories/new')}
                    />
                    <ActionRow
                        icon="images-outline"
                        label="Manage Memories"
                        onPress={() => router.push('/(caregiver)/memories')}
                    />
                    <ActionRow
                        icon="school-outline"
                        label="Manage Training"
                        onPress={() => router.push('/(caregiver)/training')}
                    />
                </View>
            </ScrollView>
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border,
        },
        headerText: {
            flex: 1,
        },
        welcome: {
            fontSize: 16,
            color: theme.textMuted,
        },
        name: {
            fontSize: 30,
            fontWeight: '800',
            color: theme.heading,
        },
        gear: {
            padding: 4,
            marginTop: 4,
        },
        content: {
            padding: 20,
            gap: 16,
        },
        row: {
            flexDirection: 'row',
            gap: 12,
        },
        sectionTitle: {
            fontSize: 20,
            fontWeight: '800',
            color: theme.heading,
            marginTop: 8,
        },
        actions: {
            gap: 12,
        },
    });
}
