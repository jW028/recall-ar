import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';

// After a reveal the correct answer is softly highlighted and the patient's pick gets a neutral
// outline. There is no wrong state — no red, no X, no "incorrect" framing anywhere in this union.
export type ChoiceState = 'idle' | 'correct' | 'selected' | 'dimmed';

const PRESS_MS = 90;

// How far the button travels when pressed. A transform, never a layout change: the choices block is
// what the response-latency timer is measured against, so nothing here may trigger a layout pass.
const PRESS_TRAVEL = 2;

function usePressDepth() {
    const reduceMotion = useReducedMotion();
    const pressed = useSharedValue(0);

    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: pressed.value * PRESS_TRAVEL }],
    }));

    const onPressIn = () => {
        if (!reduceMotion) pressed.value = withTiming(1, { duration: PRESS_MS });
    };
    const onPressOut = () => {
        if (!reduceMotion) pressed.value = withTiming(0, { duration: PRESS_MS });
    };

    return { style, onPressIn, onPressOut };
}

interface NameProps {
    label: string;
    state: ChoiceState;
    disabled: boolean;
    compact: boolean;
    onPress: () => void;
}

// The photo-to-name direction: a full-width key with a thick bottom edge that presses down on touch.
export function ChoiceButton({ label, state, disabled, compact, onPress }: NameProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
    const depth = usePressDepth();

    return (
        <Animated.View style={depth.style}>
            <Pressable
                style={[styles.choice, stateStyle(styles, state)]}
                onPress={onPress}
                onPressIn={depth.onPressIn}
                onPressOut={depth.onPressOut}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={label}
            >
                <Text style={styles.choiceText} numberOfLines={2}>
                    {label}
                </Text>
            </Pressable>
        </Animated.View>
    );
}

interface PhotoProps {
    imageUrl: string;
    // Announced instead of the name — a screen reader reading the name would give the answer away.
    position: number;
    total: number;
    state: ChoiceState;
    disabled: boolean;
    compact: boolean;
    onPress: () => void;
}

// The name-to-photo direction: a square tile in a grid, same press behaviour and same reveal states.
export function PhotoChoiceButton({
    imageUrl,
    position,
    total,
    state,
    disabled,
    compact,
    onPress,
}: PhotoProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
    const depth = usePressDepth();

    return (
        <Animated.View style={[styles.photoChoiceWrap, depth.style]}>
            <Pressable
                style={[styles.photoChoice, stateStyle(styles, state)]}
                onPress={onPress}
                onPressIn={depth.onPressIn}
                onPressOut={depth.onPressOut}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`Photo ${position} of ${total}`}
            >
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.photoChoiceImage}
                    contentFit="cover"
                />
            </Pressable>
        </Animated.View>
    );
}

function stateStyle(styles: ReturnType<typeof createStyles>, state: ChoiceState) {
    switch (state) {
        case 'correct':
            return styles.choiceCorrect;
        case 'selected':
            return styles.choiceSelected;
        case 'dimmed':
            return styles.choiceDimmed;
        default:
            return null;
    }
}

function createStyles(theme: Theme, compact: boolean) {
    return StyleSheet.create({
        choice: {
            minHeight: compact ? 52 : 56,
            // Trimmed to offset the thicker bottom edge, so the button's overall height is unchanged
            paddingVertical: compact ? 10 : 12,
            paddingHorizontal: 20,
            borderRadius: 14,
            borderWidth: 1,
            // The depth cue: a raised edge that the press animation appears to compress
            borderBottomWidth: 4,
            borderColor: theme.borderStrong,
            backgroundColor: theme.cardBackground,
            alignItems: 'center',
            justifyContent: 'center',
        },
        choiceCorrect: {
            borderColor: theme.success,
            backgroundColor: theme.primarySoft,
        },
        choiceSelected: {
            borderColor: theme.primary,
        },
        choiceDimmed: {
            opacity: 0.5,
        },
        choiceText: {
            fontSize: compact ? 19 : 20,
            lineHeight: compact ? 23 : 24,
            fontWeight: '600',
            color: theme.body,
            textAlign: 'center',
        },
        // The wrapper carries the grid width so the animated transform does not fight flex sizing
        photoChoiceWrap: {
            width: '47%',
        },
        photoChoice: {
            width: '100%',
            aspectRatio: 1,
            borderRadius: 14,
            borderWidth: 1,
            borderBottomWidth: 4,
            borderColor: theme.borderStrong,
            backgroundColor: theme.cardBackground,
            overflow: 'hidden',
        },
        photoChoiceImage: {
            width: '100%',
            height: '100%',
        },
    });
}
