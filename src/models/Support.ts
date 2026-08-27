// A support conversation between one caregiver and the support team.
// Status is deliberately just open/resolved — a caregiver reply to a resolved ticket reopens it
// server-side, so there is no "waiting on customer" state for anyone to get stuck in.
export type SupportTicketStatus = 'open' | 'resolved';

export type SupportAuthorRole = 'caregiver' | 'admin';

export interface SupportTicket {
    ticketId: string;
    caregiverId: string;
    subject: string;
    status: SupportTicketStatus;
    lastMessageAt: string;
    caregiverLastReadAt: string | null;
    resolvedAt: string | null;
    createdAt: string;
    // Filled in from the joined message rows; absent on a bare ticket read.
    messageCount?: number;
    lastAuthorRole?: SupportAuthorRole;
}

export interface SupportMessage {
    messageId: string;
    ticketId: string;
    authorRole: SupportAuthorRole;
    authorUserId: string;
    body: string;
    createdAt: string;
}

// True when support has said something the caregiver has not seen yet.
export function hasUnreadReply(ticket: SupportTicket): boolean {
    if (ticket.lastAuthorRole !== 'admin') return false;
    if (!ticket.caregiverLastReadAt) return true;
    return ticket.lastMessageAt > ticket.caregiverLastReadAt;
}
