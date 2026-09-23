import { useTranslation } from 'react-i18next';
import { NetworkStatusPanelView } from '../components/NetworkStatusPanel';
import { TripLocationPicker } from '../components/TripLocationPicker';
import { useNetworkDataset } from '../data/use-network-dataset.ts';

/** Render the landing page's product introduction and current local-data summary. */
export function HomePage() {
  const { t } = useTranslation();
  const networkState = useNetworkDataset();

  return (
    <main
      id="main-content"
      className="grid gap-10 py-12 desktop:grid-cols-[0.86fr_1.14fr] desktop:items-start desktop:gap-16 desktop:py-20 desktop:pb-21.25"
      tabIndex={-1}
    >
      {/* This column is product context; the adjacent panel reports whether local data loaded. */}
      <section className="desktop:py-8">
        <p className="mb-5 text-xs font-[650] tracking-[1.8px] text-accent uppercase">{t('hero.eyebrow')}</p>
        <h1 className="text-[clamp(44px,7vw,76px)] leading-[1.05] font-[650] tracking-[-2.8px] whitespace-pre-line">
          {t('hero.title')}
        </h1>
        <p className="mt-6 max-w-92.5 text-[17px] leading-[1.65] text-muted max-[380px]:text-base">
          {t('hero.description')}
        </p>
        <TripLocationPicker state={networkState} />
      </section>

      {/* Both views use one validated local-network load and stay in the same ready/error state. */}
      <NetworkStatusPanelView state={networkState} />
    </main>
  );
}
