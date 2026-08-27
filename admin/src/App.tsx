import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { fetchTickets, isAdmin } from './lib/adminApi';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Users } from './pages/Users';
import { CaregiverDetail } from './pages/CaregiverDetail';
import { PatientDetail } from './pages/PatientDetail';
import { Clinical } from './pages/Clinical';
import { Content } from './pages/Content';
import { Safety } from './pages/Safety';
import { Audit } from './pages/Audit';
import { Support } from './pages/Support';
import { SupportTicket } from './pages/SupportTicket';

type Gate = 'checking' | 'signed-out' | 'not-admin' | 'admin';

const NAV = [
    { to: '/', label: 'Overview', end: true },
    { to: '/users', label: 'Users' },
    { to: '/clinical', label: 'Clinical' },
    { to: '/content', label: 'Content' },
    { to: '/safety', label: 'Safety' },
    { to: '/support', label: 'Support' },
    { to: '/audit', label: 'Audit log' },
];

export function App() {
    const [session, setSession] = useState<Session | null>(null);
    const [gate, setGate] = useState<Gate>('checking');

    // Only queried once the admin gate passes, so a signed-out session never fires it.
    const tickets = useQuery({ queryKey: ['tickets'], queryFn: fetchTickets, enabled: gate === 'admin' });
    const unreadTickets = (tickets.data ?? []).filter((t) => t.has_unread).length;

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => setSession(data.session));
        const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
        return () => sub.subscription.unsubscribe();
    }, []);

    useEffect(() => {
        let cancelled = false;
        if (!session) {
            setGate('signed-out');
            return;
        }
        setGate('checking');
        // Client-side gate for UX only. The real enforcement is RLS: a non-admin who bypassed this
        // screen would still get empty results from every admin_* view.
        isAdmin().then((ok) => {
            if (!cancelled) setGate(ok ? 'admin' : 'not-admin');
        });
        return () => { cancelled = true; };
    }, [session]);

    if (gate === 'checking') return <div className="login-wrap"><div className="muted">Checking access…</div></div>;
    if (gate === 'signed-out') return <Login />;

    if (gate === 'not-admin') {
        return (
            <div className="login-wrap">
                <div className="login-card">
                    <h1>Not authorized</h1>
                    <p>
                        This account is signed in but is not an administrator. Admin access is granted by
                        membership in <span className="mono">admin_users</span>, not by any role on the account.
                    </p>
                    <button onClick={() => supabase.auth.signOut()}>Sign out</button>
                </div>
            </div>
        );
    }

    return (
        <div className="shell">
            <nav className="sidebar">
                <div className="brand">
                    RecallAR
                    <small>Admin</small>
                </div>
                {NAV.map((n) => (
                    <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                        {n.label}
                        {n.to === '/support' && unreadTickets > 0 && (
                            <span className="nav-badge">{unreadTickets}</span>
                        )}
                    </NavLink>
                ))}
                <div className="sidebar-footer">
                    <div style={{ marginBottom: 8, wordBreak: 'break-all' }}>{session?.user.email}</div>
                    <button onClick={() => supabase.auth.signOut()}>Sign out</button>
                </div>
            </nav>
            <main className="main">
                <Routes>
                    <Route path="/" element={<Overview />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/users/caregiver/:caregiverId" element={<CaregiverDetail />} />
                    <Route path="/users/patient/:patientId" element={<PatientDetail />} />
                    <Route path="/clinical" element={<Clinical />} />
                    <Route path="/content" element={<Content />} />
                    <Route path="/safety" element={<Safety />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/support/:ticketId" element={<SupportTicket />} />
                    <Route path="/audit" element={<Audit />} />
                </Routes>
            </main>
        </div>
    );
}
