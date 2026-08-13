import { CHOICES_ENTRANCE_MS } from '@/constants/config';
import { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

interface Props {
    // Fired once the choices are actually readable. This is the start of the response-latency
    // measurement, so it must be stable across renders and must not fire before the fade completes.
    onVisible: () => void;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

// Fades the answer choices in and reports the moment they become visible.
//
// The latency stamp deliberately hangs off this callback rather than onLayout: onLayout fires when
// layout resolves, which with a fade is before the patient can read anything. Measuring from there
// would inflate every row by the fade duration — a step change in a biomarker whose trend deadband
// is 10ms/day, which would read as decline on the caregiver dashboard.
//
// Mount is per-step: the parent keys this by stepId, so a retry of the same asset remounts and
// re-arms the timer.
export function ChoicesReveal({ onVisible, style, children }: Props) {
    const reduceMotion = useReducedMotion();
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(reduceMotion ? 0 : 10);

    useEffect(() => {
        const duration = reduceMotion ? 0 : CHOICES_ENTRANCE_MS;
        opacity.value = withTiming(1, { duration }, (finished) => {
            'worklet';
            // An interrupted run reports finished=false; let the restarting animation stamp instead.
            if (finished) runOnJS(onVisible)();
        });
        translateY.value = withTiming(0, { duration });

        // Backstop: a dropped worklet callback would leave the attempt with a null latency. This lands
        // a frame or two late at worst, and markRendered's single-stamp guard means first one wins.
        const fallback = setTimeout(onVisible, duration + 40);
        return () => clearTimeout(fallback);
        // Empty deps: this component is remounted per step, so the entrance runs exactly once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Transform and opacity only — neither triggers a layout pass, so nothing here can disturb measurement.
    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ translateY: translateY.value }],
    }));

    return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
