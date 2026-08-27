import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChartFrame, TimeSeries, seriesColor } from '../components/charts';
import { ConfirmDestructive } from '../components/ConfirmDestructive';
import { DataTable } from '../components/DataTable';
import { Empty, ErrorState, Loading, Panel, Pill, Segmented, Tile } from '../components/ui';
import { fetchAssetStats, fetchIncidents, fetchPatientDaily, fetchPatients } from '../lib/adminApi';
import { computeBiomarkers } from '../lib/biomarkers';
import { formatDate, formatDateTime, formatDuration, formatMs, formatPercent } from '../lib/format';
import { useAdminAction } from '../lib/useAdminAction';

const TREND_TONE = { improving: 'good', stable: 'neutral', declining: 'serious' } as const;

export function PatientDetail() {
    const { patientId } = useParams<{ patientId: string }>();
    const navigate = useNavigate();
    const [timeframe, setTimeframe] = useState<'7' | '30'>('30');
    const [confirming, setConfirming] = useState(false);
    const action = useAdminAction();

    const patients = useQuery({ queryKey: ['patients'], queryFn: fetchPatients });
    const daily = useQuery({ queryKey: ['patientDaily'], queryFn: fetchPatientDaily });
    const assets = useQuery({ queryKey: ['assetStats'], queryFn: fetchAssetStats });
    const incidents = useQuery({ queryKey: ['incidents'], queryFn: () => fetchIncidents() });

    if (patients.isLoading || daily.isLoading) return <Loading what="the patient" />;
    if (patients.error) return <ErrorState error={patients.error} />;

    const patient = patients.data?.find((p) => p.patient_id === patientId);
    if (!patient) return <Empty>No patient with that id.</Empty>;

    const rows = (daily.data ?? []).filter((r) => r.patient_id === patientId);
    const bio = computeBiomarkers(patient.patient_id, rows, Number(timeframe));
    const assetRow = assets.data?.find((a) => a.patient_id === patientId);
    const theirIncidents = (incidents.data ?? []).filter((i) => i.patient_id === patientId);

    return (
        <>
            <header className="page-head">
                <Link to="/users" className="muted">← Users</Link>
                <h1 style={{ marginTop: 8 }}>{patient.patient_name ?? 'Unnamed patient'}</h1>
                <p>
                    Cared for by <Link to={`/users/caregiver/${patient.caregiver_id}`}>{patient.caregiver_name ?? 'unknown'}</Link>
                    {' · added '}{formatDate(patient.created_at)}
                    {patient.date_of_birth ? ` · born ${formatDate(patient.date_of_birth)}` : ''}
                    {' · '}{patient.is_paired ? <Pill tone="good">Device paired</Pill> : <Pill>No device</Pill>}
                </p>
            </header>

            <div className="controls">
                <span className="muted">Window</span>
                <Segmented
                    value={timeframe}
                    onChange={setTimeframe}
                    options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }]}
                />
            </div>

            <div className="tile-row">
                <Tile label="Accuracy" value={formatPercent(bio.currentAccuracy, 1)} hint="7-day smoothed" />
                <Tile label="Median latency" value={formatMs(bio.currentMedianLatencyMs)} hint="7-day smoothed" />
                <Tile
                    label="Trend"
                    value={<Pill tone={TREND_TONE[bio.trendDirection]}>{bio.trendDirection}</Pill>}
                    hint={bio.insufficientData ? 'Not enough data to judge' : `${bio.sessionsCount} answers over ${bio.distinctDaysCount} days`}
                />
                <Tile label="Streak" value={`${bio.currentStreakDays}d`} />
                <Tile
                    label="30d adherence"
                    value={patient.queued_30d ? formatPercent(patient.completed_30d / patient.queued_30d) : '—'}
                    hint={`${patient.completed_30d}/${patient.queued_30d} queued reviews done`}
                />
                <Tile label="Assets" value={patient.asset_count} hint={`${patient.onboarding_count} onboarding · ${patient.maintenance_count} mastered · ${patient.paused_count} paused`} />
            </div>

            {bio.insufficientData && (
                <Panel>
                    <p style={{ margin: 0 }} className="muted">
                        The degradation flag needs at least 10 answers across at least 5 separate days before it
                        will judge a trend. This patient has {bio.sessionsCount} across {bio.distinctDaysCount}, so
                        the trend reads <b>stable</b> by default rather than by measurement.
                    </p>
                </Panel>
            )}

            <div className="chart-grid">
                {/* Two charts rather than one with two y-axes: accuracy is a 0–1 ratio and latency is
                    milliseconds, and a shared scale would flatten one of them into a straight line. */}
                <ChartFrame title="Accuracy" subtitle="Daily correct/total, with the 7-day rolling average the trend is fitted to.">
                    <TimeSeries
                        data={bio.accuracyByDay}
                        xKey="date"
                        series={[
                            { key: 'raw', label: 'Daily', color: seriesColor(3) },
                            { key: 'smoothed', label: '7-day average', color: seriesColor(0) },
                        ]}
                        yDomain={[0, 1]}
                        format={(v) => `${Math.round(v * 100)}%`}
                    />
                </ChartFrame>

                <ChartFrame title="Response latency" subtitle="Median milliseconds to answer. Rising latency is a degradation signal even when accuracy holds.">
                    <TimeSeries
                        data={bio.latencyByDay}
                        xKey="date"
                        series={[
                            { key: 'raw', label: 'Daily median', color: seriesColor(3) },
                            { key: 'smoothed', label: '7-day average', color: seriesColor(1) },
                        ]}
                        format={(v) => `${Math.round(v)}`}
                    />
                </ChartFrame>
            </div>

            {assetRow && (
                <Panel title="Memory pool" subtitle="Assets in active rotation against the 45-asset monthly cap.">
                    <div className="tile-row" style={{ marginBottom: 0 }}>
                        <Tile label="Active pool" value={`${assetRow.active_pool_size}/45`} hint={`${assetRow.pool_utilisation_pct}% of cap`} />
                        <Tile label="People" value={assetRow.person_count} />
                        <Tile label="Objects" value={assetRow.object_count} />
                        <Tile label="Mastered" value={assetRow.maintenance_count} />
                        <Tile label="Missing embedding" value={assetRow.missing_embedding_count} />
                    </div>
                </Panel>
            )}

            <Panel title="Incidents" subtitle="Panic, fall, geofence crossings and context alerts for this patient.">
                {theirIncidents.length === 0 ? <Empty>No incidents recorded.</Empty> : (
                    <DataTable
                        rows={theirIncidents}
                        rowKey={(i) => `${i.kind}-${i.source_id}`}
                        initialSort={{ key: 'when', desc: true }}
                        columns={[
                            { key: 'kind', header: 'Type', sortValue: (i) => i.kind, render: (i) => <Pill tone={i.kind === 'threat' ? 'critical' : 'neutral'}>{i.subtype ?? i.kind}</Pill> },
                            { key: 'when', header: 'When', sortValue: (i) => i.occurred_at, render: (i) => formatDateTime(i.occurred_at) },
                            { key: 'status', header: 'Status', sortValue: (i) => i.status ?? '', render: (i) => i.status ?? '—' },
                            {
                                key: 'ack', header: 'Acknowledged in', numeric: true,
                                sortValue: (i) => i.ack_latency_seconds,
                                render: (i) => i.acknowledged_at ? formatDuration(i.ack_latency_seconds) : <Pill tone="warning">Unacknowledged</Pill>,
                            },
                            { key: 'msg', header: 'Detail', render: (i) => <span className="muted">{i.message ?? '—'}</span> },
                        ]}
                    />
                )}
            </Panel>

            <Panel title="Patient actions">
                {action.error && <div className="login-error">{action.error}</div>}
                {action.notice && <p className="muted">{action.notice}</p>}
                <div className="row-actions">
                    <button
                        disabled={action.busy !== null || !patient.is_paired}
                        onClick={() => action.run('unpair_device', patient.patient_id, (r) => `Device unpaired. ${r.tokensRevoked ?? 0} unused pairing token(s) revoked.`)}
                    >
                        Unpair device
                    </button>
                    <button className="danger" disabled={action.busy !== null} onClick={() => setConfirming(true)}>
                        Erase patient and all data
                    </button>
                </div>
                <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                    Unpairing ends the device session and leaves the patient record intact — the caregiver can
                    pair a new device afterwards.
                </p>
            </Panel>

            {confirming && (
                <ConfirmDestructive
                    title={`Erase ${patient.patient_name ?? 'this patient'}?`}
                    confirmWord={patient.patient_name ?? 'DELETE'}
                    actionLabel="Erase permanently"
                    busy={action.busy === 'delete_patient'}
                    consequences={[
                        `Delete ${patient.asset_count} memory asset${patient.asset_count === 1 ? '' : 's'} and ${patient.sessions_total} training answer${patient.sessions_total === 1 ? '' : 's'}`,
                        'Delete every review entry, cognitive report, geofence, alert, threat and location record',
                        'Delete all enrolled photos and the profile picture from storage',
                        'Delete the paired device sign-in, if there is one',
                    ]}
                    onCancel={() => setConfirming(false)}
                    onConfirm={async () => {
                        const result = await action.run('delete_patient', patient.patient_id);
                        setConfirming(false);
                        if (result) navigate('/users');
                    }}
                />
            )}
        </>
    );
}
