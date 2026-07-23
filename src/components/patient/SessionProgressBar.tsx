import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

// Filled progress bar for the training session. Fill only ever grows — answered questions are never taken back.
export function SessionProgressBar({ current, total }: { current: number; total: number }) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [trackWidth, setTrackWidth] = useState(0);

    const fraction = total > 0 ? Math.min(Math.max(current - 1, 0) / total, 1) : 0;

    const fillStyle = useAnimatedStyle(() => ({
        width: withTiming(trackWidth * fraction, { duration: 350 }),
    }), [trackWidth, fraction]);

    return (
        <View
            style={styles.track}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            accessibilityRole="progressbar"
            accessibilityLabel={`Question ${current} of ${total}`}
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
