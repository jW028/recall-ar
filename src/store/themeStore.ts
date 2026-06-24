import type { ColorScheme } from '@/hooks/use-theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Caregiver-only color scheme preference, persisted across launches
interface ThemeState {
    mode: ColorScheme;
    setMode: (mode: ColorScheme) => void;
    toggle: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            // Default light; caregivers can opt into dark
            mode: 'light',
            setMode: (mode) => set({ mode }),
            toggle: () => set({ mode: get().mode === 'dark' ? 'light' : 'dark' }),
        }),
        {
            name: 'caregiver-theme-preference',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
