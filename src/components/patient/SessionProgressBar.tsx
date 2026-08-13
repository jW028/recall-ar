import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

// Filled progress bar for the training session. Takes an already-monotonic fraction: the viewmodel
// owns "fill only ever grows", because a retry grows the denominator while the reveal is on screen
// and clamping here would stall the bar on exactly the step the patient just missed.
export function SessionProgressBar({ fraction }: { fraction: number }) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [trackWidth, setTrackWidth] = useState(0);

    const clamped = Math.min(Math.max(fraction, 0), 1);

    const fillStyle = useAnimatedStyle(() => ({
        width: withTiming(trackWidth * clamped, { duration: 350 }),
    }), [trackWidth, clamped]);

    return (
        <View
            style={styles.track}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            accessibilityRole="progressbar"
            // Progress, not "question X of Y" — once retries grow the total, a rising denominator
            // would announce to the patient that more work was added because they got one wrong.
            accessibilityLabel="Session progress"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
        >
            <Animated.View style={[styles.fill, fillStyle]} />
        </View>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        track: {
            height: 10,
            borderRadius: 5,
            backgroundColor: theme.backgroundElement,
            overflow: 'hidden',
        },
        fill: {
            height: '100%',
            borderRadius: 5,
            backgroundColor: theme.primary,
        },
    });
}
