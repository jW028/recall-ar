import { AuthService } from '@/services/AuthService';
import type { SignInParams, SignUpParams } from '@/services/AuthService';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

interface UseAuthViewModel {
    // State
    isSubmitting: boolean;
    error: string | null;
    confirmationPending: boolean;

    // Actions
    login: (params: SignInParams) => Promise<void>;
    register: (params: SignUpParams) => Promise<void>;
    logout: () => Promise<void>;
    clearError: () => void;
}

export function useAuthViewModel(): UseAuthViewModel {
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmationPending, setConfirmationPending] = useState(false);

    const login = useCallback(
        async (params: SignInParams) => {
            setIsSubmitting(true);
            setError(null);

            try {
                const result = await AuthService.signIn(params);

                if (result.error) {
                    setError(result.error);
                    return;
                }

                setUser(result.data);
                router.replace('/(caregiver)/home');
            } catch (e) {
                // Without this the submit button would stay stuck on its spinner with nothing on screen explaining why.
                setError(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
        },
        [router, setUser]
    );

    const register = useCallback(
        async (params: SignUpParams) => {
            setIsSubmitting(true);
            setError(null);

            try {
                const result = await AuthService.signUp(params);

                if (result.error) {
                    setError(result.error);
                    return;
                }

                if (!result.data) {
                    // Email confirmation is enabled — account created but session
                    // won't exist until the user clicks the confirmation link.
                    setConfirmationPending(true);
                    return;
                }

                setUser(result.data);
                router.replace('/(caregiver)/home');
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Registration failed. Please try again.');
            } finally {
                setIsSubmitting(false);
            }
        },
        [router, setUser]
    );

    const logout = useCallback(async () => {
        setIsSubmitting(true);
        try {
            await AuthService.signOut();
        } finally {
            setUser(null);
            setIsSubmitting(false);
            router.replace('/login');
        }
    }, [router, setUser]);

    const clearError = useCallback(() => setError(null), []);

    return {
        isSubmitting,
        error,
        confirmationPending,
        login,
        register,
        logout,
        clearError,
    };
}