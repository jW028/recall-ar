// Every write the admin dashboard performs, behind one service-role entry point.
//
// The browser never holds a service-role key: it sends the admin's own JWT, this function re-checks
// is_admin() as that caller, and only then switches to the service-role client. Trusting a role
// claim sent by the client would make the whole RLS model decorative.
//
// Deletes are irreversible. Every foreign key in this schema is ON DELETE CASCADE except
// ContextAlert.asset_id and Patient.auth_user_id (both SET NULL), so removing a single Patient row
// takes its assets, sessions, review entries, reports, geofences, threats, locations and
// encouragements with it, and removing a Caregiver row does that for every patient they own. There
// are no soft deletes and no tombstones anywhere in this schema.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.108.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': Deno.env.get('ADMIN_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Supabase caps ban_duration well above any realistic account lifetime; 'none' lifts it.
const BAN_FOREVER = '876000h';

interface ActionRequest {
    action: string;
    targetId?: string;
    payload?: Record<string, unknown>;
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
}

// Every object under a folder prefix, following one level of nesting.
// memory-assets nests as {patientId}/{assetId}/{photoId}.ext; the avatar buckets are flat.
async function listPathsUnder(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
    const paths: string[] = [];
    const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
    for (const entry of entries ?? []) {
        // A storage "folder" is a synthetic row with no id, so recurse rather than trying to delete it.
        if (entry.id === null) {
            paths.push(...(await listPathsUnder(admin, bucket, `${prefix}/${entry.name}`)));
        } else {
            paths.push(`${prefix}/${entry.name}`);
        }
    }
    return paths;
}

// Turns a stored public URL back into a bucket-relative object path.
// Needed because a patient avatar uploaded before the Patient row existed is namespaced under the
// caregiver's folder, not the patient's, so sweeping {patientId}/ alone would leave it orphaned.
function pathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
    if (!url) return null;
    const marker = `/storage/v1/object/public/${bucket}/`;
    const at = url.indexOf(marker);
    return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length));
}

async function removeAll(admin: SupabaseClient, bucket: string, paths: string[]): Promise<number> {
    const unique = [...new Set(paths.filter(Boolean))];
    if (unique.length === 0) return 0;
    await admin.storage.from(bucket).remove(unique);
    return unique.length;
}

// Storage first, then the auth user, then the row: the row delete cascades away the URLs we need.
async function purgePatient(admin: SupabaseClient, patientId: string): Promise<Record<string, number>> {
    const { data: patient } = await admin
        .from('Patient')
        .select('patient_id, auth_user_id, image_url')
        .eq('patient_id', patientId)
        .maybeSingle();

    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const { data: assets } = await admin
        .from('MemoryAsset')
        .select('asset_id, image_url, photo_urls')
        .eq('patient_id', patientId);

    const assetPaths: string[] = [];
    for (const asset of assets ?? []) {
        assetPaths.push(pathFromPublicUrl(asset.image_url, 'memory-assets') ?? '');
        for (const url of (asset.photo_urls as string[] | null) ?? []) {
            assetPaths.push(pathFromPublicUrl(url, 'memory-assets') ?? '');
        }
    }
    assetPaths.push(...(await listPathsUnder(admin, 'memory-assets', patientId)));

    const avatarPaths = [pathFromPublicUrl(patient.image_url, 'patient-avatars') ?? ''];
    avatarPaths.push(...(await listPathsUnder(admin, 'patient-avatars', patientId)));

    const assetObjects = await removeAll(admin, 'memory-assets', assetPaths);
    const avatarObjects = await removeAll(admin, 'patient-avatars', avatarPaths);

    if (patient.auth_user_id) {
        await admin.auth.admin.deleteUser(patient.auth_user_id);
    }

    const { error } = await admin.from('Patient').delete().eq('patient_id', patientId);
    if (error) throw new Error(error.message);

    return { assetObjects, avatarObjects, assets: assets?.length ?? 0 };
}


// Notifies a caregiver that support replied. Best-effort by design: a missing token is the normal
// case on iOS, where plugins/withIosNoPush strips the APNs entitlement so registerForPushNotifications
// returns null and no token is ever stored. The reply has already landed either way, so a failure
// here must never fail the action.
async function notifyCaregiverOfReply(
    admin: SupabaseClient,
    caregiverId: string,
    ticketId: string,
    subject: string
): Promise<'sent' | 'no_token' | 'failed'> {
    const { data } = await admin
        .from('CaregiverPushToken')
        .select('push_token')
        .eq('caregiver_id', caregiverId)
        .maybeSingle();

    const token = data?.push_token;
    if (!token) return 'no_token';

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: token,
                // Never 'emergency-alerts': that channel is MAX importance with a red light and a
                // vibration pattern, reserved for the panic button and fall detection.
                channelId: 'support',
                title: 'Support replied',
                body: subject,
                sound: 'default',
                data: { url: `/(caregiver)/home/support/${ticketId}` },
            }),
        });
        return response.ok ? 'sent' : 'failed';
    } catch {
        return 'failed';
    }
}

async function handle(
    action: string,
    targetId: string | undefined,
    _payload: Record<string, unknown>,
    admin: SupabaseClient,
    actorId: string
): Promise<Record<string, unknown>> {
    switch (action) {
        case 'suspend_caregiver': {
            if (!targetId) throw new Error('targetId required');
            const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: BAN_FOREVER });
            if (error) throw new Error(error.message);
            return { suspended: targetId };
        }

        case 'unsuspend_caregiver': {
            if (!targetId) throw new Error('targetId required');
            const { error } = await admin.auth.admin.updateUserById(targetId, { ban_duration: 'none' });
            if (error) throw new Error(error.message);
            return { unsuspended: targetId };
        }

        case 'send_password_reset': {
            if (!targetId) throw new Error('targetId required');
            const { data: user, error: lookupError } = await admin.auth.admin.getUserById(targetId);
            if (lookupError) throw new Error(lookupError.message);
            const email = user?.user?.email;
            if (!email) throw new Error('user has no email address');
            const { error } = await admin.auth.resetPasswordForEmail(email);
            if (error) throw new Error(error.message);
            return { emailed: email };
        }

        case 'unpair_device': {
            if (!targetId) throw new Error('targetId required');
            const { data: patient } = await admin
                .from('Patient')
                .select('auth_user_id')
                .eq('patient_id', targetId)
                .maybeSingle();
            if (!patient) throw new Error(`Patient ${targetId} not found`);

            // Null the link before deleting the auth user: the FK is ON DELETE SET NULL, so doing it
            // in this order leaves the same end state whether or not the auth user still exists.
            await admin.from('Patient').update({ auth_user_id: null }).eq('patient_id', targetId);
            if (patient.auth_user_id) {
                await admin.auth.admin.deleteUser(patient.auth_user_id);
            }
            const { count } = await admin
                .from('DevicePairing')
                .delete({ count: 'exact' })
                .eq('patient_id', targetId)
                .is('used_at', null);

            return { unpaired: targetId, hadSession: patient.auth_user_id !== null, tokensRevoked: count ?? 0 };
        }

        case 'delete_patient': {
            if (!targetId) throw new Error('targetId required');
            return { deletedPatient: targetId, ...(await purgePatient(admin, targetId)) };
        }

        case 'delete_caregiver': {
            if (!targetId) throw new Error('targetId required');
            const { data: caregiver } = await admin
                .from('Caregiver')
                .select('caregiver_id, image_url')
                .eq('caregiver_id', targetId)
                .maybeSingle();
            if (!caregiver) throw new Error(`Caregiver ${targetId} not found`);

            const { data: patients } = await admin
                .from('Patient')
                .select('patient_id')
                .eq('caregiver_id', targetId);

            // Purge each patient individually so their storage and paired auth users go too — the
            // Caregiver row delete would cascade the database rows but orphan both of those.
            for (const p of patients ?? []) {
                await purgePatient(admin, p.patient_id);
            }

            const avatarPaths = [pathFromPublicUrl(caregiver.image_url, 'caregiver-avatars') ?? ''];
            avatarPaths.push(...(await listPathsUnder(admin, 'caregiver-avatars', targetId)));
            const avatarObjects = await removeAll(admin, 'caregiver-avatars', avatarPaths);

            // Caregiver has no foreign key to auth.users, so the row and the account are two deletes.
            const { error } = await admin.from('Caregiver').delete().eq('caregiver_id', targetId);
            if (error) throw new Error(error.message);
            await admin.auth.admin.deleteUser(targetId);

            return { deletedCaregiver: targetId, patientsPurged: patients?.length ?? 0, avatarObjects };
        }

        case 'revoke_pairing_tokens': {
            const { count, error } = await admin
                .from('DevicePairing')
                .delete({ count: 'exact' })
                .is('used_at', null)
                .lt('expires_at', new Date().toISOString());
            if (error) throw new Error(error.message);
            return { revoked: count ?? 0 };
        }

        case 'support_reply': {
            if (!targetId) throw new Error('targetId required');
            const body = typeof _payload.body === 'string' ? _payload.body.trim() : '';
            if (!body) throw new Error('reply body required');

            const { data: ticket } = await admin
                .from('SupportTicket')
                .select('ticket_id, caregiver_id, subject')
                .eq('ticket_id', targetId)
                .maybeSingle();
            if (!ticket) throw new Error(`Ticket ${targetId} not found`);

            // author_role 'admin' is only writable through the service role — the caregiver-facing
            // RLS policy pins it to 'caregiver' so a caregiver cannot impersonate support.
            const { data: inserted, error } = await admin
                .from('SupportMessage')
                .insert({ ticket_id: targetId, author_role: 'admin', author_user_id: actorId, body })
                .select('created_at')
                .single();
            if (error) throw new Error(error.message);

            // Replying counts as having read the ticket, so it must not stay in the unread queue.
            // Stamped from the inserted row's own created_at, not Deno's clock: message timestamps come
            // from Postgres, and skew between the two would let a later caregiver reply look already-read.
            await admin.from('support_ticket_admin_state').upsert({
                ticket_id: targetId,
                admin_last_read_at: inserted.created_at,
            });

            const push = await notifyCaregiverOfReply(admin, ticket.caregiver_id, targetId, ticket.subject);
            return { repliedTo: targetId, push };
        }

        case 'support_resolve': {
            if (!targetId) throw new Error('targetId required');
            const { error } = await admin
                .from('SupportTicket')
                .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: actorId })
                .eq('ticket_id', targetId);
            if (error) throw new Error(error.message);
            return { resolved: targetId };
        }

        case 'support_reopen': {
            if (!targetId) throw new Error('targetId required');
            const { error } = await admin
                .from('SupportTicket')
                .update({ status: 'open', resolved_at: null, resolved_by: null })
                .eq('ticket_id', targetId);
            if (error) throw new Error(error.message);
            return { reopened: targetId };
        }

        default:
            throw new Error(`unknown action: ${action}`);
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'missing authorization header' }, 401);

    // Runs as the caller, so is_admin() sees their auth.uid() and their RLS, not ours.
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
    });

    const { data: userData } = await caller.auth.getUser();
    const actor = userData?.user;
    if (!actor) return json({ error: 'invalid session' }, 401);

    const { data: isAdmin, error: adminCheckError } = await caller.rpc('is_admin');
    if (adminCheckError) return json({ error: adminCheckError.message }, 500);
    if (isAdmin !== true) return json({ error: 'not authorized' }, 403);

    let body: ActionRequest;
    try {
        body = await req.json();
    } catch {
        return json({ error: 'invalid json body' }, 400);
    }

    const { action, targetId, payload = {} } = body;
    if (!action) return json({ error: 'action required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    try {
        const result = await handle(action, targetId, payload, admin, actor.id);
        await admin.from('admin_audit_log').insert({
            actor_user_id: actor.id,
            action,
            target_type: action.startsWith('support_') ? 'ticket' : action.includes('caregiver') ? 'caregiver' : action.includes('patient') || action === 'unpair_device' ? 'patient' : 'system',
            target_id: targetId ?? null,
            succeeded: true,
            details: result,
        });
        return json({ ok: true, result });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // Failures are audited too: a rejected erasure attempt is exactly as interesting as a successful one.
        await admin.from('admin_audit_log').insert({
            actor_user_id: actor.id,
            action,
            target_type: 'unknown',
            target_id: targetId ?? null,
            succeeded: false,
            details: { error: message },
        });
        return json({ ok: false, error: message }, 400);
    }
});
