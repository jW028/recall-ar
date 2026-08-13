import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

// Small one-shot star burst shown on a correct reveal. Mounting plays it once; ~600ms, no loop, deliberately subtle.
// Under Reduce Motion the stars still appear — the reward is the point; only the movement is dropped.
export function CorrectCelebration() {
    const theme = useTheme();
    const reduceMotion = useReducedMotion();
    const scale = useSharedValue(reduceMotion ? 1 : 0);
    const opacity = useSharedValue(reduceMotion ? 1 : 0);
    const sideOpacity = useSharedValue(reduceMotion ? 1 : 0);

    useEffect(() => {
        if (reduceMotion) return;
        opacity.value = withTiming(1, { duration: 150 });
        scale.value = withSequence(withSpring(1.15, { damping: 12 }), withTiming(1, { duration: 150 }));
        sideOpacity.value = withDelay(200, withTiming(1, { duration: 250 }));
    }, [opacity, scale, sideOpacity, reduceMotion]);

    const mainStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));
    const sideStyle = useAnimatedStyle(() => ({
        opacity: sideOpacity.value,
    }));

    return (
        <View style={styles.row}>
            <Animated.View style={sideStyle}>
                <Ionicons name="star" size={16} color={theme.warning} />
            </Animated.View>
            <Animated.View style={mainStyle}>
                <Ionicons name="star" size={32} color={theme.warning} />
            </Animated.View>
            <Animated.View style={sideStyle}>
                <Ionicons name="star" size={16} color={theme.warning} />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
});
