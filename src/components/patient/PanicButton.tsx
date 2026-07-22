import { useTheme } from '@/hooks/use-theme';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface PanicButtonProps {
    onTrigger: () => void;
}

export function PanicButton({ onTrigger }: PanicButtonProps) {
    const theme = useTheme();
    const [progress, setProgress] = useState(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggeredRef = useRef(false);

    const handlePressIn = () => {
        triggeredRef.current = false;
        setProgress(0);

        let msPassed = 0;

        timerRef.current = setInterval(() => {
            msPassed += 100;
            const newProgress = Math.min((msPassed / 3000) * 100, 100);

            setProgress(newProgress);

            if (newProgress >= 100 && !triggeredRef.current) {
                triggeredRef.current = true;
                if (timerRef.current) clearInterval(timerRef.current);
                onTrigger();
            }
        }, 100);
    };

    const handlePressOut = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!triggeredRef.current) {
            setProgress(0);
        }
    };

    const secondsRemaining = Math.ceil(3 - (progress / 100) * 3);

    return (
        <View style={styles.container}>

            <Text style={styles.helperText}>
                {progress > 0 && progress < 100
                    ? `Hold for ${secondsRemaining}s to activate...`
                    : progress >= 100
                        ? 'Emergency Alert Activated'
                        : 'Press and hold to activate'
                }
            </Text>


            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            >
                <View style={[styles.button, { backgroundColor: theme.error }]}>
                    {/* Visual Progress Bar filling up */}
                    <View style={[styles.progressFill, { height: `${progress}%` }]} />

                    <Text style={styles.text}>
                        {progress >= 100 ? 'SENT' : 'SOS'}
                    </Text>
                </View>
            </Pressable>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 32,
        alignItems: 'center',
        justifyContent: 'center'
    },
    button: {
        width: 150,
        height: 150,
        borderRadius: 75,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },

    progressFill: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },

    text: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        zIndex: 1,
        paddingHorizontal: 16,
    },

    helperText: {
        fontSize: 16,
        marginBottom: 16,
        textAlign: 'center',
        fontWeight: '500',
    }
});