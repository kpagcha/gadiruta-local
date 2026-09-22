import type { Meta, StoryObj } from '@storybook/react-vite';
import type { NetworkDatasetState } from '../data/use-network-dataset.ts';
import { NetworkStatusPanelView } from './NetworkStatusPanel';

/** A compact valid snapshot that makes the ready state independent of a network request. */
const readyState = {
  status: 'ready',
  dataset: {
    formatVersion: 1,
    source: {
      url: 'https://api.ctan.es/v1/datos/UNIFICADO/gtfs.zip',
      generatedAt: '2026-09-21T15:15:44.000Z',
      archiveSha256: 'a'.repeat(64),
    },
    agencies: [{ id: 'CMTBC', name: 'Red de Consorcios de Transporte de Andalucía - Bahía de Cádiz' }],
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
      {
        id: '2_12',
        agencyId: 'CMTBC',
        shortName: 'M-020',
        longName: 'Cádiz-San Fernando',
        type: 3,
        color: '155f64',
        textColor: 'FFFFFF',
      },
      {
        id: '2_14',
        agencyId: 'CMTBC',
        shortName: 'M-050',
        longName: 'Cádiz-Jerez de la Frontera',
        type: 3,
        color: '8b471f',
        textColor: 'FFFFFF',
      },
    ],
    stops: [{ id: 'cadiz', name: 'Cádiz', latitude: 36.53, longitude: -6.29, parentStationId: null }],
    patterns: [{ routeId: '2_13', directionId: '0', stopIds: ['cadiz'] }],
  },
} satisfies NetworkDatasetState;

const meta = {
  title: 'Components/Network status panel',
  component: NetworkStatusPanelView,
} satisfies Meta<typeof NetworkStatusPanelView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { state: { status: 'loading' } },
};

export const Error: Story = {
  args: { state: { status: 'error' } },
};

export const Ready: Story = {
  args: { state: readyState },
};
