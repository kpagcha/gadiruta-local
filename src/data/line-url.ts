/** Resolves line paths from official labels in the checked-in network. */
import type { NetworkRoute } from './network-schema.ts';
import { urlSlug } from './url-alias.ts';

/** Use the public line label, keeping source IDs out of paths when no label is supplied. */
function labelSlug(route: NetworkRoute): string {
  return urlSlug(route.shortName ?? route.longName ?? 'line', 'line');
}

/** Add the official route description only when another line has the same label. */
function lineSlug(route: NetworkRoute, routes: readonly NetworkRoute[]): string {
  const label = labelSlug(route);
  if (routes.filter((item) => labelSlug(item) === label).length === 1) return label;
  const description = urlSlug(route.longName ?? '', '');
  if (description === '') {
    throw new Error(`Line ${route.id} needs a route description to distinguish its URL.`);
  }
  return `${label}-${description}`;
}

/** Make a readable line path, using a description only for repeated labels. */
export function lineUrl(route: NetworkRoute, routes: readonly NetworkRoute[]): string {
  return `/explore/lines/${lineSlug(route, routes)}`;
}

/** Find a line by its readable path segment; source IDs are not public aliases. */
export function lineFromUrl(routes: readonly NetworkRoute[], value: string): NetworkRoute | undefined {
  return routes.find((route) => lineSlug(route, routes) === value);
}

/** Reject ambiguous route descriptions before the browser offers a broken link. */
export function validateLineUrls(routes: readonly NetworkRoute[]): void {
  const aliases = new Set<string>();
  for (const route of routes) {
    const alias = lineSlug(route, routes);
    if (aliases.has(alias)) {
      throw new Error(`Lines with the label ${labelSlug(route)} need distinct route descriptions for their URLs.`);
    }
    aliases.add(alias);
  }
}
