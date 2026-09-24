/**
 * Searches the checked-in timetable in the browser for one-seat journeys on a selected local date.
 * Times are minutes from a GTFS service day, which may continue after midnight. This module makes
 * no network requests and leaves display formatting to the interface.
 */
import type { LocationOption } from './location-search.ts';
import type { NetworkDataset, NetworkStopTime, NetworkTrip } from './network-schema.ts';

/** A reachable destination on the same trip after one chosen boarding visit. */
export interface AlightingChoice {
  index: number;
  stopId: string;
  arrivalMinute: number;
}

/** One boardable visit and all later alighting visits matching the destination. */
export interface BoardingChoice {
  index: number;
  stopId: string;
  departureMinute: number;
  alightings: AlightingChoice[];
}

/** One trip occurrence on a service date, with its default earliest matching pair. */
export interface DirectJourney {
  id: string;
  tripId: string;
  routeId: string;
  serviceDate: string;
  boardings: BoardingChoice[];
}

/** One trip card with the boarding that places it in a time-anchored result list. */
export interface TimedJourney {
  journey: DirectJourney;
  boardingIndex: number;
  departureMinute: number;
}

/** Return today's calendar date in Cádiz even when the browser is in another time zone. */
export function madridToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const field = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${field('year')}-${field('month')}-${field('day')}`;
}

/** Shift an ISO calendar date without applying the browser's local time zone. */
function previousDate(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/** Check whether a service runs after a date exception overrides its weekly calendar. */
function runsOnDate(
  serviceId: string,
  date: string,
  calendars: Map<string, NetworkDataset['calendars'][number]>,
  exceptions: Map<string, number>,
): boolean {
  const exception = exceptions.get(`${serviceId}:${date}`);
  if (exception !== undefined) return exception === 1;
  const calendar = calendars.get(serviceId);
  if (calendar === undefined || date < calendar.startDate || date > calendar.endDate) return false;
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return calendar.weekdays[weekday] ?? false;
}

/** Decide whether a selected place or exact stop contains this stop visit. */
function matchesLocation(location: LocationOption, stopId: string, placeByStop: Map<string, string | null>): boolean {
  return location.kind === 'stop' ? location.id === stopId : placeByStop.get(stopId) === location.id;
}

/** A GTFS pickup or drop-off value of one forbids the corresponding action. */
function permitsAction(time: NetworkStopTime, action: 'pickup' | 'dropOff'): boolean {
  return (action === 'pickup' ? time.pickupType : time.dropOffType) !== 1;
}

/** List the stops where this trip can end after the chosen boarding visit. */
export function alightableTripStopIndices(trip: NetworkTrip, boardingIndex: number): number[] {
  const boarding = trip.stopTimes[boardingIndex];
  if (boarding === undefined) return [];
  return trip.stopTimes.flatMap((time, index) =>
    index > boardingIndex && permitsAction(time, 'dropOff') && time.arrivalMinutes >= boarding.departureMinutes
      ? [index]
      : [],
  );
}

/** List pickup stops that have at least one later stop where the rider can leave the trip. */
export function boardableTripStopIndices(trip: NetworkTrip): number[] {
  return trip.stopTimes.flatMap((time, index) =>
    permitsAction(time, 'pickup') && alightableTripStopIndices(trip, index).length > 0 ? [index] : [],
  );
}

/** Find each direct trip occurrence whose boarding lies within the selected full calendar day. */
export function findDirectJourneys(
  dataset: NetworkDataset,
  date: string,
  origin: LocationOption,
  destination: LocationOption,
): DirectJourney[] {
  if (
    date < dataset.coverage.startDate ||
    date > dataset.coverage.endDate ||
    (origin.kind === 'stop' && destination.kind === 'stop' && origin.id === destination.id)
  )
    return [];

  const placeByStop = new Map(dataset.stops.map((stop) => [stop.id, stop.placeId]));
  const calendars = new Map(dataset.calendars.map((calendar) => [calendar.serviceId, calendar]));
  const exceptions = new Map(
    dataset.calendarExceptions.map((exception) => [`${exception.serviceId}:${exception.date}`, exception.type]),
  );
  const journeys: DirectJourney[] = [];

  // A GTFS trip dated yesterday can board after midnight today with a 24:xx time.
  for (const serviceDate of [previousDate(date), date]) {
    const offset = serviceDate === date ? 0 : -1440;
    for (const trip of dataset.trips) {
      if (!runsOnDate(trip.serviceId, serviceDate, calendars, exceptions)) continue;
      const boardings: BoardingChoice[] = [];
      for (const [index, time] of trip.stopTimes.entries()) {
        const departureMinute = time.departureMinutes + offset;
        if (
          departureMinute < 0 ||
          departureMinute >= 1440 ||
          !permitsAction(time, 'pickup') ||
          !matchesLocation(origin, time.stopId, placeByStop)
        )
          continue;
        const alightings = trip.stopTimes.slice(index + 1).flatMap((later, relativeIndex) =>
          permitsAction(later, 'dropOff') &&
          matchesLocation(destination, later.stopId, placeByStop) &&
          later.arrivalMinutes >= time.departureMinutes
            ? [
                {
                  index: index + relativeIndex + 1,
                  stopId: later.stopId,
                  arrivalMinute: later.arrivalMinutes + offset,
                },
              ]
            : [],
        );
        if (alightings.length > 0) boardings.push({ index, stopId: time.stopId, departureMinute, alightings });
      }
      if (boardings.length > 0)
        journeys.push({
          id: `${trip.id}:${serviceDate}`,
          tripId: trip.id,
          routeId: trip.routeId,
          serviceDate,
          boardings,
        });
    }
  }
  return journeys.sort(
    (a, b) => a.boardings[0]!.departureMinute - b.boardings[0]!.departureMinute || a.id.localeCompare(b.id),
  );
}

/** Split complete local results around an empty or validated HH:mm time without duplicating a trip card. */
export function splitDirectJourneys(
  journeys: readonly DirectJourney[],
  departAfter: string,
): { earlier: TimedJourney[]; later: TimedJourney[] } {
  const cutoff = departAfter === '' ? 0 : Number(departAfter.slice(0, 2)) * 60 + Number(departAfter.slice(3, 5));
  const earlier: TimedJourney[] = [];
  const later: TimedJourney[] = [];

  for (const journey of journeys) {
    // A place can include several boarding stops on one trip. Display the first one at or after
    // the requested time, but retain the other choices inside the same card.
    const boardingIndex = journey.boardings.findIndex((boarding) => boarding.departureMinute >= cutoff);
    if (boardingIndex >= 0) {
      later.push({ journey, boardingIndex, departureMinute: journey.boardings[boardingIndex]!.departureMinute });
    } else {
      earlier.push({ journey, boardingIndex: 0, departureMinute: journey.boardings[0]!.departureMinute });
    }
  }

  /** Order the cards by their displayed default boarding, then by their stable trip ID. */
  function byDeparture(first: TimedJourney, second: TimedJourney): number {
    return first.departureMinute - second.departureMinute || first.journey.id.localeCompare(second.journey.id);
  }

  return { earlier: earlier.sort(byDeparture), later: later.sort(byDeparture) };
}

/** Display an absolute trip minute as a clock time, wrapping at midnight. */
export function clockTime(minute: number): string {
  const withinDay = ((minute % 1440) + 1440) % 1440;
  return `${String(Math.floor(withinDay / 60)).padStart(2, '0')}:${String(withinDay % 60).padStart(2, '0')}`;
}
