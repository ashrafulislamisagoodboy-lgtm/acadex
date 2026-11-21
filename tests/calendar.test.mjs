import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventsInRange, localMidnight } from '../src/lib/calendar.ts';

const holiday = { startDate: '2026-12-30', endDate: '2027-01-03' };
const exam = { startDate: '2027-01-05' };
const events = [holiday, exam, { startDate: '2026-01-05' }];

test('agenda includes cross-year events but not last year’s single-day events', () => {
  assert.deepEqual(eventsInRange(events, new Date(2027, 0, 1), new Date(2027, 0, 31)), [holiday, exam]);
});

test('day filter includes ongoing events through the last day', () => {
  for (const [day, expected] of [[1, [holiday]], [3, [holiday]], [4, []], [5, [exam]]]) {
    const date = new Date(2027, 0, day, 15);
    assert.deepEqual(eventsInRange(events, date, date), expected);
  }
});

test('date-only values are displayed at local midnight', () => {
  assert.equal(localMidnight(exam.startDate).getTime(), new Date(2027, 0, 5).getTime());
});
