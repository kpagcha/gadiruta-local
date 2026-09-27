/** Give line-timeline municipalities stable color families and their areas readable nearby shades. */
import { hexToHsv, hsvToHex } from './color-picker.ts';
import { contrastRatio } from './dev-settings.ts';
import type { NetworkDataset, NetworkStop } from './network-schema.ts';

export type LineAreaColors = { light: string; dark: string };

const MIN_TEXT_CONTRAST = 4.5;
const MUNICIPALITY_HUE_STEP = 137.508;

/** Match the opaque CSS color-mix used by the theme and area badge. */
function mixHex(base: string, accent: string, accentShare: number): string {
  const channels = [1, 3, 5].map((start) => {
    const baseChannel = Number.parseInt(base.slice(start, start + 2), 16);
    const accentChannel = Number.parseInt(accent.slice(start, start + 2), 16);
    return Math.round(baseChannel * (1 - accentShare) + accentChannel * accentShare)
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

/** Choose a color that keeps stop text, actions, and badge text readable in either palette state. */
function readableColor(hue: number, accent: string, mode: 'light' | 'dark'): string {
  const light = mode === 'light';
  const paper = light ? '#f7f6f0' : '#0e191a';
  const hover = light ? '#e6eee8' : '#192d2b';
  const paperBackgrounds = [paper, mixHex(paper, accent, light ? 0.04 : 0.03)];
  const backgrounds = [
    ...paperBackgrounds,
    hover,
    mixHex(hover, accent, light ? 0.1 : 0.12),
    // The Andalucía lime experiment has its own hover surface.
    light ? mixHex(hover, '#c5e86f', 0.23) : mixHex(hover, accent, 0.16),
  ];

  // Bright blue, violet, and red need less saturation than green to read on dark surfaces.
  for (let saturation = light ? 65 : 53; saturation >= (light ? 65 : 20); saturation -= 3) {
    for (let value = light ? 58 : 74; light ? value >= 0 : value <= 100; value += light ? -1 : 1) {
      const color = hsvToHex({ hue, saturation, value });
      if (
        backgrounds.every((background) => contrastRatio(color, background) >= MIN_TEXT_CONTRAST) &&
        paperBackgrounds.every(
          (background) => contrastRatio(color, mixHex(background, color, 0.12)) >= MIN_TEXT_CONTRAST,
        )
      ) {
        return color;
      }
    }
  }
  return light ? '#000000' : '#ffffff';
}

/** Name the municipality or local-area color shared by stops in that place. */
export function lineStopAreaKey(stop: NetworkStop): string | null {
  if (stop.localAreaId !== null) return `area:${stop.localAreaId}`;
  return stop.municipalityId === null ? null : `place:${stop.municipalityId}`;
}

/** Calculate the readable light and dark pair for one hue in the selected app palette. */
function colorsForHue(hue: number, accents: { light: string; dark: string }): LineAreaColors {
  return {
    light: readableColor(hue, accents.light, 'light'),
    dark: readableColor(hue, accents.dark, 'dark'),
  };
}

/** Assign distinct municipality hues, then vary each area's hue slightly within its family. */
export function lineAreaColors(
  dataset: NetworkDataset,
  accents: { light: string; dark: string },
): Map<string, LineAreaColors> {
  const colors = new Map<string, LineAreaColors>();
  const accentHue = hexToHsv(accents.light)?.hue ?? 0;
  const municipalities = [...dataset.municipalities].sort((first, second) =>
    first.id < second.id ? -1 : first.id > second.id ? 1 : 0,
  );

  for (const [municipalityIndex, municipality] of municipalities.entries()) {
    const baseHue = (accentHue + municipalityIndex * MUNICIPALITY_HUE_STEP) % 360;
    colors.set(`place:${municipality.id}`, colorsForHue(baseHue, accents));

    const areas = dataset.localAreas
      .filter((area) => area.municipalityId === municipality.id)
      .sort((first, second) => (first.id < second.id ? -1 : first.id > second.id ? 1 : 0));
    for (const [areaIndex, area] of areas.entries()) {
      // Even a municipality with many areas stays within a narrow hue family.
      const offset = Math.ceil((areaIndex + 1) / 2) * 4 * (areaIndex % 2 === 0 ? -1 : 1);
      colors.set(`area:${area.id}`, colorsForHue((baseHue + offset + 360) % 360, accents));
    }
  }
  return colors;
}
