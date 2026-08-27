// Every read the dashboard performs, plus the one write entry point.
//
// Reads go straight to Postgres against the admin_* views; RLS decides what comes back, so an
// authorization failure surfaces as an empty result rather than a permission error.

import { supabase } from './supabase';
import type { PatientDailyRow } from './biomarkers';

export interface Kpi {
    caregivers: number;
    patients: number;
    paired_patients: number;
    assets: number;
    sessions: number;
    recognitions: number;
    open_threats: number;
    open_context_alerts: number;
    reports_generated: number;
}

export interface GrowthDay {
    day: string;
    new_caregivers: number;
    new_patients: number;
    sessions: number;
    active_patients: number;
    recognitions: number;
}

export interface CaregiverOverview {
    caregiver_id: string;
    full_name: string | null;
    email: string | null;
    caregiver_contact: string | null;
    image_url: string | null;
    created_at: string;
    patient_count: number;
    paired_patient_count: number;
    asset_count: number;
    session_count: number;
    last_session_at: string | null;
    open_ticket_count: number;
}

export interface PatientOverview {
    patient_id: string;
    patient_name: string | null;
    date_of_birth: string | null;
    image_url: string | null;
    created_at: string;
    caregiver_id: string;
    caregiver_name: string | null;
    caregiver_email: string | null;
    auth_user_id: string | null;
    is_paired: boolean;
    asset_count: number;
    onboarding_count: number;
    maintenance_count: number;
    paused_count: number;
    sessions_total: number;
    sessions_correct: number;
    last_session_at: string | null;
    queued_30d: number;
    completed_30d: number;
    last_active_day: string | null;
    open_threats: number;
}

export interface AssetStats {
    patient_id: string;
    patient_name: string | null;
    caregiver_id: string;
    total_assets: number;
    person_count: number;
    object_count: number;
    onboarding_count: number;
    maintenance_count: number;
    paused_count: number;
    active_pool_size: number;
    pool_utilisation_pct: number;
    missing_embedding_count: number;
}

export interface EmbeddingModelMix {
    type: string;
    embedding_model: string;
    asset_count: number;
}

export interface PairingFunnel {
    issued: number;
    used: number;
    expired_unused: number;
    pending: number;
}

export interface Incident {
    kind: 'threat' | 'context_alert' | 'geofence';
    subtype: string | null;
    patient_id: string;
    source_id: string;
    occurred_at: string;
    status: string | null;
    acknowledged_at: string | null;
    ack_latency_seconds: number | null;
    message: string | null;
}

export interface AuthUserStatus {
    user_id: string;
    email: string | null;
    last_sign_in_at: string | null;
    banned_until: string | null;
    email_confirmed_at: string | null;
    created_at: string;
}

export interface AuditEntry {
    id: number;
    actor_user_id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    succeeded: boolean;
    details: Record<string, unknown>;
    created_at: string;
}


export interface SupportTicketRow {
    ticket_id: string;
    caregiver_id: string;
    caregiver_name: string | null;
    caregiver_email: string | null;
    subject: string;
    status: 'open' | 'resolved';
    diagnostics: Record<string, unknown>;
    created_at: string;
    last_message_at: string;
    resolved_at: string | null;
    admin_last_read_at: string | null;
    assigned_to: string | null;
    message_count: number;
    last_author_role: 'caregiver' | 'admin' | null;
    has_unread: boolean;
}

export interface SupportMessageRow {
    message_id: string;
    ticket_id: string;
    author_role: 'caregiver' | 'admin';
    author_user_id: string;
    body: string;
    created_at: string;
}

export interface CaregiverNote {
    note_id: string;
    caregiver_id: string;
    author_user_id: string;
    body: string;
    created_at: string;
}

export interface CaregiverTag {
    caregiver_id: string;
    tag: string;
    created_by: string;
    created_at: string;
}

// Supabase returns bigint counts as strings once they exceed the JS-safe range, and numeric columns
// always as strings. Coercing at the boundary keeps every consumer free of Number() noise.
function toNumber(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
    if (error) throw new Error(error.message);
    return (data ?? []) as T;
}

export async function isAdmin(): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) return false;
    return data === true;
}

export async function fetchKpi(): Promise<Kpi | null> {
    const { data, error } = await supabase.from('admin_kpi').select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toNumber(v)])) as unknown as Kpi;
}

export async function fetchGrowth(days = 90): Promise<GrowthDay[]> {
    const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
    const rows = unwrap<GrowthDay[]>(
        await supabase.from('admin_growth_daily').select('*').gte('day', since).order('day')
    );
    return rows.map((r) => ({
        day: r.day,
        new_caregivers: toNumber(r.new_caregivers),
        new_patients: toNumber(r.new_patients),
        sessions: toNumber(r.sessions),
        active_patients: toNumber(r.active_patients),
        recognitions: toNumber(r.recognitions),
    }));
}

export async function fetchCaregivers(): Promise<CaregiverOverview[]> {
    const rows = unwrap<CaregiverOverview[]>(
        await supabase.from('admin_caregiver_overview').select('*').order('created_at', { ascending: false })
    );
    return rows.map((r) => ({
        ...r,
        patient_count: toNumber(r.patient_count),
        paired_patient_count: toNumber(r.paired_patient_count),
        asset_count: toNumber(r.asset_count),
        session_count: toNumber(r.session_count),
        open_ticket_count: toNumber(r.open_ticket_count),
    }));
}

export async function fetchPatients(): Promise<PatientOverview[]> {
    const rows = unwrap<PatientOverview[]>(
        await supabase.from('admin_patient_overview').select('*').order('created_at', { ascending: false })
    );
    return rows.map((r) => ({
        ...r,
        asset_count: toNumber(r.asset_count),
        onboarding_count: toNumber(r.onboarding_count),
        maintenance_count: toNumber(r.maintenance_count),
        paused_count: toNumber(r.paused_count),
        sessions_total: toNumber(r.sessions_total),
        sessions_correct: toNumber(r.sessions_correct),
        queued_30d: toNumber(r.queued_30d),
        completed_30d: toNumber(r.completed_30d),
        open_threats: toNumber(r.open_threats),
    }));
}

export async function fetchPatientDaily(): Promise<PatientDailyRow[]> {
    const rows = unwrap<PatientDailyRow[]>(
        await supabase.from('admin_patient_daily').select('*').order('day')
    );
    return rows.map((r) => ({
        patient_id: r.patient_id,
        day: r.day,
        sessions: toNumber(r.sessions),
        correct: toNumber(r.correct),
        accuracy: toNumber(r.accuracy),
        median_latency_ms: r.median_latency_ms === null ? null : toNumber(r.median_latency_ms),
    }));
}

export async function fetchAssetStats(): Promise<AssetStats[]> {
    const rows = unwrap<AssetStats[]>(await supabase.from('admin_asset_stats').select('*'));
    return rows.map((r) => ({
        ...r,
        total_assets: toNumber(r.total_assets),
        person_count: toNumber(r.person_count),
        object_count: toNumber(r.object_count),
        onboarding_count: toNumber(r.onboarding_count),
        maintenance_count: toNumber(r.maintenance_count),
        paused_count: toNumber(r.paused_count),
        active_pool_size: toNumber(r.active_pool_size),
        pool_utilisation_pct: toNumber(r.pool_utilisation_pct),
        missing_embedding_count: toNumber(r.missing_embedding_count),
    }));
}

export async function fetchEmbeddingMix(): Promise<EmbeddingModelMix[]> {
    const rows = unwrap<EmbeddingModelMix[]>(await supabase.from('admin_embedding_model_mix').select('*'));
    return rows.map((r) => ({ ...r, asset_count: toNumber(r.asset_count) }));
}

export async function fetchPairingFunnel(): Promise<PairingFunnel | null> {
    const { data, error } = await supabase.from('admin_pairing_funnel').select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
        issued: toNumber(data.issued),
        used: toNumber(data.used),
        expired_unused: toNumber(data.expired_unused),
        pending: toNumber(data.pending),
    };
}

export async function fetchIncidents(limit = 500): Promise<Incident[]> {
    const rows = unwrap<Incident[]>(
        await supabase.from('admin_incident_feed').select('*').order('occurred_at', { ascending: false }).limit(limit)
    );
    return rows.map((r) => ({
        ...r,
        ack_latency_seconds: r.ack_latency_seconds === null ? null : toNumber(r.ack_latency_seconds),
    }));
}

export async function fetchAuthStatus(): Promise<Map<string, AuthUserStatus>> {
    const { data, error } = await supabase.rpc('admin_auth_user_status');
    if (error) throw new Error(error.message);
    return new Map((data as AuthUserStatus[]).map((u) => [u.user_id, u]));
}

export async function fetchAudit(limit = 200): Promise<AuditEntry[]> {
    return unwrap<AuditEntry[]>(
        await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(limit)
    );
}


// ── Support ──

export async function fetchTickets(): Promise<SupportTicketRow[]> {
    const rows = unwrap<SupportTicketRow[]>(
        await supabase.from('admin_support_overview').select('*').order('last_message_at', { ascending: false })
    );
    return rows.map((r) => ({ ...r, message_count: toNumber(r.message_count) }));
}

export async function fetchTicketMessages(ticketId: string): Promise<SupportMessageRow[]> {
    return unwrap<SupportMessageRow[]>(
        await supabase
            .from('SupportMessage')
            .select('message_id, ticket_id, author_role, author_user_id, body, created_at')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true })
    );
}

// Marking read is not an admin *action* — routing it through the edge function would add an
// admin_audit_log row every time someone merely opened a ticket.
// The RPC stamps the cursor with the database clock; sending the browser's would let clock skew
// mark a caregiver reply as read before anyone saw it.
export async function markTicketRead(ticketId: string): Promise<void> {
    const { error } = await supabase.rpc('admin_mark_ticket_read', { p_ticket_id: ticketId });
    if (error) throw new Error(error.message);
}

// ── CRM: notes and tags ──

export async function fetchNotes(caregiverId: string): Promise<CaregiverNote[]> {
    return unwrap<CaregiverNote[]>(
        await supabase
            .from('caregiver_note')
            .select('*')
            .eq('caregiver_id', caregiverId)
            .order('created_at', { ascending: false })
    );
}

export async function addNote(caregiverId: string, body: string): Promise<void> {
    const { data: session } = await supabase.auth.getUser();
    const authorId = session.user?.id;
    if (!authorId) throw new Error('not signed in');
    const { error } = await supabase
        .from('caregiver_note')
        .insert({ caregiver_id: caregiverId, author_user_id: authorId, body: body.trim() });
    if (error) throw new Error(error.message);
}

export async function deleteNote(noteId: string): Promise<void> {
    const { error } = await supabase.from('caregiver_note').delete().eq('note_id', noteId);
    if (error) throw new Error(error.message);
}

export async function fetchTags(caregiverId: string): Promise<CaregiverTag[]> {
    return unwrap<CaregiverTag[]>(
        await supabase.from('caregiver_tag').select('*').eq('caregiver_id', caregiverId).order('tag')
    );
}

export async function addTag(caregiverId: string, tag: string): Promise<void> {
    const { data: session } = await supabase.auth.getUser();
    const authorId = session.user?.id;
    if (!authorId) throw new Error('not signed in');
    const { error } = await supabase
        .from('caregiver_tag')
        .insert({ caregiver_id: caregiverId, tag: tag.trim().toLowerCase(), created_by: authorId });
    if (error) throw new Error(error.message);
}

export async function removeTag(caregiverId: string, tag: string): Promise<void> {
    const { error } = await supabase
        .from('caregiver_tag')
        .delete()
        .eq('caregiver_id', caregiverId)
        .eq('tag', tag);
    if (error) throw new Error(error.message);
}

export type AdminAction =
    | 'suspend_caregiver'
    | 'unsuspend_caregiver'
    | 'send_password_reset'
    | 'unpair_device'
    | 'delete_patient'
    | 'delete_caregiver'
    | 'revoke_pairing_tokens'
    | 'support_reply'
    | 'support_resolve'
    | 'support_reopen';

// The only write path. The caller's JWT rides along automatically and is re-checked server-side.
export async function invokeAdminAction(
    action: AdminAction,
    targetId?: string,
    payload?: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: { action, targetId, payload },
    });
    if (error) throw new Error(error.message);
    if (data && data.ok === false) throw new Error(String(data.error ?? 'action failed'));
    return (data?.result ?? {}) as Record<string, unknown>;
}
