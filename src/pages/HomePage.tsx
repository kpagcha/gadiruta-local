import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import { getRouteLabel, getRoutePreview } from '../data/network.ts';
import { useNetworkDataset } from '../data/use-network-dataset.ts';

function formatGeneratedDate(value: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(value));
}

/** Render the local network's loading state and a compact route preview. */
export function HomePage() {
  const { t, i18n } = useTranslation();
  const networkState = useNetworkDataset();

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
        <div aria-live="polite">
          {networkState.status === 'loading' && (
            <>
              <h2
                id="data-status-title"
                className="mt-3 text-[28px] leading-[1.15] font-[650] tracking-[-1px]"
              >
                {t('dataStatus.loading.title')}
              </h2>
              <p className="mt-4 max-w-100 text-[15px] leading-[1.65] text-muted">
                {t('dataStatus.loading.description')}
              </p>
            </>
          )}

          {networkState.status === 'error' && (
            <>
              <h2
                id="data-status-title"
                className="mt-3 text-[28px] leading-[1.15] font-[650] tracking-[-1px]"
              >
                {t('dataStatus.error.title')}
              </h2>
              <p className="mt-4 max-w-100 text-[15px] leading-[1.65] text-warning" role="alert">
                {t('dataStatus.error.description')}
              </p>
            </>
          )}

          {networkState.status === 'ready' && (
            <>
              <h2
                id="data-status-title"
                className="mt-3 text-[28px] leading-[1.15] font-[650] tracking-[-1px]"
              >
                {t('dataStatus.ready.title')}
              </h2>
              <p className="mt-4 max-w-100 text-[15px] leading-[1.65] text-muted">
                {t('dataStatus.ready.description', {
                  date: formatGeneratedDate(
                    networkState.dataset.source.generatedAt,
                    i18n.resolvedLanguage ?? 'en',
                  ),
                })}
              </p>
              <dl className="mt-6 grid grid-cols-3 gap-3 border-y border-line-subtle py-4">
                <div>
                  <dt className="text-[10px] font-[650] tracking-[1.2px] text-muted uppercase">
                    {t('dataStatus.ready.routes')}
                  </dt>
                  <dd className="mt-1 text-lg font-[650] tracking-[-0.6px]">
                    {networkState.dataset.routes.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-[650] tracking-[1.2px] text-muted uppercase">
                    {t('dataStatus.ready.stops')}
                  </dt>
                  <dd className="mt-1 text-lg font-[650] tracking-[-0.6px]">
                    {networkState.dataset.stops.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-[650] tracking-[1.2px] text-muted uppercase">
                    {t('dataStatus.ready.patterns')}
                  </dt>
                  <dd className="mt-1 text-lg font-[650] tracking-[-0.6px]">
                    {networkState.dataset.patterns.length}
                  </dd>
                </div>
              </dl>
              <h3 className="mt-6 text-sm font-[650]">{t('dataStatus.ready.previewTitle')}</h3>
              <ul className="mt-3 divide-y divide-line-subtle">
                {getRoutePreview(networkState.dataset.routes).map((route) => {
                  const label = getRouteLabel(route);
                  return (
                    <li className="flex gap-3 py-2.5 first:pt-0 last:pb-0" key={route.id}>
                      <span className="min-w-13 rounded-md bg-surface-active px-2 py-1 text-center text-xs font-[700] text-accent">
                        {label}
                      </span>
                      {route.longName !== null && route.longName !== label && (
                        <span className="pt-0.5 text-xs leading-[1.5] text-muted">
                          {route.longName}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </Panel>
    </main>
  );
}
