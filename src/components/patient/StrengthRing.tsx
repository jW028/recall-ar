import { useTheme } from '@/hooks/use-theme';
import { STRENGTH_STEPS } from '@/utils/memoryStrength';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Props {
    // Filled segments, 0..STRENGTH_STEPS.
    filled: number;
    size?: number;
    children?: React.ReactNode;
}

const GAP_DEGREES = 10;
const STROKE = 3.5;

function pointOnCircle(centre: number, radius: number, degrees: number) {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return {
        x: centre + radius * Math.cos(radians),
        y: centre + radius * Math.sin(radians),
    };
}

function arc(centre: number, radius: number, startDeg: number, endDeg: number): string {
    const start = pointOnCircle(centre, radius, endDeg);
    const end = pointOnCircle(centre, radius, startDeg);
    const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

// A memory's progress along the spaced-repetition ladder, drawn as segments that fill in as it is
// remembered. Deliberately wordless: no count, no percentage, no comparison between memories.
export function StrengthRing({ filled, size = 40, children }: Props) {
    const theme = useTheme();
    const centre = size / 2;
    const radius = centre - STROKE / 2;
    const segmentDegrees = 360 / STRENGTH_STEPS;
    const complete = filled >= STRENGTH_STEPS;

    return (
        <View style={[styles.wrap, { width: size, height: size }]}>
            <Svg width={size} height={size}>
                {Array.from({ length: STRENGTH_STEPS }, (_, i) => {
                    const start = i * segmentDegrees + GAP_DEGREES / 2;
                    const end = (i + 1) * segmentDegrees - GAP_DEGREES / 2;
                    const earned = i < filled;
                    return (
                        <Path
                            key={i}
                            d={arc(centre, radius, start, end)}
                            stroke={
                                earned
                                    ? complete
                                        ? theme.warning
                                        : theme.primary
                                    : theme.border
                            }
                            strokeWidth={STROKE}
                            strokeLinecap="round"
                            fill="none"
                        />
                    );
                })}
            </Svg>
            <View style={styles.centreSlot} pointerEvents="none">
                {children}
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
});
