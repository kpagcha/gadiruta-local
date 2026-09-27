import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createLocationMunicipalities, type LocationOption } from '../data/location-search.ts';
import { lineUrl } from '../data/line-url.ts';
import { getRouteLabel } from '../data/network.ts';
import { linesForStops, matchesBrowseQuery, stopLocality, stopsForPlace } from '../data/network-browse.ts';
import type { NetworkDataset, NetworkRoute, NetworkStop } from '../data/network-schema.ts';
import { originSearchUrl } from '../data/search-url.ts';
import { ExploreDirectoryHeading } from './ExploreDirectoryHeading';

/** Show the place directory or one selected place from the local network. */
export function ExplorePlaces({
  dataset,
  options,
  selectedId,
  query,
  onQueryChange,
}: {
  dataset: NetworkDataset;
  options: readonly LocationOption[];
  selectedId: string | null;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { t } = useTranslation();
  const municipalities = useMemo(() => createLocationMunicipalities(options, dataset), [options, dataset]);

  if (selectedId !== null) {
    const choice = options.find((option) => option.kind === 'place' && option.id === selectedId);
    return choice?.kind === 'place' ? (
      <PlaceDetail dataset={dataset} choice={choice} options={options} />
    ) : (
      <p role="alert" className="rounded-2xl border border-line bg-surface-card p-5">
        {t('explore.notFound')}
      </p>
    );
  }

  const visible = municipalities.filter(
    (municipality) =>
      matchesBrowseQuery(municipality.name, query) ||
      municipality.areas.some((area) => matchesBrowseQuery(area.name, query)),
  );
  return (
    <section aria-labelledby="browse-places-title">
      <ExploreDirectoryHeading
        id="browse-places-title"
        title={t('explore.places')}
        placeholder={t('explore.placeFilterPlaceholder')}
        query={query}
        onQueryChange={onQueryChange}
      />
      {visible.length === 0 && <p className="text-muted">{t('explore.noMatches')}</p>}
      <ul className="grid gap-4 desktop:grid-cols-2">
        {visible.map((municipality) => (
          <li key={municipality.id} className="rounded-2xl border border-line bg-surface-card p-5">
            <a
              className="text-lg font-bold text-ink underline decoration-line-decoration underline-offset-4 hover:text-accent"
              href={`/explore/places/${encodeURIComponent(municipality.choice.id)}`}
            >
              {municipality.name}
            </a>
            {municipality.areas.some((area) => !area.choice.isTown) && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {municipality.areas
                  .filter((area) => !area.choice.isTown)
                  .map((area) => (
                    <li key={area.id}>
                      <a
                        className="motion-interactive inline-flex min-h-10 items-center rounded-lg bg-surface-active px-3 text-sm text-ink no-underline hover:text-accent"
                        href={`/explore/places/${encodeURIComponent(area.choice.id)}`}
                      >
                        {area.name}
                      </a>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Show the selected place's physical stops and every line with saved visits there. */
function PlaceDetail({
  dataset,
  choice,
  options,
}: {
  dataset: NetworkDataset;
  choice: Extract<LocationOption, { kind: 'place' }>;
  options: readonly LocationOption[];
}) {
  const { t } = useTranslation();
  const stops = stopsForPlace(dataset, choice);
  const lines = linesForStops(dataset, stops);
  const municipality =
    choice.municipalityId !== undefined
      ? dataset.municipalities.find((item) => item.id === choice.municipalityId)
      : dataset.municipalities.find((item) => item.id === choice.parentMunicipalityId);
  const areas =
    choice.municipalityId === undefined || municipality === undefined
      ? []
      : (createLocationMunicipalities(options, dataset).find((item) => item.id === municipality.id)?.areas ?? []);

  return (
    <article>
      <a className="text-sm font-semibold text-accent underline underline-offset-4" href="/explore/places">
        {t('explore.backToPlaces')}
      </a>
      <h2 className="mt-4 text-3xl font-bold tracking-[-0.8px]">{choice.name}</h2>
      {choice.municipalityId === undefined && municipality !== undefined && !choice.isTown && (
        <p className="mt-1 text-sm text-muted">{municipality.name}</p>
      )}
      <a
        className="motion-interactive mt-5 inline-flex min-h-11 items-center rounded-lg bg-accent px-4 font-semibold text-on-accent no-underline"
        href={originSearchUrl(choice)}
      >
        {t('explore.searchFromHere')}
      </a>
      {areas.length > 0 && (
        <section className="mt-8" aria-labelledby="place-areas-title">
          <h3 id="place-areas-title" className="text-xl font-bold">
            {t('explore.areas')}
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {areas.map((area) => (
              <li key={area.id}>
                <a
                  className="motion-interactive inline-flex min-h-10 items-center rounded-lg bg-surface-active px-3 text-sm text-ink no-underline hover:text-accent"
                  href={`/explore/places/${encodeURIComponent(area.choice.id)}`}
                >
                  {area.choice.isTown ? area.choice.name : area.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-8" aria-labelledby="place-lines-title">
        <h3 id="place-lines-title" className="text-xl font-bold">
          {t('explore.linesServing')}
        </h3>
        <LineLinks lines={lines} allLines={dataset.routes} />
      </section>
      <section className="mt-8" aria-labelledby="place-stops-title">
        <h3 id="place-stops-title" className="text-xl font-bold">
          {t('explore.stops')}
        </h3>
        <StopList dataset={dataset} stops={stops} />
      </section>
    </article>
  );
}

/** Link from a place to each line that visits one of its stops. */
function LineLinks({ lines, allLines }: { lines: readonly NetworkRoute[]; allLines: readonly NetworkRoute[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {lines.map((route) => (
        <li key={route.id}>
          <a
            className="motion-interactive inline-flex min-h-10 items-center rounded-lg bg-surface-active px-3 text-sm font-semibold text-ink no-underline hover:text-accent"
            href={lineUrl(route, allLines)}
          >
            {getRouteLabel(route)}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Render stops with reviewed locality names and links into the existing journey form. */
function StopList({ dataset, stops }: { dataset: NetworkDataset; stops: readonly NetworkStop[] }) {
  const { t } = useTranslation();
  return (
    <ul className="mt-3 grid gap-3 desktop:grid-cols-2">
      {stops.map((stop) => {
        const locality = stopLocality(dataset, stop);
        return (
          <li
            key={stop.id}
            className="flex min-h-18 items-center justify-between gap-3 rounded-xl border border-line bg-surface-card p-4"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{stop.name}</span>
              {locality !== null && <span className="block text-sm text-muted">{locality}</span>}
            </span>
            <a
              className="shrink-0 text-sm font-semibold text-accent underline underline-offset-4"
              href={originSearchUrl({ kind: 'stop', id: stop.id, name: stop.name })}
              aria-label={t('explore.searchFromStop', { stop: stop.name })}
            >
              {t('explore.search')}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
