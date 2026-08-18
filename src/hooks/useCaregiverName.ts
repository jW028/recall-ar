import { CaregiverService } from '@/services/CaregiverService';
import { PairingService } from '@/services/PairingService';
import { useEffect, useState } from 'react';

// Patient-side display name of the paired caregiver, or null while it loads or when it cannot be resolved.
// Every caller must keep generic "your caregiver" copy as the null fallback.
export function useCaregiverName(): string | null {
    const [name, setName] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const pairing = await PairingService.getPersistedPairing();
            if (!pairing || cancelled) return;
            const resolved = await CaregiverService.getDisplayName(pairing.caregiverId);
            if (!cancelled) setName(resolved);
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return name;
}
