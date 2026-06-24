import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useGeofenceListViewModel } from '@/viewmodels/useGeofenceViewModels';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import MapView, {
    Circle,
    Marker,
    PROVIDER_GOOGLE,
    type Region,
} from 'react-native-maps';

// ── Types ─────────────────────────────────────────────────────────
type NominatimResult = {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
};

// ── Debounce hook ─────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

// ── Zone type options ─────────────────────────────────────────────
const ZONE_TYPES = ['Home', 'Hospital', 'School', 'Work', 'Other'] as const;

// ── Helper: compute lat/lon delta that neatly frames the radius ───
function regionForRadius(lat: number, lon: number, radiusM: number): Region {
    const r = Math.max(radiusM, 200);
    const latDelta = (r * 4) / 111_000;
    return {
        latitude: lat,
        longitude: lon,
        latitudeDelta: latDelta,
        longitudeDelta: latDelta * 1.4,
    };
}

// ─────────────────────────────────────────────────────────────────
export default function GeofenceCreateScreen() {
    const patientId = useCurrentPatientId() ?? undefined;
    const router = useRouter();
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    const {
        createGeofence,
        isCreating: isUpdating, // alias to match UI
        createError: updateError,
        clearCreateError: clearUpdateError,
    } = useGeofenceListViewModel(patientId);

    // ── Form state ────────────────────────────────────────────────
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [radius, setRadius] = useState('');
    const [zoneType, setZoneType] = useState('Home');
    const [typePickerOpen, setTypePickerOpen] = useState(false);

    // ── Location search state ─────────────────────────────────────
    const [locationQuery, setLocationQuery] = useState('');
    const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const searchAbortRef = useRef<AbortController | null>(null);
    const mapRef = useRef<MapView>(null);
    const debouncedQuery = useDebounce(locationQuery, 500);

    // ── Derived map coordinate ────────────────────────────────────
    const mapLat = parseFloat(latitude);
    const mapLon = parseFloat(longitude);
    const mapRadius = parseInt(radius, 10);
    const hasValidCoord = !isNaN(mapLat) && !isNaN(mapLon);
    const hasValidRadius = !isNaN(mapRadius) && mapRadius > 0;

    // ── Animate map whenever valid lat/lon change ─────────────────
    useEffect(() => {
        if (!hasValidCoord || !mapRef.current) return;
        mapRef.current.animateToRegion(
            regionForRadius(mapLat, mapLon, hasValidRadius ? mapRadius : 300),
            600
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latitude, longitude, radius]);

    // ── Nominatim autocomplete ────────────────────────────────────
    useEffect(() => {
        if (debouncedQuery.trim().length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        searchAbortRef.current?.abort();
        const controller = new AbortController();
        searchAbortRef.current = controller;
        setIsFetchingSuggestions(true);
        fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedQuery)}&format=json&limit=5&addressdetails=0`,
            {
                signal: controller.signal,
                headers: { 'Accept-Language': 'en', 'User-Agent': 'RecallAR/1.0' },
            }
        )
            .then(r => r.json())
            .then((data: NominatimResult[]) => {
                setSuggestions(data);
                setShowSuggestions(data.length > 0);
            })
            .catch(err => { if (err.name !== 'AbortError') setSuggestions([]); })
            .finally(() => setIsFetchingSuggestions(false));
        return () => controller.abort();
    }, [debouncedQuery]);

    const handleSelectSuggestion = useCallback((item: NominatimResult) => {
        const lat = parseFloat(item.lat).toFixed(6);
        const lon = parseFloat(item.lon).toFixed(6);
        setLatitude(lat);
        setLongitude(lon);
        setLocationQuery(item.display_name.split(',')[0]);
        setSuggestions([]);
        setShowSuggestions(false);
        mapRef.current?.animateToRegion(
            regionForRadius(parseFloat(item.lat), parseFloat(item.lon), mapRadius || 300),
            800
        );
    }, [mapRadius]);

    // ── Tap / drag on map → update coords ────────────────────────
    const handleMapPress = useCallback((lat: number, lon: number) => {
        setLatitude(lat.toFixed(6));
        setLongitude(lon.toFixed(6));
        setLocationQuery('');
    }, []);

    // ── GPS — patient's current location ─────────────────────────
    const handleUseCurrentLocation = async () => {
        setIsFetchingLocation(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Location permission is required. Please enable it in Settings.'
                );
                return;
            }
            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            const lat = loc.coords.latitude.toFixed(6);
            const lon = loc.coords.longitude.toFixed(6);
            setLatitude(lat);
            setLongitude(lon);
            setLocationQuery('Current Location');
            setSuggestions([]);
            setShowSuggestions(false);
            mapRef.current?.animateToRegion(
                regionForRadius(loc.coords.latitude, loc.coords.longitude, mapRadius || 300),
                800
            );
        } catch {
            Alert.alert('Error', 'Unable to fetch current location. Please try again.');
        } finally {
            setIsFetchingLocation(false);
        }
    };

    // ── Save ──────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!hasValidCoord) {
            Alert.alert('Validation', 'Please enter valid latitude and longitude.');
            return;
        }
        if (!hasValidRadius) {
            Alert.alert('Validation', 'Please enter a valid radius greater than 0.');
            return;
        }
        if (!patientId) {
             Alert.alert('Error', 'Patient ID is missing.');
             return;
        }
        
        const ok = await createGeofence({
            patientId,
            centerLatitude: mapLat,
            centerLongitude: mapLon,
            radiusMeters: mapRadius,
            geofenceType: zoneType,
        });
        
        if (ok) {
            Alert.alert('Saved', 'Safe zone created successfully.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        }
    };

    // ── Initial map region ────────────────────────────────────────
    const initialRegion = { latitude: 3.139, longitude: 101.6869, latitudeDelta: 0.05, longitudeDelta: 0.07 };

    return (
        <View style={styles.root}>
            {/* ── Top header bar ──────────────────────────────── */}
            <View style={styles.header}>
                <Pressable style={styles.headerBack} onPress={() => router.back()}>
                    <Text style={styles.headerBackText}>← Back</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Configure Safe Zone</Text>
                <Pressable
                    style={[styles.saveBtn, isUpdating && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={isUpdating}
                >
                    {isUpdating
                        ? <ActivityIndicator size="small" color={theme.onPrimary} />
                        : <Text style={styles.saveBtnText}>Save</Text>
                    }
                </Pressable>
            </View>

            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
            >
                {/* ── Update error banner ─────────────────────── */}
                {updateError && (
                    <Pressable style={styles.errorBanner} onPress={clearUpdateError}>
                        <Text style={styles.errorBannerText}>
                            ⚠ {updateError}  (tap to dismiss)
                        </Text>
                    </Pressable>
                )}

                {/* ══ SECTION: Geofence Area ═══════════════════ */}
                <Text style={styles.sectionTitle}>Geofence Area</Text>

                {/* Address search row */}
                <Text style={styles.fieldLabel}>Set by Address</Text>
                <View style={styles.searchRow}>
                    <View style={styles.searchInputWrapper}>
                        <TextInput
                            id="create-location-search"
                            style={styles.searchInput}
                            value={locationQuery}
                            onChangeText={text => {
                                setLocationQuery(text);
                                if (text.trim().length < 3) setShowSuggestions(false);
                            }}
                            placeholder="Enter home address..."
                            placeholderTextColor={theme.textFaint}
                            autoCorrect={false}
                            autoCapitalize="none"
                            returnKeyType="search"
                        />
                        {isFetchingSuggestions && (
                            <ActivityIndicator
                                style={styles.searchSpinner}
                                size="small"
                                color={theme.primary}
                            />
                        )}
                    </View>
                    <Pressable
                        style={styles.searchBtn}
                        onPress={() => setLocationQuery(q => q.trimEnd() + ' ')}
                    >
                        <Text style={styles.searchBtnText}>Search</Text>
                    </Pressable>
                </View>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <View style={styles.suggestionBox}>
                        {suggestions.map(item => (
                            <Pressable
                                key={item.place_id}
                                style={({ pressed }) => [
                                    styles.suggestionItem,
                                    pressed && styles.suggestionItemPressed,
                                ]}
                                onPress={() => handleSelectSuggestion(item)}
                            >
                                <Text style={styles.suggestionText} numberOfLines={2}>
                                    {item.display_name}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* ── MapView ──────────────────────────────────── */}
                <View style={styles.mapContainer}>
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                        initialRegion={initialRegion}
                        onPress={e =>
                            handleMapPress(
                                e.nativeEvent.coordinate.latitude,
                                e.nativeEvent.coordinate.longitude
                            )
                        }
                        showsUserLocation
                        showsCompass
                        showsScale
                    >
                        {hasValidCoord && (
                            <>
                                <Marker
                                    coordinate={{ latitude: mapLat, longitude: mapLon }}
                                    draggable
                                    onDragEnd={e =>
                                        handleMapPress(
                                            e.nativeEvent.coordinate.latitude,
                                            e.nativeEvent.coordinate.longitude
                                        )
                                    }
                                    pinColor={theme.primary}
                                />
                                {hasValidRadius && (
                                    <Circle
                                        center={{ latitude: mapLat, longitude: mapLon }}
                                        radius={mapRadius}
                                        strokeColor={theme.primary}
                                        strokeWidth={2}
                                        fillColor="rgba(37, 99, 235, 0.12)"
                                    />
                                )}
                            </>
                        )}
                    </MapView>
                    <View style={styles.mapHint}>
                        <Text style={styles.mapHintText}>
                            Tap or drag the pin to reposition
                        </Text>
                    </View>
                </View>

                {/* Lat / Lng row */}
                <View style={styles.row}>
                    <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Latitude</Text>
                        <TextInput
                            id="create-latitude"
                            style={styles.input}
                            value={latitude}
                            onChangeText={setLatitude}
                            keyboardType="decimal-pad"
                            placeholder="e.g. 3.1390"
                            placeholderTextColor={theme.textFaint}
                        />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                        <Text style={styles.fieldLabel}>Longitude</Text>
                        <TextInput
                            id="create-longitude"
                            style={styles.input}
                            value={longitude}
                            onChangeText={setLongitude}
                            keyboardType="decimal-pad"
                            placeholder="e.g. 101.6869"
                            placeholderTextColor={theme.textFaint}
                        />
                    </View>
                </View>

                {/* Current location button */}
                <Pressable
                    style={({ pressed }) => [
                        styles.locationBtn,
                        pressed && styles.locationBtnPressed,
                        isFetchingLocation && styles.locationBtnDisabled,
                    ]}
                    onPress={handleUseCurrentLocation}
                    disabled={isFetchingLocation}
                >
                    {isFetchingLocation
                        ? <ActivityIndicator size="small" color={theme.primary} />
                        : <Text style={styles.locationBtnText}>
                            📍  Set to Patient's Current Location
                          </Text>
                    }
                </Pressable>

                {/* ══ SECTION: Safe Radius ════════════════════ */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                    Safe Radius (meters)
                </Text>
                <TextInput
                    id="create-radius"
                    style={styles.input}
                    value={radius}
                    onChangeText={setRadius}
                    keyboardType="number-pad"
                    placeholder="e.g. 200"
                    placeholderTextColor={theme.textFaint}
                />
                <Text style={styles.helperText}>
                    The area patient can move within safely.
                </Text>

                {/* ══ SECTION: Safe Zone Type ════════════════ */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
                    Safe Zone Type
                </Text>
                <Pressable
                    style={styles.typeSelector}
                    onPress={() => setTypePickerOpen(o => !o)}
                >
                    <Text style={styles.typeSelectorText}>{zoneType}</Text>
                    <Text style={styles.typeSelectorChevron}>
                        {typePickerOpen ? '▲' : '▼'}
                    </Text>
                </Pressable>
                {typePickerOpen && (
                    <View style={styles.typeDropdown}>
                        {ZONE_TYPES.map(t => (
                            <Pressable
                                key={t}
                                style={({ pressed }) => [
                                    styles.typeOption,
                                    t === zoneType && styles.typeOptionSelected,
                                    pressed && styles.typeOptionPressed,
                                ]}
                                onPress={() => {
                                    setZoneType(t);
                                    setTypePickerOpen(false);
                                }}
                            >
                                <Text style={[
                                    styles.typeOptionText,
                                    t === zoneType && styles.typeOptionTextSelected,
                                ]}>
                                    {t}
                                </Text>
                                {t === zoneType && (
                                    <Text style={styles.typeOptionCheck}>✓</Text>
                                )}
                            </Pressable>
                        ))}
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────
function createStyles(theme: Theme) {
    return StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: theme.pageBackground,
        },
        // ── Header ──────────────────────────────────────────────
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 56,
            paddingBottom: 12,
            paddingHorizontal: 16,
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        headerBack: {
            paddingVertical: 6,
            paddingRight: 12,
            minWidth: 64,
        },
        headerBackText: {
            fontSize: 15,
            color: theme.primary,
            fontWeight: '500',
        },
        headerTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.heading,
            flex: 1,
            textAlign: 'center',
        },
        saveBtn: {
            backgroundColor: theme.primary,
            paddingHorizontal: 18,
            paddingVertical: 8,
            borderRadius: 8,
            minWidth: 64,
            alignItems: 'center',
        },
        saveBtnDisabled: {
            backgroundColor: theme.primaryDisabled,
        },
        saveBtnText: {
            color: theme.onPrimary,
            fontWeight: '700',
            fontSize: 14,
        },

        // ── Scroll ──────────────────────────────────────────────
        scroll: {
            padding: 20,
        },

        // ── Error banner ─────────────────────────────────────────
        errorBanner: {
            backgroundColor: theme.errorBackground,
            borderWidth: 1,
            borderColor: theme.errorBorder,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
        },
        errorBannerText: { color: theme.error, fontSize: 13 },

        // ── Section / field labels ──────────────────────────────
        sectionTitle: {
            fontSize: 16,
            fontWeight: '700',
            color: theme.heading,
            marginBottom: 10,
        },
        fieldLabel: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.label,
            marginBottom: 6,
        },
        helperText: {
            fontSize: 12,
            color: theme.textMuted,
            marginTop: 5,
            marginBottom: 4,
        },

        // ── Address search ──────────────────────────────────────
        searchRow: {
            flexDirection: 'row',
            gap: 8,
            marginBottom: 4,
        },
        searchInputWrapper: {
            flex: 1,
            position: 'relative',
            justifyContent: 'center',
        },
        searchInput: {
            borderWidth: 1,
            borderColor: theme.borderStrong,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 14,
            color: theme.body,
            backgroundColor: theme.surface,
            paddingRight: 36,
        },
        searchSpinner: {
            position: 'absolute',
            right: 10,
        },
        searchBtn: {
            backgroundColor: theme.primary,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 8,
            justifyContent: 'center',
        },
        searchBtnText: {
            color: theme.onPrimary,
            fontWeight: '600',
            fontSize: 14,
        },

        // ── Suggestions ─────────────────────────────────────────
        suggestionBox: {
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            backgroundColor: theme.surface,
            marginBottom: 10,
            overflow: 'hidden',
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
        },
        suggestionItem: {
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        suggestionItemPressed: { backgroundColor: theme.primarySoft },
        suggestionText: {
            fontSize: 13,
            color: theme.body,
            lineHeight: 18,
        },

        // ── MapView ─────────────────────────────────────────────
        mapContainer: {
            borderRadius: 12,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.border,
            marginBottom: 14,
        },
        map: {
            width: '100%',
            height: 220,
        },
        mapHint: {
            backgroundColor: theme.cardBackground,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            alignItems: 'center',
        },
        mapHintText: {
            fontSize: 12,
            color: theme.textMuted,
            fontStyle: 'italic',
        },

        // ── Inputs ──────────────────────────────────────────────
        row: {
            flexDirection: 'row',
            gap: 12,
        },
        field: { marginBottom: 12 },
        input: {
            borderWidth: 1,
            borderColor: theme.borderStrong,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            color: theme.body,
            backgroundColor: theme.surface,
            marginBottom: 12,
        },

        // ── Current location button ─────────────────────────────
        locationBtn: {
            borderWidth: 1.5,
            borderColor: theme.primary,
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: 'center',
            marginBottom: 4,
            backgroundColor: theme.primaryMuted,
        },
        locationBtnPressed: { backgroundColor: theme.primarySoft },
        locationBtnDisabled: { opacity: 0.6 },
        locationBtnText: {
            color: theme.primary,
            fontWeight: '600',
            fontSize: 14,
        },

        // ── Zone type picker ────────────────────────────────────
        typeSelector: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.borderStrong,
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: theme.surface,
        },
        typeSelectorText: { fontSize: 15, color: theme.body },
        typeSelectorChevron: { fontSize: 11, color: theme.textMuted },
        typeDropdown: {
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            backgroundColor: theme.surface,
            marginTop: 4,
            overflow: 'hidden',
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
        },
        typeOption: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 13,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
        },
        typeOptionSelected: { backgroundColor: theme.primarySoft },
        typeOptionPressed: { backgroundColor: theme.primaryMuted },
        typeOptionText: { fontSize: 14, color: theme.body },
        typeOptionTextSelected: {
            color: theme.primaryText,
            fontWeight: '600',
        },
        typeOptionCheck: {
            fontSize: 14,
            color: theme.primary,
            fontWeight: '700',
        },
    });
}
