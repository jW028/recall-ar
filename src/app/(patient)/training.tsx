import { CorrectCelebration } from '@/components/patient/CorrectCelebration';
import { SessionProgressBar } from '@/components/patient/SessionProgressBar';
import { SessionSummaryView } from '@/components/patient/SessionSummaryView';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isPerson, type MemoryAsset } from '@/models/MemoryAsset';
import { useTrainingViewModel } from '@/viewmodels/useTrainingViewModel';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TrainingScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();

    const { status, error, question, progress, lastResult, summary, streakDays, isSubmitting, answer, next, markRendered } =
        useTrainingViewModel();

    const goHome = () => router.navigate('/(patient)');

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
                <Text style={styles.message}>{error ?? 'Something went wrong.'}</Text>
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
            />
        );
    }

    if (status === 'empty') {
        return (
            <View style={styles.centered}>
                <Text style={styles.doneTitle}>All caught up</Text>
                <Text style={styles.message}>
                    There are no memories to review right now.
                </Text>
                <Pressable
                    style={styles.primaryButton}
                    onPress={() => router.navigate('/(patient)/album')}
                >
                    <Text style={styles.primaryButtonText}>Browse your album</Text>
                </Pressable>
                <Pressable onPress={goHome} hitSlop={8}>
                    <Text style={styles.secondaryLink}>Home</Text>
                </Pressable>
            </View>
        );
    }

    // status === 'ready'
    if (!question) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    const { correctAsset, choices } = question;
    const prompt = isPerson(correctAsset) ? 'Who is this?' : 'What is this?';
    const revealed = lastResult !== null;

    return (
        <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <Pressable onPress={goHome} hitSlop={12} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={theme.primary} />
                    <Text style={styles.backText}>Home</Text>
                </Pressable>
                <View style={styles.progressBar}>
                    <SessionProgressBar current={progress.current} total={progress.total} />
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.questionArea}>
                    <Image source={{ uri: correctAsset.imageUrl }} style={styles.photo} />
                    <Text style={styles.prompt}>{prompt}</Text>
                </View>

                {error && !revealed && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorBannerText}>{error}</Text>
                    </View>
                )}

                <View style={styles.choices} onLayout={markRendered}>
                    {choices.map((choice) => (
                        <ChoiceButton
                            key={choice.assetId}
                            choice={choice}
                            revealed={revealed}
                            isCorrect={choice.assetId === correctAsset.assetId}
                            isSelected={lastResult?.selectedAssetId === choice.assetId}
                            disabled={isSubmitting || revealed}
                            onPress={() => answer(choice)}
                            styles={styles}
                        />
                    ))}
                </View>

                {revealed && (
                    <View style={styles.revealArea}>
                        {lastResult!.correct && <CorrectCelebration />}
                        <Text style={styles.revealText}>
                            {lastResult!.correct
                                ? `That's right — this is ${correctAsset.name}.`
                                : `Let's remember together — this is ${correctAsset.name}.`}
                        </Text>
                        <Pressable style={styles.primaryButton} onPress={next}>
                            <Text style={styles.primaryButtonText}>Continue</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

function ChoiceButton({
    choice,
    revealed,
    isCorrect,
    isSelected,
    disabled,
    onPress,
    styles,
}: {
    choice: MemoryAsset;
    revealed: boolean;
    isCorrect: boolean;
    isSelected: boolean;
    disabled: boolean;
    onPress: () => void;
    styles: ReturnType<typeof createStyles>;
}) {
    // After reveal, gently highlight the correct answer; mark the patient's pick only with a soft outline. No red, no X, no "wrong" framing.
    const stateStyle = revealed
        ? isCorrect
            ? styles.choiceCorrect
            : isSelected
                ? styles.choiceSelected
                : styles.choiceDimmed
        : null;

    return (
        <Pressable
            style={[styles.choice, stateStyle]}
            onPress={onPress}
            disabled={disabled}
        >
            <Text style={styles.choiceText}>{choice.name}</Text>
        </Pressable>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.surface,
            paddingHorizontal: 24,
        },
        // flexGrow keeps the reveal area's marginTop:'auto' pinning Continue to the bottom when content is short, while allowing scroll when it overflows
        scrollContent: {
            flexGrow: 1,
            paddingBottom: 32,
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
            marginBottom: 16,
        },
        backButton: { flexDirection: 'row', alignItems: 'center', marginLeft: -4 },
        backText: { fontSize: 16, color: theme.primary, fontWeight: '600' },
        progressBar: { flex: 1, marginLeft: 16 },
        questionArea: {
            alignItems: 'center',
            marginBottom: 28,
        },
        photo: {
            width: 200,
            height: 200,
            borderRadius: 20,
            backgroundColor: theme.border,
            marginBottom: 20,
        },
        prompt: {
            fontSize: 26,
            fontWeight: '700',
            color: theme.body,
            textAlign: 'center',
        },
        errorBanner: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginBottom: 16,
        },
        errorBannerText: {
            color: theme.error,
            fontSize: 15,
            fontWeight: '600',
            textAlign: 'center',
        },
        choices: {
            gap: 12,
        },
        choice: {
            paddingVertical: 18,
            paddingHorizontal: 20,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: theme.borderStrong,
            backgroundColor: theme.cardBackground,
            alignItems: 'center',
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
            fontSize: 20,
            fontWeight: '600',
            color: theme.body,
        },
        revealArea: {
            marginTop: 'auto',
            gap: 16,
        },
        revealText: {
            fontSize: 18,
            color: theme.body,
            textAlign: 'center',
            lineHeight: 26,
        },
        primaryButton: {
            backgroundColor: theme.primary,
            borderRadius: 14,
            paddingVertical: 18,
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
        },
    });
}
