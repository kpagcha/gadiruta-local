/** Keep development-only app settings in one browser and apply their theme palette to the document. */
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_DEV_SETTINGS,
  DEV_SETTINGS_STORAGE_KEY,
  parseDevSettings,
  selectedAccentColors,
  strongAccent,
  type DevSettings,
} from '../data/dev-settings.ts';
import { DevSettingsContext } from './dev-settings-context.ts';

/** Read only development settings, ignoring saved experiments in production. */
function readDevSettings(): DevSettings {
  if (!import.meta.env.DEV) return { ...DEFAULT_DEV_SETTINGS };
  try {
    const saved = window.localStorage.getItem(DEV_SETTINGS_STORAGE_KEY);
    return saved === null ? { ...DEFAULT_DEV_SETTINGS } : parseDevSettings(JSON.parse(saved));
  } catch {
    return { ...DEFAULT_DEV_SETTINGS };
  }
}

/** Recognize the default values so Reset can remove the browser entry entirely. */
function isDefaultSettings(settings: DevSettings): boolean {
  return (
    settings.lineAreaColors === DEFAULT_DEV_SETTINGS.lineAreaColors &&
    settings.recentSearchLimit === DEFAULT_DEV_SETTINGS.recentSearchLimit &&
    settings.accentChoice === DEFAULT_DEV_SETTINGS.accentChoice &&
    settings.customLight === DEFAULT_DEV_SETTINGS.customLight &&
    settings.customDark === DEFAULT_DEV_SETTINGS.customDark
  );
}

/** Share live settings across the local pages without exposing controls in production. */
export function DevSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(readDevSettings);

  useLayoutEffect(() => {
    if (!import.meta.env.DEV) return;
    // CSS chooses the light or dark pair and derives surrounding surfaces from the selected accent.
    const root = document.documentElement;
    const colors = selectedAccentColors(settings);
    root.style.setProperty('--dev-light-accent', colors.light);
    root.style.setProperty('--dev-dark-accent', colors.dark);
    if (settings.accentChoice === 'bay') {
      delete root.dataset.devPalette;
      root.style.removeProperty('--dev-light-accent-strong');
      root.style.removeProperty('--dev-dark-accent-strong');
    } else {
      root.dataset.devPalette = settings.accentChoice;
      root.style.setProperty('--dev-light-accent-strong', strongAccent(colors.light, 'light'));
      root.style.setProperty('--dev-dark-accent-strong', strongAccent(colors.dark, 'dark'));
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).backgroundColor);
  }, [settings]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    try {
      if (isDefaultSettings(settings)) window.localStorage.removeItem(DEV_SETTINGS_STORAGE_KEY);
      else window.localStorage.setItem(DEV_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Denied storage still allows an in-memory experiment for this visit.
    }
  }, [settings]);

  /** Restore the shipped values, including the current line palette. */
  function resetSettings(): void {
    setSettings({ ...DEFAULT_DEV_SETTINGS });
  }

  return <DevSettingsContext value={{ settings, setSettings, resetSettings }}>{children}</DevSettingsContext>;
}
