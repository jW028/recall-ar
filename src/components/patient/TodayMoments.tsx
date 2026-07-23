import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RecognitionMoment } from '@/services/EngagementService';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const MAX_SHOWN = 3;

// Today's AR recognition moments. Renders nothing when there are none — never an empty prompt.
export function TodayMoments({ moments }: { moments: RecognitionMoment[] }) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    if (moments.length === 0) return null;

    const shown = moments.slice(0, MAX_SHOWN);
    const overflow = moments.length - shown.length;

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Ionicons name="sparkles" size={18} color={theme.primary} />
                <Text style={styles.heading}>Today&apos;s moments</Text>
            </View>
            {shown.map((m) => (
                <Text key={m.assetId} style={styles.moment}>
                    You recognized {m.type === 'Person' ? m.name : m.name.toLowerCase()} today!
                </Text>
            ))}
            {overflow > 0 && (
                <Text style={styles.overflow}>
                    …and {overflow} more {overflow === 1 ? 'memory' : 'memories'}
                </Text>
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        card: {
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            gap: 8,
        },
        headerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        heading: {
            fontSize: 15,
            fontWeight: '700',
            color: theme.heading,
        },
        moment: {
            fontSize: 16,
            color: theme.body,
            lineHeight: 22,
        },
        overflow: {
            fontSize: 14,
            color: theme.textMuted,
        },
    });
}
