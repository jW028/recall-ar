import {
    Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { Legend } from './ui';

// Recharts cannot read CSS custom properties, so the tokens are resolved once at module load and
// re-resolved when the OS theme flips. Keeping the values in one place means the charts and the
// surrounding chrome never drift apart.
function token(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export const SERIES = [
    () => token('--series-1'),
    () => token('--series-2'),
    () => token('--series-3'),
    () => token('--series-4'),
];

export function seriesColor(i: number): string {
    return SERIES[i % SERIES.length]();
}

const axisStyle = { fontSize: 11, fill: 'var(--text-muted)' } as const;

// Dates arrive as YYYY-MM-DD; show them short so a 90-day axis stays readable.
function shortDay(day: string): string {
    return day.slice(5).replace('-', '/');
}

interface TooltipPayloadEntry {
    name?: string | number;
    value?: string | number;
    color?: string;
}

function ChartTooltip({ active, payload, label, format }: {
    active?: boolean;
    payload?: TooltipPayloadEntry[];
    label?: string | number;
    format?: (v: number) => string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div className="tooltip">
            <div className="t-date">{String(label)}</div>
            {payload.map((p, i) => (
                <div className="t-row" key={i}>
                    <span>
                        <i className="swatch" style={{ background: p.color, marginRight: 6 }} />
                        {String(p.name)}
                    </span>
                    <b>{format && typeof p.value === 'number' ? format(p.value) : String(p.value ?? '—')}</b>
                </div>
            ))}
        </div>
    );
}

export interface SeriesSpec {
    key: string;
    label: string;
    color?: string;
}

// Time series. One y-axis only — two measures of different magnitude get two charts, never two scales.
export function TimeSeries<T>({
    data, xKey, series, height = 200, format, yDomain,
}: {
    data: T[];
    xKey: string;
    series: SeriesSpec[];
    height?: number;
    format?: (v: number) => string;
    yDomain?: [number | 'auto', number | 'auto'];
}) {
    const colors = series.map((s, i) => s.color ?? seriesColor(i));
    return (
        <>
            {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} />}
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey={xKey} tickFormatter={shortDay} tick={axisStyle} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} minTickGap={28} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={yDomain} tickFormatter={format} width={52} />
                    <Tooltip content={<ChartTooltip format={format} />} cursor={{ stroke: 'var(--axis)' }} />
                    {series.map((s, i) => (
                        <Line
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.label}
                            stroke={colors[i]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
                            connectNulls={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </>
    );
}

// Bars, optionally stacked. The 2px surface-coloured stroke is the gap the spec calls for between
// stacked segments, so adjacent fills never read as one block.
export function Bars<T>({
    data, xKey, series, stacked = false, height = 200, format, xFormatter,
}: {
    data: T[];
    xKey: string;
    series: SeriesSpec[];
    stacked?: boolean;
    height?: number;
    format?: (v: number) => string;
    xFormatter?: (v: string) => string;
}) {
    const colors = series.map((s, i) => s.color ?? seriesColor(i));
    return (
        <>
            {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} />}
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="var(--grid)" vertical={false} />
                    <XAxis dataKey={xKey} tickFormatter={xFormatter ?? shortDay} tick={axisStyle} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} minTickGap={20} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={format} width={52} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: 'color-mix(in srgb, currentColor 6%, transparent)' }} />
                    {series.map((s, i) => (
                        <Bar
                            key={s.key}
                            dataKey={s.key}
                            name={s.label}
                            stackId={stacked ? 'a' : undefined}
                            fill={colors[i]}
                            radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
                            stroke="var(--surface-1)"
                            strokeWidth={stacked ? 2 : 0}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </>
    );
}

export function ChartFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
    return (
        <section className="panel">
            <h2>{title}</h2>
            {subtitle && <p className="panel-sub">{subtitle}</p>}
            {children}
        </section>
    );
}

// Buckets values into fixed ranges for a distribution view. Returns bucket labels plus counts.
export function histogram(values: number[], edges: number[], labels: string[]): { bucket: string; count: number }[] {
    const counts = new Array(labels.length).fill(0);
    for (const v of values) {
        let idx = edges.findIndex((e) => v < e);
        if (idx === -1) idx = labels.length - 1;
        counts[idx] += 1;
    }
    return labels.map((bucket, i) => ({ bucket, count: counts[i] }));
}
