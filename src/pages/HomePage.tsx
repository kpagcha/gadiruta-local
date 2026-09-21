/** Present the local-first application status while no transit dataset is bundled. */
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';

/** Render the first-run home view without promising unavailable transport queries. */
export function HomePage() {
  const { t } = useTranslation();

  return (
    <main
      id="main-content"
      className="grid gap-10 py-12 desktop:grid-cols-[0.86fr_1.14fr] desktop:items-center desktop:gap-16 desktop:py-20 desktop:pb-21.25"
      tabIndex={-1}
    >
      <section className="desktop:py-8">
        <p className="mb-5 text-xs font-[650] tracking-[1.8px] text-accent uppercase">
          {t('hero.eyebrow')}
        </p>
        <h1 className="text-[clamp(44px,7vw,76px)] leading-[1.05] font-[650] tracking-[-2.8px] whitespace-pre-line">
          {t('hero.title')}
        </h1>
        <p className="mt-6 max-w-92.5 text-[17px] leading-[1.65] text-muted max-[380px]:text-base">
          {t('hero.description')}
        </p>
      </section>

      <Panel aria-labelledby="data-status-title">
        <span className="grid size-11 place-items-center rounded-xl bg-surface-active text-accent">
          <Icon name="route" size={23} />
        </span>
        <p className="mt-6 text-xs font-[650] tracking-[1.8px] text-accent uppercase">
          {t('dataStatus.eyebrow')}
        </p>
        <h2
          id="data-status-title"
          className="mt-3 text-[28px] leading-[1.15] font-[650] tracking-[-1px]"
        >
          {t('dataStatus.title')}
        </h2>
        <p className="mt-4 max-w-100 text-[15px] leading-[1.65] text-muted">
          {t('dataStatus.description')}
        </p>
      </Panel>
    </main>
  );
}
