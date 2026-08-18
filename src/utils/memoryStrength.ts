import { ONBOARDING_INTERVALS_MINUTES } from '@/constants/config';
import type { MemoryAsset } from '@/models/MemoryAsset';

// Rungs on the 1-2-4-8-16 ladder. A memory that has climbed them all has graduated.
export const STRENGTH_STEPS = ONBOARDING_INTERVALS_MINUTES.length;

// How far along the ladder a memory has climbed, as filled segments out of STRENGTH_STEPS.
//
// currentIntervalMinutes is the interval waiting for the *next* attempt, so its position on the
// ladder is exactly the number of rungs already earned: a brand-new memory sits at 1 minute and has
// earned nothing, and a memory at 16 minutes has earned four.
//
// This is a growth indicator, never a score. No number derived from it is shown to the patient, and
// memories are never ranked against each other.
export function memoryStrength(asset: MemoryAsset): number {
    if (asset.status === 'Maintenance') return STRENGTH_STEPS;

    const rung = ONBOARDING_INTERVALS_MINUTES.indexOf(
        asset.currentIntervalMinutes as (typeof ONBOARDING_INTERVALS_MINUTES)[number]
    );
    // An off-ladder interval means the sequence restarted; credit an attempted memory with one rung
    // rather than showing an empty ring for work that did happen.
    if (rung === -1) return asset.reviewCount > 0 ? 1 : 0;
    return rung;
}
