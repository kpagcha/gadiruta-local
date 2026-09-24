import type { Meta, StoryObj } from '@storybook/react-vite';
import type { NetworkDatasetState } from '../data/use-network-dataset.ts';
import { TripLocationPicker } from './TripLocationPicker';

/** A small valid local network for inspecting the picker without a request. */
const readyState = {
  status: 'ready',
  dataset: {
    formatVersion: 2,
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
      {
        id: '2_10',
        name: 'Estación de Autobuses Cádiz',
        latitude: 36.53,
        longitude: -6.29,
        parentStationId: null,
        placeId: 'cadiz',
      },
      {
        id: '2_11',
        name: 'Estación de Autobuses Jerez',
        latitude: 36.69,
        longitude: -6.14,
        parentStationId: null,
        placeId: 'jerez-de-la-frontera',
      },
    ],
    patterns: [{ routeId: '2_13', directionId: '0', stopIds: ['2_10', '2_11'] }],
    trips: [
      {
        id: 'sample',
        routeId: '2_13',
        serviceId: 'daily',
        stopTimes: [
          { stopId: '2_10', arrivalMinutes: 480, departureMinutes: 480, pickupType: 0, dropOffType: 0 },
          { stopId: '2_11', arrivalMinutes: 540, departureMinutes: 540, pickupType: 0, dropOffType: 0 },
        ],
      },
    ],
    calendars: [
      {
        serviceId: 'daily',
        startDate: '2026-09-01',
        endDate: '2026-12-31',
        weekdays: [true, true, true, true, true, true, true],
      },
    ],
    calendarExceptions: [],
    coverage: { startDate: '2026-09-01', endDate: '2026-12-31' },
  },
} satisfies NetworkDatasetState;

const meta = {
  title: 'Components/Trip location picker',
  component: TripLocationPicker,
} satisfies Meta<typeof TripLocationPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Keep the isolated form story interactive without changing page-level results. */
function ignoreStoryInteraction() {}

export const Ready: Story = {
  args: { state: readyState, onSearch: ignoreStoryInteraction, onDraftChange: ignoreStoryInteraction },
};
export const Loading: Story = {
  args: { state: { status: 'loading' }, onSearch: ignoreStoryInteraction, onDraftChange: ignoreStoryInteraction },
};
export const Error: Story = {
  args: { state: { status: 'error' }, onSearch: ignoreStoryInteraction, onDraftChange: ignoreStoryInteraction },
};
