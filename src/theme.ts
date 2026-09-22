/** Manage the persisted theme preference and synchronize the document theme. */
import { useEffect, useState } from 'react';

/** Theme choices supported by the application; system is the default until overridden. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Theme values applied to the document after resolving a system preference. */
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

/** Theme state and actions exposed to the application shell. */
export interface ThemeState {
  mode: ThemeMode;
  theme: ResolvedTheme;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'gadiruta-local.theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#f7f6f0',
  dark: '#0e191a',
};

/** Check whether a stored value is one of the supported theme choices. */
function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Read the saved theme choice, falling back to the system preference. */
function readThemeMode(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isThemeMode(saved)) return saved;
  } catch {
    // A denied storage read must not prevent the system theme from being used.
  }
  return 'system';
}

/** Resolve a theme choice into the light or dark value used by the document. */
function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode;
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}

/** Apply the resolved theme to document attributes and browser chrome metadata. */
function applyTheme(mode: ThemeMode): ResolvedTheme {
  // Resolve before writing so the document never receives the abstract "system" value.
  const theme = resolveTheme(mode);
  const root = document.documentElement;

  // `data-theme` drives CSS, while these browser hints affect native controls and the address bar.
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  return theme;
}

/** Persist a theme choice when browser storage is available. */
function persistThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // A denied storage write must not prevent the current theme from changing.
  }
}

/** Synchronize React state, system preference changes, and the document theme. */
export function useTheme(): ThemeState {
  // Read storage lazily so it runs only when this hook first mounts.
  const [mode, setMode] = useState<ThemeMode>(() => readThemeMode());
  const [theme, setTheme] = useState<ResolvedTheme>(() => {
    // An early document theme avoids a visible flash while React is starting up.
    const initialTheme = document.documentElement.dataset.theme;
    if (initialTheme === 'dark' || initialTheme === 'light') return initialTheme;
    return resolveTheme(readThemeMode());
  });

  useEffect(() => {
    // Listen only in system mode; an explicit choice must not change with the OS setting.
    const media = window.matchMedia(MEDIA_QUERY);

    /** Re-resolve the preference so system-mode changes update both React and the document. */
    const updateTheme = () => setTheme(applyTheme(mode));
    updateTheme();

    if (mode !== 'system') return;

    media.addEventListener('change', updateTheme);
    return () => media.removeEventListener('change', updateTheme);
  }, [mode]);

  /** Toggle to the opposite explicit theme, overriding the system choice for this browser. */
  function toggleTheme(): void {
    // Toggling always creates an explicit preference, even if the starting mode was "system".
    const nextTheme: ResolvedTheme = theme === 'dark' ? 'light' : 'dark';
    persistThemeMode(nextTheme);
    setMode(nextTheme);
  }

  return { mode, theme, toggleTheme };
}
