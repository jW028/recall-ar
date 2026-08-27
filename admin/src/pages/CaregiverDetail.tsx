import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDestructive } from '../components/ConfirmDestructive';
import { CaregiverNotes, CaregiverTags, CaregiverTickets } from '../components/CrmPanels';
import { DataTable } from '../components/DataTable';
import { Empty, ErrorState, Loading, Panel, Pill, Tile } from '../components/ui';
import { fetchAuthStatus, fetchCaregivers, fetchPatients } from '../lib/adminApi';
import { daysSince, formatDate, formatDateTime, formatPercent } from '../lib/format';
import { useAdminAction } from '../lib/useAdminAction';

export function CaregiverDetail() {
    const { caregiverId } = useParams<{ caregiverId: string }>();
    const navigate = useNavigate();
    const [confirming, setConfirming] = useState(false);
    const action = useAdminAction();

    const caregivers = useQuery({ queryKey: ['caregivers'], queryFn: fetchCaregivers });
    const patients = useQuery({ queryKey: ['patients'], queryFn: fetchPatients });
    const authStatus = useQuery({ queryKey: ['authStatus'], queryFn: fetchAuthStatus });

    if (caregivers.isLoading || patients.isLoading) return <Loading what="the caregiver" />;
    if (caregivers.error) return <ErrorState error={caregivers.error} />;

    const caregiver = caregivers.data?.find((c) => c.caregiver_id === caregiverId);
    if (!caregiver) return <Empty>No caregiver with that id.</Empty>;

    const theirPatients = (patients.data ?? []).filter((p) => p.caregiver_id === caregiverId);
    const status = authStatus.data?.get(caregiver.caregiver_id);
    const suspended = Boolean(status?.banned_until && new Date(status.banned_until) > new Date());

    return (
        <>
            <header className="page-head">
                <Link to="/users" className="muted">← Users</Link>
                <h1 style={{ marginTop: 8 }}>{caregiver.full_name ?? 'Unnamed caregiver'}</h1>
                <p>
                    <span className="mono">{caregiver.email}</span>
                    {caregiver.caregiver_contact ? ` · ${caregiver.caregiver_contact}` : ''}
                    {' · joined '}{formatDate(caregiver.created_at)}
                    {suspended && <> · <Pill tone="critical">Suspended</Pill></>}
                </p>
            </header>

            <div className="tile-row">
                <Tile label="Patients" value={caregiver.patient_count} hint={`${caregiver.paired_patient_count} paired`} />
                <Tile label="Memory assets" value={caregiver.asset_count} />
                <Tile label="Training answers" value={caregiver.session_count} />
                <Tile label="Last training" value={caregiver.last_session_at ? `${daysSince(caregiver.last_session_at)}d ago` : 'Never'} />
                <Tile label="Last sign-in" value={status?.last_sign_in_at ? formatDate(status.last_sign_in_at) : 'Never'} />
            </div>

            <Panel title="Patients" subtitle="Every patient record this caregiver owns.">
                {theirPatients.length === 0 ? <Empty>This caregiver has not added a patient yet.</Empty> : (
                    <DataTable
                        rows={theirPatients}
                        rowKey={(p) => p.patient_id}
                        onRowClick={(p) => navigate(`/users/patient/${p.patient_id}`)}
                        columns={[
                            { key: 'name', header: 'Patient', sortValue: (p) => p.patient_name ?? '', render: (p) => p.patient_name ?? '—' },
                            { key: 'paired', header: 'Device', sortValue: (p) => (p.is_paired ? 1 : 0), render: (p) => p.is_paired ? <Pill tone="good">Paired</Pill> : <Pill>Not paired</Pill> },
                            { key: 'assets', header: 'Assets', numeric: true, sortValue: (p) => p.asset_count, render: (p) => p.asset_count },
                            { key: 'sessions', header: 'Answers', numeric: true, sortValue: (p) => p.sessions_total, render: (p) => p.sessions_total },
                            {
                                key: 'accuracy', header: 'Accuracy', numeric: true,
                                sortValue: (p) => (p.sessions_total ? p.sessions_correct / p.sessions_total : null),
                                render: (p) => p.sessions_total ? formatPercent(p.sessions_correct / p.sessions_total) : <span className="muted">—</span>,
                            },
                            { key: 'added', header: 'Added', numeric: true, sortValue: (p) => p.created_at, render: (p) => formatDate(p.created_at) },
                        ]}
                        initialSort={{ key: 'added', desc: true }}
                    />
                )}
            </Panel>

            <CaregiverTickets caregiverId={caregiver.caregiver_id} />
            <CaregiverTags caregiverId={caregiver.caregiver_id} />
            <CaregiverNotes caregiverId={caregiver.caregiver_id} />

            <Panel title="Account actions">
                {action.error && <div className="login-error">{action.error}</div>}
                {action.notice && <p className="muted">{action.notice}</p>}
                <div className="row-actions">
                    {suspended ? (
                        <button
                            disabled={action.busy !== null}
                            onClick={() => action.run('unsuspend_caregiver', caregiver.caregiver_id, () => 'Account reinstated.')}
                        >
                            Lift suspension
                        </button>
                    ) : (
                        <button
                            disabled={action.busy !== null}
                            onClick={() => action.run('suspend_caregiver', caregiver.caregiver_id, () => 'Account suspended — they can no longer sign in.')}
                        >
                            Suspend account
                        </button>
                    )}
                    <button
                        disabled={action.busy !== null}
                        onClick={() => action.run('send_password_reset', caregiver.caregiver_id, (r) => `Password reset sent to ${r.emailed}.`)}
                    >
                        Send password reset
                    </button>
                    <button className="danger" disabled={action.busy !== null} onClick={() => setConfirming(true)}>
                        Delete account and all data
                    </button>
                </div>
                <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                    Suspension is reversible and blocks sign-in immediately. Deletion is not reversible.
                </p>
            </Panel>

            <Panel title="Audit" subtitle="Every action above is recorded with the administrator who performed it.">
                <p className="muted" style={{ margin: 0 }}>
                    Account created {formatDateTime(caregiver.created_at)}. See the{' '}
                    <Link to="/audit">audit log</Link> for the full history.
                </p>
            </Panel>

            {confirming && (
                <ConfirmDestructive
                    title={`Delete ${caregiver.full_name ?? caregiver.email}?`}
                    confirmWord={caregiver.email ?? 'DELETE'}
                    actionLabel="Delete permanently"
                    busy={action.busy === 'delete_caregiver'}
                    consequences={[
                        `Delete ${theirPatients.length} patient record${theirPatients.length === 1 ? '' : 's'} and every memory asset, training answer, review entry, report, geofence, alert and location belonging to them`,
                        'Delete all uploaded photos from storage',
                        'Delete the caregiver sign-in account and any paired patient device sessions',
                        'Retroactively change the totals shown on every page of this dashboard',
                    ]}
                    onCancel={() => setConfirming(false)}
                    onConfirm={async () => {
                        const result = await action.run('delete_caregiver', caregiver.caregiver_id);
                        setConfirming(false);
                        if (result) navigate('/users');
                    }}
                />
            )}
        </>
    );
}
