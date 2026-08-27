import { Button } from '@/components/common/Button';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkIsAlertExpired, formatDisplayDateTime, type ContextAlert, type ContextAlertFrequency, type ContextAlertType } from '@/models/ContextAlert';
import { isObject } from '@/models/MemoryAsset';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useContextAlertViewModel } from '@/viewmodels/useContextAlertViewModel';
import { useMemoryAssetListViewModel } from '@/viewmodels/useMemoryAssetViewModel';
import { Ionicons } from '@expo/vector-icons';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let DateTimePickerComponent: any = null;
try {
    DateTimePickerComponent = require('@react-native-community/datetimepicker').default || require('@react-native-community/datetimepicker');
} catch {
    DateTimePickerComponent = null;
}

// Helpers for 12h <-> 24h conversion and Date/Time display
function parse24to12(time24: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
    const match = (time24 || '08:00').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return { hour12: 8, minute: 0, period: 'AM' };
    const h24 = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const hour12 = h24 % 12 || 12;
    return { hour12, minute: m, period };
}

function formatDisplayTime(time24: string): string {
    const { hour12, minute, period } = parse24to12(time24);
    const hStr = String(hour12).padStart(2, '0');
    const mStr = String(minute).padStart(2, '0');
    return `${hStr}:${mStr} ${period}`;
}

function formatDisplayDate(d: Date): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDisplayTimeFromDate(d: Date): string {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const hStr = String(hours).padStart(2, '0');
    return `${hStr}:${minutes} ${period}`;
}

const ALERT_TYPES: { type: ContextAlertType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
    { type: 'Reminder', label: 'Reminder', icon: 'notifications-outline', color: '#2563EB' },
    { type: 'Medication', label: 'Medication', icon: 'medkit-outline', color: '#10B981' },
    { type: 'Safety', label: 'Safety', icon: 'shield-checkmark-outline', color: '#F59E0B' },
    { type: 'Object', label: 'Object', icon: 'cube-outline', color: '#8B5CF6' },
];

export default function ContextAlertsDashboardScreen() {
    const patientId = useCurrentPatientId() ?? undefined;
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();

    const {
        alerts,
        isLoading,
        error,
        refresh,
        createAlert,
        updateAlert,
        acknowledgeAlert,
    } = useContextAlertViewModel(patientId);

    const toggleAlertStatus = async (item: ContextAlert) => {
        const isCurrentlyActive = item.ctxAlertStatus !== 'Dismissed';
        const newStatus = isCurrentlyActive ? 'Dismissed' : 'Active';
        await updateAlert(item.ctxAlertId, {
            ctxAlertStatus: newStatus,
            ...(newStatus === 'Active' ? { ackStatus: 'Unacknowledged', ackTime: null } : {}),
        });
    };

    const { assets } = useMemoryAssetListViewModel(patientId);
    const objectAssets = useMemo(() => assets.filter(isObject), [assets]);

    // Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [modalView, setModalView] = useState<'form' | 'select-object'>('form');
    const [objectSearch, setObjectSearch] = useState('');

    // Form Field States
    const [msg, setMsg] = useState('');
    const [desc, setDesc] = useState('');
    const [alertType, setAlertType] = useState<ContextAlertType>('Reminder');
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [scheduledDateTime, setScheduledDateTime] = useState<Date>(() => {
        const d = new Date();
        d.setHours(8, 0, 0, 0);
        return d;
    });
    const [frequency, setFrequency] = useState<ContextAlertFrequency>('Daily');
    const [hasSchedule, setHasSchedule] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Native DateTimePicker state
    const [showNativeDatePicker, setShowNativeDatePicker] = useState(false);
    const [showNativeTimePicker, setShowNativeTimePicker] = useState(false);

    const handleOpenDatePicker = () => {
        if (!DateTimePickerComponent) {
            Alert.alert(
                'Rebuild Required',
                'The native DateTimePicker module (RNCDatePicker) is not included in your current dev build binary. Please rebuild your app by running "npx expo run:android" or "npx expo run:ios".'
            );
            return;
        }
        setShowNativeDatePicker(true);
    };

    const handleOpenTimePicker = () => {
        if (!DateTimePickerComponent) {
            Alert.alert(
                'Rebuild Required',
                'The native DateTimePicker module (RNCDatePicker) is not included in your current dev build binary. Please rebuild your app by running "npx expo run:android" or "npx expo run:ios".'
            );
            return;
        }
        setShowNativeTimePicker(true);
    };

    const handleNativeDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowNativeDatePicker(false);
        }
        if (selectedDate && event.type !== 'dismissed') {
            setScheduledDateTime((prev) => {
                const updated = new Date(prev);
                updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                return updated;
            });
        }
    };

    const handleNativeTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowNativeTimePicker(false);
        }
        if (selectedDate && event.type !== 'dismissed') {
            setScheduledDateTime((prev) => {
                const updated = new Date(prev);
                updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                return updated;
            });
        }
    };

    // Active alerts for today include both ongoing (upcoming) and expired unacknowledged alerts
    const todayActiveAlertsCount = useMemo(
        () => alerts.filter((a) => a.ctxAlertStatus !== 'Dismissed' && a.ackStatus !== 'Acknowledged').length,
        [alerts]
    );

    // Group alerts into sections matching reference mockup
    const upcomingAlerts = useMemo(
        () => alerts.filter((a) => a.ctxAlertStatus === 'Active' && (!a.ctxAlertTime || !checkIsAlertExpired(a.ctxAlertTime, a.ackStatus))),
        [alerts]
    );

    const earlierAlerts = useMemo(
        () => alerts.filter((a) => (a.ctxAlertStatus === 'Triggered' || a.ackStatus === 'Acknowledged' || (a.ctxAlertTime && checkIsAlertExpired(a.ctxAlertTime, a.ackStatus))) && a.ctxAlertStatus !== 'Dismissed'),
        [alerts]
    );

    const otherAlerts = useMemo(
        () => alerts.filter((a) => a.ctxAlertStatus === 'Dismissed'),
        [alerts]
    );

    const openCreateModal = () => {
        setMsg('');
        setDesc('');
        setAlertType('Reminder');
        setSelectedAssetId(null);
        const d = new Date();
        d.setHours(8, 0, 0, 0);
        setScheduledDateTime(d);
        setFrequency('Daily');
        setHasSchedule(false);
        setModalView('form');
        setIsAddModalOpen(true);
    };

    const handleSaveAlert = async () => {
        if (!msg.trim()) {
            Alert.alert('Required field', 'Please enter a reminder title/message.');
            return;
        }

        setIsSubmitting(true);
        const success = await createAlert({
            ctxAlertMsg: msg.trim(),
            ctxAlertDesc: desc.trim() || null,
            ctxAlertType: alertType,
            ctxAlertTime: hasSchedule ? scheduledDateTime.toISOString() : null,
            assetId: selectedAssetId,
            frequency: hasSchedule ? frequency : null,
        });

        setIsSubmitting(false);

        if (success) {
            setIsAddModalOpen(false);
            setMsg('');
            setDesc('');
            setAlertType('Reminder');
            setSelectedAssetId(null);
            const d = new Date();
            d.setHours(8, 0, 0, 0);
            setScheduledDateTime(d);
            setFrequency('Daily');
            setHasSchedule(false);
        } else {
            Alert.alert('Error', 'Failed to create contextual alert. Please try again.');
        }
    };

    const selectedAsset = useMemo(
        () => objectAssets.find((a) => a.assetId === selectedAssetId) ?? null,
        [objectAssets, selectedAssetId]
    );

    const filteredObjects = useMemo(() => {
        if (!objectSearch.trim()) return objectAssets;
        const q = objectSearch.toLowerCase().trim();
        return objectAssets.filter(
            (a) =>
                a.name.toLowerCase().includes(q) ||
                (a.category && a.category.toLowerCase().includes(q)) ||
                (a.notes && a.notes.toLowerCase().includes(q))
        );
    }, [objectAssets, objectSearch]);

    const renderAlertCard = (item: ContextAlert) => {
        const targetAsset = assets.find((a) => a.assetId === item.assetId);
        const isDismissed = item.ctxAlertStatus === 'Dismissed';
        const isAcknowledged = item.ackStatus === 'Acknowledged';
        const isExpired = checkIsAlertExpired(item.ctxAlertTime, item.ackStatus);
        const isTriggered = item.ctxAlertStatus === 'Triggered';
        const typeConfig = ALERT_TYPES.find((t) => t.type === (item.ctxAlertType || 'Reminder')) || ALERT_TYPES[0];

        return (
            <Pressable
                key={item.ctxAlertId}
                style={[
                    styles.card,
                    isDismissed && styles.cardDismissed,
                    !isDismissed && isAcknowledged && styles.cardAcknowledged,
                ]}
                onPress={() => router.push(`/(caregiver)/context-alerts/${item.ctxAlertId}` as any)}
            >
                {/* Left Circular Icon Box */}
                <View
                    style={[
                        styles.cardIconBox,
                        { backgroundColor: typeConfig.color + (isDismissed ? '0A' : '15') },
                    ]}
                >
                    <Ionicons
                        name={typeConfig.icon}
                        size={20}
                        color={isDismissed ? theme.textMuted : typeConfig.color}
                    />
                </View>

                {/* Middle Info */}
                <View style={styles.cardMainContent}>
                    <Text
                        style={[styles.cardTitle, isDismissed && styles.cardTitleDismissed]}
                        numberOfLines={1}
                    >
                        {item.ctxAlertMsg}
                    </Text>

                    <View style={styles.cardSubRow}>
                        {/* Category Chip Badge */}
                        <View
                            style={[
                                styles.typeChipBadge,
                                { backgroundColor: typeConfig.color + (isDismissed ? '0A' : '15') },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.cardTypeChipText,
                                    { color: isDismissed ? theme.textMuted : typeConfig.color },
                                ]}
                            >
                                {typeConfig.label}
                            </Text>
                        </View>

                        {/* Status Badge (Done / Expired / Triggered) next to Alert Type */}
                        {!isDismissed && isAcknowledged && (
                            <View style={styles.doneBadge}>
                                <Text style={styles.doneBadgeText}>✓ Done</Text>
                            </View>
                        )}
                        {!isDismissed && !isAcknowledged && isExpired && (
                            <Pressable
                                style={styles.expiredBadge}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    acknowledgeAlert(item.ctxAlertId);
                                }}
                            >
                                <Text style={styles.expiredBadgeText}>Expired</Text>
                            </Pressable>
                        )}
                        {!isDismissed && !isAcknowledged && isTriggered && (
                            <Pressable
                                style={styles.triggeredBadge}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    acknowledgeAlert(item.ctxAlertId);
                                }}
                            >
                                <Text style={styles.triggeredBadgeText}>Triggered</Text>
                            </Pressable>
                        )}

                        {/* Scheduled Time Tag */}
                        <View style={styles.timeTag}>
                            <Ionicons name="alarm-outline" size={13} color={theme.textMuted} />
                            <Text style={styles.timeTagText}>{formatDisplayDateTime(item.ctxAlertTime)}</Text>
                        </View>

                        {/* Associated Target Object Tag */}
                        {targetAsset && (
                            <View style={styles.assetTag}>
                                <Ionicons name="cube-outline" size={12} color={theme.textMuted} />
                                <Text style={styles.assetTagText} numberOfLines={1}>
                                    {targetAsset.name}
                                </Text>
                            </View>
                        )}
                    </View>

                    {item.ctxAlertDesc ? (
                        <Text style={styles.cardDescText} numberOfLines={2}>
                            {item.ctxAlertDesc}
                        </Text>
                    ) : null}
                </View>

                {/* Right On/Off Switch & Forward Arrow */}
                <View style={styles.cardRightActions}>
                    {/* On/Off Switch */}
                    <Pressable
                        hitSlop={8}
                        onPress={(e) => {
                            e.stopPropagation();
                        }}
                    >
                        <Switch
                            value={!isDismissed}
                            onValueChange={() => toggleAlertStatus(item)}
                            trackColor={{ false: theme.border, true: theme.primary }}
                            thumbColor={Platform.OS === 'android' ? (!isDismissed ? '#FFFFFF' : '#F4F3F4') : undefined}
                            style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] } : undefined}
                        />
                    </Pressable>

                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </View>
            </Pressable>
        );
    };

    if (isLoading && alerts.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
            {/* Header Bar */}
            <View style={styles.headerBar}>
                <Pressable
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                        } else {
                            router.replace('/(caregiver)/home');
                        }
                    }}
                    style={styles.headerBackBtn}
                    hitSlop={8}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.heading} />
                </Pressable>
                <Text style={styles.headerTitle}>My Contextual Alert</Text>
                <Pressable style={styles.headerAddBtn} onPress={openCreateModal}>
                    <Text style={styles.headerAddBtnText}>+ Add</Text>
                </Pressable>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Top Summary Banner Card ("TODAY 5 Alerts") */}
                <View style={styles.summaryBanner}>
                    <Text style={styles.summaryBannerCaption}>TODAY</Text>
                    <Text style={styles.summaryBannerTitle}>
                        {todayActiveAlertsCount} {todayActiveAlertsCount === 1 ? 'Alert' : 'Alerts'}
                    </Text>
                </View>

                {/* Section 1: Upcoming */}
                {upcomingAlerts.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionHeaderTitle}>Upcoming</Text>
                        {upcomingAlerts.map(renderAlertCard)}
                    </View>
                )}

                {/* Section 2: Earlier Today */}
                {earlierAlerts.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionHeaderTitle}>Earlier Today</Text>
                        {earlierAlerts.map(renderAlertCard)}
                    </View>
                )}

                {/* Section 3: Deactivated Reminders */}
                {otherAlerts.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionHeaderTitle}>Deactivated Reminders</Text>
                        {otherAlerts.map(renderAlertCard)}
                    </View>
                )}

                {/* Empty State */}
                {alerts.length === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={56} color={theme.textMuted} />
                        <Text style={styles.emptyTitle}>No contextual alerts</Text>
                        <Text style={styles.emptySubtitle}>
                            Tap "+ Add" to create reminders that trigger when target objects are detected at scheduled times.
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Modal for Create */}
            <Modal
                visible={isAddModalOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsAddModalOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {modalView === 'form' ? (
                            <View style={{ flex: 1 }}>
                                {/* Modal Header */}
                                <View style={styles.modalHeader}>
                                    <View style={styles.headerSpacer} />
                                    <Text style={styles.modalTitle}>New Contextual Reminder</Text>
                                    <Pressable onPress={() => setIsAddModalOpen(false)} hitSlop={8}>
                                        <Ionicons name="close" size={24} color={theme.heading} />
                                    </Pressable>
                                </View>

                                <ScrollView
                                    contentContainerStyle={styles.formContainer}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {/* Alert Type Selector */}
                                    <Text style={styles.inputLabel}>Alert Category / Type</Text>
                                    <View style={styles.typeSelectorRow}>
                                        {ALERT_TYPES.map((t) => {
                                            const isSelected = alertType === t.type;
                                            return (
                                                <Pressable
                                                    key={t.type}
                                                    style={[
                                                        styles.typeChip,
                                                        isSelected && {
                                                            backgroundColor: t.color,
                                                            borderColor: t.color,
                                                        },
                                                    ]}
                                                    onPress={() => setAlertType(t.type)}
                                                >
                                                    <Ionicons
                                                        name={t.icon}
                                                        size={14}
                                                        color={isSelected ? '#FFFFFF' : t.color}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.modalTypeChipText,
                                                            isSelected && styles.typeChipTextSelected,
                                                        ]}
                                                    >
                                                        {t.label}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>

                                    <Text style={styles.inputLabel}>Reminder Title / Message</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="e.g. Take morning blood pressure pill"
                                        placeholderTextColor={theme.textMuted}
                                        value={msg}
                                        onChangeText={setMsg}
                                    />

                                    <Text style={styles.inputLabel}>Description / Notes (Optional)</Text>
                                    <TextInput
                                        style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]}
                                        placeholder="e.g. Take 1 pill with warm water after breakfast."
                                        placeholderTextColor={theme.textMuted}
                                        multiline
                                        value={desc}
                                        onChangeText={setDesc}
                                    />

                                    {/* Target Object Selector Card */}
                                    <Text style={styles.inputLabel}>Target Object (Optional)</Text>
                                    <Text style={styles.inputHint}>
                                        Select an object to trigger this reminder when detected by camera, or leave as Any Object.
                                    </Text>

                                    <Pressable
                                        style={styles.objectSelectorCard}
                                        onPress={() => setModalView('select-object')}
                                    >
                                        <View style={styles.objectSelectorLeft}>
                                            {selectedAsset?.imageUrl ? (
                                                <Image
                                                    source={{ uri: selectedAsset.imageUrl }}
                                                    style={styles.objectThumb}
                                                />
                                            ) : (
                                                <View style={styles.objectIconPlaceholder}>
                                                    <Ionicons
                                                        name={selectedAsset ? 'cube-outline' : 'globe-outline'}
                                                        size={22}
                                                        color={theme.primary}
                                                    />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.objectSelectorName}>
                                                    {selectedAsset ? selectedAsset.name : 'No Object (Optional)'}
                                                </Text>
                                                <Text style={styles.objectSelectorSub}>
                                                    {selectedAsset
                                                        ? selectedAsset.category || 'Memory Object'
                                                        : 'Triggers based on time or any object'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.selectObjectBtn}>
                                            <Text style={styles.selectObjectBtnText}>
                                                {selectedAsset ? 'Change' : 'Select'}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                                        </View>
                                    </Pressable>

                                    {/* Scheduled Date, Time & Frequency Toggle Card */}
                                    <View style={styles.scheduleSwitchCard}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.scheduleSwitchLabel}>Set Scheduled Time & Frequency</Text>
                                            <Text style={styles.scheduleSwitchHint}>
                                                {hasSchedule
                                                    ? 'Reminder will trigger at the selected date, time & frequency.'
                                                    : 'Optional: When off, reminder triggers anytime target object is detected.'}
                                            </Text>
                                        </View>
                                        <Switch
                                            value={hasSchedule}
                                            onValueChange={setHasSchedule}
                                            trackColor={{ false: theme.border, true: theme.primary }}
                                            thumbColor={Platform.OS === 'android' ? (hasSchedule ? '#FFFFFF' : '#F4F3F4') : undefined}
                                        />
                                    </View>

                                    {hasSchedule && (
                                        <>
                                            {/* Scheduled Date & Time Fields */}
                                            <Text style={styles.inputLabel}>Scheduled Date & Time</Text>
                                            <Text style={styles.inputHint}>
                                                Tap date or time field to select using native picker.
                                            </Text>

                                            <View style={{ flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                                                <Pressable
                                                    style={[styles.timeInputField, { flex: 1.2 }]}
                                                    onPress={handleOpenDatePicker}
                                                >
                                                    <View style={styles.timeInputTextGroup}>
                                                        <Ionicons name="calendar-outline" size={20} color={theme.primary} />
                                                        <Text style={styles.timeInputValText}>
                                                            {formatDisplayDate(scheduledDateTime)}
                                                        </Text>
                                                    </View>
                                                </Pressable>

                                                <Pressable
                                                    style={[styles.timeInputField, { flex: 1 }]}
                                                    onPress={handleOpenTimePicker}
                                                >
                                                    <View style={styles.timeInputTextGroup}>
                                                        <Ionicons name="alarm-outline" size={20} color={theme.primary} />
                                                        <Text style={styles.timeInputValText}>
                                                            {formatDisplayTimeFromDate(scheduledDateTime)}
                                                        </Text>
                                                    </View>
                                                    <View style={styles.clockIconBadge}>
                                                        <Ionicons name="time" size={22} color={theme.primary} />
                                                    </View>
                                                </Pressable>
                                            </View>

                                            {/* Native DateTimePicker Dialogs */}
                                            {showNativeDatePicker && DateTimePickerComponent && (
                                                <DateTimePickerComponent
                                                    value={scheduledDateTime}
                                                    mode="date"
                                                    display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                                                    onChange={handleNativeDateChange}
                                                />
                                            )}

                                            {showNativeTimePicker && DateTimePickerComponent && (
                                                <DateTimePickerComponent
                                                    value={scheduledDateTime}
                                                    mode="time"
                                                    is24Hour={false}
                                                    display={Platform.OS === 'android' ? 'clock' : 'spinner'}
                                                    onChange={handleNativeTimeChange}
                                                />
                                            )}

                                            <Text style={styles.inputLabel}>Frequency</Text>
                                            <View style={styles.freqRow}>
                                                {(['Once', 'Daily', 'Weekly'] as ContextAlertFrequency[]).map((f) => (
                                                    <Pressable
                                                        key={f}
                                                        style={[styles.freqOption, frequency === f && styles.freqOptionSelected]}
                                                        onPress={() => setFrequency(f)}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.freqOptionText,
                                                                frequency === f && styles.freqOptionTextSelected,
                                                            ]}
                                                        >
                                                            {f}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        </>
                                    )}
                                </ScrollView>

                                {/* Fixed Bottom Action Button */}
                                <View style={styles.fixedBottomButtonContainer}>
                                    <Button
                                        label={isSubmitting ? 'Saving...' : 'Save Contextual Alert'}
                                        onPress={handleSaveAlert}
                                        disabled={isSubmitting}
                                    />
                                </View>
                            </View>
                        ) : (
                            /* Dedicated Object Selector View/Tab */
                            <View style={{ flex: 1 }}>
                                <View style={styles.modalHeader}>
                                    <Pressable
                                        onPress={() => setModalView('form')}
                                        style={styles.modalBackBtn}
                                        hitSlop={8}
                                    >
                                        <Ionicons name="arrow-back" size={22} color={theme.heading} />
                                    </Pressable>
                                    <Text style={styles.modalTitle}>Select Object</Text>
                                    <View style={styles.headerSpacer} />
                                </View>

                                <Text style={styles.inputHint}>
                                    Choose an enrolled memory object to associate with this reminder, or choose "No Object".
                                </Text>

                                {/* Object Search Bar */}
                                <View style={styles.searchBox}>
                                    <Ionicons name="search" size={18} color={theme.textMuted} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search memory objects..."
                                        placeholderTextColor={theme.textMuted}
                                        value={objectSearch}
                                        onChangeText={setObjectSearch}
                                    />
                                    {objectSearch.length > 0 && (
                                        <Pressable onPress={() => setObjectSearch('')}>
                                            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                                        </Pressable>
                                    )}
                                </View>

                                <ScrollView
                                    contentContainerStyle={styles.objectListContent}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {/* Option 1: No Object / Optional */}
                                    <Pressable
                                        style={[
                                            styles.objectListItem,
                                            selectedAssetId === null && styles.objectListItemSelected,
                                        ]}
                                        onPress={() => {
                                            setSelectedAssetId(null);
                                            setModalView('form');
                                        }}
                                    >
                                        <View style={styles.objectIconPlaceholder}>
                                            <Ionicons name="globe-outline" size={24} color={theme.primary} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.objectItemTitle}>No Object (Optional)</Text>
                                            <Text style={styles.objectItemSub}>
                                                Reminder activates for scheduled time or any object
                                            </Text>
                                        </View>
                                        {selectedAssetId === null && (
                                            <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                        )}
                                    </Pressable>

                                    {/* Enrolled Objects List */}
                                    {filteredObjects.length === 0 ? (
                                        <View style={styles.emptyObjectSearch}>
                                            <Text style={styles.emptyObjectSearchText}>
                                                {objectAssets.length === 0
                                                    ? 'No memory objects enrolled yet. You can enroll objects from the Memories tab.'
                                                    : 'No objects match your search.'}
                                            </Text>
                                        </View>
                                    ) : (
                                        filteredObjects.map((asset) => {
                                            const isSelected = selectedAssetId === asset.assetId;
                                            return (
                                                <Pressable
                                                    key={asset.assetId}
                                                    style={[
                                                        styles.objectListItem,
                                                        isSelected && styles.objectListItemSelected,
                                                    ]}
                                                    onPress={() => {
                                                        setSelectedAssetId(asset.assetId);
                                                        setModalView('form');
                                                    }}
                                                >
                                                    {asset.imageUrl ? (
                                                        <Image
                                                            source={{ uri: asset.imageUrl }}
                                                            style={styles.objectThumbLarge}
                                                        />
                                                    ) : (
                                                        <View style={styles.objectIconPlaceholder}>
                                                            <Ionicons name="cube-outline" size={24} color={theme.primary} />
                                                        </View>
                                                    )}
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.objectItemTitle}>{asset.name}</Text>
                                                        <Text style={styles.objectItemSub}>
                                                            {asset.category || asset.notes || 'Memory Object'}
                                                        </Text>
                                                    </View>
                                                    {isSelected && (
                                                        <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                                                    )}
                                                </Pressable>
                                            );
                                        })
                                    )}
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.pageBackground,
            paddingHorizontal: 20,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.pageBackground,
        },

        /* Header Bar */
        headerBar: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
        },
        headerBackBtn: {
            padding: 4,
            width: 36,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '800',
            color: theme.heading,
            textAlign: 'center',
            flex: 1,
        },
        headerAddBtn: {
            backgroundColor: theme.primary + '18',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 16,
        },
        headerAddBtnText: {
            color: theme.primary,
            fontSize: 13,
            fontWeight: '800',
        },

        scrollContent: {
            paddingBottom: 32,
            gap: 16,
        },

        /* Top Summary Banner Card ("TODAY 5 Alerts") */
        summaryBanner: {
            backgroundColor: theme.primary,
            borderRadius: 16,
            paddingVertical: 20,
            paddingHorizontal: 24,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 4,
        },
        summaryBannerCaption: {
            color: 'rgba(255, 255, 255, 0.85)',
            fontSize: 12,
            fontWeight: '800',
            letterSpacing: 1.2,
            marginBottom: 4,
        },
        summaryBannerTitle: {
            color: '#FFFFFF',
            fontSize: 26,
            fontWeight: '900',
            letterSpacing: 0.3,
        },

        /* Section Containers & Headers */
        sectionContainer: {
            gap: 10,
        },
        sectionHeaderTitle: {
            fontSize: 16,
            fontWeight: '800',
            color: theme.heading,
            marginBottom: 2,
        },

        /* Alert Card Layout */
        card: {
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderWidth: 1,
            borderColor: theme.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 3,
            elevation: 1,
        },
        cardAcknowledged: {
            opacity: 0.6,
        },
        cardDismissed: {
            opacity: 0.55,
            backgroundColor: theme.cardBackground,
        },
        cardIconBox: {
            width: 44,
            height: 44,
            borderRadius: 22,
            justifyContent: 'center',
            alignItems: 'center',
        },
        cardMainContent: {
            flex: 1,
            gap: 4,
        },
        cardTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.heading,
        },
        cardTitleDismissed: {
            color: theme.textMuted,
        },
        cardSubRow: {
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
        },
        typeChipBadge: {
            paddingVertical: 2,
            paddingHorizontal: 8,
            borderRadius: 6,
        },
        cardTypeChipText: {
            fontSize: 11,
            fontWeight: '700',
        },
        timeTag: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        timeTagText: {
            fontSize: 12,
            color: theme.textMuted,
            fontWeight: '600',
        },
        assetTag: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            maxWidth: 100,
        },
        assetTagText: {
            fontSize: 11,
            color: theme.textMuted,
            fontWeight: '500',
        },
        cardDescText: {
            fontSize: 12,
            color: theme.textMuted,
            marginTop: 2,
        },
        cardRightActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        doneBadge: {
            backgroundColor: '#E6F4EA',
            paddingVertical: 2,
            paddingHorizontal: 8,
            borderRadius: 6,
        },
        doneBadgeText: {
            color: '#137333',
            fontSize: 11,
            fontWeight: '700',
        },
        expiredBadge: {
            backgroundColor: '#FEE2E2',
            paddingVertical: 2,
            paddingHorizontal: 8,
            borderRadius: 6,
        },
        expiredBadgeText: {
            color: '#DC2626',
            fontSize: 11,
            fontWeight: '700',
        },
        triggeredBadge: {
            backgroundColor: '#FEF3C7',
            paddingVertical: 2,
            paddingHorizontal: 8,
            borderRadius: 6,
        },
        triggeredBadgeText: {
            color: '#B45309',
            fontSize: 11,
            fontWeight: '700',
        },

        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
            marginTop: 40,
        },
        emptyTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: theme.heading,
            marginTop: 12,
            marginBottom: 6,
        },
        emptySubtitle: {
            fontSize: 14,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 20,
        },
        errorText: {
            color: theme.error,
            fontSize: 14,
            marginBottom: 12,
        },

        /* Modal Styles */
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
        },
        modalContent: {
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            maxHeight: '90%',
            minHeight: 540,
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '800',
            color: theme.heading,
            textAlign: 'center',
            flex: 1,
        },
        modalBackBtn: {
            width: 28,
            alignItems: 'flex-start',
            justifyContent: 'center',
        },
        headerSpacer: {
            width: 28,
        },
        formContainer: {
            gap: 12,
            paddingBottom: 16,
        },
        fixedBottomButtonContainer: {
            paddingTop: 12,
            paddingBottom: 4,
            backgroundColor: theme.surface,
        },
        inputLabel: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.heading,
            marginTop: 4,
        },
        inputHint: {
            fontSize: 12,
            color: theme.textMuted,
            marginTop: -6,
            marginBottom: 8,
        },
        scheduleSwitchCard: {
            backgroundColor: theme.pageBackground,
            borderRadius: 12,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: theme.border,
            marginTop: 8,
            marginBottom: 12,
            gap: 12,
        },
        scheduleSwitchLabel: {
            fontSize: 14,
            fontWeight: '700',
            color: theme.heading,
            marginBottom: 2,
        },
        scheduleSwitchHint: {
            fontSize: 11,
            color: theme.textMuted,
            lineHeight: 15,
        },
        typeSelectorRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        typeChip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: theme.pageBackground,
            borderWidth: 1,
            borderColor: theme.border,
        },
        modalTypeChipText: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.heading,
        },
        typeChipTextSelected: {
            color: '#FFFFFF',
        },
        textInput: {
            backgroundColor: theme.pageBackground,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            padding: 12,
            fontSize: 15,
            color: theme.heading,
        },
        objectSelectorCard: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.pageBackground,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 12,
            marginBottom: 4,
        },
        objectSelectorLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            flex: 1,
        },
        objectThumb: {
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: theme.surface,
        },
        objectThumbLarge: {
            width: 46,
            height: 46,
            borderRadius: 8,
            backgroundColor: theme.surface,
        },
        objectIconPlaceholder: {
            width: 40,
            height: 40,
            borderRadius: 8,
            backgroundColor: theme.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
        },
        objectSelectorName: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.heading,
        },
        objectSelectorSub: {
            fontSize: 12,
            color: theme.textMuted,
        },
        selectObjectBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingLeft: 8,
        },
        selectObjectBtnText: {
            fontSize: 13,
            fontWeight: '700',
            color: theme.primary,
        },

        /* Compact Time Input Field with Clock Icon */
        timeInputField: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.pageBackground,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 14,
        },
        timeInputTextGroup: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
        },
        timeInputValText: {
            fontSize: 17,
            fontWeight: '800',
            color: theme.heading,
        },
        clockIconBadge: {
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            padding: 6,
        },

        freqRow: {
            flexDirection: 'row',
            gap: 8,
        },
        freqOption: {
            flex: 1,
            backgroundColor: theme.pageBackground,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            paddingVertical: 10,
            alignItems: 'center',
        },
        freqOptionSelected: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
        },
        freqOptionText: {
            fontSize: 13,
            fontWeight: '600',
            color: theme.body,
        },
        freqOptionTextSelected: {
            color: '#FFFFFF',
        },
        searchBox: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.pageBackground,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            gap: 8,
            marginVertical: 12,
        },
        searchInput: {
            flex: 1,
            fontSize: 14,
            color: theme.heading,
        },
        objectListContent: {
            paddingBottom: 24,
            gap: 8,
        },
        objectListItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: theme.pageBackground,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 12,
        },
        objectListItemSelected: {
            borderColor: theme.primary,
            backgroundColor: theme.surface,
        },
        objectItemTitle: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.heading,
        },
        objectItemSub: {
            fontSize: 12,
            color: theme.textMuted,
        },
        emptyObjectSearch: {
            padding: 24,
            alignItems: 'center',
        },
        emptyObjectSearchText: {
            fontSize: 13,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 18,
        },
    });
}
