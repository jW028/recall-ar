import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bars, ChartFrame, histogram, seriesColor } from '../components/charts';
import { DataTable } from '../components/DataTable';
import { Empty, ErrorState, Loading, Panel, Pill, Segmented, Tile } from '../components/ui';
import { fetchPatientDaily, fetchPatients } from '../lib/adminApi';
import { computeAllBiomarkers } from '../lib/biomarkers';
import { formatMs, formatPercent } from '../lib/format';

const TREND_TONE = { improving: 'good', stable: 'neutral', declining: 'serious' } as const;
const TREND_RANK = { declining: 0, stable: 1, improving: 2 } as const;

export function Clinical() {
    const [timeframe, setTimeframe] = useState<'7' | '30'>('30');
    const navigate = useNavigate();

    const patients = useQuery({ queryKey: ['patients'], queryFn: fetchPatients });
    const daily = useQuery({ queryKey: ['patientDaily'], queryFn: fetchPatientDaily });

    if (patients.isLoading || daily.isLoading) return <Loading what="clinical data" />;
    if (daily.error) return <ErrorState error={daily.error} />;

    const bio = computeAllBiomarkers(daily.data ?? [], Number(timeframe));
    const rows = (patients.data ?? []).map((p) => ({ patient: p, bio: bio.get(p.patient_id) ?? null }));
    const measured = rows.filter((r) => r.bio && !r.bio.insufficientData);

    const accuracies = measured.map((r) => r.bio!.currentAccuracy).filter((v): v is number => v !== null);
    const latencies = measured.map((r) => r.bio!.currentMedianLatencyMs).filter((v): v is number => v !== null);

    const accuracyBuckets = histogram(
        accuracies,
        [0.2, 0.4, 0.6, 0.8, Infinity],
        ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%']
    );
    const latencyBuckets = histogram(
        latencies,
        [1000, 2000, 3000, 5000, Infinity],
        ['<1s', '1–2s', '2–3s', '3–5s', '5s+']
    );

    const degradingCount = measured.filter((r) => r.bio!.isDegrading).length;

    return (
        <>
            <header className="page-head">
                <h1>Clinical</h1>
                <p>
                    Cognitive biomarkers across every patient. Accuracy and median response latency are smoothed
                    over 7 days before a trend line is fitted, and a patient is only judged once they have at
                    least 10 answers across 5 separate days — the same rules the caregiver app applies, running
                    the same code.
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
                <Tile label="Patients measured" value={measured.length} hint={`${rows.length - measured.length} below the data threshold`} />
                <Tile label="Flagged declining" value={degradingCount} hint="accuracy falling or latency rising" />
                <Tile
                    label="Median accuracy"
                    value={accuracies.length ? formatPercent(accuracies.slice().sort((a, b) => a - b)[Math.floor(accuracies.length / 2)], 1) : '—'}
                />
                <Tile
                    label="Median latency"
                    value={latencies.length ? formatMs(latencies.slice().sort((a, b) => a - b)[Math.floor(latencies.length / 2)]) : '—'}
                />
            </div>

            <div className="chart-grid">
                <ChartFrame title="Accuracy distribution" subtitle="Patients grouped by their current smoothed accuracy.">
                    <Bars
                        data={accuracyBuckets}
                        xKey="bucket"
                        series={[{ key: 'count', label: 'Patients', color: seriesColor(0) }]}
                        xFormatter={(v) => v}
                    />
                </ChartFrame>
                <ChartFrame title="Latency distribution" subtitle="Patients grouped by their current smoothed median response time.">
                    <Bars
                        data={latencyBuckets}
                        xKey="bucket"
                        series={[{ key: 'count', label: 'Patients', color: seriesColor(1) }]}
                        xFormatter={(v) => v}
                    />
                </ChartFrame>
            </div>

            <Panel title="Per-patient trends" subtitle="Sorted so declining patients surface first.">
                {rows.length === 0 ? <Empty>No patients yet.</Empty> : (
                    <DataTable
                        rows={rows}
                        rowKey={(r) => r.patient.patient_id}
                        onRowClick={(r) => navigate(`/users/patient/${r.patient.patient_id}`)}
                        initialSort={{ key: 'trend', desc: false }}
                        columns={[
                            { key: 'name', header: 'Patient', sortValue: (r) => r.patient.patient_name ?? '', render: (r) => r.patient.patient_name ?? '—' },
                            { key: 'caregiver', header: 'Caregiver', sortValue: (r) => r.patient.caregiver_name ?? '', render: (r) => r.patient.caregiver_name ?? '—' },
                            {
                                key: 'trend', header: 'Trend',
                                sortValue: (r) => (r.bio && !r.bio.insufficientData ? TREND_RANK[r.bio.trendDirection] : 3),
                                render: (r) => !r.bio || r.bio.insufficientData
                                    ? <span className="muted">Not enough data</span>
                                    : <Pill tone={TREND_TONE[r.bio.trendDirection]}>{r.bio.trendDirection}</Pill>,
                            },
                            {
                                key: 'accuracy', header: 'Accuracy', numeric: true,
                                sortValue: (r) => r.bio?.currentAccuracy ?? null,
                                render: (r) => formatPercent(r.bio?.currentAccuracy, 1),
                            },
                            {
                                key: 'latency', header: 'Median latency', numeric: true,
                                sortValue: (r) => r.bio?.currentMedianLatencyMs ?? null,
                                render: (r) => formatMs(r.bio?.currentMedianLatencyMs),
                            },
                            {
                                key: 'accSlope', header: 'Accuracy / day', numeric: true,
                                sortValue: (r) => r.bio?.accuracySlope ?? null,
                                render: (r) => r.bio ? `${(r.bio.accuracySlope * 100).toFixed(2)}pp` : '—',
                            },
                            {
                                key: 'latSlope', header: 'Latency / day', numeric: true,
                                sortValue: (r) => r.bio?.latencySlope ?? null,
                                render: (r) => r.bio ? `${r.bio.latencySlope >= 0 ? '+' : ''}${Math.round(r.bio.latencySlope)}ms` : '—',
                            },
                            { key: 'streak', header: 'Streak', numeric: true, sortValue: (r) => r.bio?.currentStreakDays ?? 0, render: (r) => `${r.bio?.currentStreakDays ?? 0}d` },
                            { key: 'answers', header: 'Answers', numeric: true, sortValue: (r) => r.bio?.sessionsCount ?? 0, render: (r) => r.bio?.sessionsCount ?? 0 },
                        ]}
                    />
                )}
            </Panel>
        </>
    );
}
