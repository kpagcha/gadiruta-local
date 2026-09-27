/**
 * Gives place choices readable links. A plain municipality name means its town area when that
 * differs from the whole municipality; `/all` selects every area in the municipality.
 */
import type { LocationOption } from './location-search.ts';

type PlaceOption = Extract<LocationOption, { kind: 'place' }>;
type PlaceUrlChoice = Pick<PlaceOption, 'id' | 'isTown' | 'isBroad' | 'parentPlaceId'>;

/** Write the public value for a selected place without exposing its internal town ID. */
export function placeUrlValue(choice: PlaceUrlChoice): string {
  if (choice.isTown) return choice.parentPlaceId ?? choice.id;
  return choice.isBroad ? `${choice.id}/all` : choice.id;
}

/** Find a place by its public value, including the optional `/all` on a single-area municipality. */
export function placeFromUrl(value: string, options: readonly LocationOption[]): PlaceOption | null {
  const places = options.filter((option): option is PlaceOption => option.kind === 'place');
  const publicChoice = places.find((option) => placeUrlValue(option) === value);
  if (publicChoice) return publicChoice;
  if (value.endsWith('/all')) {
    const id = value.slice(0, -'/all'.length);
    return places.find((option) => option.municipalityId !== undefined && option.id === id) ?? null;
  }
  // Previously shared `-town` links still open their original place.
  return places.find((option) => option.id === value) ?? null;
}

/** Build an Explore path, preserving `/all` as a separate path segment. */
export function placePageUrl(choice: PlaceOption): string {
  return `/explore/places/${placeUrlValue(choice).split('/').map(encodeURIComponent).join('/')}`;
}
