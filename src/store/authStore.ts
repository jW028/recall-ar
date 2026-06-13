import type { AuthUser } from '@/services/AuthService';
import { create } from 'zustand';

// Types

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
    // State
    user: AuthUser | null;
    status: AuthStatus;
    // Derived 
    isAuthenticated: boolean,
    isCaregiver: boolean;
    isPatient: boolean;
    isLoading: boolean;

    // Set authenticated user
    setUser: (user: AuthUser | null) => void;

    // Set auth status explicitly
    setStatus: (status: AuthStatus) => void;

    // CLear user and set status to unauthenticated
    clearAuth: () => void;
}

// Store
export const useAuthStore = create<AuthState>((set) => ({
    // Initial state
    user: null,
    status: 'loading', // loading until onAuthStateChange on cold start

    // Derived (recomputed on every set)
    isAuthenticated: false,
    isCaregiver: false,
    isPatient: false,
    isLoading: true,

    // Actions
    setUser: (user) => 
        set({
            user,
            status: user ? 'authenticated' : 'unauthenticated',
            isAuthenticated: !!user,
            isCaregiver: user?.role === 'caregiver',
            isPatient: user?.role === 'patient',
            isLoading: false,
        }),
    
    setStatus: (status) =>
        set({
            status,
            isLoading: status === 'loading',
        }),

    clearAuth: () => 
        set({
            user: null,
            status: 'unauthenticated',
            isAuthenticated: false,
            isCaregiver: false,
            isPatient: false,
            isLoading: false,
        }),
}));