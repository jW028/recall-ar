import { AnalyticsEmptyState } from '@/components/analytics/AnalyticsEmptyState';
import { DegradationBanner } from '@/components/analytics/DegradationBanner';
import { EngagementCard } from '@/components/analytics/EngagementCard';
import { SummaryCard } from '@/components/analytics/SummaryCard';
import { TimeframeSelector } from '@/components/analytics/TimeframeSelector';
import { TrendChart } from '@/components/analytics/TrendChart';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAnalyticsViewModel } from '@/viewmodels/useAnalyticsViewModel';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AnalyticsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const {
        status,
        error,
        dataset,
        timeframe,
        setTimeframe,
        isExporting,
        exportError,
        exportMessage,
        exportReport,
    } = useAnalyticsViewModel(id);

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backButtonText}>‹ Back</Text>
            </Pressable>

            <Text style={styles.title}>Cognitive Analytics</Text>

            <TimeframeSelector value={timeframe} onChange={setTimeframe} />

            {status === 'loading' && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            )}

            {status === 'error' && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>{error ?? 'Failed to load analytics.'}</Text>
                </View>
            )}

            {status === 'empty' && <AnalyticsEmptyState />}

            {status === 'ready' && dataset && (
                <>
                    <DegradationBanner dataset={dataset} />
                    <SummaryCard dataset={dataset} />
                    <TrendChart
                        title="Recognition accuracy (7-day smoothed)"
                        points={dataset.accuracyByDay}
                        color={theme.primary}
                        mode="percent"
                    />
                    <TrendChart
                        title="Response latency (7-day smoothed median)"
                        points={dataset.latencyByDay}
                        color={theme.warning}
                        mode="ms"
                    />
                    <EngagementCard dataset={dataset} />

                    <Pressable
                        style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
                        onPress={exportReport}
                        disabled={isExporting}
                    >
                        <Text style={styles.exportButtonText}>
                            {isExporting ? 'Preparing…' : 'Export Medical Report'}
                        </Text>
                    </Pressable>

                    {exportMessage && <Text style={styles.successText}>{exportMessage}</Text>}
                    {exportError && <Text style={styles.exportErrorText}>{exportError}</Text>}
                </>
            )}
        </ScrollView>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            padding: 24,
            paddingTop: 56,
            backgroundColor: theme.surface,
            flexGrow: 1,
        },
        centered: {
            paddingVertical: 64,
            alignItems: 'center',
        },
        backButton: { alignSelf: 'flex-start', marginBottom: 16 },
        backButtonText: { fontSize: 16, color: theme.primary, fontWeight: '600' },
        title: {
            fontSize: 26,
            fontWeight: '700',
            color: theme.body,
            marginBottom: 20,
        },
        errorBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        errorBoxText: {
            color: theme.error,
            fontSize: 14,
        },
        exportButton: {
            backgroundColor: theme.primary,
            borderRadius: 10,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 8,
        },
        exportButtonDisabled: {
            backgroundColor: theme.primaryDisabled,
        },
        exportButtonText: {
            color: theme.onPrimary,
            fontSize: 16,
            fontWeight: '600',
        },
        successText: {
            color: theme.success,
            fontSize: 14,
            textAlign: 'center',
            marginTop: 12,
        },
        exportErrorText: {
            color: theme.error,
            fontSize: 14,
            textAlign: 'center',
            marginTop: 12,
        },
    });
}
