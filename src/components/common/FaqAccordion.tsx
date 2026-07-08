import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import type { FaqItem } from '@/constants/infoContent';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface FaqAccordionProps {
    items: FaqItem[];
}

// Collapsible Q&A list with back navigation, one item open at a time
export function FaqAccordion({ items }: FaqAccordionProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    const toggle = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpenIndex((current) => (current === index ? null : index));
    };

    return (
        <Screen background="page">
            <ScreenHeader title="User Guide & FAQ" showBack />
            <ScrollView contentContainerStyle={styles.content}>
                {items.map((item, index) => {
                    const open = openIndex === index;
                    return (
                        <View key={item.question} style={styles.card}>
                            <Pressable
                                style={styles.questionRow}
                                onPress={() => toggle(index)}
                                accessibilityRole="button"
                                accessibilityLabel={item.question}
                                accessibilityState={{ expanded: open }}
                            >
                                <Text style={styles.question}>{item.question}</Text>
                                <Ionicons
                                    name={open ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color={theme.textFaint}
                                />
                            </Pressable>
                            {open && <Text style={styles.answer}>{item.answer}</Text>}
                        </View>
                    );
                })}
            </ScrollView>
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        content: {
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 32,
            gap: 12,
        },
        card: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 16,
        },
        questionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 16,
        },
        question: {
            flex: 1,
            fontSize: 16,
            fontWeight: '600',
            color: theme.heading,
        },
        answer: {
            fontSize: 15,
            lineHeight: 22,
            color: theme.bodySecondary,
            paddingBottom: 16,
        },
    });
}
