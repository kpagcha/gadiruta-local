/** Checks time entry, Madrid clock conversion, and date-boundary stepping without a browser. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { isCalendarDate, madridToday, shiftCalendarDate } from '../../../src/data/calendar-date.ts';
import { clockTime, currentMadridTime, normalizeJourneyTime, stepJourneyTime } from '../../../src/data/journey-time.ts';

test('keeps exact minutes, compact entry conventions, and invalid input behavior', () => {
  for (const [input, expected] of [
    ['3', '15:00'],
    ['03', '03:00'],
    ['1707', '17:07'],
    ['9:5', '21:05'],
    ['09:05', '09:05'],
    ['24:00', ''],
    ['abc', ''],
  ]) {
    assert.equal(normalizeJourneyTime(input!), expected);
  }
  assert.equal(clockTime(1500), '01:00');
  assert.equal(clockTime(-10), '23:50');
});

test('steps across midnight only within coverage and handles leap days', () => {
  assert.deepEqual(stepJourneyTime('2026-09-26', '23:50', 1, '2026-09-26', '2026-09-27'), {
    date: '2026-09-27',
    time: '00:05',
  });
  assert.equal(stepJourneyTime('2026-09-26', '23:50', 1, '2026-09-26', '2026-09-26'), null);
  assert.equal(stepJourneyTime('2026-09-26', '00:05', -1, '2026-09-26', '2026-09-27'), null);
  assert.equal(shiftCalendarDate('2024-03-01', -1), '2024-02-29');
  assert.equal(isCalendarDate('2024-02-29'), true);
  assert.equal(isCalendarDate('2026-02-29'), false);
});

test('resolves the Madrid day and clock independently of host timezone and across DST', () => {
  const summer = new Date('2026-09-26T22:05:00Z');
  assert.equal(madridToday(summer), '2026-09-27');
  assert.equal(currentMadridTime(summer), '00:05');
  assert.equal(currentMadridTime(new Date('2026-10-25T00:30:00Z')), '02:30');
  assert.equal(currentMadridTime(new Date('2026-10-25T01:30:00Z')), '02:30');
});
