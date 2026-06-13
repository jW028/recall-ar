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

// Map raw Supabase User + Caregiver row into a typed AuthUser
async function resolveAuthUser(user: User): Promise<AuthUser | null> {
    const role = (user.user_metadata?.role as UserRole) ?? 'caregiver';

    if (role === 'caregiver') {
        const { data, error } = await supabase
            .from('Caregiver')
            .select('full_name')
            .eq('caregiver_id', user.id)
            .single();
        if (error || !data) return null;

        return {
            id: user.id,
            email: user.email ?? '',
            role: 'caregiver',
            fullName: data.full_name,
        };
    }

    // Patient role
    return {
        id: user.id,
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

// Caregiver sign up
async function signUp(
    params: SignUpParams
): Promise<AuthResult<AuthUser>> {
    // Create Supabase auth user
    const { data, error } = await supabase.auth.signUp({
        email: params.email.trim().toLowerCase(),
        password: params.password,
        options: {
            data: {
                role: params.role,
                full_name: params.fullName
            },
        },
    });

    if (error || !data.user) {
        return {
            data: null,
            error: error?.message ?? 'Registration failed. Please try again.',
        };
    }

    // Insert Caregiver profile row (caregiver_id matches Supabase auth user id)
    const { error: insertError } = await supabase.from('Caregiver').insert({
        caregiver_id: data.user.id,
        full_name: params.fullName,
        email: params.email.trim().toLowerCase(),
        caregiver_contact: params.contact,
    });

    if (insertError) {
        // Auth user created but profile insert failed -> clean up auth user
        await supabase.auth.signOut();
        return {
            data: null,
            error: 'Failed to create account profile. Please try again.',
        };
    }

    const authUser: AuthUser = {
        id: data.user.id,
        email: data.user.email ?? '',
        role: 'caregiver',
        fullName: params.fullName,
    };

    return { data: authUser, error: null };
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