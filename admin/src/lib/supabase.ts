import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
    throw new Error(
        '[Supabase] Missing environment variables.\n' +
        'Copy admin/.env.example to admin/.env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
    );
}

// The same publishable key the mobile app uses. Cross-tenant reads are granted by the admin_users
// membership behind is_admin(), never by the key — a non-admin signed in here sees nothing.
export const supabase = createClient(url, publishableKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});
