import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createLocationMunicipalities, type LocationOption } from '../data/location-search.ts';
import { lineUrl } from '../data/line-url.ts';
import { getRouteLabel } from '../data/network.ts';
import { linesForStops, matchesBrowseQuery, stopLocality, stopsForPlace } from '../data/network-browse.ts';
import type { NetworkDataset, NetworkRoute, NetworkStop } from '../data/network-schema.ts';
import { placeFromUrl, placePageUrl } from '../data/place-url.ts';
import { ExploreDirectoryHeading } from './ExploreDirectoryHeading';
import { SearchOriginLink } from './SearchOriginLink';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './ui/breadcrumb';
import { PillLink } from './ui/pill-link';

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
    const choice = placeFromUrl(selectedId, options);
    return choice !== null ? (
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
          <li key={municipality.id} className="directory-card">
            <a
              className="text-lg font-bold text-ink underline decoration-line-decoration underline-offset-4 hover:text-accent"
              href={placePageUrl(municipality.choice)}
            >
              {municipality.name}
            </a>
            {municipality.areas.some((area) => !area.choice.isTown) && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {municipality.areas
                  .filter((area) => !area.choice.isTown)
                  .map((area) => (
                    <li key={area.id}>
                      <PillLink href={placePageUrl(area.choice)}>{area.name}</PillLink>
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
  const parentChoice = options.find(
    (option) => option.kind === 'place' && option.municipalityId === choice.parentMunicipalityId && option.isBroad,
  );

  return (
    <article>
      <Breadcrumb aria-label={t('explore.breadcrumb')}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/explore/places">{t('explore.backToPlaces')}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {parentChoice?.kind === 'place' && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink href={placePageUrl(parentChoice)}>{parentChoice.name}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{choice.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <h2 className="mt-4 text-3xl font-bold tracking-[-0.8px]">{choice.name}</h2>
      <SearchOriginLink origin={choice} variant="prominent" className="mt-5" />
      {areas.length > 0 && (
        <section className="mt-8" aria-labelledby="place-areas-title">
          <h3 id="place-areas-title" className="text-xl font-bold">
            {t('explore.areas')}
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {areas.map((area) => (
              <li key={area.id}>
                <PillLink href={placePageUrl(area.choice)}>
                  {area.choice.isTown ? area.choice.name : area.name}
                </PillLink>
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
          <PillLink href={lineUrl(route, allLines)}>{getRouteLabel(route)}</PillLink>
        </li>
      ))}
    </ul>
  );
}

/** Render stops with reviewed locality names and links into the existing journey form. */
function StopList({ dataset, stops }: { dataset: NetworkDataset; stops: readonly NetworkStop[] }) {
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
            <SearchOriginLink
              origin={{ kind: 'stop', id: stop.id, name: stop.name }}
              variant="inline"
              className="shrink-0"
            />
          </li>
        );
      })}
    </ul>
  );
}
