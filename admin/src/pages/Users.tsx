import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { ErrorState, Loading, Panel, Pill, Segmented } from '../components/ui';
import { fetchAuthStatus, fetchCaregivers, fetchPatients } from '../lib/adminApi';
import { daysSince, formatDate, formatPercent } from '../lib/format';

type Tab = 'caregivers' | 'patients';

export function Users() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<Tab>('caregivers');
    const [search, setSearch] = useState('');

    const caregivers = useQuery({ queryKey: ['caregivers'], queryFn: fetchCaregivers });
    const patients = useQuery({ queryKey: ['patients'], queryFn: fetchPatients });
    // Only auth.users carries sign-in and suspension state, and it is reachable solely through the
    // admin_auth_user_status() function — a security_invoker view cannot read the auth schema.
    const authStatus = useQuery({ queryKey: ['authStatus'], queryFn: fetchAuthStatus });

    const needle = search.trim().toLowerCase();

    const caregiverRows = useMemo(() => {
        const rows = caregivers.data ?? [];
        if (!needle) return rows;
        return rows.filter((c) =>
            (c.full_name ?? '').toLowerCase().includes(needle) || (c.email ?? '').toLowerCase().includes(needle));
    }, [caregivers.data, needle]);

    const patientRows = useMemo(() => {
        const rows = patients.data ?? [];
        if (!needle) return rows;
        return rows.filter((p) =>
            (p.patient_name ?? '').toLowerCase().includes(needle) ||
            (p.caregiver_name ?? '').toLowerCase().includes(needle) ||
            (p.caregiver_email ?? '').toLowerCase().includes(needle));
    }, [patients.data, needle]);

    const isLoading = tab === 'caregivers' ? caregivers.isLoading : patients.isLoading;
    const error = tab === 'caregivers' ? caregivers.error : patients.error;

    return (
        <>
            <header className="page-head">
                <h1>Users</h1>
                <p>
                    Caregivers are the account holders. A patient is a record owned by a caregiver and only
                    becomes a sign-in identity of its own once a device is paired to it.
                </p>
            </header>

            <div className="controls">
                <Segmented
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'caregivers', label: `Caregivers (${caregivers.data?.length ?? 0})` },
                        { value: 'patients', label: `Patients (${patients.data?.length ?? 0})` },
                    ]}
                />
                <input
                    type="text"
                    placeholder={tab === 'caregivers' ? 'Search name or email…' : 'Search patient or caregiver…'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {isLoading ? <Loading what="the directory" /> : error ? <ErrorState error={error} /> : (
                <Panel>
                    {tab === 'caregivers' ? (
                        <DataTable
                            rows={caregiverRows}
                            rowKey={(c) => c.caregiver_id}
                            onRowClick={(c) => navigate(`/users/caregiver/${c.caregiver_id}`)}
                            initialSort={{ key: 'created', desc: true }}
                            empty="No caregivers match that search."
                            columns={[
                                { key: 'name', header: 'Name', sortValue: (c) => c.full_name ?? '', render: (c) => c.full_name ?? <span className="muted">Unnamed</span> },
                                { key: 'email', header: 'Email', sortValue: (c) => c.email ?? '', render: (c) => <span className="mono">{c.email ?? '—'}</span> },
                                {
                                    key: 'status', header: 'Status',
                                    sortValue: (c) => (authStatus.data?.get(c.caregiver_id)?.banned_until ? 1 : 0),
                                    render: (c) => {
                                        const s = authStatus.data?.get(c.caregiver_id);
                                        if (!s) return <span className="muted">—</span>;
                                        const banned = s.banned_until && new Date(s.banned_until) > new Date();
                                        return banned ? <Pill tone="critical">Suspended</Pill> : <Pill tone="good">Active</Pill>;
                                    },
                                },
                                { key: 'patients', header: 'Patients', numeric: true, sortValue: (c) => c.patient_count, render: (c) => `${c.paired_patient_count}/${c.patient_count}` },
                                { key: 'assets', header: 'Assets', numeric: true, sortValue: (c) => c.asset_count, render: (c) => c.asset_count },
                                { key: 'sessions', header: 'Answers', numeric: true, sortValue: (c) => c.session_count, render: (c) => c.session_count },
                                {
                                    key: 'lastSignIn', header: 'Last sign-in', numeric: true,
                                    sortValue: (c) => authStatus.data?.get(c.caregiver_id)?.last_sign_in_at ?? null,
                                    render: (c) => {
                                        const d = daysSince(authStatus.data?.get(c.caregiver_id)?.last_sign_in_at);
                                        return d === null ? <span className="muted">Never</span> : d === 0 ? 'Today' : `${d}d ago`;
                                    },
                                },
                                { key: 'created', header: 'Joined', numeric: true, sortValue: (c) => c.created_at, render: (c) => formatDate(c.created_at) },
                            ]}
                        />
                    ) : (
                        <DataTable
                            rows={patientRows}
                            rowKey={(p) => p.patient_id}
                            onRowClick={(p) => navigate(`/users/patient/${p.patient_id}`)}
                            initialSort={{ key: 'created', desc: true }}
                            empty="No patients match that search."
                            columns={[
                                { key: 'name', header: 'Patient', sortValue: (p) => p.patient_name ?? '', render: (p) => p.patient_name ?? <span className="muted">Unnamed</span> },
                                { key: 'caregiver', header: 'Caregiver', sortValue: (p) => p.caregiver_name ?? '', render: (p) => p.caregiver_name ?? '—' },
                                {
                                    key: 'paired', header: 'Device',
                                    sortValue: (p) => (p.is_paired ? 1 : 0),
                                    render: (p) => p.is_paired ? <Pill tone="good">Paired</Pill> : <Pill>Not paired</Pill>,
                                },
                                { key: 'assets', header: 'Assets', numeric: true, sortValue: (p) => p.asset_count, render: (p) => p.asset_count },
                                { key: 'sessions', header: 'Answers', numeric: true, sortValue: (p) => p.sessions_total, render: (p) => p.sessions_total },
                                {
                                    key: 'accuracy', header: 'Lifetime accuracy', numeric: true,
                                    sortValue: (p) => (p.sessions_total ? p.sessions_correct / p.sessions_total : null),
                                    render: (p) => p.sessions_total ? formatPercent(p.sessions_correct / p.sessions_total) : <span className="muted">—</span>,
                                },
                                {
                                    key: 'adherence', header: '30d adherence', numeric: true,
                                    sortValue: (p) => (p.queued_30d ? p.completed_30d / p.queued_30d : null),
                                    render: (p) => p.queued_30d ? formatPercent(p.completed_30d / p.queued_30d) : <span className="muted">—</span>,
                                },
                                {
                                    key: 'lastActive', header: 'Last active', numeric: true,
                                    sortValue: (p) => p.last_active_day,
                                    render: (p) => {
                                        const d = daysSince(p.last_active_day);
                                        return d === null ? <span className="muted">Never</span> : d === 0 ? 'Today' : `${d}d ago`;
                                    },
                                },
                                { key: 'created', header: 'Added', numeric: true, sortValue: (p) => p.created_at, render: (p) => formatDate(p.created_at) },
                            ]}
                        />
                    )}
                </Panel>
            )}
        </>
    );
}
