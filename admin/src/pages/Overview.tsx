import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bars, ChartFrame, TimeSeries, seriesColor } from '../components/charts';
import { DataTable } from '../components/DataTable';
import { Empty, ErrorState, Loading, Panel, Pill, Segmented, Tile } from '../components/ui';
import { useState } from 'react';
import { fetchGrowth, fetchKpi, fetchPairingFunnel, fetchPatientDaily, fetchPatients } from '../lib/adminApi';
import type { PatientOverview } from '../lib/adminApi';
import { computeAllBiomarkers } from '../lib/biomarkers';
import { daysSince, formatPercent } from '../lib/format';

// A patient counts as dormant once they have gone this long without completing a review.
const DORMANT_AFTER_DAYS = 7;

export function Overview() {
    const [range, setRange] = useState<'30' | '90' | '180'>('90');

    const kpi = useQuery({ queryKey: ['kpi'], queryFn: fetchKpi });
    const growth = useQuery({ queryKey: ['growth', range], queryFn: () => fetchGrowth(Number(range)) });
    const funnel = useQuery({ queryKey: ['funnel'], queryFn: fetchPairingFunnel });
    const patients = useQuery({ queryKey: ['patients'], queryFn: fetchPatients });
    const daily = useQuery({ queryKey: ['patientDaily'], queryFn: fetchPatientDaily });

    if (kpi.isLoading || patients.isLoading) return <Loading what="the platform overview" />;
    if (kpi.error) return <ErrorState error={kpi.error} />;

    const rows = patients.data ?? [];
    const biomarkers = computeAllBiomarkers(daily.data ?? [], 30);

    const dormant = rows.filter((p) => {
        const since = daysSince(p.last_active_day);
        return since === null || since > DORMANT_AFTER_DAYS;
    });
    const degrading = rows.filter((p) => biomarkers.get(p.patient_id)?.isDegrading);
    const withOpenIncidents = rows.filter((p) => p.open_threats > 0);

    // One combined list so an operator has a single place to look, sorted worst-first.
    const attention = [
        ...withOpenIncidents.map((p) => ({ patient: p, reason: 'Unacknowledged incident', tone: 'critical' as const })),
        ...degrading.map((p) => ({ patient: p, reason: 'Cognitive trend declining', tone: 'serious' as const })),
        ...dormant.map((p) => ({ patient: p, reason: 'No completed review in over a week', tone: 'warning' as const })),
    ];

    return (
        <>
            <header className="page-head">
                <h1>Overview</h1>
                <p>Everything on the platform at a glance — accounts, activity, and who needs looking at.</p>
            </header>

            <div className="tile-row">
                <Tile label="Caregivers" value={kpi.data?.caregivers ?? 0} />
                <Tile
                    label="Patients"
                    value={kpi.data?.patients ?? 0}
                    hint={`${kpi.data?.paired_patients ?? 0} with a paired device`}
                />
                <Tile label="Memory assets" value={kpi.data?.assets ?? 0} />
                <Tile label="Training answers" value={kpi.data?.sessions ?? 0} />
                <Tile label="AR recognitions" value={kpi.data?.recognitions ?? 0} />
                <Tile
                    label="Open incidents"
                    value={(kpi.data?.open_threats ?? 0) + (kpi.data?.open_context_alerts ?? 0)}
                    hint={`${kpi.data?.open_threats ?? 0} threats · ${kpi.data?.open_context_alerts ?? 0} alerts`}
                />
            </div>

            <div className="controls">
                <span className="muted">Range</span>
                <Segmented
                    value={range}
                    onChange={setRange}
                    options={[
                        { value: '30', label: '30 days' },
                        { value: '90', label: '90 days' },
                        { value: '180', label: '180 days' },
                    ]}
                />
            </div>

            {growth.isLoading ? <Loading what="growth" /> : growth.error ? <ErrorState error={growth.error} /> : (
                <div className="chart-grid">
                    <ChartFrame title="Activity" subtitle="Training answers and AR recognitions per day.">
                        <TimeSeries
                            data={growth.data ?? []}
                            xKey="day"
                            series={[
                                { key: 'sessions', label: 'Training answers' },
                                { key: 'recognitions', label: 'AR recognitions' },
                            ]}
                        />
                    </ChartFrame>

                    {/* Its own chart rather than a second axis on the one above: patient counts and
                        answer counts are different magnitudes, and one y-scale can only serve one. */}
                    <ChartFrame title="Active patients" subtitle="Distinct patients who answered at least one question that day.">
                        <TimeSeries
                            data={growth.data ?? []}
                            xKey="day"
                            series={[{ key: 'active_patients', label: 'Active patients', color: seriesColor(2) }]}
                            yDomain={[0, 'auto']}
                        />
                    </ChartFrame>

                    <ChartFrame title="New accounts" subtitle="Sign-ups and patient records created per day.">
                        <Bars
                            data={growth.data ?? []}
                            xKey="day"
                            stacked
                            series={[
                                { key: 'new_caregivers', label: 'Caregivers' },
                                { key: 'new_patients', label: 'Patients' },
                            ]}
                        />
                    </ChartFrame>

                    <ChartFrame title="Device pairing" subtitle="Lifetime pairing tokens by outcome.">
                        {funnel.data ? (
                            <>
                                <div className="tile-row" style={{ marginBottom: 0 }}>
                                    <Tile label="Issued" value={funnel.data.issued} />
                                    <Tile
                                        label="Used"
                                        value={funnel.data.used}
                                        hint={formatPercent(funnel.data.issued ? funnel.data.used / funnel.data.issued : 0)}
                                    />
                                    <Tile label="Expired unused" value={funnel.data.expired_unused} />
                                    <Tile label="Still valid" value={funnel.data.pending} />
                                </div>
                                {funnel.data.used === 0 && funnel.data.issued > 0 && (
                                    <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                                        No token has ever been marked used. The pair-device edge function does not
                                        write <span className="mono">used_at</span>, so this reads 0% regardless of how
                                        many devices actually paired.
                                    </p>
                                )}
                            </>
                        ) : <Loading what="pairing data" />}
                    </ChartFrame>
                </div>
            )}

            <Panel title="Needs attention" subtitle="Patients with an open incident, a declining trend, or no recent activity.">
                {attention.length === 0 ? (
                    <Empty>Nothing flagged. Every patient has been active recently with no open incidents.</Empty>
                ) : (
                    <DataTable
                        rows={attention}
                        rowKey={(a) => `${a.reason}-${a.patient.patient_id}`}
                        columns={[
                            {
                                key: 'patient',
                                header: 'Patient',
                                sortValue: (a) => a.patient.patient_name ?? '',
                                render: (a) => <Link to={`/users/patient/${a.patient.patient_id}`}>{a.patient.patient_name ?? '—'}</Link>,
                            },
                            {
                                key: 'caregiver', header: 'Caregiver',
                                sortValue: (a) => a.patient.caregiver_name ?? '',
                                render: (a) => a.patient.caregiver_name ?? '—',
                            },
                            {
                                key: 'reason', header: 'Reason',
                                sortValue: (a) => a.reason,
                                render: (a) => <Pill tone={a.tone}>{a.reason}</Pill>,
                            },
                            {
                                key: 'last', header: 'Last active', numeric: true,
                                sortValue: (a) => daysSince(a.patient.last_active_day) ?? Number.MAX_SAFE_INTEGER,
                                render: (a) => {
                                    const d = daysSince(a.patient.last_active_day);
                                    return d === null ? 'Never' : d === 0 ? 'Today' : `${d}d ago`;
                                },
                            },
                        ]}
                        initialSort={{ key: 'last', desc: true }}
                    />
                )}
            </Panel>

            <Panel title="Account activity" subtitle={`Dormant means no completed daily review in the last ${DORMANT_AFTER_DAYS} days.`}>
                <div className="tile-row" style={{ marginBottom: 0 }}>
                    <Tile label="Active patients" value={rows.length - dormant.length} />
                    <Tile label="Dormant patients" value={dormant.length} />
                    <Tile label="Never trained" value={rows.filter((p: PatientOverview) => p.sessions_total === 0).length} />
                    <Tile label="Declining trend" value={degrading.length} />
                </div>
            </Panel>
        </>
    );
}
