/**
 * Defines the small set of development-only app settings and checks saved or custom values.
 * Production always uses these defaults; no setting here changes the tracked network data.
 */
import { MAX_RECENT_SEARCH_LIMIT, RECENT_SEARCH_LIMIT } from '../config.ts';

export type ThemeMode = 'light' | 'dark';
export type AccentPreset = 'bay' | 'atlantic' | 'plum' | 'renfe' | 'cercanias' | 'andalusiaLime';
export type AccentChoice = AccentPreset | 'custom';

export type DevSettings = {
  lineAreaColors: boolean;
  recentSearchLimit: number;
  accentChoice: AccentChoice;
  customLight: string;
  customDark: string;
};

export const DEV_SETTINGS_STORAGE_KEY = 'gadiruta-local.dev-settings.v1';

export const ACCENT_PRESETS: Record<AccentPreset, { light: string; dark: string }> = {
  bay: { light: '#155f64', dark: '#79cbc2' },
  atlantic: { light: '#355e8a', dark: '#9ac0ed' },
  plum: { light: '#785078', dark: '#e0b2dd' },
  renfe: { light: '#413d49', dark: '#e1d5e7' },
  cercanias: { light: '#78573a', dark: '#f3d2ab' },
  andalusiaLime: { light: '#436322', dark: '#d2f38a' },
};

export const DEFAULT_DEV_SETTINGS: DevSettings = {
  lineAreaColors: false,
  recentSearchLimit: RECENT_SEARCH_LIMIT,
  accentChoice: 'bay',
  customLight: ACCENT_PRESETS.bay.light,
  customDark: ACCENT_PRESETS.bay.dark,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const MIN_TEXT_CONTRAST = 4.5;
// Match the neutral-based experimental surfaces in app.css, where accent text must stay readable.
const CONTRAST_BACKGROUNDS: Record<ThemeMode, readonly { base: string; accentPercent: number }[]> = {
  light: [
    { base: '#faf8f4', accentPercent: 6 },
    { base: '#ffffff', accentPercent: 3 },
    { base: '#eceeeb', accentPercent: 12 },
    { base: '#edeeec', accentPercent: 10 },
    { base: '#e9ecea', accentPercent: 12 },
    { base: '#eef0eb', accentPercent: 12 },
    { base: '#f7f8f5', accentPercent: 6 },
  ],
  dark: [
    { base: '#131719', accentPercent: 5 },
    { base: '#1b2023', accentPercent: 8 },
    { base: '#2b3032', accentPercent: 10 },
    { base: '#282e30', accentPercent: 10 },
    { base: '#303638', accentPercent: 10 },
    { base: '#343a3b', accentPercent: 10 },
    { base: '#252b2d', accentPercent: 10 },
  ],
};
const ON_ACCENT: Record<ThemeMode, string> = { light: '#ffffff', dark: '#131719' };

/** Calculate the brightness used by WCAG contrast ratios for one hexadecimal color. */
function luminance(color: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(color.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** Compare two opaque colors on the usual 1:1 to 21:1 WCAG scale. */
export function contrastRatio(first: string, second: string): number {
  const one = luminance(first);
  const two = luminance(second);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

/** Blend opaque colors as CSS color-mix(in srgb) does for the theme surfaces. */
function mixedColor(accent: string, base: string, accentPercent: number): string {
  return `#${[1, 3, 5]
    .map((start) => {
      const accentChannel = Number.parseInt(accent.slice(start, start + 2), 16);
      const baseChannel = Number.parseInt(base.slice(start, start + 2), 16);
      return Math.round((accentChannel * accentPercent + baseChannel * (100 - accentPercent)) / 100)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

/** Measure accent contrast so the picker can warn without rejecting a chosen color. */
export function checkAccentContrast(color: string, mode: ThemeMode): { valid: boolean; lowestRatio: number | null } {
  if (!HEX_COLOR.test(color)) return { valid: false, lowestRatio: null };
  const lowestRatio = Math.min(
    ...CONTRAST_BACKGROUNDS[mode].map(({ base, accentPercent }) =>
      contrastRatio(color, mixedColor(color, base, accentPercent)),
    ),
    contrastRatio(color, ON_ACCENT[mode]),
  );
  return { valid: lowestRatio >= MIN_TEXT_CONTRAST, lowestRatio };
}

/** Accept only a complete, safe browser-saved settings object. */
export function parseDevSettings(value: unknown): DevSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_DEV_SETTINGS };
  const saved = value as Record<string, unknown>;
  if (
    typeof saved.lineAreaColors !== 'boolean' ||
    typeof saved.recentSearchLimit !== 'number' ||
    !Number.isInteger(saved.recentSearchLimit) ||
    saved.recentSearchLimit < 0 ||
    saved.recentSearchLimit > MAX_RECENT_SEARCH_LIMIT ||
    (saved.accentChoice !== 'bay' &&
      saved.accentChoice !== 'atlantic' &&
      saved.accentChoice !== 'plum' &&
      saved.accentChoice !== 'renfe' &&
      saved.accentChoice !== 'cercanias' &&
      saved.accentChoice !== 'andalusiaLime' &&
      saved.accentChoice !== 'custom') ||
    typeof saved.customLight !== 'string' ||
    typeof saved.customDark !== 'string' ||
    !HEX_COLOR.test(saved.customLight) ||
    !HEX_COLOR.test(saved.customDark)
  ) {
    return { ...DEFAULT_DEV_SETTINGS };
  }
  return {
    lineAreaColors: saved.lineAreaColors,
    recentSearchLimit: saved.recentSearchLimit,
    accentChoice: saved.accentChoice,
    customLight: saved.customLight.toLowerCase(),
    customDark: saved.customDark.toLowerCase(),
  };
}

/** Resolve the active preset or complete custom pair into concrete CSS colors. */
export function selectedAccentColors(settings: DevSettings): { light: string; dark: string } {
  return settings.accentChoice === 'custom'
    ? { light: settings.customLight, dark: settings.customDark }
    : ACCENT_PRESETS[settings.accentChoice];
}

/** Make hovered accent text stronger while preserving the selected hue. */
export function strongAccent(color: string, mode: ThemeMode): string {
  const target = mode === 'light' ? 0 : 255;
  const weight = mode === 'light' ? 0.18 : 0.22;
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(color.slice(start, start + 2), 16);
    return Math.round(value * (1 - weight) + target * weight)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}
