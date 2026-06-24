import { supabase } from '@/database/remote/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';

// Types
export type UserRole = 'caregiver' | 'patient';

export interface AuthUser {
    id: string;
    email: string;
    role: UserRole;
    fullName: string;
}

export interface SignInParams {
    email: string;
    password: string;
}

export interface SignUpParams {
    email: string;
    password: string;
    fullName: string;
    contact: string;
    role: UserRole;
}

export interface AuthResult<T = void> {
    data: T | null;
    error: string | null;
}

// Helper functions

// Map raw Supabase User + Caregiver row into a typed AuthUser.
// The Caregiver row is created by the on_auth_user_created database trigger
// (SECURITY DEFINER), so it exists by the time the user first signs in.
async function resolveAuthUser(user: User): Promise<AuthUser | null> {
    const role = (user.user_metadata?.role as UserRole) ?? 'caregiver';

    if (role === 'caregiver') {
        const { data, error } = await supabase
            .from('Caregiver')
            .select('full_name')
            .eq('caregiver_id', user.id)
            .single();

        // Profile found — return it
        if (!error && data) {
            return {
                id: user.id,
                email: user.email ?? '',
                role: 'caregiver',
                fullName: data.full_name,
            };
        }

        // Profile missing — this happens when email confirmation is enabled and
        // the signup flow skipped the insert. Create the row now using the
        // metadata stored in Supabase Auth at registration time.
        const fullName: string = user.user_metadata?.full_name ?? '';
        const contact: string = user.user_metadata?.contact ?? '';

        const { error: insertError } = await supabase.from('Caregiver').upsert({
            caregiver_id: user.id,
            full_name: fullName,
            email: (user.email ?? '').trim().toLowerCase(),
            caregiver_contact: contact,
        }, { onConflict: 'caregiver_id', ignoreDuplicates: true });

        if (insertError) {
            console.error('[Auth] Failed to create Caregiver profile on first sign-in:', insertError.message);
            return null;
        }

        return {
            id: user.id,
            email: user.email ?? '',
            role: 'caregiver',
            fullName,
        };
    }

    // Patient role — use patient_id from metadata so AuthUser.id === patient_id
    return {
        id: user.user_metadata?.patient_id ?? user.id,
        email: user.email ?? '',
        role: 'patient',
        fullName: user.user_metadata?.full_name ?? '',
    };
}

// Auth operations

async function signIn(
    params: SignInParams
): Promise<AuthResult<AuthUser>> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: params.email.trim().toLowerCase(),
        password: params.password,
    });

    if (error || !data.user) {
        return {
            data: null,
            error: error?.message ?? 'Sign in failed. Please try again.',
        };
    }

    const authUser = await resolveAuthUser(data.user);

    if (!authUser) {
        return {
            data: null,
            error: 'Account profile not found.',
        };
    }

    return { data: authUser, error: null };
}

// Caregiver sign up.
// When email confirmation is enabled in Supabase, signUp returns session: null
// and there is no active session with which to run an authenticated insert.
// In that case we skip the profile insert here and let resolveAuthUser handle
// it on the first sign-in after the user confirms their email.
async function signUp(
    params: SignUpParams
): Promise<AuthResult<AuthUser>> {
    const { data, error } = await supabase.auth.signUp({
        email: params.email.trim().toLowerCase(),
        password: params.password,
        options: {
            data: {
                role: params.role,
                full_name: params.fullName,
                // Store contact so resolveAuthUser can create the profile later
                contact: params.contact,
            },
        },
    });

    if (error || !data.user) {
        return {
            data: null,
            error: error?.message ?? 'Registration failed. Please try again.',
        };
    }

    // Email confirmation pending — no session yet, skip the profile insert.
    // resolveAuthUser will create the Caregiver row on first sign-in.
    if (!data.session) {
        return { data: null, error: null };
    }

    // Email confirmation disabled — we have a live session, insert now.
    const { error: insertError } = await supabase.from('Caregiver').insert({
        caregiver_id: data.user.id,
        full_name: params.fullName,
        email: params.email.trim().toLowerCase(),
        caregiver_contact: params.contact,
    });

    if (insertError) {
        await supabase.auth.signOut();
        return {
            data: null,
            error: 'Failed to create account profile. Please try again.',
        };
    }

    return {
        data: {
            id: data.user.id,
            email: data.user.email ?? '',
            role: 'caregiver',
            fullName: params.fullName,
        },
        error: null,
    };
}

// Sign out current user and clear session
async function signOut(): Promise<AuthResult> {
    const { error } = await supabase.auth.signOut();

    if (error) {
        return {
            data: null,
            error: error.message,
        };
    }

    return { data: null, error: null };
}

// Get current active session
async function getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

// Get resolved AuthUser for the current session, null if not authenticated or not found
async function getCurrentUser(): Promise<AuthUser | null> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return resolveAuthUser(data.user);
}

// Subscribe to auth state changes (sign in, sign out, token refresh)
function onAuthStateChange(
    callback: (user: AuthUser | null) => void
): () => void {
    const { data: listener } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
            if (!session?.user) {
                callback(null);
                return;
            }
            const authUser = await resolveAuthUser(session.user);
            callback(authUser);
        }
    );

    return () => listener.subscription.unsubscribe();
}

// Export as a namespace for imports
export const AuthService = {
    signIn,
    signUp,
    signOut, 
    getSession,
    getCurrentUser,
    onAuthStateChange,
};