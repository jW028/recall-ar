import type { ReactNode } from 'react';

export function Panel({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
    return (
        <section className="panel">
            {title && <h2>{title}</h2>}
            {subtitle && <p className="panel-sub">{subtitle}</p>}
            {children}
        </section>
    );
}

export function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
    return (
        <div className="tile">
            <div className="label">{label}</div>
            <div className="value">{value}</div>
            {hint && <div className="hint">{hint}</div>}
        </div>
    );
}

export type PillTone = 'neutral' | 'good' | 'warning' | 'serious' | 'critical';

// Status colour never travels alone: every pill carries its own label text.
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
    return <span className={tone === 'neutral' ? 'pill' : `pill ${tone}`}>{children}</span>;
}

export function Loading({ what = 'data' }: { what?: string }) {
    return <div className="loading">Loading {what}…</div>;
}

export function ErrorState({ error }: { error: unknown }) {
    const message = error instanceof Error ? error.message : String(error);
    return <div className="error">Could not load: {message}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
    return <div className="empty">{children}</div>;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
    return (
        <div className="legend">
            {items.map((i) => (
                <span key={i.label}>
                    <i className="swatch" style={{ background: i.color }} />
                    {i.label}
                </span>
            ))}
        </div>
    );
}

// Segmented timeframe control, mirroring the caregiver app's own 7d/30d selector.
export function Segmented<T extends string>({
    options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
    return (
        <div className="seg">
            {options.map((o) => (
                <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
                    {o.label}
                </button>
            ))}
        </div>
    );
}
