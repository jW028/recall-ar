import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

// Multi-sensory confirmation for the training loop. Seeing and hearing the same name is standard
// practice in memory care, and it takes reading ability out of the response-latency measurement.
//
// Every call here is fire-and-forget: feedback must never block the UI, delay an answer, or surface
// an error to the patient. Unsupported platforms (simulator, web) reject silently.

// Slower than conversational, so a name lands clearly without sounding laboured.
const SPEECH_RATE = 0.9;

// Light confirmation as a choice is pressed.
export function tapFeedback(): void {
    Haptics.selectionAsync().catch(() => {});
}

// Correct answer revealed.
export function correctFeedback(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// Missed answer revealed. Deliberately a light impact, never NotificationFeedbackType.Error —
// that double-buzz is the "you failed" signal this app must not send.
export function missFeedback(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Session finished.
export function completeFeedback(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// Speaks a line, interrupting anything already in progress so utterances can never overlap or queue up.
export function speak(text: string): void {
    try {
        Speech.stop();
        Speech.speak(text, { rate: SPEECH_RATE });
    } catch {
        // Speech is an enhancement; losing it must never interrupt the session.
    }
}

// Call when leaving a screen, so walking away from a session goes quiet immediately.
export function stopSpeaking(): void {
    try {
        Speech.stop();
    } catch {
        // Nothing to stop.
    }
}
