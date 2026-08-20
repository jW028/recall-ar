import { CaregiverService } from '@/services/CaregiverService';
import { useAuthStore } from '@/store/authStore';
import { useCallback, useState } from 'react';

interface SaveProfileParams {
    fullName: string;
    contact: string;
    avatarUri: string | null;
}

interface UseCaregiverProfileViewModel {
    // State
    isSaving: boolean;
    isUploading: boolean;
    error: string | null;

    // Actions
    saveProfile: (params: SaveProfileParams) => Promise<boolean>;
    changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
    clearError: () => void;
}

export function useCaregiverProfileViewModel(): UseCaregiverProfileViewModel {
    const user = useAuthStore((state) => state.user);
    const setUser = useAuthStore((state) => state.setUser);

    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const saveProfile = useCallback(
        async ({ fullName, contact, avatarUri }: SaveProfileParams) => {
            if (!user) return false;
            setError(null);

            // Only touch image_url when the avatar changed; upload freshly picked local uris first
            let imageUrlParam: string | null | undefined;
            if (avatarUri !== user.imageUrl) {
                if (avatarUri && !avatarUri.startsWith('http')) {
                    setIsUploading(true);
                    const upload = await CaregiverService.uploadProfilePicture(user.id, avatarUri);
                    setIsUploading(false);
                    if (upload.error || !upload.data) {
                        setError(upload.error ?? 'Failed to upload photo.');
                        return false;
                    }
                    imageUrlParam = upload.data;
                } else {
                    imageUrlParam = avatarUri;
                }
            }

            setIsSaving(true);
            const result = await CaregiverService.updateProfile(user.id, {
                fullName,
                contact,
                ...(imageUrlParam !== undefined ? { imageUrl: imageUrlParam } : {}),
            });
            setIsSaving(false);

            if (result.error || !result.data) {
                setError(result.error ?? 'Failed to save profile.');
                return false;
            }

            // The store is the only consumer of the profile, so push the saved row straight into it
            setUser({
                ...user,
                fullName: result.data.fullName,
                contact: result.data.contact,
                imageUrl: result.data.imageUrl,
            });
            return true;
        },
        [user, setUser]
    );

    const changePassword = useCallback(
        async (currentPassword: string, newPassword: string) => {
            if (!user) return false;
            setError(null);
            setIsSaving(true);

            const result = await CaregiverService.changePassword(user.email, currentPassword, newPassword);
            setIsSaving(false);

            if (result.error) {
                setError(result.error);
                return false;
            }
            return true;
        },
        [user]
    );

    const clearError = useCallback(() => setError(null), []);

    return {
        isSaving,
        isUploading,
        error,
        saveProfile,
        changePassword,
        clearError,
    };
}
