import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface Column<T> {
    key: string;
    header: string;
    numeric?: boolean;
    // Value used for sorting. Omit to make the column unsortable.
    sortValue?: (row: T) => string | number | null;
    render: (row: T) => ReactNode;
}

interface Props<T> {
    rows: T[];
    columns: Column<T>[];
    rowKey: (row: T) => string;
    onRowClick?: (row: T) => void;
    initialSort?: { key: string; desc: boolean };
    empty?: string;
}

// Sortable table. Nulls always sink to the bottom regardless of direction, because "never trained"
// is not a small number — sorting it as one would put dormant patients at the top of an accuracy list.
export function DataTable<T>({ rows, columns, rowKey, onRowClick, initialSort, empty = 'Nothing to show.' }: Props<T>) {
    const [sort, setSort] = useState(initialSort ?? null);

    const sorted = useMemo(() => {
        if (!sort) return rows;
        const col = columns.find((c) => c.key === sort.key);
        if (!col?.sortValue) return rows;
        const dir = sort.desc ? -1 : 1;
        return [...rows].sort((a, b) => {
            const av = col.sortValue!(a);
            const bv = col.sortValue!(b);
            if (av === null && bv === null) return 0;
            if (av === null) return 1;
            if (bv === null) return -1;
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv)) * dir;
        });
    }, [rows, columns, sort]);

    if (rows.length === 0) return <div className="empty">{empty}</div>;

    return (
        <div className="table-wrap">
            <table>
                <thead>
                    <tr>
                        {columns.map((c) => {
                            const sortable = Boolean(c.sortValue);
                            const active = sort?.key === c.key;
                            return (
                                <th
                                    key={c.key}
                                    className={`${c.numeric ? 'num' : ''} ${sortable ? '' : 'no-sort'}`.trim()}
                                    onClick={sortable ? () => setSort({ key: c.key, desc: active ? !sort!.desc : true }) : undefined}
                                >
                                    {c.header}
                                    {active ? (sort!.desc ? ' ↓' : ' ↑') : ''}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((row) => (
                        <tr
                            key={rowKey(row)}
                            className={onRowClick ? 'clickable' : undefined}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                        >
                            {columns.map((c) => (
                                <td key={c.key} className={c.numeric ? 'num' : undefined}>{c.render(row)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
