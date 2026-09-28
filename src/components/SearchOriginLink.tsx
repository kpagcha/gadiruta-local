import { useTranslation } from 'react-i18next';
import type { LocationOption } from '../data/location-search.ts';
import { originSearchUrl } from '../data/search-url.ts';
import { Icon } from './Icon';
import { AppTooltip } from './ui/tooltip';

type StopOrigin = { kind: 'stop'; id: string; name: string };
type SearchOriginLinkProps =
  | { origin: Extract<LocationOption, { kind: 'place' }>; variant: 'prominent'; className?: string }
  | { origin: StopOrigin; variant: 'inline' | 'icon'; className?: string };

/** Open the journey form with a place or stop already chosen as the origin. */
export function SearchOriginLink({ origin, variant, className }: SearchOriginLinkProps) {
  const { t } = useTranslation();
  const href = originSearchUrl(origin);

  if (variant === 'prominent') {
    return (
      <a
        className={`motion-interactive inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-semibold text-on-accent no-underline ${className ?? ''}`}
        href={href}
      >
        {t('explore.searchFromHere')}
      </a>
    );
  }

  const label = t('explore.searchFromStop', { stop: origin.name });
  if (variant === 'inline') {
    return (
      <a
        aria-label={label}
        className={`text-sm font-semibold text-accent underline underline-offset-4 ${className ?? ''}`}
        href={href}
      >
        {t('explore.search')}
      </a>
    );
  }

  return (
    <AppTooltip content={t('explore.search')}>
      <a
        aria-label={label}
        className={`motion-interactive grid size-10 place-items-center rounded-xl hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent ${className ?? ''}`}
        href={href}
      >
        <Icon name="search" size={16} strokeWidth={1.8} />
      </a>
    </AppTooltip>
  );
}
