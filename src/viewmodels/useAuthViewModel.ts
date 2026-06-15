import { AuthService, SignInParams, SignUpParams } from "@/services/AuthService";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";

interface UseAuthViewModel {
    // State
    isSubmitting: boolean;
    error: string | null;

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

    const login = useCallback(
        async (params: SignInParams) => {
            setIsSubmitting(true);
            setError(null);

            const result = await AuthService.signIn(params);

            if (result.error) {
                setError(result.error);
                setIsSubmitting(false);
                return;
            }

            setUser(result.data);
            setIsSubmitting(false);
            router.replace('/(caregiver)');
        },
        [router, setUser]
    );

    const register = useCallback(
        async (params: SignUpParams) => {
            setIsSubmitting(true);
            setError(null);

            const result = await AuthService.signUp(params);

            if (result.error) {
                setError(result.error);
                setIsSubmitting(false);
                return;
            }

            setUser(result.data);
            setIsSubmitting(false);
            router.replace('/(caregiver)');
        },
        [router, setUser]
    );

    const logout = useCallback(async () => {
        setIsSubmitting(true);
        await AuthService.signOut();
        setUser(null);
        setIsSubmitting(false);
        router.replace('/login');
    }, [router, setUser]);

    const clearError = useCallback(() => setError(null), []);

    return {
        isSubmitting,
        error,
        login,
        register,
        logout,
        clearError,
    };
}