import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useThreatListViewModel } from '@/viewmodels/useThreatViewModel';
import { useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function ThreatListScreen() {
    const patientId = useCurrentPatientId() ?? undefined;
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const { threats, isLoading, error, refresh, acknowledgeThreat } =
        useThreatListViewModel(patientId);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>{error}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>⚠️ Threats</Text>
            <Text style={styles.subtitle}>
                {threats.filter(t => t.alertStatus !== 'Acknowledged').length} unacknowledged
            </Text>

            {threats.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyIcon}>✅</Text>
                    <Text style={styles.emptyTitle}>No threats detected</Text>
                    <Text style={styles.emptySubtitle}>
                        Threat alerts will appear here when boundary violations are flagged.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={threats}
                    keyExtractor={item => item.threatId}
                    contentContainerStyle={styles.listContent}
                    onRefresh={refresh}
                    refreshing={isLoading}
                    renderItem={({ item }) => {
                        const isAcknowledged = item.alertStatus === 'Acknowledged';
                        return (
                            <View
                                style={[
                                    styles.card,
                                    isAcknowledged && styles.cardAcknowledged,
                                ]}
                            >
                                <View style={styles.cardHeader}>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            isAcknowledged
                                                ? styles.badgeAcknowledged
                                                : styles.badgeActive,
                                        ]}
                                    >
                                        <Text style={styles.statusBadgeText}>
                                            {isAcknowledged ? '✓ Acknowledged' : '⚠ Active'}
                                        </Text>
                                    </View>
                                    <Text style={styles.threatType}>{item.threatType}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Status</Text>
                                    <Text style={styles.detailValue}>{item.threatStatus}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Detected</Text>
                                    <Text style={styles.detailValue}>
                                        {new Date(item.detectedTime).toLocaleString()}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Alert time</Text>
                                    <Text style={styles.detailValue}>
                                        {new Date(item.alertTime).toLocaleString()}
                                    </Text>
                                </View>
                                {item.acknowledgedTime && (
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Acknowledged</Text>
                                        <Text style={styles.detailValue}>
                                            {new Date(item.acknowledgedTime).toLocaleString()}
                                        </Text>
                                    </View>
                                )}

                                {!isAcknowledged && (
                                    <Pressable
                                        style={styles.ackButton}
                                        onPress={() => acknowledgeThreat(item.threatId)}
                                    >
                                        <Text style={styles.ackButtonText}>Acknowledge</Text>
                                    </Pressable>
                                )}
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.pageBackground,
            paddingTop: 56,
            paddingHorizontal: 24,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.pageBackground,
        },
        title: {
            fontSize: 24,
            fontWeight: '700',
            color: theme.heading,
            marginBottom: 4,
        },
        subtitle: {
            fontSize: 14,
            color: theme.textMuted,
            marginBottom: 20,
        },
        listContent: {
            paddingBottom: 32,
        },
        card: {
            backgroundColor: theme.cardBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.errorBorder,
            padding: 16,
            marginBottom: 14,
        },
        cardAcknowledged: {
            borderColor: theme.border,
            opacity: 0.7,
        },
        cardHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        statusBadge: {
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 6,
        },
        badgeActive: {
            backgroundColor: theme.errorBackground,
        },
        badgeAcknowledged: {
            backgroundColor: '#DCFCE7',
        },
        statusBadgeText: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.body,
        },
        threatType: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.heading,
        },
        detailRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
        },
        detailLabel: {
            fontSize: 13,
            color: theme.textMuted,
        },
        detailValue: {
            fontSize: 13,
            fontWeight: '500',
            color: theme.body,
            flex: 1,
            textAlign: 'right',
        },
        ackButton: {
            marginTop: 12,
            backgroundColor: theme.primary,
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: 'center',
        },
        ackButtonText: {
            color: theme.onPrimary,
            fontWeight: '600',
            fontSize: 14,
        },
        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        emptyIcon: {
            fontSize: 48,
            marginBottom: 12,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.heading,
            marginBottom: 8,
        },
        emptySubtitle: {
            fontSize: 14,
            color: theme.textMuted,
            textAlign: 'center',
            paddingHorizontal: 24,
        },
        errorText: {
            color: theme.error,
            fontSize: 15,
            textAlign: 'center',
        },
    });
}
