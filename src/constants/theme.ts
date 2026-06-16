/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',

    // brand / interactive
    primary: '#2563EB',
    primaryDisabled: '#93C5FD',
    primaryMuted: '#EFF6FF',
    primaryMutedBorder: '#BFDBFE',
    primaryText: '#1D4ED8',
    primarySoft: '#DBEAFE',

    // text scale
    heading: '#0F172A',
    body: '#111827',
    bodySecondary: '#475569',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',
    label: '#374151',

    // surfaces & borders
    cardBackground: '#F9FAFB',
    surface: '#FFFFFF',
    pageBackground: '#F3F7FC',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',
    buttonSecondaryBackground: '#E2E8F0',

    // feedback / status
    error: '#B91C1C',
    errorBackground: '#FEF2F2',
    errorBorder: '#FCA5A5',
    errorStrong: '#DC2626',
    success: '#22C55E',
    warning: '#F59E0B',

    // overlay / special
    overlay: 'rgba(0,0,0,0.6)',
    scrim: '#000000',
    onPrimary: '#FFFFFF',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',

    // brand / interactive
    primary: '#3B82F6',
    primaryDisabled: '#1E3A5F',
    primaryMuted: '#172554',
    primaryMutedBorder: '#1D4ED8',
    primaryText: '#93C5FD',
    primarySoft: '#1E3A8A',

    // text scale
    heading: '#F8FAFC',
    body: '#F1F5F9',
    bodySecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    textFaint: '#64748B',
    label: '#CBD5E1',

    // surfaces & borders
    cardBackground: '#1E293B',
    surface: '#0F172A',
    pageBackground: '#0B1120',
    border: '#334155',
    borderStrong: '#475569',
    buttonSecondaryBackground: '#334155',

    // feedback / status
    error: '#FCA5A5',
    errorBackground: '#3F1D1D',
    errorBorder: '#7F1D1D',
    errorStrong: '#F87171',
    success: '#4ADE80',
    warning: '#FBBF24',

    // overlay / special
    overlay: 'rgba(0,0,0,0.7)',
    scrim: '#000000',
    onPrimary: '#FFFFFF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = Record<ThemeColor, string>;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
