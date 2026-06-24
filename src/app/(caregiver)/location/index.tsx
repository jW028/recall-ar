import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useGeofenceListViewModel, usePatientGeofenceEventsViewModel, usePatientLocationViewModel } from '@/viewmodels/useGeofenceViewModels';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from 'react-native-maps';

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth radius in meters
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default function GeofenceListScreen() {
    const patientId = useCurrentPatientId() ?? undefined;
    const router = useRouter();
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const {
        geofences,
        isLoading: isLoadingGeofences,
        error: geofenceError,
        deleteGeofence,
        refresh: refreshGeofences,
    } = useGeofenceListViewModel(patientId);

    const {
        events,
        isLoading: isLoadingEvents,
        refresh: refreshEvents,
    } = usePatientGeofenceEventsViewModel(patientId);

    const {
        isTracking,
        fetchLocation,
    } = usePatientLocationViewModel(patientId);

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [patientMarker, setPatientMarker] = useState<{
        latitude: number;
        longitude: number;
        isLive: boolean;
        label: string;
        recordedAt?: string;
    } | null>(null);
    const mapRef = useRef<MapView>(null);

    const handleDelete = (geofenceId: string, label: string) => {
        Alert.alert(
            'Delete Geofence',
            `Remove the "${label}" geofence zone?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => deleteGeofence(geofenceId),
                },
            ]
        );
    };

    // Calculate initial region bounding box based on geofences
    const initialRegion = useMemo(() => {
        if (geofences.length === 0) {
            return { latitude: 3.139, longitude: 101.6869, latitudeDelta: 0.1, longitudeDelta: 0.1 };
        }

        let minLat = geofences[0].centerLatitude;
        let maxLat = geofences[0].centerLatitude;
        let minLon = geofences[0].centerLongitude;
        let maxLon = geofences[0].centerLongitude;

        for (const g of geofences) {
            if (g.centerLatitude < minLat) minLat = g.centerLatitude;
            if (g.centerLatitude > maxLat) maxLat = g.centerLatitude;
            if (g.centerLongitude < minLon) minLon = g.centerLongitude;
            if (g.centerLongitude > maxLon) maxLon = g.centerLongitude;
        }

        const latDelta = Math.max(maxLat - minLat, 0.05) * 1.5;
        const lonDelta = Math.max(maxLon - minLon, 0.05) * 1.5;

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLon + maxLon) / 2,
            latitudeDelta: latDelta,
            longitudeDelta: lonDelta,
        };
    }, [geofences]);

    useEffect(() => {
        if (geofences.length > 0 && mapRef.current) {
            mapRef.current.animateToRegion(initialRegion, 800);
        }
    }, [geofences.length, initialRegion]);

    // Automatically fetch patient location on mount
    useEffect(() => {
        let mounted = true;
        (async () => {
            const { found, isLive, location } = await fetchLocation();
            if (found && location && mounted) {
                setPatientMarker({
                    latitude: location.latitude,
                    longitude: location.longitude,
                    isLive,
                    label: isLive ? '📍 Patient (Live)' : '📍 Last Known Area',
                    recordedAt: location.recordedAt,
                });
                
                // Animate to patient location once loaded
                if (mapRef.current) {
                    mapRef.current.animateToRegion({
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }, 800);
                }
            }
        })();
        return () => { mounted = false; };
    }, [fetchLocation]);

    const latestEvent = events.length > 0 ? events[0] : null;
    
    // Default to event-based safety status
    let isSafe: boolean | null = latestEvent ? (latestEvent.event.eventType === 'Enter') : null;
    let referenceZone = latestEvent?.geofence.geofenceType || null;
    let lastUpdated = latestEvent
        ? new Date(latestEvent.event.eventTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
        : "Never";

    // If we have live coordinates, override the safety status with exact real-time math
    if (patientMarker?.isLive) {
        let currentlyInZone: string | null = null;
        for (const fence of geofences) {
            const dist = getDistanceInMeters(
                patientMarker.latitude, patientMarker.longitude,
                fence.centerLatitude, fence.centerLongitude
            );
            if (dist <= fence.radiusMeters) {
                currentlyInZone = fence.geofenceType;
                break;
            }
        }
        
        if (currentlyInZone) {
            isSafe = true;
            referenceZone = currentlyInZone;
        } else {
            isSafe = false;
        }
        
        lastUpdated = patientMarker.recordedAt
            ? new Date(patientMarker.recordedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    }

    let statusText = "Status Unknown";
    if (isSafe === true) {
        statusText = `Safe at ${referenceZone || 'Zone'}${patientMarker?.isLive ? ' (Live)' : ''}`;
    } else if (isSafe === false) {
        statusText = `Left ${referenceZone || 'Zone'}${patientMarker?.isLive ? ' (Live)' : ''}`;
    }
    const statusColor = isSafe === true ? '#10B981' : '#F59E0B'; // Green or Orange

    if ((isLoadingGeofences && geofences.length === 0) || (isLoadingEvents && events.length === 0 && !latestEvent)) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerButton}>
                    <Text style={styles.headerIcon}>←</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Location Tracking</Text>
                <Pressable onPress={() => setIsSettingsOpen(true)} style={styles.headerButton}>
                    <Text style={styles.headerIcon}>✏️</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Status Card */}
                <View style={[styles.statusCard, { borderLeftColor: statusColor }]}>
                    <View style={styles.statusTitleRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusTitle, { color: statusColor }]}>{statusText}</Text>
                    </View>
                    <Text style={styles.statusSubtitle}>Last updated: {lastUpdated}</Text>
                </View>

                {/* Map Card */}
                <View style={styles.mapCard}>
                    <View style={styles.mapContainer}>
                        <MapView
                            ref={mapRef}
                            style={StyleSheet.absoluteFillObject}
                            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                            initialRegion={initialRegion}
                            showsUserLocation
                        >
                            {geofences.map(geofence => (
                                <React.Fragment key={geofence.geofenceId}>
                                    <Marker
                                        coordinate={{
                                            latitude: geofence.centerLatitude,
                                            longitude: geofence.centerLongitude,
                                        }}
                                        title={geofence.geofenceType}
                                        pinColor={theme.primary}
                                    />
                                    <Circle
                                        center={{
                                            latitude: geofence.centerLatitude,
                                            longitude: geofence.centerLongitude,
                                        }}
                                        radius={geofence.radiusMeters}
                                        strokeColor={theme.primary}
                                        strokeWidth={2}
                                        fillColor="rgba(37, 99, 235, 0.12)"
                                    />
                                </React.Fragment>
                            ))}
                            {/* Patient live location marker */}
                            {patientMarker && (
                                <Marker
                                    coordinate={{
                                        latitude: patientMarker.latitude,
                                        longitude: patientMarker.longitude,
                                    }}
                                    title={patientMarker.label}
                                    description={patientMarker.isLive ? 'Live location' : 'Last known area'}
                                    pinColor={patientMarker.isLive ? '#0EA5E9' : '#F59E0B'}
                                />
                            )}
                        </MapView>
                    </View>
                    <Pressable
                        style={[styles.trackButton, isTracking && styles.trackButtonLoading]}
                        disabled={isTracking}
                        onPress={async () => {
                            refreshGeofences();
                            refreshEvents();

                            const { found, isLive, location } = await fetchLocation();

                            if (found && location) {
                                // Animate map to the patient's position
                                mapRef.current?.animateToRegion({
                                    latitude: location.latitude,
                                    longitude: location.longitude,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }, 800);
                                setPatientMarker({
                                    latitude: location.latitude,
                                    longitude: location.longitude,
                                    isLive,
                                    label: isLive ? '📍 Patient (Live)' : '📍 Last Known Area',
                                    recordedAt: location.recordedAt,
                                });
                            } else if (!found) {
                                // Fallback: navigate to most recent event's geofence center
                                const lastEvent = events[0];
                                if (lastEvent) {
                                    const lat = lastEvent.geofence.centerLatitude;
                                    const lon = lastEvent.geofence.centerLongitude;
                                    mapRef.current?.animateToRegion({
                                        latitude: lat,
                                        longitude: lon,
                                        latitudeDelta: 0.05,
                                        longitudeDelta: 0.05,
                                    }, 800);
                                    setPatientMarker({
                                        latitude: lat,
                                        longitude: lon,
                                        isLive: false,
                                        label: `📍 Last seen near ${lastEvent.geofence.geofenceType}`,
                                    });
                                } else {
                                    Alert.alert(
                                        'No Location Data',
                                        'No location or geofence activity found for this patient yet.'
                                    );
                                }
                            }
                        }}
                    >
                        {isTracking
                            ? <Text style={styles.trackButtonText}>Locating…</Text>
                            : <Text style={styles.trackButtonText}>Track Now</Text>
                        }
                    </Pressable>
                </View>

                {/* Activity History */}
                <View style={styles.historySection}>
                    <Text style={styles.sectionTitle}>Activity History</Text>
                    {events.map((e, index) => (
                        <View key={e.event.geoEventId || index} style={styles.historyCard}>
                            <View style={styles.historyIconContainer}>
                                <Text style={styles.historyEmoji}>
                                    {e.event.eventType === 'Enter' ? '🏠' : '🚪'}
                                </Text>
                            </View>
                            <View style={styles.historyContent}>
                                <Text style={styles.historyTitle}>
                                    {e.event.eventType === 'Enter' ? 'Arrived' : 'Left'} {e.geofence.geofenceType}
                                </Text>
                                <Text style={styles.historySubtitle}>
                                    Patient has {e.event.eventType === 'Enter' ? 'entered' : 'exited'} the geofence area.
                                </Text>
                                <Text style={styles.historyTime}>
                                    {new Date(e.event.eventTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </Text>
                            </View>
                        </View>
                    ))}
                    {events.length === 0 && (
                        <Text style={styles.emptyHistoryText}>No recent activity.</Text>
                    )}
                </View>
            </ScrollView>

            {/* ── List Modal ────────────────────────────────── */}
            <Modal
                visible={isSettingsOpen}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsSettingsOpen(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Geofences List</Text>
                        <Pressable onPress={() => setIsSettingsOpen(false)}>
                            <Text style={styles.closeButtonText}>Done</Text>
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={styles.listContainer}>
                        <Pressable
                            style={styles.addButton}
                            onPress={() => {
                                setIsSettingsOpen(false);
                                router.push(`/(caregiver)/location/create`);
                            }}
                        >
                            <Text style={styles.addButtonText}>+ Add New Geofence</Text>
                        </Pressable>

                        {geofenceError && <Text style={styles.errorText}>{geofenceError}</Text>}

                        {geofences.length === 0 && (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyIcon}>📍</Text>
                                <Text style={styles.emptyTitle}>No geofences yet</Text>
                                <Text style={styles.emptySubtitle}>
                                    Add a safe zone to start tracking boundary events.
                                </Text>
                            </View>
                        )}

                        {geofences.map(geofence => (
                            <Pressable
                                key={geofence.geofenceId}
                                style={styles.card}
                                onPress={() => {
                                    setIsSettingsOpen(false);
                                    router.push(
                                        `/(caregiver)/location/${geofence.geofenceId}`
                                    );
                                }}
                            >
                                <View style={styles.cardContent}>
                                    <View style={styles.typeBadge}>
                                        <Text style={styles.typeBadgeText}>{geofence.geofenceType}</Text>
                                    </View>
                                    <Text style={styles.cardCoords}>
                                        {geofence.centerLatitude.toFixed(5)}, {geofence.centerLongitude.toFixed(5)}
                                    </Text>
                                    <Text style={styles.cardRadius}>
                                        Radius: {geofence.radiusMeters} m
                                    </Text>
                                </View>
                                <Pressable
                                    style={styles.deleteIcon}
                                    onPress={() => handleDelete(geofence.geofenceId, geofence.geofenceType)}
                                >
                                    <Text style={styles.deleteIconText}>🗑</Text>
                                </Pressable>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#F8FAFC', // Slightly off-white background matching mockup
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#F8FAFC',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 56,
            paddingBottom: 12,
            paddingHorizontal: 16,
            backgroundColor: '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: '#1E293B',
        },
        headerButton: {
            padding: 8,
        },
        headerIcon: {
            fontSize: 20,
            color: '#475569',
        },
        content: {
            padding: 20,
        },
        statusCard: {
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderLeftWidth: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
        },
        statusTitleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        statusDot: {
            width: 10,
            height: 10,
            borderRadius: 5,
            marginRight: 8,
        },
        statusTitle: {
            fontSize: 18,
            fontWeight: '700',
        },
        statusSubtitle: {
            fontSize: 14,
            color: '#64748B',
            marginLeft: 18,
        },
        mapCard: {
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
        },
        mapContainer: {
            height: 200,
            width: '100%',
        },
        trackButton: {
            backgroundColor: '#0EA5E9',
            paddingVertical: 14,
            alignItems: 'center',
        },
        trackButtonLoading: {
            backgroundColor: '#7DD3F0',
        },
        trackButtonText: {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 16,
        },
        historySection: {
            marginTop: 8,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: '#1E293B',
            marginBottom: 16,
        },
        historyCard: {
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.03,
            shadowRadius: 4,
            elevation: 1,
            borderWidth: 1,
            borderColor: '#F1F5F9',
        },
        historyIconContainer: {
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#F1F5F9',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
        },
        historyEmoji: {
            fontSize: 20,
        },
        historyContent: {
            flex: 1,
        },
        historyTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: '#1E293B',
            marginBottom: 4,
        },
        historySubtitle: {
            fontSize: 13,
            color: '#64748B',
            marginBottom: 8,
        },
        historyTime: {
            fontSize: 12,
            color: '#94A3B8',
            fontWeight: '500',
        },
        emptyHistoryText: {
            fontSize: 14,
            color: '#64748B',
            textAlign: 'center',
            paddingVertical: 24,
        },
        modalContainer: {
            flex: 1,
            backgroundColor: theme.pageBackground,
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            paddingTop: Platform.OS === 'android' ? 40 : 20,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
            backgroundColor: theme.surface,
        },
        modalTitle: {
            fontSize: 20,
            fontWeight: '700',
            color: theme.heading,
        },
        closeButtonText: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.primary,
        },
        listContainer: {
            padding: 24,
            paddingBottom: 40,
        },
        addButton: {
            backgroundColor: theme.primary,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 24,
        },
        addButtonText: {
            color: theme.onPrimary,
            fontWeight: '700',
            fontSize: 15,
        },
        errorText: {
            color: theme.error,
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 20,
        },
        emptyState: {
            alignItems: 'center',
            paddingVertical: 48,
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
        card: {
            backgroundColor: theme.cardBackground,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 2,
        },
        cardContent: {
            flex: 1,
        },
        typeBadge: {
            alignSelf: 'flex-start',
            backgroundColor: theme.primarySoft,
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 3,
            marginBottom: 8,
        },
        typeBadgeText: {
            fontSize: 12,
            fontWeight: '700',
            color: theme.primaryText,
        },
        cardCoords: {
            fontSize: 14,
            color: theme.body,
            fontFamily: 'monospace',
            marginBottom: 4,
        },
        cardRadius: {
            fontSize: 13,
            color: theme.textMuted,
        },
        deleteIcon: {
            padding: 8,
        },
        deleteIconText: {
            fontSize: 18,
        },
    });
}
