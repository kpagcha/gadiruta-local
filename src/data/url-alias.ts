/**
 * Normalizes names for readable URLs. Shared stop links also use a short token from the source ID
 * so they keep resolving when stop names repeat or change.
 */

/** Return a stable eight-character token without exposing the source ID. */
export function urlToken(id: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(id)) {
    hash = ((hash ^ BigInt(byte)) * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return (hash % 36n ** 8n).toString(36).padStart(8, '0');
}

/** Fold a displayed name into a readable path segment without accents or punctuation. */
export function urlSlug(name: string, fallback: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLocaleLowerCase('es')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || fallback
  );
}

/** Put a plain, readable name before the token that identifies an exact network item. */
export function urlAlias(id: string, name: string, fallback: string): string {
  return `${urlSlug(name, fallback)}-${urlToken(id)}`;
}

/** Extract the identifying token even when the visible name has changed. */
export function urlTokenFromAlias(value: string): string | null {
  return /-([0-9a-z]{8})$/.exec(value)?.[1] ?? null;
}
