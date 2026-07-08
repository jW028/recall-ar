import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import type { Theme } from '@/constants/theme';
import type { InfoSection } from '@/constants/infoContent';
import { useTheme } from '@/hooks/use-theme';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface InfoArticleProps {
    title: string;
    updated?: string;
    sections: InfoSection[];
}

// Static titled article with back navigation, used for the legal/policy screens
export function InfoArticle({ title, updated, sections }: InfoArticleProps) {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    return (
        <Screen background="page">
            <ScreenHeader title={title} showBack />
            <ScrollView contentContainerStyle={styles.content}>
                {updated && <Text style={styles.updated}>Last updated {updated}</Text>}
                {sections.map((section) => (
                    <View key={section.heading} style={styles.section}>
                        <Text style={styles.heading}>{section.heading}</Text>
                        <Text style={styles.body}>{section.body}</Text>
                    </View>
                ))}
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
            gap: 20,
        },
        updated: {
            fontSize: 13,
            color: theme.textMuted,
        },
        section: {
            gap: 6,
        },
        heading: {
            fontSize: 17,
            fontWeight: '700',
            color: theme.heading,
        },
        body: {
            fontSize: 15,
            lineHeight: 22,
            color: theme.bodySecondary,
        },
    });
}
