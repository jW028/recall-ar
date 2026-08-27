import { useState } from 'react';

interface Props {
    title: string;
    confirmWord: string;
    consequences: string[];
    actionLabel: string;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

// Type-the-name confirmation. Deliberately not a plain "are you sure": this schema has no soft
// deletes and no tombstones, so nothing here is recoverable and every dashboard count shifts after.
export function ConfirmDestructive({ title, confirmWord, consequences, actionLabel, busy, onCancel, onConfirm }: Props) {
    const [typed, setTyped] = useState('');
    const matches = typed.trim() === confirmWord;

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h3>{title}</h3>
                <p>This cannot be undone. It will:</p>
                <ul>
                    {consequences.map((c) => <li key={c}>{c}</li>)}
                </ul>
                <p className="muted">
                    The patient device keeps its own local SQLite copy until the app is reinstalled — this
                    removes the cloud record, it is not a remote wipe.
                </p>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Type <b className="mono">{confirmWord}</b> to confirm
                </label>
                <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder={confirmWord}
                    style={{ width: '100%', marginTop: 4 }}
                    autoFocus
                />
                <div className="modal-actions">
                    <button onClick={onCancel} disabled={busy}>Cancel</button>
                    <button className="danger" disabled={!matches || busy} onClick={onConfirm}>
                        {busy ? 'Working…' : actionLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
