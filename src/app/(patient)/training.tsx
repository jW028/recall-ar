import { ChoiceButton, PhotoChoiceButton, type ChoiceState } from '@/components/patient/ChoiceButton';
import { ChoicesReveal } from '@/components/patient/ChoicesReveal';
import { CorrectCelebration } from '@/components/patient/CorrectCelebration';
import { SessionProgressBar } from '@/components/patient/SessionProgressBar';
import { SessionSummaryView } from '@/components/patient/SessionSummaryView';
import type { Theme } from '@/constants/theme';
import { useCaregiverName } from '@/hooks/useCaregiverName';
import { useSpeechEnabled } from '@/hooks/useSpeechEnabled';
import { useTheme } from '@/hooks/use-theme';
import { isPerson } from '@/models/MemoryAsset';
import { correctFeedback, missFeedback, speak, stopSpeaking, tapFeedback } from '@/utils/feedback';
import { useTrainingViewModel } from '@/viewmodels/useTrainingViewModel';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Crossfade between question photos. Independent of the choices' entrance, which is the one animation
// the latency measurement depends on.
const PHOTO_FADE_MS = 200;

export default function TrainingScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    // Small phones (iPhone SE and similar) get a tighter set of sizes so the whole question still fits without scrolling
    const compact = windowHeight - insets.top - insets.bottom < 700;
    const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);
    const router = useRouter();
    const caregiverName = useCaregiverName();

    const { status, error, step, nextImageUrl, question, progress, lastResult, summary, streakDays, isSubmitting, practiceAvailable, startPractice, answer, next, markRendered } =
        useTrainingViewModel();
    const { speechEnabled, toggleSpeech } = useSpeechEnabled();

    // Warm the next step's photo while the patient is still on this one, so advancing does not stall
    // on the network. Best-effort: a failed prefetch just means the image loads normally later.
    useEffect(() => {
        if (nextImageUrl) Image.prefetch(nextImageUrl).catch(() => {});
    }, [nextImageUrl]);

    // Confirm the answer in the hand as well as the eye. Fires once per reveal; a miss gets a light
    // tap, never the error buzz.
    useEffect(() => {
        if (!lastResult) return;
        if (lastResult.correct) correctFeedback();
        else missFeedback();
    }, [lastResult]);

    // Say the name out loud on reveal — hearing and seeing it together is the point of the exercise.
    useEffect(() => {
        if (!lastResult || !question || !speechEnabled) return;
        const name = question.correctAsset.name;
        speak(lastResult.correct ? `That's right. This is ${name}.` : `This is ${name}.`);
    }, [lastResult, question, speechEnabled]);

    // A teach card introduces the name, so it is spoken as soon as the card appears.
    useEffect(() => {
        if (!step || step.kind !== 'teach' || !speechEnabled) return;
        speak(`This is ${step.asset.name}.`);
    }, [step, speechEnabled]);

    // Leaving mid-session goes quiet immediately rather than finishing the sentence.
    useEffect(() => stopSpeaking, []);

    const handleChoice = useCallback(
        (choice: Parameters<typeof answer>[0]) => {
            tapFeedback();
            answer(choice);
        },
        [answer]
    );

    // Advancing cuts off whatever is still being read from the previous step.
    const handleNext = useCallback(() => {
        stopSpeaking();
        next();
    }, [next]);

    const goHome = () => {
        stopSpeaking();
        router.navigate('/(patient)');
    };

    if (status === 'loading') {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (status === 'error') {
        return (
            <View style={styles.centered}>
                <Text style={styles.message} numberOfLines={4}>
                    {error ?? 'Something went wrong.'}
                </Text>
                <Pressable style={styles.primaryButton} onPress={goHome}>
                    <Text style={styles.primaryButtonText}>Go back</Text>
                </Pressable>
            </View>
        );
    }

    if (status === 'complete') {
        return (
            <SessionSummaryView
                summary={summary}
                streakDays={streakDays}
                onDone={goHome}
                onBrowseAlbum={() => router.navigate('/(patient)/album')}
                onPractice={practiceAvailable ? startPractice : undefined}
            />
        );
    }

    // Nothing has been enrolled yet, so there is nothing to have caught up on
    if (status === 'unenrolled') {
        return (
            <View style={styles.centered}>
                <Text style={styles.doneTitle}>Nothing to review yet</Text>
                <Text style={styles.message} numberOfLines={4}>
                    {caregiverName ?? 'Your caregiver'} hasn&apos;t added any memories yet. They will
                    show up here once they do.
                </Text>
                <Pressable style={styles.primaryButton} onPress={goHome}>
                    <Text style={styles.primaryButtonText}>Home</Text>
                </Pressable>
            </View>
        );
    }

    if (status === 'empty') {
        return (
            <View style={styles.centered}>
                <Text style={styles.doneTitle}>All caught up</Text>
                <Text style={styles.message}>
                    There are no memories to review right now.
                </Text>
                {/* Offered, never required: nothing here is due, so this is a way to keep going rather than a task */}
                {practiceAvailable ? (
                    <Pressable
                        style={styles.primaryButton}
                        onPress={startPractice}
                        accessibilityRole="button"
                    >
                        <Text style={styles.primaryButtonText}>Practice anyway</Text>
                    </Pressable>
                ) : (
                    <Pressable
                        style={styles.primaryButton}
                        onPress={() => router.navigate('/(patient)/album')}
                        accessibilityRole="button"
                    >
                        <Text style={styles.primaryButtonText}>Browse your album</Text>
                    </Pressable>
                )}
                <Pressable onPress={goHome} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.secondaryLink}>Home</Text>
                </Pressable>
            </View>
        );
    }

    // status === 'ready'
    if (!step) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const header = (
        <View style={styles.header}>
            <Pressable
                onPress={goHome}
                hitSlop={12}
                style={styles.backButton}
                accessibilityRole="button"
                accessibilityLabel="Go home"
            >
                <Ionicons name="chevron-back" size={22} color={theme.primary} />
                <Text style={styles.backText}>Home</Text>
            </Pressable>
            <View style={styles.progressBar}>
                <SessionProgressBar fraction={progress.fraction} />
            </View>
            {/* The control sits with the sound rather than in a settings screen the patient would have to find */}
            <Pressable
                onPress={toggleSpeech}
                hitSlop={12}
                style={styles.speakerButton}
                accessibilityRole="button"
                accessibilityLabel={speechEnabled ? 'Turn off reading aloud' : 'Turn on reading aloud'}
            >
                <Ionicons
                    name={speechEnabled ? 'volume-high' : 'volume-mute'}
                    size={22}
                    color={speechEnabled ? theme.primary : theme.textMuted}
                />
            </Pressable>
        </View>
    );

    // A memory the patient has never been tested on is shown with its name first, so the first
    // retrieval attempt is never a cold guess. Nothing here is recorded or timed.
    if (step.kind === 'teach') {
        const detail = isPerson(step.asset) ? step.asset.relationship : step.asset.category;
        return (
            <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
                {header}

                <View style={styles.photoFrame}>
                    <Image
                        source={{ uri: step.asset.imageUrl }}
                        style={styles.photo}
                        contentFit="cover"
                        transition={PHOTO_FADE_MS}
                    />
                </View>

                <View style={styles.captionSlot}>
                    <Text style={styles.prompt} numberOfLines={2} accessibilityLiveRegion="polite">
                        This is {step.asset.name}.
                    </Text>
                </View>

                <View style={styles.choices}>
                    {detail ? (
                        <Text style={styles.teachDetail} numberOfLines={2}>
                            {detail}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.spacer} />

                <View style={styles.footerSlot}>
                    <Pressable
                        style={styles.primaryButton}
                        onPress={next}
                        accessibilityRole="button"
                    >
                        <Text style={styles.primaryButtonText}>Got it</Text>
                    </Pressable>
                </View>
            </View>
        );
    }

    if (!question) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const { correctAsset, choices } = question;
    const revealed = lastResult !== null;
    const byPhoto = step.format === 'nameToPhoto';
    const prompt = byPhoto
        ? 'Which photo is this?'
        : isPerson(correctAsset)
            ? 'Who is this?'
            : 'What is this?';

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            {header}

            {/* The stimulus is the only element that grows, so it — never the buttons — absorbs the difference between a large and a small phone */}
            {/* When the choices are photos the stimulus is the name instead: showing the photo here would give the answer away */}
            <View style={styles.photoFrame}>
                {byPhoto ? (
                    <Text style={styles.nameStimulus} numberOfLines={3} adjustsFontSizeToFit>
                        {correctAsset.name}
                    </Text>
                ) : (
                    <Image
                        source={{ uri: correctAsset.imageUrl }}
                        style={styles.photo}
                        contentFit="cover"
                        transition={PHOTO_FADE_MS}
                    />
                )}
                {/* Overlaid rather than stacked, so a correct reveal is exactly as tall as an incorrect one. Anchored low because faces sit in the upper part of a portrait. */}
                {revealed && lastResult!.correct && (
                    <View style={styles.celebration} pointerEvents="none">
                        <CorrectCelebration />
                    </View>
                )}
            </View>

            {/* One fixed-height slot holds either the question or the reveal sentence, so answering never shifts the buttons below.
                The tint is warm on a hit and simply neutral on a miss — a miss is never coloured as a failure. */}
            <View
                style={[
                    styles.captionSlot,
                    revealed && (lastResult!.correct ? styles.captionCorrect : styles.captionMiss),
                ]}
            >
                <Text
                    style={revealed ? styles.revealText : styles.prompt}
                    numberOfLines={2}
                    accessibilityLiveRegion="polite"
                >
                    {revealed
                        ? lastResult!.correct
                            ? `That's right — this is ${correctAsset.name}.`
                            : `Let's remember together — this is ${correctAsset.name}.`
                        : prompt}
                </Text>
            </View>

            {/* Keyed per step, not per asset: a retry shows the same asset again, and only a remount
                replays the entrance and re-arms the latency timer */}
            <ChoicesReveal
                key={step.stepId}
                onVisible={markRendered}
                style={byPhoto ? styles.photoChoices : styles.choices}
            >
                {choices.map((choice, i) => {
                    const state = choiceState(
                        revealed,
                        choice.assetId === correctAsset.assetId,
                        lastResult?.selectedAssetId === choice.assetId
                    );
                    return byPhoto ? (
                        <PhotoChoiceButton
                            key={choice.assetId}
                            imageUrl={choice.imageUrl}
                            position={i + 1}
                            total={choices.length}
                            state={state}
                            disabled={isSubmitting || revealed}
                            compact={compact}
                            onPress={() => handleChoice(choice)}
                        />
                    ) : (
                        <ChoiceButton
                            key={choice.assetId}
                            label={choice.name}
                            state={state}
                            disabled={isSubmitting || revealed}
                            compact={compact}
                            onPress={() => handleChoice(choice)}
                        />
                    );
                })}
            </ChoicesReveal>

            <View style={styles.spacer} />

            {/* Always mounted so the Continue button's space is reserved from the start and the reveal shifts nothing */}
            <View style={styles.footerSlot}>
                {revealed ? (
                    <Pressable
                        style={styles.primaryButton}
                        onPress={handleNext}
                        accessibilityRole="button"
                    >
                        <Text style={styles.primaryButtonText}>Continue</Text>
                    </Pressable>
                ) : error ? (
                    // Submit errors can only occur before the reveal, so they borrow the reserved slot instead of displacing content
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText} numberOfLines={2}>{error}</Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

// After a reveal the correct answer is softly highlighted and the patient's pick gets a neutral
// outline. There is no wrong state — no red, no X, no "wrong" framing.
function choiceState(revealed: boolean, isCorrect: boolean, isSelected: boolean): ChoiceState {
    if (!revealed) return 'idle';
    if (isCorrect) return 'correct';
    return isSelected ? 'selected' : 'dimmed';
}

function createStyles(theme: Theme, compact: boolean) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.surface,
            paddingHorizontal: 24,
            paddingBottom: 12,
        },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: theme.surface,
            paddingHorizontal: 32,
            gap: 16,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            marginBottom: compact ? 8 : 12,
        },
        backButton: { flexDirection: 'row', alignItems: 'center', marginLeft: -4 },
        backText: { fontSize: 16, color: theme.primary, fontWeight: '600' },
        progressBar: { flex: 1, marginHorizontal: 16 },
        speakerButton: { padding: 2 },
        // Grows to fill the slack left by the fixed slots below, clamped so it neither balloons nor becomes unrecognisable
        photoFrame: {
            flexGrow: 8,
            flexShrink: 0,
            flexBasis: 0,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: compact ? 96 : 120,
            maxHeight: compact ? 200 : 240,
            marginBottom: compact ? 8 : 12,
        },
        // The name takes the stimulus slot in the name-to-photo direction, so the frame keeps its size and the celebration still has somewhere to sit
        nameStimulus: {
            fontSize: compact ? 32 : 38,
            lineHeight: compact ? 38 : 44,
            fontWeight: '800',
            color: theme.heading,
            textAlign: 'center',
        },
        // Height comes from the frame's resolved flex height; aspectRatio derives the width from it
        photo: {
            height: '100%',
            aspectRatio: 1,
            borderRadius: 20,
            backgroundColor: theme.border,
        },
        celebration: {
            position: 'absolute',
            bottom: 10,
            backgroundColor: theme.surface,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 6,
        },
        // Fixed height fits two lines of either text style, so the swap on reveal cannot resize the slot
        captionSlot: {
            height: compact ? 56 : 68,
            flexShrink: 0,
            justifyContent: 'center',
            marginBottom: compact ? 10 : 14,
            // Padding and radius are constant across states so the tint can never resize the slot
            paddingHorizontal: 12,
            borderRadius: 14,
        },
        captionCorrect: {
            backgroundColor: theme.primarySoft,
        },
        // A miss gets a plain neutral panel, never an error colour — the tint marks the answer, not a verdict
        captionMiss: {
            backgroundColor: theme.backgroundElement,
        },
        prompt: {
            fontSize: compact ? 24 : 26,
            lineHeight: compact ? 30 : 32,
            fontWeight: '700',
            color: theme.body,
            textAlign: 'center',
        },
        errorBanner: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: compact ? 10 : 12,
            paddingHorizontal: 16,
        },
        errorBannerText: {
            color: theme.error,
            fontSize: 15,
            fontWeight: '600',
            textAlign: 'center',
        },
        // Everything else in the column is flexShrink:0, so this is the only node that can absorb an impossible layout. It clips the last button rather than letting Continue leave the screen.
        choices: {
            gap: compact ? 8 : 10,
            flexShrink: 1,
            overflow: 'hidden',
        },
        // Grid for the name-to-photo direction. Shares the shrink behaviour of the name column so it
        // stays the one node that can absorb an impossible layout.
        photoChoices: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: compact ? 8 : 10,
            flexShrink: 1,
            overflow: 'hidden',
        },
        // Secondary line under a teach card's name, e.g. the relationship or object category
        teachDetail: {
            fontSize: compact ? 17 : 18,
            lineHeight: compact ? 22 : 24,
            color: theme.textMuted,
            textAlign: 'center',
        },
        // Takes whatever the clamped photo could not, keeping the footer pinned to the bottom on large screens
        spacer: {
            flexGrow: 1,
            flexShrink: 0,
            flexBasis: 0,
            minHeight: 12,
        },
        // Reserved whether or not the answer is revealed, so Continue always lands in the same place
        footerSlot: {
            height: compact ? 64 : 76,
            flexShrink: 0,
            justifyContent: 'center',
        },
        revealText: {
            fontSize: compact ? 18 : 20,
            lineHeight: compact ? 24 : 26,
            color: theme.body,
            textAlign: 'center',
        },
        primaryButton: {
            backgroundColor: theme.primary,
            borderRadius: 14,
            paddingVertical: compact ? 14 : 16,
            paddingHorizontal: 48,
            alignItems: 'center',
        },
        primaryButtonText: {
            color: theme.onPrimary,
            fontSize: 18,
            fontWeight: '700',
        },
        doneTitle: {
            fontSize: 28,
            fontWeight: '800',
            color: theme.body,
        },
        secondaryLink: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.primary,
        },
        message: {
            fontSize: 16,
            color: theme.textMuted,
            textAlign: 'center',
            lineHeight: 24,
            flexShrink: 1,
        },
    });
}
