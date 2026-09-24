import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState } from 'react';
import { createLocationOptions } from '../data/location-search.ts';
import { places } from '../data/places.ts';
import type { NetworkDatasetState } from '../data/use-network-dataset.ts';
import { TripLocationPicker, type TripSearchDraft } from './TripLocationPicker';

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
  args: {
    options: [],
    draft: {
      origin: { text: '', choice: null },
      destination: { text: '', choice: null },
      date: '2026-09-24',
      departAfter: '',
      departureMode: 'leave-now',
    },
    onSearch: ignoreStorySearch,
    onDraftChange: ignoreStoryDraft,
    urlError: false,
    isSearching: false,
  },
  render: ({ state }) => <PickerStory state={state} />,
} satisfies Meta<typeof TripLocationPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Keep a standalone form story interactive without running a page search. */
function PickerStory({ state }: { state: NetworkDatasetState }) {
  const [draft, setDraft] = useState<TripSearchDraft>({
    origin: { text: '', choice: null },
    destination: { text: '', choice: null },
    date: '2026-09-24',
    departAfter: '',
    departureMode: 'leave-now',
  });
  const options = useMemo(
    () => (state.status === 'ready' ? createLocationOptions(places, state.dataset) : []),
    [state],
  );
  return (
    <TripLocationPicker
      state={state}
      options={options}
      draft={draft}
      onSearch={ignoreStorySearch}
      onDraftChange={setDraft}
      urlError={false}
      isSearching={false}
    />
  );
}

/** Storybook cannot show a page-level result from its isolated picker. */
function ignoreStorySearch() {}

/** Supply a complete default callback for the component's Storybook controls. */
function ignoreStoryDraft() {}

export const Ready: Story = { args: { state: readyState } };
export const Loading: Story = { args: { state: { status: 'loading' } } };
export const Error: Story = { args: { state: { status: 'error' } } };
