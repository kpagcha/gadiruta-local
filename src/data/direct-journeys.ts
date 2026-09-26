/**
 * Searches the checked-in timetable in the browser for one-seat journeys on a selected local date.
 * Times are minutes from a GTFS service day, which may continue after midnight. This module makes
 * no network requests and leaves display formatting to the interface.
 */
import { shiftCalendarDate } from './calendar-date.ts';
import { townLocalAreaId, type LocationOption } from './location-search.ts';
import type { NetworkDataset, NetworkStop, NetworkStopTime, NetworkTrip } from './network-schema.ts';

/** One trip occurrence and the stop pair initially shown on its result card. */
export interface DirectJourney {
  id: string;
  trip: NetworkTrip;
  serviceDate: string;
  minuteOffset: 0 | -1440;
  boardingIndex: number;
  alightingIndex: number;
  departureMinute: number;
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

/** Locate the reviewed point used to rank stops for a place, if one exists. */
function locationReferencePoint(
  dataset: NetworkDataset,
  location: LocationOption,
  stopsById: Map<string, NetworkStop>,
): { latitude: number; longitude: number } | null {
  if (location.kind === 'stop') return stopsById.get(location.id) ?? null;
  const localAreaId =
    location.municipalityId === undefined ? location.localAreaId : townLocalAreaId(dataset, location.municipalityId);
  return dataset.localAreas.find((localArea) => localArea.id === localAreaId)?.referencePoint ?? null;
}

/** Measure straight-line distance between two coordinates in kilometres. */
function distanceKm(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number } | null,
): number {
  if (second === null) return 0;
  const radians = Math.PI / 180;
  const latitudeDifference = (second.latitude - first.latitude) * radians;
  const longitudeDifference = (second.longitude - first.longitude) * radians;
  const arc =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(first.latitude * radians) * Math.cos(second.latitude * radians) * Math.sin(longitudeDifference / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, arc)));
}

/** Decide whether a selected place or exact stop contains this physical stop. */
function matchesLocation(location: LocationOption, stop: NetworkStop): boolean {
  if (location.kind === 'stop') return location.id === stop.id;
  if (location.municipalityId !== undefined) return location.municipalityId === stop.municipalityId;
  if (location.localAreaId !== undefined) return stop.localAreaId === location.localAreaId;
  return stop.placeId === location.id;
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

/** Choose one reachable stop pair per trip, preferring departures at or after the cutoff. */
export function findDirectJourneys(
  dataset: NetworkDataset,
  date: string,
  origin: LocationOption,
  destination: LocationOption,
  departAfter = '',
): { earlier: DirectJourney[]; later: DirectJourney[] } {
  const earlier: DirectJourney[] = [];
  const later: DirectJourney[] = [];
  if (
    date < dataset.coverage.startDate ||
    date > dataset.coverage.endDate ||
    (origin.kind === 'stop' && destination.kind === 'stop' && origin.id === destination.id)
  )
    return { earlier, later };

  // The caller supplies an empty or normalized HH:mm cutoff; an empty value means the full day.
  const cutoff = departAfter === '' ? 0 : Number(departAfter.slice(0, 2)) * 60 + Number(departAfter.slice(3, 5));
  const stopsById = new Map(dataset.stops.map((stop) => [stop.id, stop]));
  const originPoint = locationReferencePoint(dataset, origin, stopsById);
  const destinationPoint = locationReferencePoint(dataset, destination, stopsById);
  const calendars = new Map(dataset.calendars.map((calendar) => [calendar.serviceId, calendar]));
  const exceptions = new Map(
    dataset.calendarExceptions.map((exception) => [`${exception.serviceId}:${exception.date}`, exception.type]),
  );
  // A GTFS trip dated yesterday can board after midnight today with a 24:xx time.
  for (const serviceDate of [shiftCalendarDate(date, -1), date]) {
    const minuteOffset: 0 | -1440 = serviceDate === date ? 0 : -1440;
    for (const trip of dataset.trips) {
      if (!runsOnDate(trip.serviceId, serviceDate, calendars, exceptions)) continue;
      let selected: {
        boardingIndex: number;
        alightingIndex: number;
        departureMinute: number;
        arrivalMinute: number;
        distanceKm: number;
        afterCutoff: boolean;
      } | null = null;
      for (const [boardingIndex, boarding] of trip.stopTimes.entries()) {
        const departureMinute = boarding.departureMinutes + minuteOffset;
        const boardingStop = stopsById.get(boarding.stopId)!;
        if (
          departureMinute < 0 ||
          departureMinute >= 1440 ||
          !permitsAction(boarding, 'pickup') ||
          !matchesLocation(origin, boardingStop)
        )
          continue;
        const boardingDistance = distanceKm(boardingStop, originPoint);
        const afterCutoff = departureMinute >= cutoff;
        for (let alightingIndex = boardingIndex + 1; alightingIndex < trip.stopTimes.length; alightingIndex += 1) {
          const alighting = trip.stopTimes[alightingIndex]!;
          const alightingStop = stopsById.get(alighting.stopId)!;
          if (
            !permitsAction(alighting, 'dropOff') ||
            !matchesLocation(destination, alightingStop) ||
            alighting.arrivalMinutes < boarding.departureMinutes
          )
            continue;

          // A boarding at or after the cutoff wins first; then proximity and time choose the pair.
          const arrivalMinute = alighting.arrivalMinutes + minuteOffset;
          const totalDistance = boardingDistance + distanceKm(alightingStop, destinationPoint);
          if (selected?.afterCutoff && !afterCutoff) continue;
          if (selected !== null && selected.afterCutoff === afterCutoff) {
            if (totalDistance > selected.distanceKm) continue;
            if (totalDistance === selected.distanceKm && departureMinute > selected.departureMinute) continue;
            if (
              totalDistance === selected.distanceKm &&
              departureMinute === selected.departureMinute &&
              arrivalMinute >= selected.arrivalMinute
            )
              continue;
          }

          selected = {
            boardingIndex,
            alightingIndex,
            departureMinute,
            arrivalMinute,
            distanceKm: totalDistance,
            afterCutoff,
          };
        }
      }
      if (selected !== null) {
        (selected.afterCutoff ? later : earlier).push({
          id: `${trip.id}:${serviceDate}`,
          trip,
          serviceDate,
          minuteOffset,
          boardingIndex: selected.boardingIndex,
          alightingIndex: selected.alightingIndex,
          departureMinute: selected.departureMinute,
        });
      }
    }
  }
  /** Order the cards by their displayed default boarding, then by their stable trip ID. */
  function byDeparture(first: DirectJourney, second: DirectJourney): number {
    return first.departureMinute - second.departureMinute || first.id.localeCompare(second.id);
  }

  return { earlier: earlier.sort(byDeparture), later: later.sort(byDeparture) };
}
