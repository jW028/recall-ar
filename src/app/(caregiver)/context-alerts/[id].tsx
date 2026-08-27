import { Button } from '@/components/common/Button';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { checkIsAlertExpired, formatDisplayDateTime, type ContextAlertFrequency, type ContextAlertType } from '@/models/ContextAlert';
import { isObject } from '@/models/MemoryAsset';
import { useCurrentPatientId } from '@/store/currentPatientStore';
import { useContextAlertViewModel } from '@/viewmodels/useContextAlertViewModel';
import { useMemoryAssetListViewModel } from '@/viewmodels/useMemoryAssetViewModel';
import { Ionicons } from '@expo/vector-icons';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

let DateTimePickerComponent: any = null;
try {
    DateTimePickerComponent = require('@react-native-community/datetimepicker').default || require('@react-native-community/datetimepicker');
} catch {
    DateTimePickerComponent = null;
}
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function ContextAlertDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const patientId = useCurrentPatientId() ?? undefined;
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();

    const {
        alerts,
        isLoading,
        updateAlert,
        deleteAlert,
        acknowledgeAlert,
    } = useContextAlertViewModel(patientId);

    const { assets } = useMemoryAssetListViewModel(patientId);
    const objectAssets = useMemo(() => assets.filter(isObject), [assets]);

    const alert = useMemo(
        () => alerts.find((a) => a.ctxAlertId === id),
        [alerts, id]
    );

    const targetAsset = useMemo(
        () => (alert?.assetId ? assets.find((a) => a.assetId === alert.assetId) : null),
        [assets, alert]
    );

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [modalView, setModalView] = useState<'form' | 'select-object'>('form');
    const [objectSearch, setObjectSearch] = useState('');

    const [msg, setMsg] = useState('');
    const [desc, setDesc] = useState('');
    const [alertType, setAlertType] = useState<ContextAlertType>('Reminder');
    const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
    const [scheduledDateTime, setScheduledDateTime] = useState<Date>(new Date());
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

    const openEditModal = () => {
        if (!alert) return;
        setMsg(alert.ctxAlertMsg);
        setDesc(alert.ctxAlertDesc || '');
        setAlertType(alert.ctxAlertType || 'Reminder');
        setSelectedAssetId(alert.assetId ?? null);
        const parsed = alert.ctxAlertTime ? new Date(alert.ctxAlertTime) : new Date();
        setScheduledDateTime(isNaN(parsed.getTime()) ? new Date() : parsed);
        setFrequency(alert.frequency || 'Daily');
        setHasSchedule(Boolean(alert.ctxAlertTime));
        setModalView('form');
        setIsEditModalOpen(true);
    };

    const handleUpdateAlert = async () => {
        if (!id || !msg.trim()) {
            Alert.alert('Required field', 'Please enter a reminder title/message.');
            return;
        }

        setIsSubmitting(true);
        const success = await updateAlert(id, {
            ctxAlertMsg: msg.trim(),
            ctxAlertDesc: desc.trim() || null,
            ctxAlertType: alertType,
            ctxAlertTime: hasSchedule ? scheduledDateTime.toISOString() : null,
            assetId: selectedAssetId,
            frequency: hasSchedule ? frequency : null,
        });

        setIsSubmitting(false);

        if (success) {
            setIsEditModalOpen(false);
        } else {
            Alert.alert('Error', 'Failed to update contextual alert. Please try again.');
        }
    };

    const handleDeleteAlert = () => {
        if (!id) return;
        Alert.alert(
            'Delete Reminder',
            'Are you sure you want to delete this contextual alert? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await deleteAlert(id);
                        if (success) {
                            router.back();
                        } else {
                            Alert.alert('Error', 'Failed to delete contextual alert.');
                        }
                    },
                },
            ]
        );
    };

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

    const selectedAssetInModal = useMemo(
        () => objectAssets.find((a) => a.assetId === selectedAssetId) ?? null,
        [objectAssets, selectedAssetId]
    );

    if (isLoading && !alert) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (!alert) {
        return (
            <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
                <View style={styles.headerBar}>
                    <Pressable onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={8}>
                        <Ionicons name="arrow-back" size={24} color={theme.heading} />
                    </Pressable>
                    <Text style={styles.headerTitle}>Reminder Details</Text>
                    <View style={{ width: 36 }} />
                </View>
                <View style={styles.emptyState}>
                    <Ionicons name="alert-circle-outline" size={56} color={theme.textMuted} />
                    <Text style={styles.emptyTitle}>Reminder Not Found</Text>
                    <Text style={styles.emptySubtitle}>
                        This contextual alert may have been deleted or is no longer available.
                    </Text>
                </View>
            </View>
        );
    }

    const typeConfig = ALERT_TYPES.find((t) => t.type === (alert.ctxAlertType || 'Reminder')) || ALERT_TYPES[0];
    const isDismissed = alert.ctxAlertStatus === 'Dismissed';
    const isAcknowledged = alert.ackStatus === 'Acknowledged';
    const isExpired = checkIsAlertExpired(alert.ctxAlertTime, alert.ackStatus);
    const isTriggered = alert.ctxAlertStatus === 'Triggered';

    const toggleAlertStatus = async () => {
        if (!id || !alert) return;
        const newStatus = isDismissed ? 'Active' : 'Dismissed';
        await updateAlert(id, {
            ctxAlertStatus: newStatus,
            ...(newStatus === 'Active' ? { ackStatus: 'Unacknowledged', ackTime: null } : {}),
        });
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
            {/* Header Bar */}
            <View style={styles.headerBar}>
                <Pressable onPress={() => router.back()} style={styles.headerBackBtn} hitSlop={8}>
                    <Ionicons name="arrow-back" size={24} color={theme.heading} />
                </Pressable>
                <Text style={styles.headerTitle}>Reminder Details</Text>
                <Pressable onPress={handleDeleteAlert} style={styles.headerDeleteBtn} hitSlop={8}>
                    <Ionicons name="trash-outline" size={22} color={theme.error} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Hero / Banner Card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroHeaderRow}>
                        {/* Type Icon Badge */}
                        <View
                            style={[
                                styles.typeBadge,
                                { backgroundColor: typeConfig.color + (isDismissed ? '0A' : '15') },
                            ]}
                        >
                            <Ionicons
                                name={typeConfig.icon}
                                size={16}
                                color={isDismissed ? theme.textMuted : typeConfig.color}
                            />
                            <Text
                                style={[
                                    styles.typeBadgeText,
                                    { color: isDismissed ? theme.textMuted : typeConfig.color },
                                ]}
                            >
                                {typeConfig.label}
                            </Text>
                        </View>

                        {/* Status Badge & Toggle Switch */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            {isDismissed ? (
                                <View style={styles.expiredBadge}>
                                    <Text style={styles.expiredBadgeText}>Deactivated</Text>
                                </View>
                            ) : isAcknowledged ? (
                                <View style={styles.doneBadge}>
                                    <Text style={styles.doneBadgeText}>✓ Done</Text>
                                </View>
                            ) : isExpired ? (
                                <View style={styles.expiredBadge}>
                                    <Text style={styles.expiredBadgeText}>Expired</Text>
                                </View>
                            ) : isTriggered ? (
                                <View style={styles.triggeredBadge}>
                                    <Text style={styles.triggeredBadgeText}>Triggered</Text>
                                </View>
                            ) : (
                                <View style={styles.activeBadge}>
                                    <Text style={styles.activeBadgeText}>Active</Text>
                                </View>
                            )}

                            <Switch
                                value={!isDismissed}
                                onValueChange={toggleAlertStatus}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor={Platform.OS === 'android' ? (!isDismissed ? '#FFFFFF' : '#F4F3F4') : undefined}
                            />
                        </View>
                    </View>

                    <Text style={[styles.heroTitle, isDismissed && { color: theme.textMuted }]}>
                        {alert.ctxAlertMsg}
                    </Text>
                    {alert.ctxAlertDesc ? (
                        <Text style={styles.heroDesc}>{alert.ctxAlertDesc}</Text>
                    ) : null}
                </View>

                {/* Section 1: Schedule & Object Config */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionHeaderTitle}>Schedule & Trigger</Text>

                    <View style={styles.infoRow}>
                        <View style={styles.infoIconBox}>
                            <Ionicons name="time-outline" size={20} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoLabel}>Scheduled Time</Text>
                            <Text style={styles.infoVal}>
                                {alert.ctxAlertTime ? formatDisplayDateTime(alert.ctxAlertTime) : 'Anytime (No scheduled time constraint)'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <View style={styles.infoIconBox}>
                            <Ionicons name="repeat-outline" size={20} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoLabel}>Frequency</Text>
                            <Text style={styles.infoVal}>
                                {alert.ctxAlertTime && alert.frequency ? alert.frequency : 'None (Anytime)'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <View style={styles.infoIconBox}>
                            <Ionicons name="cube-outline" size={20} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoLabel}>Target Object</Text>
                            <Text style={styles.infoVal}>
                                {targetAsset ? targetAsset.name : 'No Object (Optional / Any Object)'}
                            </Text>
                            {targetAsset && isObject(targetAsset) && targetAsset.category ? (
                                <Text style={styles.infoSub}>{targetAsset.category}</Text>
                            ) : null}
                        </View>
                        {targetAsset?.imageUrl && (
                            <Image source={{ uri: targetAsset.imageUrl }} style={styles.assetThumb} />
                        )}
                    </View>
                </View>

                {/* Section 2: Acknowledgement Status */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionHeaderTitle}>Acknowledgement Status</Text>
                    <View style={styles.infoRow}>
                        <View style={styles.infoIconBox}>
                            <Ionicons
                                name={isAcknowledged ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                                size={20}
                                color={isAcknowledged ? theme.success || '#10B981' : theme.error}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoLabel}>Status</Text>
                            <Text style={styles.infoVal}>
                                {isAcknowledged
                                    ? 'Acknowledged'
                                    : isExpired
                                    ? 'Expired (Time passed)'
                                    : isTriggered
                                    ? 'Triggered (Awaiting acknowledgment)'
                                    : 'Active (Scheduled)'}
                            </Text>

                            {alert.ackTime ? (
                                <Text style={styles.infoSub}>Acknowledged at: {alert.ackTime}</Text>
                            ) : null}
                        </View>
                    </View>

                    {!isAcknowledged && (isTriggered || isExpired) && (
                        <Pressable
                            style={styles.ackActionBtn}
                            onPress={() => acknowledgeAlert(alert.ctxAlertId)}
                        >
                            <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                            <Text style={styles.ackActionBtnText}>Mark as Acknowledged</Text>
                        </Pressable>
                    )}
                </View>

                {/* Section 3: Action Buttons (Edit & Delete) */}
                <View style={styles.actionSection}>
                    <Pressable style={styles.editBtn} onPress={openEditModal}>
                        <Ionicons name="pencil-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.editBtnText}>Edit Reminder</Text>
                    </Pressable>

                    <Pressable style={styles.deleteBtn} onPress={handleDeleteAlert}>
                        <Ionicons name="trash-outline" size={18} color={theme.error} />
                        <Text style={styles.deleteBtnText}>Delete Reminder</Text>
                    </Pressable>
                </View>
            </ScrollView>

            {/* Modal for Edit */}
            <Modal
                visible={isEditModalOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsEditModalOpen(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {modalView === 'form' ? (
                            <View style={{ flex: 1 }}>
                                {/* Modal Header */}
                                <View style={styles.modalHeader}>
                                    <View style={styles.headerSpacer} />
                                    <Text style={styles.modalTitle}>Edit Contextual Reminder</Text>
                                    <Pressable onPress={() => setIsEditModalOpen(false)} hitSlop={8}>
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
                                            {selectedAssetInModal?.imageUrl ? (
                                                <Image
                                                    source={{ uri: selectedAssetInModal.imageUrl }}
                                                    style={styles.objectThumb}
                                                />
                                            ) : (
                                                <View style={styles.objectIconPlaceholder}>
                                                    <Ionicons
                                                        name={selectedAssetInModal ? 'cube-outline' : 'globe-outline'}
                                                        size={22}
                                                        color={theme.primary}
                                                    />
                                                </View>
                                            )}
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.objectSelectorName}>
                                                    {selectedAssetInModal ? selectedAssetInModal.name : 'No Object (Optional)'}
                                                </Text>
                                                <Text style={styles.objectSelectorSub}>
                                                    {selectedAssetInModal
                                                        ? selectedAssetInModal.category || 'Memory Object'
                                                        : 'Triggers based on time or any object'}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.selectObjectBtn}>
                            <Text style={styles.selectObjectBtnText}>
                                                {selectedAssetInModal ? 'Change' : 'Select'}
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
                                        label={isSubmitting ? 'Updating...' : 'Update Reminder'}
                                        onPress={handleUpdateAlert}
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
        headerDeleteBtn: {
            padding: 4,
            width: 36,
            alignItems: 'flex-end',
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '800',
            color: theme.heading,
            textAlign: 'center',
            flex: 1,
        },

        scrollContent: {
            paddingBottom: 36,
            gap: 16,
        },

        /* Hero Card */
        heroCard: {
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
        },
        heroHeaderRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        typeBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 8,
        },
        typeBadgeText: {
            fontSize: 13,
            fontWeight: '700',
        },
        doneBadge: {
            backgroundColor: '#E6F4EA',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 12,
        },
        doneBadgeText: {
            color: '#137333',
            fontSize: 12,
            fontWeight: '700',
        },
        expiredBadge: {
            backgroundColor: '#FEE2E2',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 12,
        },
        expiredBadgeText: {
            color: '#DC2626',
            fontSize: 12,
            fontWeight: '700',
        },
        triggeredBadge: {
            backgroundColor: '#FEF3C7',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 12,
        },
        triggeredBadgeText: {
            color: '#B45309',
            fontSize: 12,
            fontWeight: '700',
        },
        activeBadge: {
            backgroundColor: '#E0F2FE',
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: 12,
        },
        activeBadgeText: {
            color: '#0284C7',
            fontSize: 12,
            fontWeight: '700',
        },
        heroTitle: {
            fontSize: 20,
            fontWeight: '800',
            color: theme.heading,
            lineHeight: 26,
        },
        heroDesc: {
            fontSize: 14,
            color: theme.bodySecondary,
            lineHeight: 20,
        },

        /* Section Card */
        sectionCard: {
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.border,
            gap: 12,
        },
        sectionHeaderTitle: {
            fontSize: 15,
            fontWeight: '800',
            color: theme.heading,
            marginBottom: 2,
        },
        infoRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        infoIconBox: {
            width: 38,
            height: 38,
            borderRadius: 10,
            backgroundColor: theme.surface,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.border,
        },
        infoLabel: {
            fontSize: 12,
            color: theme.textMuted,
            fontWeight: '600',
        },
        infoVal: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.heading,
            marginTop: 1,
        },
        infoSub: {
            fontSize: 12,
            color: theme.bodySecondary,
            marginTop: 1,
        },
        assetThumb: {
            width: 44,
            height: 44,
            borderRadius: 8,
            backgroundColor: theme.surface,
        },
        divider: {
            height: 1,
            backgroundColor: theme.border,
        },
        ackActionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.success || '#10B981',
            paddingVertical: 10,
            borderRadius: 10,
            marginTop: 4,
        },
        ackActionBtnText: {
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: 14,
        },

        /* Action Section */
        actionSection: {
            gap: 10,
            marginTop: 8,
        },
        editBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.primary,
            paddingVertical: 14,
            borderRadius: 12,
        },
        editBtnText: {
            color: '#FFFFFF',
            fontWeight: '800',
            fontSize: 15,
        },
        deleteBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.error + '40',
            paddingVertical: 14,
            borderRadius: 12,
        },
        deleteBtnText: {
            color: theme.error,
            fontWeight: '800',
            fontSize: 15,
        },

        emptyState: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 32,
            marginTop: 60,
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
