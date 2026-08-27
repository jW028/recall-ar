import { supabase } from '@/database/remote/supabaseClient';
import type { SupportMessage, SupportTicket } from '@/models/Support';
import { collectDiagnostics } from '@/utils/diagnostics';
import { isOnline } from '@/utils/connectivity';

// Support goes straight to Supabase rather than through the SQLite sync queue.
// Two reasons: a conversation has to be current — routing replies through the 30s sync watermark plus
// the 30s viewmodel refresh would show the caregiver a thread up to a minute stale — and
// SyncService.pullAllForCaregiver only ever scopes by caregiver_id in one hardcoded place (Patient),
// so a caregiver-keyed table would push up and never pull replies back down.
// This follows PatientLocation, DevicePairing, CaregiverPushToken and Caregiver, which bypass it too.

export interface ServiceResult<T = void> {
    data: T | null;
    error: string | null;
}

interface TicketRow {
    ticket_id: string;
    caregiver_id: string;
    subject: string;
    status: string;
    last_message_at: string;
    caregiver_last_read_at: string | null;
    resolved_at: string | null;
    created_at: string;
    SupportMessage?: { author_role: string; created_at: string }[];
}

interface MessageRow {
    message_id: string;
    ticket_id: string;
    author_role: string;
    author_user_id: string;
    body: string;
    created_at: string;
}

const OFFLINE_MESSAGE = 'You are offline. Reconnect to reach support.';

function mapTicket(row: TicketRow): SupportTicket {
    // The embedded messages are only used to derive who spoke last, so the list can show an unread
    // dot without a second round trip per ticket.
    const messages = row.SupportMessage ?? [];
    const newest = messages.reduce<{ author_role: string; created_at: string } | null>(
        (latest, m) => (latest === null || m.created_at > latest.created_at ? m : latest),
        null
    );
    return {
        ticketId: row.ticket_id,
        caregiverId: row.caregiver_id,
        subject: row.subject,
        status: row.status === 'resolved' ? 'resolved' : 'open',
        lastMessageAt: row.last_message_at,
        caregiverLastReadAt: row.caregiver_last_read_at,
        resolvedAt: row.resolved_at,
        createdAt: row.created_at,
        messageCount: messages.length,
        lastAuthorRole: newest?.author_role === 'admin' ? 'admin' : 'caregiver',
    };
}

function mapMessage(row: MessageRow): SupportMessage {
    return {
        messageId: row.message_id,
        ticketId: row.ticket_id,
        authorRole: row.author_role === 'admin' ? 'admin' : 'caregiver',
        authorUserId: row.author_user_id,
        body: row.body,
        createdAt: row.created_at,
    };
}

// RLS scopes this to the caller, but filtering by caregiver_id as well keeps the payload honest
// and makes the query readable without knowing the policy.
async function listTickets(caregiverId: string): Promise<ServiceResult<SupportTicket[]>> {
    const { data, error } = await supabase
        .from('SupportTicket')
        .select('ticket_id, caregiver_id, subject, status, last_message_at, caregiver_last_read_at, resolved_at, created_at, SupportMessage(author_role, created_at)')
        .eq('caregiver_id', caregiverId)
        .order('last_message_at', { ascending: false });

    if (error) return { data: null, error: 'Could not load your tickets.' };
    return { data: (data as unknown as TicketRow[]).map(mapTicket), error: null };
}

async function getTicket(ticketId: string): Promise<ServiceResult<SupportTicket>> {
    const { data, error } = await supabase
        .from('SupportTicket')
        .select('ticket_id, caregiver_id, subject, status, last_message_at, caregiver_last_read_at, resolved_at, created_at')
        .eq('ticket_id', ticketId)
        .maybeSingle();

    if (error) return { data: null, error: 'Could not load this ticket.' };
    if (!data) return { data: null, error: null };
    return { data: mapTicket(data as unknown as TicketRow), error: null };
}

async function listMessages(ticketId: string): Promise<ServiceResult<SupportMessage[]>> {
    const { data, error } = await supabase
        .from('SupportMessage')
        .select('message_id, ticket_id, author_role, author_user_id, body, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    if (error) return { data: null, error: 'Could not load this conversation.' };
    return { data: (data as MessageRow[]).map(mapMessage), error: null };
}

// Creates the ticket and its opening message. Diagnostics are gathered here rather than in the screen
// so every ticket carries them regardless of which entry point created it.
async function createTicket(
    caregiverId: string,
    subject: string,
    body: string
): Promise<ServiceResult<string>> {
    if (!isOnline()) return { data: null, error: OFFLINE_MESSAGE };

    const diagnostics = await collectDiagnostics(caregiverId);

    const { data, error } = await supabase
        .from('SupportTicket')
        // Cast because the generated jsonb type is an index signature and Diagnostics is a
        // closed interface; the shape is plain JSON either way.
        .insert({ caregiver_id: caregiverId, subject: subject.trim(), diagnostics: { ...diagnostics } })
        .select('ticket_id')
        .single();

    if (error || !data) return { data: null, error: 'Could not open the ticket. Please try again.' };

    const ticketId = (data as { ticket_id: string }).ticket_id;
    const posted = await postMessage(ticketId, caregiverId, body);
    if (posted.error) {
        // The ticket exists but is empty. Surfacing it is better than silently orphaning it — the
        // caregiver can open the thread and send the first message themselves.
        return { data: ticketId, error: 'Ticket opened, but the first message failed to send.' };
    }
    return { data: ticketId, error: null };
}

async function postMessage(
    ticketId: string,
    caregiverId: string,
    body: string
): Promise<ServiceResult<SupportMessage>> {
    if (!isOnline()) return { data: null, error: OFFLINE_MESSAGE };

    const { data, error } = await supabase
        .from('SupportMessage')
        .insert({
            ticket_id: ticketId,
            author_role: 'caregiver',
            author_user_id: caregiverId,
            body: body.trim(),
        })
        .select('message_id, ticket_id, author_role, author_user_id, body, created_at')
        .single();

    if (error || !data) return { data: null, error: 'Could not send your message. Please try again.' };
    return { data: mapMessage(data as MessageRow), error: null };
}

// caregiver_last_read_at is the only column a caregiver is granted UPDATE on; status and resolution
// are service-role territory. A failure here is cosmetic (a stale unread dot), so it never surfaces.
async function markRead(ticketId: string): Promise<void> {
    if (!isOnline()) return;
    await supabase
        .from('SupportTicket')
        .update({ caregiver_last_read_at: new Date().toISOString() })
        .eq('ticket_id', ticketId);
}

export const SupportService = {
    listTickets,
    getTicket,
    listMessages,
    createTicket,
    postMessage,
    markRead,
};
