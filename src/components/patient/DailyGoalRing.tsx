import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
    // Distinct memories already reviewed today.
    done: number;
    // Memories still waiting.
    due: number;
    size?: number;
}

const STROKE = 7;

// Today's review progress. Fills as memories are reviewed and shows a star once nothing is left.
//
// It never shows an empty or zero state as a reproach: with nothing due it reads as finished, not as
// "0 of 0", because a patient who has no reviews waiting has done nothing wrong.
export function DailyGoalRing({ done, due, size = 64 }: Props) {
    const theme = useTheme();
    const complete = due === 0;
    const total = done + due;
    const fraction = complete ? 1 : done / total;

    const centre = size / 2;
    const radius = centre - STROKE / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <View style={[styles.wrap, { width: size, height: size }]}>
            <Svg width={size} height={size}>
                <Circle
                    cx={centre}
                    cy={centre}
                    r={radius}
                    stroke={theme.border}
                    strokeWidth={STROKE}
                    fill="none"
                />
                {fraction > 0 && (
                    <Circle
                        cx={centre}
                        cy={centre}
                        r={radius}
                        stroke={complete ? theme.warning : theme.primary}
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - fraction)}
                        // Start the fill at the top rather than at three o'clock
                        transform={`rotate(-90 ${centre} ${centre})`}
                    />
                )}
            </Svg>
            <View style={styles.centreSlot} pointerEvents="none">
                {complete ? (
                    <Ionicons name="star" size={size * 0.4} color={theme.warning} />
                ) : (
                    <Text style={[styles.remaining, { fontSize: size * 0.36, color: theme.primaryText }]}>
                        {due}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    centreSlot: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    remaining: {
        fontWeight: '800',
    },
});
