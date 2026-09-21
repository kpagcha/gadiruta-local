/** Render application identity, theme controls, and language selection in the page header. */

import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { useTheme } from '../theme';
import { Icon } from './Icon';

/** Render the persistent site header while keeping preferences owned by their dedicated hooks. */
export function AppHeader() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const { theme, toggleTheme } = useTheme();
  const themeLabel = theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark');

  return (
    <header className="flex min-h-25 items-center justify-between gap-5 border-b border-line">
      <a
        className="inline-flex items-center gap-2.75 text-[25px] font-[750] tracking-[-1.2px] text-ink no-underline"
        href="/"
        aria-label={t('app.home')}
      >
        <span className="grid size-9.75 place-items-center rounded-xl bg-accent text-paper">
          <Icon name="gadiruta" size={27} />
        </span>
        <span>{t('app.name')}</span>
      </a>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={themeLabel}
          aria-pressed={theme === 'dark'}
          title={themeLabel}
          className="grid size-11 place-items-center rounded-lg border-0 bg-transparent text-muted transition-colors hover:text-ink"
          onClick={toggleTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        <div
          className="flex items-center gap-0.5 text-[13px] font-bold"
          role="group"
          aria-label={t('language.label')}
        >
          <button
            type="button"
            lang="en"
            aria-label={t('language.en')}
            aria-pressed={language === 'en'}
            className={`min-h-11 min-w-11 rounded-lg border-0 bg-transparent px-2 text-muted transition-colors hover:text-ink ${language === 'en' ? 'bg-surface-active text-accent' : ''}`}
            onClick={() => changeLanguage('en')}
          >
            {t('language.enShort')}
          </button>
          <span className="text-muted-faint" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            lang="es"
            aria-label={t('language.es')}
            aria-pressed={language === 'es'}
            className={`min-h-11 min-w-11 rounded-lg border-0 bg-transparent px-2 text-muted transition-colors hover:text-ink ${language === 'es' ? 'bg-surface-active text-accent' : ''}`}
            onClick={() => changeLanguage('es')}
          >
            {t('language.esShort')}
          </button>
        </div>
      </div>
    </header>
  );
}
