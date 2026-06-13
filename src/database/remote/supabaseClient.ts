import 'expo-sqlite/localStorage/install';
import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';


// Environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error (
        '[Supabase] Missing environment variables.\n'+
        'Make sure EXPO_PUBLIC_SUPABASE_YRL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in .env'
    );
}

// Client singleton
export const supabase: SupabaseClient<Database> = createClient<Database>(
    supabaseUrl, 
    supabasePublishableKey,
    {
        auth: {
            storage: localStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    }
);