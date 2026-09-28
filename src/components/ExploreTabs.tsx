import { useTranslation } from 'react-i18next';

/** Link between the two Explore directories and mark the current page. */
export function ExploreTabs({ active }: { active: 'places' | 'lines' }) {
  const { t } = useTranslation();
  return (
    <nav className="flex gap-2" aria-label={t('explore.navigation')}>
      {(['places', 'lines'] as const).map((category) => (
        <a
          key={category}
          href={`/explore/${category}`}
          aria-current={active === category ? 'page' : undefined}
          className={`motion-interactive flex min-h-11 items-center border-b-2 px-3 text-sm font-bold no-underline ${active === category ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'}`}
        >
          {t(category === 'places' ? 'explore.places' : 'explore.lines')}
        </a>
      ))}
    </nav>
  );
}
