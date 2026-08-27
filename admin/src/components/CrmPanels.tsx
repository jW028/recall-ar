import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from './DataTable';
import { Empty, Loading, Panel, Pill } from './ui';
import {
    addNote, addTag, deleteNote, fetchNotes, fetchTags, fetchTickets, removeTag,
} from '../lib/adminApi';
import { formatDateTime } from '../lib/format';

export function CaregiverTickets({ caregiverId }: { caregiverId: string }) {
    const tickets = useQuery({ queryKey: ['tickets'], queryFn: fetchTickets });
    const theirs = (tickets.data ?? []).filter((t) => t.caregiver_id === caregiverId);

    return (
        <Panel title="Support tickets" subtitle="Every conversation this caregiver has opened.">
            {tickets.isLoading ? <Loading what="tickets" /> : theirs.length === 0 ? (
                <Empty>This caregiver has never contacted support.</Empty>
            ) : (
                <DataTable
                    rows={theirs}
                    rowKey={(t) => t.ticket_id}
                    initialSort={{ key: 'last', desc: true }}
                    columns={[
                        {
                            key: 'subject', header: 'Subject', sortValue: (t) => t.subject,
                            render: (t) => <Link to={`/support/${t.ticket_id}`}>{t.subject}</Link>,
                        },
                        {
                            key: 'status', header: 'Status', sortValue: (t) => t.status,
                            render: (t) => t.status === 'open'
                                ? <Pill tone="warning">Open</Pill>
                                : <Pill tone="good">Resolved</Pill>,
                        },
                        { key: 'messages', header: 'Messages', numeric: true, sortValue: (t) => t.message_count, render: (t) => t.message_count },
                        { key: 'last', header: 'Last activity', numeric: true, sortValue: (t) => t.last_message_at, render: (t) => formatDateTime(t.last_message_at) },
                    ]}
                />
            )}
        </Panel>
    );
}

export function CaregiverTags({ caregiverId }: { caregiverId: string }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState('');
    const tags = useQuery({ queryKey: ['tags', caregiverId], queryFn: () => fetchTags(caregiverId) });

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['tags', caregiverId] });
        queryClient.invalidateQueries({ queryKey: ['caregivers'] });
    };
    const add = useMutation({ mutationFn: (tag: string) => addTag(caregiverId, tag), onSuccess: () => { setDraft(''); invalidate(); } });
    const remove = useMutation({ mutationFn: (tag: string) => removeTag(caregiverId, tag), onSuccess: invalidate });

    return (
        <Panel title="Tags" subtitle="Short labels for segmenting accounts. Admin-only.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {(tags.data ?? []).length === 0 && <span className="muted">No tags yet.</span>}
                {(tags.data ?? []).map((t) => (
                    <span key={t.tag} className="pill">
                        {t.tag}
                        <button
                            onClick={() => remove.mutate(t.tag)}
                            style={{ border: 'none', background: 'none', padding: 0, marginLeft: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                            aria-label={`Remove tag ${t.tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
            </div>
            {(add.error || remove.error) && (
                <div className="login-error">{String((add.error ?? remove.error) as Error)}</div>
            )}
            <form
                className="controls"
                style={{ marginBottom: 0 }}
                onSubmit={(e) => { e.preventDefault(); if (draft.trim()) add.mutate(draft); }}
            >
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="at-risk, trial, vip…"
                    maxLength={32}
                />
                <button type="submit" disabled={!draft.trim() || add.isPending}>Add tag</button>
            </form>
        </Panel>
    );
}

export function CaregiverNotes({ caregiverId }: { caregiverId: string }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState('');
    const notes = useQuery({ queryKey: ['notes', caregiverId], queryFn: () => fetchNotes(caregiverId) });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notes', caregiverId] });
    const add = useMutation({ mutationFn: (body: string) => addNote(caregiverId, body), onSuccess: () => { setDraft(''); invalidate(); } });
    const remove = useMutation({ mutationFn: (id: string) => deleteNote(id), onSuccess: invalidate });

    return (
        <Panel
            title="Internal notes"
            subtitle="Only administrators can see these — the caregiver has no access to this table at all."
        >
            <form
                onSubmit={(e) => { e.preventDefault(); if (draft.trim()) add.mutate(draft); }}
                style={{ marginBottom: 16 }}
            >
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Called 21 Aug about pairing — sending a replacement tablet."
                    rows={3}
                    maxLength={4000}
                    style={{
                        width: '100%', font: 'inherit', padding: 10, borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--surface-1)',
                        color: 'var(--text-primary)', resize: 'vertical',
                    }}
                />
                <button type="submit" disabled={!draft.trim() || add.isPending} style={{ marginTop: 8 }}>
                    {add.isPending ? 'Saving…' : 'Add note'}
                </button>
            </form>

            {notes.isLoading ? <Loading what="notes" /> : (notes.data ?? []).length === 0 ? (
                <Empty>No notes on this account yet.</Empty>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(notes.data ?? []).map((n) => (
                        <div key={n.note_id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <span className="muted" style={{ fontSize: 12 }}>{formatDateTime(n.created_at)}</span>
                                <button
                                    onClick={() => remove.mutate(n.note_id)}
                                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}
                                >
                                    Delete
                                </button>
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{n.body}</div>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
}
