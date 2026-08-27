import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { Empty, ErrorState, Loading, Panel, Pill, Segmented, Tile } from '../components/ui';
import { fetchTickets } from '../lib/adminApi';
import { formatDateTime } from '../lib/format';

type Filter = 'unread' | 'open' | 'all';

export function Support() {
    const navigate = useNavigate();
    const [filter, setFilter] = useState<Filter>('unread');

    const tickets = useQuery({ queryKey: ['tickets'], queryFn: fetchTickets });

    if (tickets.isLoading) return <Loading what="the support queue" />;
    if (tickets.error) return <ErrorState error={tickets.error} />;

    const all = tickets.data ?? [];
    const unread = all.filter((t) => t.has_unread);
    const open = all.filter((t) => t.status === 'open');

    const shown = filter === 'unread' ? unread : filter === 'open' ? open : all;

    // Time the oldest unanswered ticket has been waiting — the number that says whether the queue
    // is actually being worked, which a raw count does not.
    const oldestUnread = unread.reduce<string | null>(
        (oldest, t) => (oldest === null || t.last_message_at < oldest ? t.last_message_at : oldest),
        null
    );

    return (
        <>
            <header className="page-head">
                <h1>Support</h1>
                <p>
                    Tickets raised by caregivers from inside the app. A ticket is unread when the caregiver
                    spoke last and no admin has opened it since — replying clears it.
                </p>
            </header>

            <div className="tile-row">
                <Tile label="Awaiting reply" value={unread.length} hint={unread.length ? 'needs a response' : 'all answered'} />
                <Tile label="Open tickets" value={open.length} />
                <Tile label="Total tickets" value={all.length} />
                <Tile
                    label="Oldest waiting"
                    value={oldestUnread ? `${Math.max(0, Math.floor((Date.now() - new Date(oldestUnread).getTime()) / 3_600_000))}h` : '—'}
                />
            </div>

            <div className="controls">
                <Segmented
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: 'unread', label: `Awaiting reply (${unread.length})` },
                        { value: 'open', label: `Open (${open.length})` },
                        { value: 'all', label: `All (${all.length})` },
                    ]}
                />
            </div>

            <Panel>
                {shown.length === 0 ? (
                    <Empty>
                        {filter === 'unread'
                            ? 'Every ticket has been answered.'
                            : 'No tickets have been raised yet.'}
                    </Empty>
                ) : (
                    <DataTable
                        rows={shown}
                        rowKey={(t) => t.ticket_id}
                        onRowClick={(t) => navigate(`/support/${t.ticket_id}`)}
                        initialSort={{ key: 'last', desc: true }}
                        columns={[
                            {
                                key: 'subject', header: 'Subject',
                                sortValue: (t) => t.subject,
                                render: (t) => (
                                    <span style={{ fontWeight: t.has_unread ? 650 : 400 }}>
                                        {t.has_unread && <span style={{ color: 'var(--series-1)', marginRight: 6 }}>●</span>}
                                        {t.subject}
                                    </span>
                                ),
                            },
                            {
                                key: 'caregiver', header: 'Caregiver',
                                sortValue: (t) => t.caregiver_name ?? '',
                                render: (t) => t.caregiver_name ?? <span className="muted">{t.caregiver_email}</span>,
                            },
                            {
                                key: 'status', header: 'Status',
                                sortValue: (t) => t.status,
                                render: (t) => t.status === 'open'
                                    ? <Pill tone="warning">Open</Pill>
                                    : <Pill tone="good">Resolved</Pill>,
                            },
                            {
                                key: 'waiting', header: 'Waiting on',
                                sortValue: (t) => t.last_author_role ?? '',
                                render: (t) => t.last_author_role === 'caregiver'
                                    ? <Pill tone="serious">Us</Pill>
                                    : <span className="muted">Caregiver</span>,
                            },
                            { key: 'messages', header: 'Messages', numeric: true, sortValue: (t) => t.message_count, render: (t) => t.message_count },
                            { key: 'last', header: 'Last activity', numeric: true, sortValue: (t) => t.last_message_at, render: (t) => formatDateTime(t.last_message_at) },
                            { key: 'opened', header: 'Opened', numeric: true, sortValue: (t) => t.created_at, render: (t) => formatDateTime(t.created_at) },
                        ]}
                    />
                )}
            </Panel>
        </>
    );
}
