import { CaregiverService } from '@/services/CaregiverService';
import { PairingService } from '@/services/PairingService';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Patient-side display name of the paired caregiver, or null while it loads or when it cannot be resolved.
// Every caller must keep generic "your caregiver" copy as the null fallback.
export function useCaregiverName(): string | null {
    const [name, setName] = useState<string | null>(null);

    // Patient tabs never unmount, so a mount-only read froze the name for the whole session. Combined with
    // getDisplayName returning the cached value while revalidating, a rename took two app launches to show.
    useFocusEffect(
        useCallback(() => {
            let cancelled = false;

            (async () => {
                const pairing = await PairingService.getPersistedPairing();
                if (!pairing || cancelled) return;

                // Cached value first so the name paints immediately and offline still works.
                const cached = await CaregiverService.getDisplayName(pairing.caregiverId);
                if (cancelled) return;
                if (cached) setName(cached);

                // Then the authoritative value, which is what a rename actually lands in.
                const fresh = await CaregiverService.refreshDisplayName(pairing.caregiverId).catch(() => null);
                if (!cancelled && fresh) setName(fresh);
            })();

            return () => {
                cancelled = true;
            };
        }, [])
    );

    return name;
}
