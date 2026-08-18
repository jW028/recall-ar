import { stopSpeaking } from '@/utils/feedback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'training.speechEnabled';

// Whether training reads names aloud. On by default — the patient turns it off from the training
// header rather than a settings screen, so the control is where the sound is.
export function useSpeechEnabled(): { speechEnabled: boolean; toggleSpeech: () => void } {
    const [speechEnabled, setSpeechEnabled] = useState(true);

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(STORAGE_KEY)
            .then((stored) => {
                // Only an explicit opt-out overrides the default, so a read failure stays on.
                if (!cancelled && stored === 'false') setSpeechEnabled(false);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, []);

    const toggleSpeech = useCallback(() => {
        const next = !speechEnabled;
        setSpeechEnabled(next);
        AsyncStorage.setItem(STORAGE_KEY, next ? 'true' : 'false').catch(() => {});
        // Silence anything mid-sentence, so the toggle takes effect immediately rather than after the current line.
        if (!next) stopSpeaking();
    }, [speechEnabled]);

    return { speechEnabled, toggleSpeech };
}
