/**
 * Makes readable stop values for shared search URLs. A short token derived from the source stop ID
 * identifies the stop; the name part is only for people reading the link and may change over time.
 */

/** Return a stable eight-character token without showing the source stop ID in a URL. */
export function stopUrlToken(id: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(id)) {
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return (hash % 36n ** 8n).toString(36).padStart(8, '0');
}

/** Keep the visible part of a stop URL short, readable, and independent of accents or punctuation. */
function stopNameSlug(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLocaleLowerCase('es')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'stop'
  );
}

/** Put the readable name before the token used to identify an exact stop. */
export function stopUrlValue(stop: { id: string; name: string }): string {
  return `${stopNameSlug(stop.name)}-${stopUrlToken(stop.id)}`;
}

/** Extract the identifying token even if the readable name has changed since sharing the URL. */
export function stopTokenFromUrl(value: string): string | null {
  return /-([0-9a-z]{8})$/.exec(value)?.[1] ?? null;
}
