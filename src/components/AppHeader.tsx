import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { useTheme } from '../hooks/use-theme';
import { Icon } from './Icon';

/** Render navigation and preferences in the persistent site header. */
export function AppHeader({ activePage }: { activePage: 'search' | 'explore' | null }) {
  // The resolved language controls which selector button is visually and semantically active.
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const { theme, toggleTheme } = useTheme();
  const themeLabel = theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark');

  return (
    <header className="motion-arrive grid min-h-20 grid-cols-[1fr_auto] items-center gap-x-2 border-b border-line desktop:flex desktop:min-h-25 desktop:gap-5">
      {/* The brand is also the simple route back to this single-page application's home view. */}
      <a
        className="inline-flex items-center gap-2 text-[20px] font-[750] tracking-[-1.2px] text-ink no-underline desktop:gap-2.75 desktop:text-[25px]"
        href="/"
        aria-label={t('app.home')}
      >
        <span className="grid size-8 place-items-center rounded-xl bg-accent text-paper desktop:size-9.75">
          <Icon name="gadiruta" size={27} />
        </span>
        <span>{t('app.name')}</span>
      </a>
      <nav className="col-span-2 flex gap-1 pb-1 desktop:col-auto desktop:pb-0" aria-label={t('app.navigation')}>
        <a
          href="/"
          aria-current={activePage === 'search' ? 'page' : undefined}
          className={`motion-interactive flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold no-underline ${activePage === 'search' ? 'bg-surface-active text-accent' : 'text-muted hover:text-ink'}`}
        >
          {t('app.search')}
        </a>
        <a
          href="/explore/places"
          aria-current={activePage === 'explore' ? 'page' : undefined}
          className={`motion-interactive flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold no-underline ${activePage === 'explore' ? 'bg-surface-active text-accent' : 'text-muted hover:text-ink'}`}
        >
          {t('app.explore')}
        </a>
      </nav>
      {/* Appearance and language are independent persisted preferences. */}
      <div className="col-start-2 row-start-1 flex items-center gap-1 desktop:ml-auto desktop:gap-2.5">
        <button
          type="button"
          aria-label={themeLabel}
          aria-pressed={theme === 'dark'}
          title={themeLabel}
          className="motion-interactive grid size-11 place-items-center rounded-lg border-0 bg-transparent text-muted hover:text-ink"
          onClick={toggleTheme}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        {/* `aria-pressed` makes this two-button language choice understandable without colour. */}
        <div className="flex items-center gap-0.5 text-[13px] font-bold" role="group" aria-label={t('language.label')}>
          <button
            type="button"
            lang="en"
            aria-label={t('language.en')}
            aria-pressed={language === 'en'}
            className={`motion-interactive min-h-11 min-w-11 rounded-lg border-0 bg-transparent px-2 text-muted hover:text-ink ${language === 'en' ? 'bg-surface-active text-accent' : ''}`}
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
            className={`motion-interactive min-h-11 min-w-11 rounded-lg border-0 bg-transparent px-2 text-muted hover:text-ink ${language === 'es' ? 'bg-surface-active text-accent' : ''}`}
            onClick={() => changeLanguage('es')}
          >
            {t('language.esShort')}
          </button>
        </div>
      </div>
    </header>
  );
}
