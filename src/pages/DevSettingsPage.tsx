import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_RECENT_SEARCH_LIMIT } from '../config.ts';
import { hexToHsv } from '../data/color-picker.ts';
import { ACCENT_PRESETS, DEFAULT_DEV_SETTINGS, checkAccentContrast, type AccentPreset } from '../data/dev-settings.ts';
import { useDevSettings } from '../hooks/dev-settings-context.ts';
import { ColorPicker } from '../components/ui/color-picker.tsx';

const PRESET_NAMES: readonly AccentPreset[] = ['bay', 'atlantic', 'plum', 'renfe', 'cercanias', 'andalusiaLime'];

/** Offer browser-local controls for experiments that are absent from the production site. */
export default function DevSettingsPage({ focusOnLoad = false }: { focusOnLoad?: boolean }) {
  const { t, i18n } = useTranslation();
  const mainRef = useRef<HTMLElement>(null);
  const { settings, setSettings, resetSettings } = useDevSettings();
  const [lightDraft, setLightDraft] = useState(settings.customLight);
  const [darkDraft, setDarkDraft] = useState(settings.customDark);
  const [lightVisual, setLightVisual] = useState(settings.customLight);
  const [darkVisual, setDarkVisual] = useState(settings.customDark);
  const lightCheck = checkAccentContrast(lightDraft, 'light');
  const darkCheck = checkAccentContrast(darkDraft, 'dark');
  const canApplyCustom = lightCheck.valid && darkCheck.valid;

  useEffect(() => {
    if (focusOnLoad) mainRef.current?.focus();
  }, [focusOnLoad]);

  /** Explain a failed color without applying it to the rest of the interface. */
  function contrastMessage(result: ReturnType<typeof checkAccentContrast>): string {
    if (result.lowestRatio === null) return t('devSettings.invalidColor');
    const ratio = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(result.lowestRatio);
    return t('devSettings.lowContrast', { ratio });
  }

  /** Restore all controls and the drafts shown by the color pickers. */
  function resetAll(): void {
    resetSettings();
    setLightDraft(DEFAULT_DEV_SETTINGS.customLight);
    setDarkDraft(DEFAULT_DEV_SETTINGS.customDark);
    setLightVisual(DEFAULT_DEV_SETTINGS.customLight);
    setDarkVisual(DEFAULT_DEV_SETTINGS.customDark);
  }

  /** Keep the canvas on the last complete color while a hex field is being edited. */
  function changeLightDraft(value: string): void {
    setLightDraft(value);
    if (hexToHsv(value) !== null) setLightVisual(value);
  }

  /** Keep the dark canvas on the last complete color while a hex field is being edited. */
  function changeDarkDraft(value: string): void {
    setDarkDraft(value);
    if (hexToHsv(value) !== null) setDarkVisual(value);
  }

  return (
    <main ref={mainRef} id="main-content" className="page-reveal flex-1 pt-8 pb-12 focus:outline-none" tabIndex={-1}>
      <header className="max-w-170">
        <p className="text-xs font-bold tracking-widest text-muted uppercase">{t('devSettings.devOnly')}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.8px]">{t('devSettings.title')}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{t('devSettings.description')}</p>
      </header>

      <div className="mt-8 grid max-w-170 gap-5">
        <section className="rounded-2xl border border-line bg-surface-card p-5">
          <h2 className="text-lg font-bold">{t('devSettings.lineView')}</h2>
          <label className="mt-4 flex min-h-11 items-center justify-between gap-4 text-sm font-semibold">
            <span>{t('devSettings.lineAreaColors')}</span>
            <input
              type="checkbox"
              checked={settings.lineAreaColors}
              onChange={(event) => setSettings((current) => ({ ...current, lineAreaColors: event.target.checked }))}
              className="size-5 accent-accent"
            />
          </label>
          <p className="mt-1 text-xs leading-5 text-muted">{t('devSettings.lineAreaColorsHelp')}</p>
        </section>

        <section className="rounded-2xl border border-line bg-surface-card p-5">
          <h2 className="text-lg font-bold">{t('devSettings.search')}</h2>
          <label
            className="mt-4 flex items-center justify-between gap-4 text-sm font-semibold"
            htmlFor="dev-recent-limit"
          >
            {t('devSettings.recentSearchLimit')}
          </label>
          <select
            id="dev-recent-limit"
            className="mt-2 min-h-11 min-w-24 rounded-xl border border-line-input bg-surface-input px-3 text-ink"
            value={settings.recentSearchLimit}
            onChange={(event) =>
              setSettings((current) => ({ ...current, recentSearchLimit: Number(event.target.value) }))
            }
          >
            {Array.from({ length: MAX_RECENT_SEARCH_LIMIT + 1 }, (_, count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-5 text-muted">{t('devSettings.recentSearchLimitHelp')}</p>
        </section>

        <section className="rounded-2xl border border-line bg-surface-card p-5">
          <h2 className="text-lg font-bold">{t('devSettings.themeAccent')}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">{t('devSettings.themeAccentHelp')}</p>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t('devSettings.presets')}>
            {PRESET_NAMES.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={settings.accentChoice === preset}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${settings.accentChoice === preset ? 'border-accent bg-surface-active text-accent' : 'border-line-input hover:bg-surface-hover'}`}
                onClick={() => setSettings((current) => ({ ...current, accentChoice: preset }))}
              >
                <span className="flex overflow-hidden rounded-full border border-line" aria-hidden="true">
                  <span className="size-4" style={{ backgroundColor: ACCENT_PRESETS[preset].light }} />
                  <span className="size-4" style={{ backgroundColor: ACCENT_PRESETS[preset].dark }} />
                </span>
                {t(`devSettings.preset.${preset}`)}
              </button>
            ))}
          </div>

          <fieldset className="mt-6 border-t border-line pt-5">
            <legend className="pr-2 text-sm font-bold">{t('devSettings.customColors')}</legend>
            <div className="mt-3 grid gap-4 desktop:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold" htmlFor="dev-light-accent">
                  {t('devSettings.lightAccent')}
                </label>
                <ColorPicker
                  id="dev-light-accent"
                  label={t('devSettings.lightAccent')}
                  hexLabel={t('devSettings.hexColor')}
                  hueLabel={t('devSettings.hue')}
                  value={lightDraft}
                  visualColor={lightVisual}
                  onChange={changeLightDraft}
                  errorId={!lightCheck.valid ? 'dev-light-contrast' : undefined}
                />
                {!lightCheck.valid && (
                  <p id="dev-light-contrast" role="status" className="mt-2 text-xs text-warning">
                    {contrastMessage(lightCheck)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold" htmlFor="dev-dark-accent">
                  {t('devSettings.darkAccent')}
                </label>
                <ColorPicker
                  id="dev-dark-accent"
                  label={t('devSettings.darkAccent')}
                  hexLabel={t('devSettings.hexColor')}
                  hueLabel={t('devSettings.hue')}
                  value={darkDraft}
                  visualColor={darkVisual}
                  onChange={changeDarkDraft}
                  errorId={!darkCheck.valid ? 'dev-dark-contrast' : undefined}
                />
                {!darkCheck.valid && (
                  <p id="dev-dark-contrast" role="status" className="mt-2 text-xs text-warning">
                    {contrastMessage(darkCheck)}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={!canApplyCustom}
              className="mt-5 min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-45"
              onClick={() =>
                setSettings((current) => ({
                  ...current,
                  accentChoice: 'custom',
                  customLight: lightDraft.toLowerCase(),
                  customDark: darkDraft.toLowerCase(),
                }))
              }
            >
              {t('devSettings.applyCustom')}
            </button>
          </fieldset>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{t('devSettings.browserOnly')}</p>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-line-input px-4 text-sm font-semibold hover:bg-surface-hover"
            onClick={resetAll}
          >
            {t('devSettings.reset')}
          </button>
        </div>
      </div>
    </main>
  );
}
