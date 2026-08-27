import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bars, ChartFrame, TimeSeries, seriesColor } from '../components/charts';
import { DataTable } from '../components/DataTable';
import { Empty, ErrorState, Loading, Panel, Pill, Tile } from '../components/ui';
import { fetchAssetStats, fetchEmbeddingMix, fetchGrowth, fetchKpi } from '../lib/adminApi';

const POOL_CAP = 45;

export function Content() {
    const navigate = useNavigate();
    const stats = useQuery({ queryKey: ['assetStats'], queryFn: fetchAssetStats });
    const mix = useQuery({ queryKey: ['embeddingMix'], queryFn: fetchEmbeddingMix });
    const growth = useQuery({ queryKey: ['growth', '90'], queryFn: () => fetchGrowth(90) });
    const kpi = useQuery({ queryKey: ['kpi'], queryFn: fetchKpi });

    if (stats.isLoading) return <Loading what="content stats" />;
    if (stats.error) return <ErrorState error={stats.error} />;

    const rows = stats.data ?? [];
    const totals = rows.reduce(
        (acc, r) => ({
            person: acc.person + r.person_count,
            object: acc.object + r.object_count,
            onboarding: acc.onboarding + r.onboarding_count,
            maintenance: acc.maintenance + r.maintenance_count,
            paused: acc.paused + r.paused_count,
            missing: acc.missing + r.missing_embedding_count,
        }),
        { person: 0, object: 0, onboarding: 0, maintenance: 0, paused: 0, missing: 0 }
    );

    // Per-patient pool occupancy, ordered so the accounts nearest the cap read first.
    const poolRows = [...rows].sort((a, b) => b.active_pool_size - a.active_pool_size).slice(0, 15).map((r) => ({
        name: r.patient_name ?? '—',
        onboarding: r.onboarding_count,
        maintenance: r.maintenance_count,
        headroom: Math.max(0, POOL_CAP - r.active_pool_size),
    }));

    const modelRows = mix.data ?? [];
    const stale = modelRows.filter((m) => m.embedding_model === 'unknown');

    return (
        <>
            <header className="page-head">
                <h1>Content</h1>
                <p>
                    What patients have enrolled and how much of it the AR layer actually sees. A memory asset is a
                    person or object with an averaged face/feature embedding; each patient&apos;s active pool is
                    capped at {POOL_CAP}.
                </p>
            </header>

            <div className="tile-row">
                <Tile label="Total assets" value={kpi.data?.assets ?? 0} />
                <Tile label="People" value={totals.person} />
                <Tile label="Objects" value={totals.object} />
                <Tile label="Onboarding" value={totals.onboarding} hint="still climbing the interval ladder" />
                <Tile label="Mastered" value={totals.maintenance} hint="graduated to maintenance" />
                <Tile label="Paused" value={totals.paused} />
            </div>

            <div className="chart-grid">
                <ChartFrame title="Pool occupancy" subtitle={`Active assets per patient against the ${POOL_CAP}-asset cap. Paused assets do not count.`}>
                    {poolRows.length === 0 ? <Empty>No assets enrolled yet.</Empty> : (
                        <Bars
                            data={poolRows}
                            xKey="name"
                            stacked
                            xFormatter={(v) => v}
                            series={[
                                { key: 'onboarding', label: 'Onboarding', color: seriesColor(0) },
                                { key: 'maintenance', label: 'Mastered', color: seriesColor(2) },
                                { key: 'headroom', label: 'Headroom', color: 'var(--grid)' },
                            ]}
                        />
                    )}
                </ChartFrame>

                <ChartFrame title="AR recognitions" subtitle="One event per asset per patient per day, so this counts distinct recognitions rather than frames.">
                    {growth.data ? (
                        <TimeSeries
                            data={growth.data}
                            xKey="day"
                            series={[{ key: 'recognitions', label: 'Recognitions', color: seriesColor(1) }]}
                            yDomain={[0, 'auto']}
                        />
                    ) : <Loading what="recognition history" />}
                </ChartFrame>
            </div>

            <Panel title="Embedding models" subtitle="People are embedded at 512 dimensions and objects at 1280. Vectors from a retired model cannot be compared against current ones.">
                {modelRows.length === 0 ? <Empty>No assets enrolled yet.</Empty> : (
                    <>
                        <DataTable
                            rows={modelRows}
                            rowKey={(m) => `${m.type}-${m.embedding_model}`}
                            initialSort={{ key: 'count', desc: true }}
                            columns={[
                                { key: 'type', header: 'Asset type', sortValue: (m) => m.type, render: (m) => m.type },
                                { key: 'model', header: 'Model', sortValue: (m) => m.embedding_model, render: (m) => <span className="mono">{m.embedding_model}</span> },
                                { key: 'count', header: 'Assets', numeric: true, sortValue: (m) => m.asset_count, render: (m) => m.asset_count },
                            ]}
                        />
                        {stale.length > 0 && (
                            <p className="muted" style={{ marginTop: 12, marginBottom: 0 }}>
                                {stale.reduce((n, m) => n + m.asset_count, 0)} asset(s) have no recorded embedding model.
                                These predate the model-tagging column and cannot be verified against the current index.
                            </p>
                        )}
                        {totals.missing > 0 && (
                            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                                {totals.missing} asset(s) have no embedding at all and will never be recognised.
                            </p>
                        )}
                    </>
                )}
            </Panel>

            <Panel title="Per-patient breakdown">
                <DataTable
                    rows={rows}
                    rowKey={(r) => r.patient_id}
                    onRowClick={(r) => navigate(`/users/patient/${r.patient_id}`)}
                    initialSort={{ key: 'total', desc: true }}
                    empty="No assets enrolled yet."
                    columns={[
                        { key: 'name', header: 'Patient', sortValue: (r) => r.patient_name ?? '', render: (r) => r.patient_name ?? '—' },
                        { key: 'total', header: 'Assets', numeric: true, sortValue: (r) => r.total_assets, render: (r) => r.total_assets },
                        { key: 'person', header: 'People', numeric: true, sortValue: (r) => r.person_count, render: (r) => r.person_count },
                        { key: 'object', header: 'Objects', numeric: true, sortValue: (r) => r.object_count, render: (r) => r.object_count },
                        { key: 'onboarding', header: 'Onboarding', numeric: true, sortValue: (r) => r.onboarding_count, render: (r) => r.onboarding_count },
                        { key: 'mastered', header: 'Mastered', numeric: true, sortValue: (r) => r.maintenance_count, render: (r) => r.maintenance_count },
                        { key: 'paused', header: 'Paused', numeric: true, sortValue: (r) => r.paused_count, render: (r) => r.paused_count },
                        {
                            key: 'pool', header: 'Pool used', numeric: true,
                            sortValue: (r) => r.pool_utilisation_pct,
                            render: (r) => (
                                <>
                                    {r.active_pool_size}/{POOL_CAP}{' '}
                                    {r.pool_utilisation_pct >= 90 && <Pill tone="warning">near cap</Pill>}
                                </>
                            ),
                        },
                    ]}
                />
            </Panel>
        </>
    );
}
