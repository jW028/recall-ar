import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/EmptyState';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { Theme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hasUnreadReply, type SupportTicket } from '@/models/Support';
import { useSupportListViewModel } from '@/viewmodels/useSupportViewModel';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

function relativeDay(iso: string): string {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function TicketCard({
    ticket,
    onPress,
    styles,
}: {
    ticket: SupportTicket;
    onPress: () => void;
    styles: ReturnType<typeof createStyles>;
}) {
    const unread = hasUnreadReply(ticket);
    return (
        <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${ticket.subject}${unread ? ', new reply' : ''}`}
        >
            <View style={styles.cardTop}>
                <Text style={styles.cardSubject} numberOfLines={1}>
                    {ticket.subject}
                </Text>
                {unread && <View style={styles.unreadDot} />}
            </View>
            <View style={styles.cardMeta}>
                <StatusBadge
                    label={ticket.status === 'resolved' ? 'Resolved' : 'Open'}
                    tone={ticket.status === 'resolved' ? 'resolved' : 'open'}
                />
                <Text style={styles.cardMetaText}>
                    {ticket.messageCount ?? 0} {ticket.messageCount === 1 ? 'message' : 'messages'} ·{' '}
                    {relativeDay(ticket.lastMessageAt)}
                </Text>
            </View>
        </Pressable>
    );
}

export default function SupportListScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const router = useRouter();
    const { tickets, isLoading, error, refresh } = useSupportListViewModel();

    const goToNew = () => router.push('/(caregiver)/home/support/new');

    if (isLoading && tickets.length === 0) {
        return (
            <Screen>
                <ScreenHeader title="Support" showBack />
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen>
            <ScreenHeader
                title="Support"
                subtitle="Message our team about anything in the app"
                showBack
                right={<Button label="New" icon="add" size="sm" onPress={goToNew} />}
            />
            {error && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}
            <FlatList
                data={tickets}
                keyExtractor={(item) => item.ticketId}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
                renderItem={({ item }) => (
                    <TicketCard
                        ticket={item}
                        styles={styles}
                        onPress={() => router.push(`/(caregiver)/home/support/${item.ticketId}`)}
                    />
                )}
                ListEmptyComponent={
                    <EmptyState
                        icon="chatbubble-ellipses-outline"
                        title="No tickets yet"
                        body="Stuck on something? Open a ticket and our team will reply here."
                        action={<Button label="Contact support" icon="add" onPress={goToNew} />}
                    />
                }
                ListFooterComponent={
                    tickets.length > 0 ? (
                        <View style={styles.footerNote}>
                            <Ionicons name="information-circle-outline" size={16} color={theme.textFaint} />
                            <Text style={styles.footerText}>
                                Replies appear here. Check back after a while.
                            </Text>
                        </View>
                    ) : null
                }
            />
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        listContent: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1, gap: 12 },
        card: {
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            padding: 16,
            gap: 10,
        },
        cardPressed: { opacity: 0.7 },
        cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        cardSubject: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.heading },
        unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary },
        cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
        cardMetaText: { fontSize: 13, color: theme.textMuted, flexShrink: 1 },
        errorBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginHorizontal: 20,
            marginBottom: 12,
        },
        errorText: { color: theme.error, fontSize: 14 },
        footerNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 16, paddingHorizontal: 4 },
        footerText: { fontSize: 13, color: theme.textFaint, flex: 1 },
    });
}
