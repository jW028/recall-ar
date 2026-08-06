import { Avatar } from '@/components/common/Avatar';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Patient } from '@/models/Patient';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';

// Horizontal padding of the home content container the card sits inside (20 each side)
const PAGE_H_PADDING = 40;

// The pager holds one page per patient plus a trailing page for adding a new one
type Page = { kind: 'patient'; patient: Patient } | { kind: 'add' };

interface CurrentPatientCardProps {
    patients: Patient[];
    currentPatientId: string | null;
    onSelect: (patientId: string) => void;
    onViewEdit: () => void;
    onAddPatient: () => void;
}

// Swipeable primary-colored card: one page per patient with dots; swiping switches the current patient
export function CurrentPatientCard({
    patients,
    currentPatientId,
    onSelect,
    onViewEdit,
    onAddPatient,
}: CurrentPatientCardProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { width } = useWindowDimensions();
    const pageWidth = width - PAGE_H_PADDING;
    const listRef = useRef<FlatList<Page>>(null);

    const pages = useMemo<Page[]>(
        () => [...patients.map((patient) => ({ kind: 'patient' as const, patient })), { kind: 'add' }],
        [patients]
    );

    const currentIndex = useMemo(() => {
        const idx = patients.findIndex((p) => p.patientId === currentPatientId);
        return idx < 0 ? 0 : idx;
    }, [patients, currentPatientId]);

    // Tracks the visible page, which differs from currentIndex while the add page is shown
    const [pageIndex, setPageIndex] = useState(currentIndex);

    // Keep the pager aligned when the current patient changes elsewhere (e.g. the patient list)
    useEffect(() => {
        setPageIndex(currentIndex);
        if (patients.length <= 1) return;
        listRef.current?.scrollToIndex({ index: currentIndex, animated: false });
    }, [currentIndex, patients.length]);

    // Commit the swiped-to patient once the page settles, ignoring the trailing add page
    const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
        setPageIndex(idx);
        const target = pages[idx];
        if (target?.kind === 'patient' && target.patient.patientId !== currentPatientId) {
            onSelect(target.patient.patientId);
        }
    };

    const renderPage = ({ item }: { item: Page }) => {
        if (item.kind === 'add') {
            return (
                <Pressable
                    style={({ pressed }) => [styles.addCard, { width: pageWidth }, pressed && styles.pressed]}
                    onPress={onAddPatient}
                    accessibilityRole="button"
                    accessibilityLabel="Add patient"
                >
                    <View style={styles.addIcon}>
                        <Ionicons name="add" size={26} color={theme.primary} />
                    </View>
                    <Text style={styles.addLabel}>Add patient</Text>
                </Pressable>
            );
        }
        const { patient } = item;
        return (
            <Pressable
                style={({ pressed }) => [styles.card, { width: pageWidth }, pressed && styles.pressed]}
                onPress={onViewEdit}
                accessibilityRole="button"
                accessibilityLabel={`View or edit ${patient.patientName}`}
            >
                <View style={styles.cardTop}>
                    <Avatar imageUrl={patient.imageUrl} name={patient.patientName} size={56} />
                    <View style={styles.cardText}>
                        <Text style={styles.label}>Current Patient</Text>
                        <Text style={styles.name} numberOfLines={1}>{patient.patientName}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.7)" />
                </View>
            </Pressable>
        );
    };

    return (
        <View>
            <FlatList
                ref={listRef}
                data={pages}
                keyExtractor={(page) => (page.kind === 'add' ? 'add-patient' : page.patient.patientId)}
                renderItem={renderPage}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
                initialScrollIndex={currentIndex}
                onMomentumScrollEnd={onMomentumScrollEnd}
                onScrollToIndexFailed={() => {}}
            />
            <View style={styles.dotsRow}>
                {pages.map((page, i) => (
                    <View
                        key={page.kind === 'add' ? 'add-patient' : page.patient.patientId}
                        style={[styles.dot, i === pageIndex && styles.dotActive]}
                        accessibilityLabel={`Page ${i + 1} of ${pages.length}`}
                    />
                ))}
            </View>
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: {
            backgroundColor: theme.primary,
            borderRadius: 20,
            padding: 20,
        },
        addCard: {
            borderRadius: 20,
            padding: 20,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
        },
        addIcon: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: theme.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
        addLabel: {
            color: theme.bodySecondary,
            fontSize: 16,
            fontWeight: '600',
        },
        cardTop: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
        },
        cardText: {
            flex: 1,
        },
        label: {
            color: 'rgba(255,255,255,0.85)',
            fontSize: 14,
            fontWeight: '500',
            marginBottom: 4,
        },
        name: {
            color: theme.onPrimary,
            fontSize: 26,
            fontWeight: '800',
        },
        pressed: {
            opacity: 0.8,
        },
        dotsRow: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            marginTop: 12,
        },
        dot: {
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: theme.border,
        },
        dotActive: {
            backgroundColor: theme.primary,
            width: 20,
        },
    });
}
