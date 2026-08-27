import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { Theme } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTheme } from '@/hooks/use-theme';
import type { SupportMessage } from '@/models/Support';
import { useSupportThreadViewModel } from '@/viewmodels/useSupportViewModel';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl,
    StyleSheet, Text, TextInput, View,
} from 'react-native';

const BODY_MAX = 4000;

function formatTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

function MessageBubble({
    message,
    styles,
}: {
    message: SupportMessage;
    styles: ReturnType<typeof createStyles>;
}) {
    const fromSupport = message.authorRole === 'admin';
    return (
        <View style={[styles.bubbleRow, fromSupport ? styles.rowLeft : styles.rowRight]}>
            <View style={[styles.bubble, fromSupport ? styles.bubbleSupport : styles.bubbleMine]}>
                {fromSupport && <Text style={styles.author}>Support</Text>}
                <Text style={[styles.body, fromSupport ? styles.bodySupport : styles.bodyMine]}>
                    {message.body}
                </Text>
                <Text style={[styles.time, fromSupport ? styles.timeSupport : styles.timeMine]}>
                    {formatTime(message.createdAt)}
                </Text>
            </View>
        </View>
    );
}

export default function SupportThreadScreen() {
    const theme = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);
    const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
    const { isOnline } = useNetworkStatus();
    const { ticket, messages, isLoading, isSending, error, sendError, refresh, send, clearSendError } =
        useSupportThreadViewModel(ticketId);

    const [draft, setDraft] = useState('');
    const listRef = useRef<FlatList<SupportMessage>>(null);

    const canSend = draft.trim().length > 0 && !isSending && isOnline;

    const handleSend = async () => {
        if (!canSend) return;
        const sent = await send(draft);
        // The draft is only cleared once the message is actually on the server, so a failed send
        // never loses what the caregiver typed.
        if (sent) {
            setDraft('');
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        }
    };

    if (isLoading && messages.length === 0) {
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
                title={ticket?.subject ?? 'Support'}
                showBack
                right={
                    ticket ? (
                        <StatusBadge
                            label={ticket.status === 'resolved' ? 'Resolved' : 'Open'}
                            tone={ticket.status === 'resolved' ? 'resolved' : 'open'}
                        />
                    ) : undefined
                }
            />

            {error && (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => item.messageId}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
                    renderItem={({ item }) => <MessageBubble message={item} styles={styles} />}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                />

                {ticket?.status === 'resolved' && (
                    <View style={styles.resolvedNote}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={theme.success} />
                        <Text style={styles.resolvedText}>
                            Marked resolved. Replying reopens this ticket.
                        </Text>
                    </View>
                )}

                {sendError && (
                    <View style={styles.sendErrorBox}>
                        <Text style={styles.errorText}>{sendError}</Text>
                    </View>
                )}

                <View style={styles.composer}>
                    <TextInput
                        style={styles.input}
                        value={draft}
                        onChangeText={(v) => {
                            setDraft(v);
                            if (sendError) clearSendError();
                        }}
                        placeholder={isOnline ? 'Write a reply…' : 'Offline — reconnect to reply'}
                        placeholderTextColor={theme.textFaint}
                        multiline
                        maxLength={BODY_MAX}
                        editable={isOnline}
                    />
                    <Button
                        label={isSending ? 'Sending…' : 'Send'}
                        size="sm"
                        onPress={handleSend}
                        disabled={!canSend}
                        loading={isSending}
                    />
                </View>
            </KeyboardAvoidingView>
        </Screen>
    );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
        flex: { flex: 1 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 10, flexGrow: 1 },
        bubbleRow: { flexDirection: 'row' },
        rowLeft: { justifyContent: 'flex-start' },
        rowRight: { justifyContent: 'flex-end' },
        bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
        bubbleSupport: {
            backgroundColor: theme.backgroundElement,
            borderTopLeftRadius: 4,
        },
        bubbleMine: {
            backgroundColor: theme.primary,
            borderTopRightRadius: 4,
        },
        author: { fontSize: 12, fontWeight: '700', color: theme.primary },
        body: { fontSize: 15, lineHeight: 21 },
        bodySupport: { color: theme.body },
        bodyMine: { color: theme.onPrimary },
        time: { fontSize: 11 },
        timeSupport: { color: theme.textFaint },
        timeMine: { color: theme.onPrimary, opacity: 0.75 },
        composer: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            backgroundColor: theme.surface,
        },
        input: {
            flex: 1,
            maxHeight: 120,
            minHeight: 40,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 15,
            color: theme.body,
            backgroundColor: theme.background,
        },
        errorBox: {
            backgroundColor: theme.errorBackground,
            borderColor: theme.errorBorder,
            borderWidth: 1,
            borderRadius: 8,
            padding: 12,
            marginHorizontal: 16,
            marginBottom: 8,
        },
        sendErrorBox: {
            backgroundColor: theme.errorBackground,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            marginHorizontal: 16,
        },
        errorText: { color: theme.error, fontSize: 14 },
        resolvedNote: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 16,
            paddingBottom: 6,
        },
        resolvedText: { fontSize: 13, color: theme.textMuted, flex: 1 },
    });
}
