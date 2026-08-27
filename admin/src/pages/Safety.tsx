import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bars, ChartFrame, histogram, seriesColor } from '../components/charts';
import { DataTable } from '../components/DataTable';
import { Empty, ErrorState, Loading, Panel, Pill, Segmented, Tile } from '../components/ui';
import { fetchIncidents, fetchPatients } from '../lib/adminApi';
import { formatDateTime, formatDuration } from '../lib/format';

type Filter = 'unacked' | 'all' | 'threats';

const KIND_LABEL: Record<string, string> = {
    threat: 'Threat',
    context_alert: 'Context alert',
    geofence: 'Geofence',
};

export function Safety() {
    const navigate = useNavigate();
    const [filter, setFilter] = useState<Filter>('unacked');

    const incidents = useQuery({ queryKey: ['incidents'], queryFn: () => fetchIncidents() });
    const patients = useQuery({ queryKey: ['patients'], queryFn: fetchPatients });

    const nameOf = useMemo(() => {
        const map = new Map((patients.data ?? []).map((p) => [p.patient_id, p.patient_name ?? '—']));
        return (id: string) => map.get(id) ?? '—';
    }, [patients.data]);

    if (incidents.isLoading) return <Loading what="the incident feed" />;
    if (incidents.error) return <ErrorState error={incidents.error} />;

    const all = incidents.data ?? [];
    // Geofence crossings have no acknowledgement concept, so they are never "unacknowledged".
    const ackable = all.filter((i) => i.kind !== 'geofence');
    const unacked = ackable.filter((i) => !i.acknowledged_at);

    const shown =
        filter === 'unacked' ? unacked :
        filter === 'threats' ? all.filter((i) => i.kind === 'threat') :
        all;

    const latencies = ackable
        .map((i) => i.ack_latency_seconds)
        .filter((v): v is number => v !== null && v >= 0);
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const medianLatency = sortedLatencies.length ? sortedLatencies[Math.floor(sortedLatencies.length / 2)] : null;
    const worstLatency = sortedLatencies.length ? sortedLatencies[sortedLatencies.length - 1] : null;

    const latencyBuckets = histogram(
        latencies,
        [60, 300, 1800, 86400, Infinity],
        ['<1m', '1–5m', '5–30m', '30m–1d', '1d+']
    );

    // Incidents per day by source, so a spike in one kind is visible against the others.
    const byDay = new Map<string, { day: string; threat: number; context_alert: number; geofence: number }>();
    for (const i of all) {
        const day = i.occurred_at.slice(0, 10);
        const entry = byDay.get(day) ?? { day, threat: 0, context_alert: 0, geofence: 0 };
        entry[i.kind] += 1;
        byDay.set(day, entry);
    }
    const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-60);

    return (
        <>
            <header className="page-head">
                <h1>Safety</h1>
                <p>
                    Panic-button presses, fall detections, geofence crossings and context alerts across every
                    patient. Acknowledgement latency is the gap between an incident being detected and a
                    caregiver acknowledging it — the number that says whether the alerting chain is working.
                </p>
            </header>

            <div className="tile-row">
                <Tile
                    label="Unacknowledged"
                    value={unacked.length}
                    hint={unacked.length > 0 ? 'needs attention now' : 'all clear'}
                />
                <Tile label="Threats" value={all.filter((i) => i.kind === 'threat').length} hint="panic and fall" />
                <Tile label="Context alerts" value={all.filter((i) => i.kind === 'context_alert').length} />
                <Tile label="Geofence crossings" value={all.filter((i) => i.kind === 'geofence').length} />
                <Tile label="Median ack time" value={formatDuration(medianLatency)} />
                <Tile label="Worst ack time" value={formatDuration(worstLatency)} />
            </div>

            <div className="chart-grid">
                <ChartFrame title="Incidents per day" subtitle="Last 60 days with any activity, split by source.">
                    {daily.length === 0 ? <Empty>No incidents recorded.</Empty> : (
                        <Bars
                            data={daily}
                            xKey="day"
                            stacked
                            series={[
                                { key: 'threat', label: 'Threats', color: seriesColor(0) },
                                { key: 'context_alert', label: 'Context alerts', color: seriesColor(1) },
                                { key: 'geofence', label: 'Geofence', color: seriesColor(2) },
                            ]}
                        />
                    )}
                </ChartFrame>

                <ChartFrame title="Acknowledgement latency" subtitle="How long acknowledged incidents waited. Excludes geofence crossings, which are not acknowledged.">
                    {latencies.length === 0 ? <Empty>Nothing has been acknowledged yet.</Empty> : (
                        <Bars
                            data={latencyBuckets}
                            xKey="bucket"
                            xFormatter={(v) => v}
                            series={[{ key: 'count', label: 'Incidents', color: seriesColor(3) }]}
                        />
                    )}
                </ChartFrame>
            </div>

            <div className="controls">
                <Segmented
                    value={filter}
                    onChange={setFilter}
                    options={[
                        { value: 'unacked', label: `Unacknowledged (${unacked.length})` },
                        { value: 'threats', label: 'Threats only' },
                        { value: 'all', label: `All (${all.length})` },
                    ]}
                />
            </div>

            <Panel>
                {shown.length === 0 ? (
                    <Empty>
                        {filter === 'unacked' ? 'Every incident has been acknowledged.' : 'No incidents recorded.'}
                    </Empty>
                ) : (
                    <DataTable
                        rows={shown}
                        rowKey={(i) => `${i.kind}-${i.source_id}`}
                        onRowClick={(i) => navigate(`/users/patient/${i.patient_id}`)}
                        initialSort={{ key: 'when', desc: true }}
                        columns={[
                            {
                                key: 'kind', header: 'Source', sortValue: (i) => i.kind,
                                render: (i) => <Pill tone={i.kind === 'threat' ? 'critical' : 'neutral'}>{KIND_LABEL[i.kind] ?? i.kind}</Pill>,
                            },
                            { key: 'subtype', header: 'Type', sortValue: (i) => i.subtype ?? '', render: (i) => i.subtype ?? '—' },
                            { key: 'patient', header: 'Patient', sortValue: (i) => nameOf(i.patient_id), render: (i) => nameOf(i.patient_id) },
                            { key: 'when', header: 'Detected', sortValue: (i) => i.occurred_at, render: (i) => formatDateTime(i.occurred_at) },
                            { key: 'status', header: 'Status', sortValue: (i) => i.status ?? '', render: (i) => i.status ?? '—' },
                            {
                                key: 'ack', header: 'Acknowledged in', numeric: true,
                                sortValue: (i) => i.ack_latency_seconds,
                                render: (i) => i.kind === 'geofence'
                                    ? <span className="muted">n/a</span>
                                    : i.acknowledged_at
                                        ? formatDuration(i.ack_latency_seconds)
                                        : <Pill tone="warning">Waiting</Pill>,
                            },
                            { key: 'msg', header: 'Detail', render: (i) => <span className="muted">{i.message ?? '—'}</span> },
                        ]}
                    />
                )}
            </Panel>
        </>
    );
}
