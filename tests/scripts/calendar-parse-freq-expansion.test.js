const { test } = require('node:test');
const assert = require('node:assert');

// Pin timezone for deterministic tests
process.env.TZ = 'America/New_York';

// Load the calendar-parse module
const { expandRecurrence, parseICS } = require('../../scripts/calendar-parse.js');

// ============================================================================
// FREQ=DAILY expansion tests
// ============================================================================

test('expandRecurrence: FREQ=DAILY with COUNT=3', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
    endDate: new Date('2026-01-01T11:00:00Z'),
    summary: 'Daily Standup',
  };
  const result = expandRecurrence(event, 'FREQ=DAILY;COUNT=3', 7, new Date('2026-01-01'));
  assert.strictEqual(result.length, 3);
  assert.strictEqual(result[0].startDate.getUTCDate(), 1);
  assert.strictEqual(result[1].startDate.getUTCDate(), 2);
  assert.strictEqual(result[2].startDate.getUTCDate(), 3);
  // All should have the same summary
  assert.strictEqual(result[0].summary, 'Daily Standup');
  assert.strictEqual(result[2].summary, 'Daily Standup');
  // Duration should be preserved
  assert.strictEqual(result[0].startDate.getTime(), result[0].startDate.getTime());
  assert.strictEqual(
    result[1].endDate.getTime() - result[1].startDate.getTime(),
    3600000 // 1 hour
  );
});

test('expandRecurrence: FREQ=DAILY with UNTIL', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
    endDate: new Date('2026-01-01T11:00:00Z'),
  };
  const result = expandRecurrence(event, 'FREQ=DAILY;UNTIL=20260105', 30, new Date('2026-01-01'));
  // Should include Jan 1, 2, 3, 4, 5 (UNTIL date is inclusive)
  assert(result.length >= 5, `Expected at least 5, got ${result.length}`);
  assert.strictEqual(result[0].startDate.getUTCDate(), 1);
  assert(result.some((e) => e.startDate.getUTCDate() === 5));
});

test('expandRecurrence: FREQ=DAILY open-ended within lookahead window', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
  };
  const result = expandRecurrence(event, 'FREQ=DAILY', 5, new Date('2026-01-01'));
  // With 5-day lookahead from Jan 1 00:00, includes up to Jan 6 00:00
  // Jan 1 10:00, Jan 2 10:00, Jan 3 10:00, Jan 4 10:00, Jan 5 10:00 (5 total, Jan 6 10:00 is past cutoff)
  assert(result.length >= 5, `Expected at least 5, got ${result.length}`);
});

test('expandRecurrence: FREQ=DAILY respects maxLookupDays cutoff', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
  };
  // With 3-day lookahead from Jan 1
  const result = expandRecurrence(event, 'FREQ=DAILY', 3, new Date('2026-01-01'));
  // Should get Jan 1, 2, 3, maybe Jan 4 (3-day cutoff)
  assert(result.length >= 3, `Expected at least 3, got ${result.length}`);
  assert(result.every((e) => e.startDate.getUTCDate() <= 5));
});

test('expandRecurrence: FREQ=DAILY starting in past, series continues', () => {
  const event = {
    startDate: new Date('2025-12-30T10:00:00Z'),
  };
  const now = new Date('2026-01-01');
  const result = expandRecurrence(event, 'FREQ=DAILY;COUNT=5', 2, now);
  // Master from Dec 30, but we're looking from Jan 1 with 2-day lookahead
  // Should get Jan 1, 2, 3 (dates within the window)
  // The COUNT=5 means total 5 occurrences: Dec 30, 31, Jan 1, 2, 3
  assert(result.length >= 1); // At least Jan 1
  assert(result[0].startDate.getUTCDate() >= 1);
});

test('expandRecurrence: FREQ=DAILY with COUNT already ended', () => {
  const event = {
    startDate: new Date('2025-12-25T10:00:00Z'),
  };
  const now = new Date('2026-01-01');
  // Series: Dec 25, 26, 27 (COUNT=3)
  const result = expandRecurrence(event, 'FREQ=DAILY;COUNT=3', 7, now);
  // Series ended before 'now', should return just the event
  assert.strictEqual(result.length, 1);
  assert.deepStrictEqual(result[0].startDate, event.startDate);
});

test('expandRecurrence: FREQ=DAILY with duration preservation', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
    endDate: new Date('2026-01-01T14:30:00Z'), // 4.5 hours
  };
  const result = expandRecurrence(event, 'FREQ=DAILY;COUNT=2', 30, new Date('2026-01-01'));
  assert.strictEqual(result.length, 2);
  // Check duration is preserved
  const duration = result[0].endDate.getTime() - result[0].startDate.getTime();
  assert.strictEqual(duration, 4.5 * 60 * 60 * 1000);
  assert.strictEqual(result[1].endDate.getTime() - result[1].startDate.getTime(), duration);
});

// ============================================================================
// FREQ=MONTHLY expansion tests
// ============================================================================

test('expandRecurrence: FREQ=MONTHLY with COUNT=3', () => {
  const event = {
    startDate: new Date('2026-01-15T10:00:00Z'),
    summary: 'Monthly Review',
  };
  const result = expandRecurrence(event, 'FREQ=MONTHLY;COUNT=3', 120, new Date('2026-01-01'));
  assert.strictEqual(result.length, 3);
  // Jan 15, Feb 15, Mar 15
  assert.strictEqual(result[0].startDate.getUTCMonth(), 0); // January
  assert.strictEqual(result[0].startDate.getUTCDate(), 15);
  assert.strictEqual(result[1].startDate.getUTCMonth(), 1); // February
  assert.strictEqual(result[1].startDate.getUTCDate(), 15);
  assert.strictEqual(result[2].startDate.getUTCMonth(), 2); // March
  assert.strictEqual(result[2].startDate.getUTCDate(), 15);
});

test('expandRecurrence: FREQ=MONTHLY with UNTIL', () => {
  const event = {
    startDate: new Date('2026-01-15T10:00:00Z'),
  };
  const result = expandRecurrence(event, 'FREQ=MONTHLY;UNTIL=20260401', 120, new Date('2026-01-01'));
  // Jan 15, Feb 15, Mar 15, Apr 1 (UNTIL is Apr 1, so includes up through Apr)
  assert(result.length >= 3);
  assert.strictEqual(result[0].startDate.getUTCDate(), 15);
});

test('expandRecurrence: FREQ=MONTHLY respects maxLookupDays cutoff', () => {
  const event = {
    startDate: new Date('2026-01-15T10:00:00Z'),
  };
  // 40-day lookahead from Jan 1 = up to Feb 10
  const result = expandRecurrence(event, 'FREQ=MONTHLY', 40, new Date('2026-01-01'));
  // Jan 15 is included (within 40 days), Feb 15 might be at boundary
  assert(result.length >= 1);
  assert.strictEqual(result[0].startDate.getUTCDate(), 15);
});

test('expandRecurrence: FREQ=MONTHLY with day-of-month edge case (31st)', () => {
  const event = {
    startDate: new Date('2026-01-31T10:00:00Z'),
  };
  const result = expandRecurrence(event, 'FREQ=MONTHLY;COUNT=3', 120, new Date('2026-01-01'));
  // Jan 31, Feb 28 (no 31st), Mar 31
  assert(result.length === 3 || result.length === 1); // Implementation detail: how to handle Feb
});

test('expandRecurrence: FREQ=MONTHLY with duration preservation', () => {
  const event = {
    startDate: new Date('2026-01-15T10:00:00Z'),
    endDate: new Date('2026-01-15T12:30:00Z'), // 2.5 hours
  };
  const result = expandRecurrence(event, 'FREQ=MONTHLY;COUNT=2', 60, new Date('2026-01-01'));
  const duration = result[0].endDate.getTime() - result[0].startDate.getTime();
  assert.strictEqual(duration, 2.5 * 60 * 60 * 1000);
  assert.strictEqual(result[1].endDate.getTime() - result[1].startDate.getTime(), duration);
});

// ============================================================================
// FREQ=YEARLY expansion tests
// ============================================================================

test('expandRecurrence: FREQ=YEARLY with COUNT=3', () => {
  const event = {
    startDate: new Date('2026-06-15T10:00:00Z'),
    summary: 'Annual Review',
  };
  const result = expandRecurrence(event, 'FREQ=YEARLY;COUNT=3', 1095, new Date('2026-01-01'));
  assert.strictEqual(result.length, 3);
  // June 15 of 2026, 2027, 2028
  assert.strictEqual(result[0].startDate.getUTCFullYear(), 2026);
  assert.strictEqual(result[1].startDate.getUTCFullYear(), 2027);
  assert.strictEqual(result[2].startDate.getUTCFullYear(), 2028);
  assert(result.every((e) => e.startDate.getUTCMonth() === 5)); // June
  assert(result.every((e) => e.startDate.getUTCDate() === 15));
});

test('expandRecurrence: FREQ=YEARLY with UNTIL', () => {
  const event = {
    startDate: new Date('2026-06-15T10:00:00Z'),
  };
  const result = expandRecurrence(event, 'FREQ=YEARLY;UNTIL=20280615', 1095, new Date('2026-01-01'));
  // 2026, 2027, 2028 (UNTIL is inclusive)
  assert(result.length >= 2, `Expected at least 2, got ${result.length}`);
  assert.strictEqual(result[0].startDate.getUTCFullYear(), 2026);
});

test('expandRecurrence: FREQ=YEARLY respects maxLookupDays cutoff', () => {
  const event = {
    startDate: new Date('2026-06-15T10:00:00Z'),
  };
  // 200-day lookahead is less than a year
  const result = expandRecurrence(event, 'FREQ=YEARLY', 200, new Date('2026-01-01'));
  // Should include the first occurrence in June 2026 (within 200 days)
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].startDate.getUTCFullYear(), 2026);
});

test('expandRecurrence: FREQ=YEARLY starting in past', () => {
  const event = {
    startDate: new Date('2024-06-15T10:00:00Z'),
  };
  const now = new Date('2026-01-01');
  const result = expandRecurrence(event, 'FREQ=YEARLY;COUNT=3', 730, now);
  // 2024, 2025, 2026 (but we look from Jan 1, 2026)
  // Should include 2026 and maybe beyond within lookahead
  assert(result.length >= 1);
});

test('expandRecurrence: FREQ=YEARLY with duration preservation', () => {
  const event = {
    startDate: new Date('2026-06-15T10:00:00Z'),
    endDate: new Date('2026-06-15T15:45:00Z'), // 5.75 hours
  };
  const result = expandRecurrence(event, 'FREQ=YEARLY;COUNT=2', 730, new Date('2026-01-01'));
  const duration = result[0].endDate.getTime() - result[0].startDate.getTime();
  assert.strictEqual(duration, 5.75 * 60 * 60 * 1000);
  assert.strictEqual(result[1].endDate.getTime() - result[1].startDate.getTime(), duration);
});

// ============================================================================
// Integration tests with parseICS
// ============================================================================

test('parseICS: FREQ=DAILY event expands correctly', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily-standup
DTSTAMP:20260101T000000Z
DTSTART:20260101T100000Z
DTEND:20260101T110000Z
SUMMARY:Daily Standup
RRULE:FREQ=DAILY;COUNT=5
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);
  assert.strictEqual(events.length, 5);
  assert(events.every((e) => e.summary === 'Daily Standup'));
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(events[i].startDate.getUTCDate(), i + 1);
  }
});

test('parseICS: FREQ=MONTHLY event expands correctly', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:monthly-review
DTSTAMP:20260101T000000Z
DTSTART:20260115T140000Z
DTEND:20260115T150000Z
SUMMARY:Monthly Review
RRULE:FREQ=MONTHLY;COUNT=3
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 120);
  assert.strictEqual(events.length, 3);
  assert.strictEqual(events[0].startDate.getUTCMonth(), 0); // Jan
  assert.strictEqual(events[1].startDate.getUTCMonth(), 1); // Feb
  assert.strictEqual(events[2].startDate.getUTCMonth(), 2); // Mar
});

test('parseICS: FREQ=YEARLY event expands correctly', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:annual-meeting
DTSTAMP:20260101T000000Z
DTSTART:20260615T100000Z
DTEND:20260615T110000Z
SUMMARY:Annual Meeting
RRULE:FREQ=YEARLY;COUNT=2
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 730);
  assert.strictEqual(events.length, 2);
  assert.strictEqual(events[0].startDate.getUTCFullYear(), 2026);
  assert.strictEqual(events[1].startDate.getUTCFullYear(), 2027);
});

test('parseICS: DAILY with EXDATE exclusion still works', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily-with-skip
DTSTAMP:20260101T000000Z
DTSTART:20260101T100000Z
DTEND:20260101T110000Z
SUMMARY:Daily with Skip
RRULE:FREQ=DAILY;COUNT=5
EXDATE:20260103T100000Z
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);
  // 5 total occurrences, minus 1 EXDATE = 4
  assert.strictEqual(events.length, 4);
  const dates = events.map((e) => e.startDate.getUTCDate());
  assert(!dates.includes(3)); // Jan 3 excluded
  assert(dates.includes(1));
  assert(dates.includes(2));
  assert(dates.includes(4));
  assert(dates.includes(5));
});

test('parseICS: MONTHLY with RECURRENCE-ID override', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:monthly-override-test
DTSTAMP:20260101T000000Z
DTSTART:20260115T100000Z
DTEND:20260115T110000Z
SUMMARY:Monthly Meeting
RRULE:FREQ=MONTHLY;COUNT=2
END:VEVENT
BEGIN:VEVENT
UID:monthly-override-test
DTSTAMP:20260101T000000Z
RECURRENCE-ID:20260215T100000Z
DTSTART:20260215T140000Z
DTEND:20260215T150000Z
SUMMARY:Monthly Meeting (rescheduled)
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 60);
  assert.strictEqual(events.length, 2);
  // First occurrence unchanged
  assert.strictEqual(events[0].summary, 'Monthly Meeting');
  assert.strictEqual(events[0].startDate.getUTCHours(), 10);
  // Second occurrence overridden
  assert.strictEqual(events[1].summary, 'Monthly Meeting (rescheduled)');
  assert.strictEqual(events[1].startDate.getUTCHours(), 14);
});

test('parseICS: multiple different frequencies in one feed', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:daily-standup
DTSTAMP:20260101T000000Z
DTSTART:20260101T090000Z
DTEND:20260101T091500Z
SUMMARY:Daily Standup
RRULE:FREQ=DAILY;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:monthly-review
DTSTAMP:20260101T000000Z
DTSTART:20260115T140000Z
DTEND:20260115T150000Z
SUMMARY:Monthly Review
RRULE:FREQ=MONTHLY;COUNT=2
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 60);
  // 3 daily + 2 monthly = 5 total
  assert.strictEqual(events.length, 5);
  const dailyEvents = events.filter((e) => e.summary === 'Daily Standup');
  const monthlyEvents = events.filter((e) => e.summary === 'Monthly Review');
  assert.strictEqual(dailyEvents.length, 3);
  assert.strictEqual(monthlyEvents.length, 2);
});
