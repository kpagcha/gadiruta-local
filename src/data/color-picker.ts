/** Convert the developer color picker's six-digit hex colors to and from hue, saturation, and value. */

export type HsvColor = { hue: number; saturation: number; value: number };

/** Read a complete opaque hex color; partial input stays invalid until all digits are present. */
export function hexToHsv(hex: string): HsvColor | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const [red, green, blue] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const highest = Math.max(red!, green!, blue!);
  const lowest = Math.min(red!, green!, blue!);
  const span = highest - lowest;
  let hue = 0;
  if (span !== 0) {
    if (highest === red) hue = ((green! - blue!) / span) % 6;
    else if (highest === green) hue = (blue! - red!) / span + 2;
    else hue = (red! - green!) / span + 4;
  }
  return {
    hue: (hue * 60 + 360) % 360,
    saturation: highest === 0 ? 0 : (span / highest) * 100,
    value: highest * 100,
  };
}

/** Produce a complete opaque hex color from the visual picker's three controls. */
export function hsvToHex({ hue, saturation, value }: HsvColor): string {
  const chroma = (value / 100) * (saturation / 100);
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = value / 100 - chroma;
  const sector = Math.floor((((hue % 360) + 360) % 360) / 60);
  const channels = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ][sector]!;
  return `#${channels
    .map((channel) =>
      Math.round((channel + offset) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
