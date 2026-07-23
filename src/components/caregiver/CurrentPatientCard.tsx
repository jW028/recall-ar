import { Avatar } from '@/components/common/Avatar';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Patient } from '@/models/Patient';
import { useEffect, useMemo, useRef } from 'react';
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

interface CurrentPatientCardProps {
    patients: Patient[];
    currentPatientId: string | null;
    onSelect: (patientId: string) => void;
    onViewEdit: () => void;
    onChange: () => void;
}

// Swipeable primary-colored card: one page per patient with dots; swiping switches the current patient
export function CurrentPatientCard({
    patients,
    currentPatientId,
    onSelect,
    onViewEdit,
    onChange,
}: CurrentPatientCardProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { width } = useWindowDimensions();
    const pageWidth = width - PAGE_H_PADDING;
    const listRef = useRef<FlatList<Patient>>(null);

    const currentIndex = useMemo(() => {
        const idx = patients.findIndex((p) => p.patientId === currentPatientId);
        return idx < 0 ? 0 : idx;
    }, [patients, currentPatientId]);

    // Keep the pager aligned when the current patient changes elsewhere (e.g. the Change screen)
    useEffect(() => {
        if (patients.length <= 1) return;
        listRef.current?.scrollToIndex({ index: currentIndex, animated: false });
    }, [currentIndex, patients.length]);

    // Commit the swiped-to patient once the page settles
    const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
        const target = patients[idx];
        if (target && target.patientId !== currentPatientId) onSelect(target.patientId);
    };

    const renderPage = ({ item }: { item: Patient }) => (
        <View style={[styles.card, { width: pageWidth }]}>
            <View style={styles.cardTop}>
                <Avatar imageUrl={item.imageUrl} name={item.patientName} size={56} />
                <View style={styles.cardText}>
                    <Text style={styles.label}>Current Patient</Text>
                    <Text style={styles.name} numberOfLines={1}>{item.patientName}</Text>
                </View>
            </View>
            <View style={styles.actions}>
                <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onViewEdit}>
                    <Text style={styles.buttonText}>View/Edit</Text>
                </Pressable>
                <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={onChange}>
                    <Text style={styles.buttonText}>Change</Text>
                </Pressable>
            </View>
        </View>
    );

    return (
        <View>
            <FlatList
                ref={listRef}
                data={patients}
                keyExtractor={(p) => p.patientId}
                renderItem={renderPage}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
                initialScrollIndex={currentIndex}
                onMomentumScrollEnd={onMomentumScrollEnd}
                onScrollToIndexFailed={() => {}}
            />
            {patients.length > 1 && (
                <View style={styles.dotsRow}>
                    {patients.map((p, i) => (
                        <View
                            key={p.patientId}
                            style={[styles.dot, i === currentIndex && styles.dotActive]}
                            accessibilityLabel={`Patient ${i + 1} of ${patients.length}`}
                        />
                    ))}
                </View>
            )}
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
        cardTop: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginBottom: 16,
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
        actions: {
            flexDirection: 'row',
            gap: 12,
        },
        button: {
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 18,
        },
        pressed: {
            opacity: 0.8,
        },
        buttonText: {
            color: theme.onPrimary,
            fontSize: 15,
            fontWeight: '600',
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
