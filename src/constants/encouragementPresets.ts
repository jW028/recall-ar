import { Ionicons } from '@expo/vector-icons';

export type EncouragementIcon = keyof typeof Ionicons.glyphMap;

// One-tap encouragements a caregiver can send. The icon name is what gets stored in the
// encouragement's `emoji` column, so keep these stable — changing one orphans past rows.
export const ENCOURAGEMENT_PRESETS: { icon: EncouragementIcon; message: string }[] = [
    { icon: 'heart', message: 'Great job!' },
    { icon: 'star', message: 'So proud of you!' },
    { icon: 'sparkles', message: 'Keep it up!' },
];

// Rows written before the switch to icon names hold a literal emoji; map the ones we ever sent.
const LEGACY_EMOJI_ICONS: Record<string, EncouragementIcon> = {
    '❤️': 'heart',
    '❤': 'heart',
    '⭐': 'star',
    '🌟': 'sparkles',
};

// Null means "not something we can draw" — the caller falls back to showing the stored text verbatim.
export function resolveEncouragementIcon(stored: string | null): EncouragementIcon | null {
    if (!stored) return null;
    if (stored in Ionicons.glyphMap) return stored as EncouragementIcon;
    return LEGACY_EMOJI_ICONS[stored] ?? null;
}
