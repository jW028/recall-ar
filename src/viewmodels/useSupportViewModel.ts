import type { SupportMessage, SupportTicket } from '@/models/Support';
import { hasUnreadReply } from '@/models/Support';
import { SupportService } from '@/services/SupportService';
import { useAuthStore } from '@/store/authStore';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// There is no Supabase Realtime anywhere in this app, so an open thread polls at the same cadence
// the rest of the app uses (usePatientHomeViewModel's REFRESH_INTERVAL_MS).
const THREAD_POLL_MS = 30_000;

export interface UseSupportListViewModel {
    tickets: SupportTicket[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function useSupportListViewModel(): UseSupportListViewModel {
    const caregiverId = useAuthStore((s) => s.user?.id);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!caregiverId) {
            setIsLoading(false);
            return;
        }
        setError(null);
        const result = await SupportService.listTickets(caregiverId);
        if (result.error) setError(result.error);
        else setTickets(result.data ?? []);
        setIsLoading(false);
    }, [caregiverId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Coming back from a thread should show the unread dot cleared without a manual pull.
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    const unreadCount = useMemo(() => tickets.filter(hasUnreadReply).length, [tickets]);

    return { tickets, unreadCount, isLoading, error, refresh };
}

export interface UseSupportThreadViewModel {
    ticket: SupportTicket | null;
    messages: SupportMessage[];
    isLoading: boolean;
    isSending: boolean;
    error: string | null;
    sendError: string | null;
    refresh: () => Promise<void>;
    send: (body: string) => Promise<boolean>;
    clearSendError: () => void;
}

export function useSupportThreadViewModel(ticketId: string | undefined): UseSupportThreadViewModel {
    const caregiverId = useAuthStore((s) => s.user?.id);
    const [ticket, setTicket] = useState<SupportTicket | null>(null);
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sendError, setSendError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const load = useCallback(
        async (silent: boolean) => {
            if (!ticketId) {
                setIsLoading(false);
                return;
            }
            if (!silent) setError(null);
            const [ticketResult, messageResult] = await Promise.all([
                SupportService.getTicket(ticketId),
                SupportService.listMessages(ticketId),
            ]);
            if (!mountedRef.current) return;
            if (ticketResult.error || messageResult.error) {
                if (!silent) setError(ticketResult.error ?? messageResult.error);
            } else {
                setTicket(ticketResult.data);
                setMessages(messageResult.data ?? []);
            }
            setIsLoading(false);
        },
        [ticketId]
    );

    const refresh = useCallback(() => load(false), [load]);

    useEffect(() => {
        load(false);
    }, [load]);

    // Opening the thread is what marks it read; the cursor write is fire-and-forget.
    useEffect(() => {
        if (ticketId) SupportService.markRead(ticketId);
    }, [ticketId]);

    // Silent so a poll never flashes the spinner or clobbers an error the caregiver is reading.
    useEffect(() => {
        const timer = setInterval(() => load(true), THREAD_POLL_MS);
        return () => clearInterval(timer);
    }, [load]);

    const send = useCallback(
        async (body: string): Promise<boolean> => {
            if (!ticketId || !caregiverId || isSending) return false;
            setIsSending(true);
            setSendError(null);
            const result = await SupportService.postMessage(ticketId, caregiverId, body);
            if (!mountedRef.current) return false;
            setIsSending(false);
            if (result.error || !result.data) {
                setSendError(result.error);
                return false;
            }
            // Append locally rather than refetching: the caregiver should see their own message land
            // instantly, and the next poll reconciles anything the server changed (a reopened status).
            setMessages((prev) => [...prev, result.data!]);
            load(true);
            return true;
        },
        [ticketId, caregiverId, isSending, load]
    );

    return {
        ticket,
        messages,
        isLoading,
        isSending,
        error,
        sendError,
        refresh,
        send,
        clearSendError: () => setSendError(null),
    };
}

export interface UseCreateTicketViewModel {
    isCreating: boolean;
    createError: string | null;
    clearCreateError: () => void;
    createTicket: (subject: string, body: string) => Promise<string | null>;
}

export function useCreateTicketViewModel(): UseCreateTicketViewModel {
    const caregiverId = useAuthStore((s) => s.user?.id);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const createTicket = useCallback(
        async (subject: string, body: string): Promise<string | null> => {
            if (!caregiverId) return null;
            setIsCreating(true);
            setCreateError(null);
            const result = await SupportService.createTicket(caregiverId, subject, body);
            setIsCreating(false);
            if (result.error) setCreateError(result.error);
            return result.data;
        },
        [caregiverId]
    );

    return { isCreating, createError, clearCreateError: () => setCreateError(null), createTicket };
}
