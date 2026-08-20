import { Button } from '@/components/common/Button';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SessionSummary } from '@/models/TrainingSession';
import { completeFeedback } from '@/utils/feedback';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

interface Props {
    summary: SessionSummary;
    streakDays?: number;
    onDone: () => void;
    onBrowseAlbum?: () => void;
    // Offered only when graduated memories exist to practise. Absent means there is nothing to offer.
    onPractice?: () => void;
}

// How long the whole count takes, regardless of how many memories there are to count.
const COUNT_UP_MS = 700;
const STAGGER_MS = 140;

// Ticks a number up from zero. The count is the reward, so it is the one thing on this screen that
// takes its time — but it is capped so a long session does not make the patient wait.
function useCountUp(target: number, animate: boolean): number {
    const [value, setValue] = useState(animate ? 0 : target);

    useEffect(() => {
        if (!animate || target <= 0) {
            setValue(target);
            return;
        }
        let current = 0;
        const stepMs = Math.max(60, Math.min(140, COUNT_UP_MS / target));
        const id = setInterval(() => {
            current += 1;
            setValue(current);
            if (current >= target) clearInterval(id);
        }, stepMs);
        return () => clearInterval(id);
    }, [target, animate]);

    return value;
}

// Fades a line in behind the ones above it, so the summary assembles rather than appearing at once.
function Staggered({
    delay,
    animate,
    children,
}: {
    delay: number;
    animate: boolean;
    children: React.ReactNode;
}) {
    const opacity = useSharedValue(animate ? 0 : 1);
    const translateY = useSharedValue(animate ? 8 : 0);

    useEffect(() => {
        if (!animate) return;
        opacity.value = withDelay(delay, withTiming(1, { duration: 280 }));
        translateY.value = withDelay(delay, withTiming(0, { duration: 280 }));
    }, [delay, animate, opacity, translateY]);

    const style = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return <Animated.View style={style}>{children}</Animated.View>;
}

// End-of-session celebration. Counts only positives — there is no wrong-answer tally anywhere on this screen.
export function SessionSummaryView({ summary, streakDays, onDone, onBrowseAlbum, onPractice }: Props) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const reduceMotion = useReducedMotion();
    const animate = !reduceMotion;

    const counted = useCountUp(summary.correct, animate);
    const badgeScale = useSharedValue(animate ? 0.6 : 1);

    useEffect(() => {
        completeFeedback();
        if (!animate) return;
        badgeScale.value = withSequence(
            withSpring(1.08, { damping: 11 }),
            withTiming(1, { duration: 160 })
        );
    }, [animate, badgeScale]);

    const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

    const rememberedLine =
        summary.correct > 0
            ? `You remembered ${counted} ${counted === 1 ? 'memory' : 'memories'} today`
            : `You practiced ${summary.answered} ${summary.answered === 1 ? 'memory' : 'memories'} today — every review helps.`;

    // This view cannot scroll, so the mastered list is capped instead of being allowed to push the Done button off screen
    const masteredCount = summary.masteredNames.length;
    const masteredLine =
        masteredCount === 0
            ? null
            : masteredCount === 1
                ? `${summary.masteredNames[0]} is now a memory you know well!`
                : masteredCount <= 3
                    ? `${summary.masteredNames.slice(0, -1).join(', ')} and ${summary.masteredNames[masteredCount - 1]} are now memories you know well!`
                    : `${summary.masteredNames.slice(0, 3).join(', ')} and ${masteredCount - 3} more are now memories you know well!`;

    return (
        <View style={styles.centered}>
            <Animated.View style={[styles.iconBadge, badgeStyle]}>
                <Ionicons name="star" size={44} color={theme.warning} />
            </Animated.View>
            <Staggered delay={0} animate={animate}>
                <Text style={styles.title}>Great work today</Text>
            </Staggered>
            <Staggered delay={STAGGER_MS} animate={animate}>
                <Text style={styles.message} numberOfLines={2}>{rememberedLine}</Text>
            </Staggered>
            {masteredLine && (
                <Staggered delay={STAGGER_MS * 2} animate={animate}>
                    <Text style={styles.mastered} numberOfLines={3}>
                        {masteredLine}
                    </Text>
                </Staggered>
            )}
            {streakDays !== undefined && streakDays >= 1 && (
                <Staggered delay={STAGGER_MS * 3} animate={animate}>
                    <Text style={styles.streak} numberOfLines={1}>
                        That&apos;s {streakDays} {streakDays === 1 ? 'day' : 'days'} in a row
                    </Text>
                </Staggered>
            )}
            {onBrowseAlbum && summary.masteredNames.length > 0 && (
                <Pressable
                    onPress={onBrowseAlbum}
                    hitSlop={8}
                    accessibilityRole="button"
                >
                    <Text style={styles.albumLink}>See it in your album</Text>
                </Pressable>
            )}
            <Button label="Done" size="lg" onPress={onDone} style={styles.done} />
            {/* Secondary by design: the session is finished, and more practice is an offer, not a task */}
            {onPractice && (
                <Pressable onPress={onPractice} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.albumLink}>Practice a few more</Text>
                </Pressable>
            )}
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.surface,
            paddingHorizontal: 32,
            gap: 16,
        },
        iconBadge: {
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: theme.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
        },
        title: {
            fontSize: 28,
            fontWeight: '800',
            color: theme.body,
            textAlign: 'center',
        },
        message: {
            fontSize: 18,
            color: theme.body,
            textAlign: 'center',
            lineHeight: 26,
            flexShrink: 1,
        },
        mastered: {
            fontSize: 16,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 24,
            flexShrink: 1,
        },
        streak: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.primaryText,
            textAlign: 'center',
        },
        albumLink: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.primary,
        },
        done: {
            marginTop: 8,
        },
    });
}
