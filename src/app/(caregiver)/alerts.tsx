import { CurrentPatientChip } from '@/components/caregiver/CurrentPatientChip';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { usePatientLocationViewModel } from '@/viewmodels/useGeofenceViewModels';
import { useThreatListViewModel } from '@/viewmodels/useThreatViewModel';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

function MiniMap({ patientId }: { patientId: string }) {
    const { fetchLocation } = usePatientLocationViewModel(patientId);
    const [coords, setCoords] = useState<{ lat: number, lng: number, recordedAt?: string } | null>(null);
    const [locationName, setLocationName] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        fetchLocation().then(async (res) => {
            if (mounted && res.found && res.location) {
                const lat = res.location.latitude;
                const lng = res.location.longitude;
                setCoords({ lat, lng, recordedAt: res.location.recordedAt });

                try {
                    const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
                    if (geocode && geocode.length > 0 && mounted) {
                        const address = geocode[0];
                        const name = address.name || address.street || address.city || address.region;
                        if (name) {
                            setLocationName(name);
                        }
                    }
                } catch (e) {
                    console.warn('Reverse geocoding failed', e);
                }
            }
        });
        return () => { mounted = false };
    }, [fetchLocation]);

    if (!coords) return <ActivityIndicator style={{ margin: 16 }} />;

    return (
        <View style={{ marginTop: 12 }}>
            <View style={{ marginBottom: 12 }}>
                {locationName && (
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 4 }}>
                        Patient is nearby {locationName}
                    </Text>
                )}
                <Text style={{ fontSize: 14, color: '#64748B' }}>
                    Coordinates: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </Text>
                {coords.recordedAt && (
                    <Text style={{ fontSize: 14, color: '#64748B' }}>
                        Last Updated: {new Date(coords.recordedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                    </Text>
                )}
            </View>
            <View style={{ height: 200, borderRadius: 12, overflow: 'hidden' }}>
                <MapView
                    style={StyleSheet.absoluteFillObject}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                    initialRegion={{
                        latitude: coords.lat,
                        longitude: coords.lng,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005
                    }}
                >
                    <Marker coordinate={{ latitude: coords.lat, longitude: coords.lng }} title="Current Location" pinColor='red' />
                </MapView>
            </View>
        </View>
    )
}

export default function ThreatListScreen() {
    const patientId = useCurrentPatientId() ?? undefined;
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();

    const { threats, isLoading, error, refresh, acknowledgeThreat, resolveThreat, clearHistory } =
        useThreatListViewModel(patientId);

    const [showLocationTab, setShowLocationTab] = useState(false);

    if (isLoading) {
        return (
            <Screen background="page">
                <ScreenHeader title="Threats" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            </Screen>
        );
    }

    if (error) {
        return (
            <Screen background="page">
                <ScreenHeader title="Threats" />
                <View style={styles.loadingContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen background="page">
            <ScreenHeader
                title="Threats"
                subtitle={`${threats.filter(t => t.alertStatus !== 'Resolved').length} active alerts`}
                right={
                    threats.length > 0 ? (
                        <Pressable onPress={clearHistory} style={styles.clearHistoryButton}>
                            <Text style={styles.clearHistoryText}>Clear History</Text>
                        </Pressable>
                    ) : null
                }
                chip={<CurrentPatientChip />}
            />

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
                        const isResolved = item.alertStatus === 'Resolved';
                        return (
                            <View
                                style={[
                                    styles.card,
                                    isAcknowledged && styles.cardAcknowledged,
                                    isResolved && { opacity: 0.6, borderColor: theme.border }
                                ]}
                            >
                                <View style={styles.cardHeader}>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            (isAcknowledged || isResolved)
                                                ? styles.badgeAcknowledged
                                                : styles.badgeActive,
                                        ]}
                                    >
                                        <Text style={styles.statusBadgeText}>
                                            {isResolved ? '✓ Resolved' : isAcknowledged ? '✓ Acknowledged' : '⚠ Active'}
                                        </Text>
                                    </View>
                                    <Text style={styles.threatType}>{item.threatType}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Status</Text>
                                    <Text style={styles.detailValue}>{isResolved ? 'Resolved' : item.threatStatus}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Detected</Text>
                                    <Text style={styles.detailValue}>
                                        {new Date(item.detectedTime).toLocaleString()}
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

                                {!isResolved && (
                                    <View style={{ flexDirection: 'column', gap: 10, marginTop: 12 }}>
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            <Pressable
                                                style={[styles.ackButton, { flex: 1, backgroundColor: theme.success || '#10B981', marginTop: 0 }]}
                                                onPress={async () => {
                                                    const success = await resolveThreat(item.threatId);
                                                    if (!success) Alert.alert('Error', 'Failed to resolve the threat. Please try again.');
                                                }}
                                            >
                                                <Text style={styles.ackButtonText}>Resolve</Text>
                                            </Pressable>
                                        </View>

                                        {/* View Location Button for Panic and Fall alerts */}
                                        {(item.threatType === 'Panic Button' || item.threatType === 'Fall Detected') && (
                                            <Pressable
                                                style={[styles.ackButton, { backgroundColor: theme.primarySoft, marginTop: 0 }]}
                                                onPress={() => setShowLocationTab(true)}
                                            >
                                                <Text style={[styles.ackButtonText, { color: theme.primary }]}>View Live Location</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    }}
                />
            )}

            <Modal
                visible={showLocationTab}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowLocationTab(false)}
            >
                <View style={styles.bottomSheetOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowLocationTab(false)} />
                    <View style={styles.bottomSheetContainer}>
                        <View style={styles.bottomSheetDragHandle} />
                        <View style={styles.bottomSheetHeader}>
                            <Text style={styles.bottomSheetTitle}>Patient Live Location</Text>
                            <Pressable onPress={() => setShowLocationTab(false)} style={styles.closeButton}>
                                <Text style={styles.closeButtonText}>Close</Text>
                            </Pressable>
                        </View>
                        {patientId ? (
                            <View style={{ paddingBottom: 16 }}>
                                <MiniMap patientId={patientId} />
                                <Pressable
                                    style={[styles.ackButton, { backgroundColor: theme.primarySoft, marginTop: 16 }]}
                                    onPress={() => {
                                        setShowLocationTab(false);
                                        router.push(`/(caregiver)/location`);
                                    }}
                                >
                                    <Text style={[styles.ackButtonText, { color: theme.primary }]}>View More Detail</Text>
                                </Pressable>
                            </View>
                        ) : <Text style={styles.detailValue}>Location not available</Text>}
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
        },
        clearHistoryButton: {
            padding: 8,
            backgroundColor: theme.errorBackground,
            borderRadius: 8,
        },
        clearHistoryText: {
            color: theme.error,
            fontWeight: '600',
            fontSize: 13,
        },
        listContent: {
            paddingHorizontal: 24,
            paddingTop: 20,
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
            paddingHorizontal: 24,
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
        bottomSheetOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
        },
        bottomSheetContainer: {
            backgroundColor: theme.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            paddingTop: 12,
            paddingBottom: 40,
            minHeight: 350,
        },
        bottomSheetDragHandle: {
            width: 40,
            height: 5,
            backgroundColor: '#CBD5E1',
            borderRadius: 3,
            alignSelf: 'center',
            marginBottom: 16,
        },
        bottomSheetHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        bottomSheetTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.heading,
        },
        closeButton: {
            paddingVertical: 4,
            paddingHorizontal: 8,
        },
        closeButtonText: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.primary,
        },
    });
}

