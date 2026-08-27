import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Empty, ErrorState, Loading, Panel, Pill, Tile } from '../components/ui';
import { fetchTicketMessages, fetchTickets, markTicketRead } from '../lib/adminApi';
import { formatDateTime } from '../lib/format';
import { useAdminAction } from '../lib/useAdminAction';

// Keys the diagnostics blob is expected to carry, in the order they are worth reading.
const DIAGNOSTIC_LABELS: [string, string][] = [
    ['appVersion', 'App version'],
    ['sdkVersion', 'Expo SDK'],
    ['platform', 'Platform'],
    ['osName', 'OS'],
    ['osVersion', 'OS version'],
    ['deviceModel', 'Device'],
    ['online', 'Online at report'],
    ['pendingSyncCount', 'Pending sync items'],
    ['patientCount', 'Patients'],
];

export function SupportTicket() {
    const { ticketId } = useParams<{ ticketId: string }>();
    const queryClient = useQueryClient();
    const action = useAdminAction();
    const [draft, setDraft] = useState('');

    const tickets = useQuery({ queryKey: ['tickets'], queryFn: fetchTickets });
    const messages = useQuery({
        queryKey: ['ticketMessages', ticketId],
        queryFn: () => fetchTicketMessages(ticketId!),
        enabled: Boolean(ticketId),
    });

    // Opening the ticket is what marks it read. Deliberately not routed through useAdminAction:
    // that writes an audit row, and merely looking at a ticket is not an auditable action.
    const markRead = useMutation({
        mutationFn: () => markTicketRead(ticketId!),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    });
    useEffect(() => {
        if (ticketId) markRead.mutate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ticketId]);

    if (tickets.isLoading || messages.isLoading) return <Loading what="the ticket" />;
    if (tickets.error) return <ErrorState error={tickets.error} />;

    const ticket = tickets.data?.find((t) => t.ticket_id === ticketId);
    if (!ticket) return <Empty>No ticket with that id.</Empty>;

    const thread = messages.data ?? [];
    const diagnostics = (ticket.diagnostics ?? {}) as Record<string, unknown>;
    const hasDiagnostics = DIAGNOSTIC_LABELS.some(([key]) => diagnostics[key] !== undefined);

    async function sendReply() {
        const body = draft.trim();
        if (!body) return;
        const result = await action.run('support_reply', ticketId, (r) => {
            if (r.push === 'sent') return 'Reply sent and the caregiver was notified.';
            if (r.push === 'no_token') return 'Reply sent. No push token on file — they will see it in the app.';
            return 'Reply sent, but the push notification failed. They will still see it in the app.';
        }, { body });
        if (result) {
            setDraft('');
            queryClient.invalidateQueries({ queryKey: ['ticketMessages', ticketId] });
        }
    }

    return (
        <>
            <header className="page-head">
                <Link to="/support" className="muted">← Support</Link>
                <h1 style={{ marginTop: 8 }}>{ticket.subject}</h1>
                <p>
                    <Link to={`/users/caregiver/${ticket.caregiver_id}`}>{ticket.caregiver_name ?? 'Unknown'}</Link>
                    {' · '}<span className="mono">{ticket.caregiver_email}</span>
                    {' · opened '}{formatDateTime(ticket.created_at)}
                    {' · '}
                    {ticket.status === 'open' ? <Pill tone="warning">Open</Pill> : <Pill tone="good">Resolved</Pill>}
                </p>
            </header>

            <Panel title="Conversation">
                {thread.length === 0 ? (
                    <Empty>This ticket has no messages. The opening message failed to send.</Empty>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {thread.map((m) => (
                            <div
                                key={m.message_id}
                                style={{
                                    alignSelf: m.author_role === 'admin' ? 'flex-end' : 'flex-start',
                                    maxWidth: '78%',
                                    background: m.author_role === 'admin'
                                        ? 'color-mix(in srgb, var(--series-1) 16%, transparent)'
                                        : 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 12,
                                    padding: '10px 14px',
                                }}
                            >
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    {m.author_role === 'admin' ? 'Support' : ticket.caregiver_name ?? 'Caregiver'}
                                    {' · '}{formatDateTime(m.created_at)}
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Panel>

            <Panel title="Reply" subtitle="The caregiver sees this in the app. Android devices also get a push.">
                {action.error && <div className="login-error">{action.error}</div>}
                {action.notice && <p className="muted">{action.notice}</p>}
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a reply…"
                    rows={5}
                    maxLength={4000}
                    style={{
                        width: '100%', font: 'inherit', padding: 10, borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface-1)',
                        color: 'var(--text-primary)', resize: 'vertical',
                    }}
                />
                <div className="row-actions" style={{ marginTop: 10 }}>
                    <button
                        className="primary"
                        onClick={sendReply}
                        disabled={!draft.trim() || action.busy !== null}
                    >
                        {action.busy === 'support_reply' ? 'Sending…' : 'Send reply'}
                    </button>
                    {ticket.status === 'open' ? (
                        <button
                            disabled={action.busy !== null}
                            onClick={() => action.run('support_resolve', ticketId, () => 'Ticket resolved.')}
                        >
                            Mark resolved
                        </button>
                    ) : (
                        <button
                            disabled={action.busy !== null}
                            onClick={() => action.run('support_reopen', ticketId, () => 'Ticket reopened.')}
                        >
                            Reopen
                        </button>
                    )}
                </div>
                <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                    Push notifications are Android-only in this app — iOS builds ship without the APNs
                    entitlement. An iOS caregiver sees the reply next time they open Support.
                </p>
            </Panel>

            <Panel title="Diagnostics" subtitle="Captured automatically when the ticket was opened.">
                {!hasDiagnostics ? (
                    <Empty>No diagnostics were attached to this ticket.</Empty>
                ) : (
                    <div className="tile-row" style={{ marginBottom: 0 }}>
                        {DIAGNOSTIC_LABELS.filter(([key]) => diagnostics[key] !== undefined).map(([key, label]) => (
                            <Tile key={key} label={label} value={<span style={{ fontSize: 16 }}>{String(diagnostics[key] ?? '—')}</span>} />
                        ))}
                    </div>
                )}
            </Panel>
        </>
    );
}
