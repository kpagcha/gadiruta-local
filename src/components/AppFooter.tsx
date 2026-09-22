/** Render the persistent data attribution and independence statement in the page footer. */

import { useTranslation } from 'react-i18next';

/** Render global source attribution once, outside feature-specific interface content. */
export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="grid gap-4.5 border-t border-line py-6.25 pb-8.75 desktop:grid-cols-[1fr_1.65fr] desktop:items-start desktop:gap-10">
      {/* Keep the service area and source statement present on every page, not tied to a feature. */}
      <p className="text-[13px] font-semibold">{t('footer.region')}</p>
      <div className="max-w-150 text-[11px] leading-[1.7] text-muted">
        <p>
          {t('footer.attribution')}{' '}
          <a
            className="underline decoration-line-decoration underline-offset-[3px] hover:text-accent"
            href="https://api.ctan.es/"
          >
            {t('footer.source')}
          </a>
          .
        </p>
        <p className="mt-1.25">{t('footer.independent')}</p>
      </div>
    </footer>
  );
}
