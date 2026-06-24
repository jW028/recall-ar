/**
 * Theme is scoped per role, not by the OS color scheme.
 * Patient app is always light; caregiver app defaults to light with optional dark mode.
 * A surrounding ThemeSchemeContext.Provider sets the active scheme; default is light.
 */

import { Colors } from '@/constants/theme';
import { createContext, useContext } from 'react';

export type ColorScheme = 'light' | 'dark';

// Default light so auth screens and any unscoped tree render light
export const ThemeSchemeContext = createContext<ColorScheme>('light');

// Active scheme for the current subtree
export function useThemeScheme() {
  return useContext(ThemeSchemeContext);
}

export function useTheme() {
  const scheme = useContext(ThemeSchemeContext);
  return Colors[scheme];
}
