import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { TripLocationPicker } from '../components/TripLocationPicker';
import { useNetworkDataset } from '../data/use-network-dataset.ts';

/** Put the trip search first on small screens and beside the introduction on desktop. */
export function HomePage() {
  const { t } = useTranslation();
  const networkState = useNetworkDataset();

  return (
    <main
      id="main-content"
      className="grid flex-1 gap-8 pt-4 pb-12 desktop:grid-cols-[1fr_1.12fr] desktop:items-start desktop:gap-16 desktop:py-20"
      tabIndex={-1}
    >
      {/* Keep a real page heading for assistive technology without pushing search below the mobile fold. */}
      <section className="sr-only desktop:not-sr-only desktop:pt-8">
        <p className="mb-5 text-xs font-[650] tracking-[1.8px] text-accent uppercase">{t('hero.eyebrow')}</p>
        <h1 className="text-[clamp(44px,7vw,76px)] leading-[1.05] font-[650] tracking-[-2.8px] whitespace-pre-line">
          {t('hero.title')}
        </h1>
        <p className="mt-6 max-w-92.5 text-[17px] leading-[1.65] text-muted">{t('hero.description')}</p>
        <p className="mt-8.5 flex items-center gap-3 text-[13px] text-muted">
          <span
            className="grid size-9 place-items-center rounded-full border border-line-brand text-accent"
            aria-hidden="true"
          >
            <Icon name="gadiruta" size={21} />
          </span>
          {t('hero.footnote')}
        </p>
      </section>

      <TripLocationPicker state={networkState} />
    </main>
  );
}
