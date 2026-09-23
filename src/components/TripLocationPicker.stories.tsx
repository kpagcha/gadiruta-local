import type { Meta, StoryObj } from '@storybook/react-vite';
import type { NetworkDatasetState } from '../data/use-network-dataset.ts';
import { TripLocationPicker } from './TripLocationPicker';

/** A small valid local network for inspecting the picker without a request. */
const readyState = {
  status: 'ready',
  dataset: {
    formatVersion: 1,
    source: {
      url: 'https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip',
      generatedAt: '2026-09-21T15:15:44.000Z',
      archiveSha256: 'a'.repeat(64),
    },
    agencies: [{ id: 'CMTBC', name: 'Bahía de Cádiz' }],
    routes: [
      {
        id: '2_13',
        agencyId: 'CMTBC',
        shortName: 'M-040',
        longName: 'Cádiz-El Puerto de Santa María',
        type: 3,
        color: '9933ff',
        textColor: 'FFFFFF',
      },
    ],
    stops: [
      { id: '2_10', name: 'Estación de Autobuses Cádiz', latitude: 36.53, longitude: -6.29, parentStationId: null },
      { id: '2_11', name: 'Estación de Autobuses Jerez', latitude: 36.69, longitude: -6.14, parentStationId: null },
    ],
    patterns: [{ routeId: '2_13', directionId: '0', stopIds: ['2_10', '2_11'] }],
  },
} satisfies NetworkDatasetState;

const meta = {
  title: 'Components/Trip location picker',
  component: TripLocationPicker,
} satisfies Meta<typeof TripLocationPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { args: { state: readyState } };
export const Loading: Story = { args: { state: { status: 'loading' } } };
export const Error: Story = { args: { state: { status: 'error' } } };
