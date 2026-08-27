import { useQuery } from '@tanstack/react-query';
import { DataTable } from '../components/DataTable';
import { Empty, ErrorState, Loading, Panel, Pill } from '../components/ui';
import { fetchAudit, fetchAuthStatus } from '../lib/adminApi';
import { formatDateTime } from '../lib/format';

export function Audit() {
    const audit = useQuery({ queryKey: ['audit'], queryFn: () => fetchAudit() });
    const authStatus = useQuery({ queryKey: ['authStatus'], queryFn: fetchAuthStatus });

    if (audit.isLoading) return <Loading what="the audit log" />;
    if (audit.error) return <ErrorState error={audit.error} />;

    const rows = audit.data ?? [];

    return (
        <>
            <header className="page-head">
                <h1>Audit log</h1>
                <p>
                    Every administrative action, successful or not. Entries are written by the service-role edge
                    function and there is no insert policy for anyone else, so an administrator can read this
                    history but cannot add to or edit it from here.
                </p>
            </header>

            <Panel>
                {rows.length === 0 ? (
                    <Empty>No administrative actions have been taken yet.</Empty>
                ) : (
                    <DataTable
                        rows={rows}
                        rowKey={(a) => String(a.id)}
                        initialSort={{ key: 'when', desc: true }}
                        columns={[
                            { key: 'when', header: 'When', sortValue: (a) => a.created_at, render: (a) => formatDateTime(a.created_at) },
                            {
                                key: 'actor', header: 'Administrator', sortValue: (a) => a.actor_user_id,
                                render: (a) => authStatus.data?.get(a.actor_user_id)?.email ?? <span className="mono">{a.actor_user_id.slice(0, 8)}…</span>,
                            },
                            { key: 'action', header: 'Action', sortValue: (a) => a.action, render: (a) => <span className="mono">{a.action}</span> },
                            { key: 'targetType', header: 'Target', sortValue: (a) => a.target_type, render: (a) => a.target_type },
                            {
                                key: 'targetId', header: 'Target id', sortValue: (a) => a.target_id ?? '',
                                render: (a) => a.target_id ? <span className="mono">{a.target_id.slice(0, 8)}…</span> : <span className="muted">—</span>,
                            },
                            {
                                key: 'result', header: 'Result', sortValue: (a) => (a.succeeded ? 1 : 0),
                                render: (a) => a.succeeded ? <Pill tone="good">Succeeded</Pill> : <Pill tone="critical">Failed</Pill>,
                            },
                            {
                                key: 'details', header: 'Detail',
                                render: (a) => <span className="mono muted">{JSON.stringify(a.details)}</span>,
                            },
                        ]}
                    />
                )}
            </Panel>
        </>
    );
}
