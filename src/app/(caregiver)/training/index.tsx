import { AnalyticsEmptyState } from '@/components/analytics/AnalyticsEmptyState';
import { DegradationBanner } from '@/components/analytics/DegradationBanner';
import { EngagementCard } from '@/components/analytics/EngagementCard';
import { SummaryCard } from '@/components/analytics/SummaryCard';
import { TimeframeSelector } from '@/components/analytics/TimeframeSelector';
import { TrendChart } from '@/components/analytics/TrendChart';
import { EmptyState } from '@/components/common/EmptyState';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { MAX_MONTHLY_POOL_SIZE } from '@/constants/config';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MemoryAsset } from '@/models/MemoryAsset';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useAnalyticsViewModel } from '@/viewmodels/useAnalyticsViewModel';
import { useMemoryAssetListViewModel } from '@/viewmodels/useMemoryAssetViewModel';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type TrainingTab = 'overview' | 'analytics';

export default function TrainingScreen() {
    const id = useCurrentPatientId() ?? undefined;
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [tab, setTab] = useState<TrainingTab>('overview');

    if (!id) {
        return (
            <Screen>
                <ScreenHeader title="Training" />
                <EmptyState
                    icon="people-outline"
                    title="No patient selected"
                    body="Select a patient on the Home tab to manage their training."
                />
            </Screen>
        );
    }

    return (
        <Screen>
            <ScreenHeader title="Training" />
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.segmentRow}>
                    {(['overview', 'analytics'] as const).map((value) => {
                        const active = value === tab;
                        return (
                            <Pressable
                                key={value}
                                style={[styles.segment, active && styles.segmentActive]}
                                onPress={() => setTab(value)}
                            >
                                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                                    {value === 'overview' ? 'Overview' : 'Analytics'}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {tab === 'overview' ? (
                    <OverviewTab patientId={id} styles={styles} theme={theme} />
                ) : (
                    <AnalyticsTab patientId={id} styles={styles} theme={theme} />
                )}
            </ScrollView>
        </Screen>
    );
}

// Overview: every asset's training status with inline pause/resume, plus the active-pool count.
function OverviewTab({
    patientId,
    styles,
    theme,
}: {
    patientId: string;
    styles: ReturnType<typeof createStyles>;
    theme: Theme;
}) {
    const { assets, isLoading, error, activeCount, pause, resume, pendingId } =
        useMemoryAssetListViewModel(patientId);

    if (isLoading && assets.length === 0) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <>
            <Text style={styles.poolCount}>
                {activeCount} of {MAX_MONTHLY_POOL_SIZE} active
            </Text>

            {error && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>{error}</Text>
                </View>
            )}

            {assets.length === 0 ? (
                <Text style={styles.emptyBody}>No memories enrolled yet.</Text>
            ) : (
                assets.map((asset) => (
                    <AssetRow
                        key={asset.assetId}
                        asset={asset}
                        pending={pendingId === asset.assetId}
                        onToggle={() =>
                            asset.status === 'Paused' ? resume(asset.assetId) : pause(asset.assetId)
                        }
                        styles={styles}
                        theme={theme}
                    />
                ))
            )}
        </>
    );
}

function AssetRow({
    asset,
    pending,
    onToggle,
    styles,
    theme,
}: {
    asset: MemoryAsset;
    pending: boolean;
    onToggle: () => void;
    styles: ReturnType<typeof createStyles>;
    theme: Theme;
}) {
    const isPaused = asset.status === 'Paused';
    return (
        <View style={[styles.assetRow, isPaused && styles.assetRowPaused]}>
            <View style={styles.assetInfo}>
                <Text style={styles.assetName}>{asset.name}</Text>
                <Text style={styles.assetStatus}>{asset.status}</Text>
            </View>
            <Pressable
                style={[styles.toggleButton, isPaused && styles.toggleButtonResume]}
                onPress={onToggle}
                disabled={pending}
            >
                {pending ? (
                    <ActivityIndicator size="small" color={theme.primaryText} />
                ) : (
                    <Text style={styles.toggleButtonText}>{isPaused ? 'Resume' : 'Pause'}</Text>
                )}
            </Pressable>
        </View>
    );
}

// Analytics: the existing cognitive-decline dashboard, unchanged.
function AnalyticsTab({
    patientId,
    styles,
    theme,
}: {
    patientId: string;
    styles: ReturnType<typeof createStyles>;
    theme: Theme;
}) {
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
    } = useAnalyticsViewModel(patientId);

    return (
        <>
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
        </>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            padding: 24,
            paddingTop: 8,
            backgroundColor: theme.surface,
            flexGrow: 1,
        },
        centered: {
            paddingVertical: 64,
            alignItems: 'center',
        },
        segmentRow: {
            flexDirection: 'row',
            backgroundColor: theme.backgroundElement,
            borderRadius: 10,
            padding: 4,
            marginBottom: 20,
        },
        segment: {
            flex: 1,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 8,
        },
        segmentActive: {
            backgroundColor: theme.surface,
        },
        segmentLabel: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.textMuted,
        },
        segmentLabelActive: {
            color: theme.primaryText,
        },
        poolCount: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.textMuted,
            marginBottom: 16,
        },
        emptyBody: {
            fontSize: 15,
            color: theme.textMuted,
            textAlign: 'center',
            paddingVertical: 32,
        },
        assetRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.cardBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 14,
            marginBottom: 10,
        },
        assetRowPaused: {
            opacity: 0.6,
        },
        assetInfo: {
            flex: 1,
        },
        assetName: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.body,
            marginBottom: 2,
        },
        assetStatus: {
            fontSize: 13,
            color: theme.textMuted,
        },
        toggleButton: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: theme.primarySoft,
            borderWidth: 1,
            borderColor: theme.primaryMutedBorder,
            minWidth: 78,
            alignItems: 'center',
        },
        toggleButtonResume: {
            backgroundColor: theme.backgroundElement,
        },
        toggleButtonText: {
            fontSize: 14,
            fontWeight: '600',
            color: theme.primaryText,
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
