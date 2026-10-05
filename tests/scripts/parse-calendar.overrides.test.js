const { test } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('fs');
const { resolve } = require('path');

// Pin timezone for deterministic tests
process.env.TZ = 'America/New_York';

// Load the parse-calendar module
const {
  parseICS,
  expandRecurrence,
  applyOverrides,
} = require('../../scripts/parse-calendar.js');

// Helper: read fixture file
function readFixture(filename) {
  return readFileSync(resolve(__dirname, `../fixtures/${filename}`), 'utf-8');
}

// ============================================================================
// applyOverrides function tests
// ============================================================================
test('applyOverrides: removes occurrences matching EXDATE timestamps', () => {
  const master = {
    exdates: [new Date('2026-01-13T10:00:00Z')],
  };
  const expanded = [
    { startDate: new Date('2026-01-06T10:00:00Z'), summary: 'Event 1' },
    { startDate: new Date('2026-01-13T10:00:00Z'), summary: 'Event 2' },
    { startDate: new Date('2026-01-20T10:00:00Z'), summary: 'Event 3' },
  ];
  const overrides = [];
  const result = applyOverrides(expanded, master, overrides);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].summary, 'Event 1');
  assert.strictEqual(result[1].summary, 'Event 3');
});

test('applyOverrides: splices in override matching RECURRENCE-ID', () => {
  const master = {
    exdates: [],
  };
  const expanded = [
    { startDate: new Date('2026-01-06T10:00:00Z'), summary: 'Original Event 1' },
    { startDate: new Date('2026-01-13T10:00:00Z'), summary: 'Original Event 2' },
  ];
  const overrides = [
    {
      startDate: new Date('2026-01-13T11:00:00Z'),
      recurrenceId: new Date('2026-01-13T10:00:00Z'),
      summary: 'Modified Event 2',
    },
  ];
  const result = applyOverrides(expanded, master, overrides);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].summary, 'Original Event 1');
  assert.strictEqual(result[1].summary, 'Modified Event 2');
  assert.strictEqual(result[1].startDate.getUTCHours(), 11); // Time was changed
});

test('applyOverrides: removes occurrence with STATUS:CANCELLED override', () => {
  const master = {
    exdates: [],
  };
  const expanded = [
    { startDate: new Date('2026-01-06T10:00:00Z'), summary: 'Event 1' },
    { startDate: new Date('2026-01-13T10:00:00Z'), summary: 'Event 2' },
    { startDate: new Date('2026-01-20T10:00:00Z'), summary: 'Event 3' },
  ];
  const overrides = [
    {
      recurrenceId: new Date('2026-01-13T10:00:00Z'),
      status: 'CANCELLED',
    },
  ];
  const result = applyOverrides(expanded, master, overrides);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].summary, 'Event 1');
  assert.strictEqual(result[1].summary, 'Event 3');
});

test('applyOverrides: includes orphaned override as standalone if no matching occurrence', () => {
  const master = {
    exdates: [],
  };
  const expanded = [
    { startDate: new Date('2026-01-06T10:00:00Z'), summary: 'Event 1' },
  ];
  const overrides = [
    {
      startDate: new Date('2026-02-01T10:00:00Z'),
      recurrenceId: new Date('2026-02-01T10:00:00Z'),
      summary: 'Orphaned Override',
    },
  ];
  const result = applyOverrides(expanded, master, overrides);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[1].summary, 'Orphaned Override');
});

test('applyOverrides: handles both EXDATE and RECURRENCE-ID together', () => {
  const master = {
    exdates: [new Date('2026-01-20T10:00:00Z')],
  };
  const expanded = [
    { startDate: new Date('2026-01-06T10:00:00Z'), summary: 'Event 1' },
    { startDate: new Date('2026-01-13T10:00:00Z'), summary: 'Event 2' },
    { startDate: new Date('2026-01-20T10:00:00Z'), summary: 'Event 3' },
  ];
  const overrides = [
    {
      startDate: new Date('2026-01-13T11:00:00Z'),
      recurrenceId: new Date('2026-01-13T10:00:00Z'),
      summary: 'Modified Event 2',
    },
  ];
  const result = applyOverrides(expanded, master, overrides);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].summary, 'Event 1');
  assert.strictEqual(result[1].summary, 'Modified Event 2');
  // Event 3 is excluded because it matches EXDATE
});

// ============================================================================
// parseICS with overrides - integration tests
// ============================================================================
test('parseICS: EXDATE-only cancellation excludes specific occurrence', () => {
  const ics = readFixture('exdate-only.ics');
  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  // Should have Jan 6 (original), but NOT Jan 13 and Jan 20 (excluded by EXDATE)
  const jan6 = events.filter((e) => e.startDate.getUTCDate() === 6);
  const jan13 = events.filter((e) => e.startDate.getUTCDate() === 13);
  const jan20 = events.filter((e) => e.startDate.getUTCDate() === 20);

  assert.strictEqual(jan6.length, 1);
  assert.strictEqual(jan13.length, 0);
  assert.strictEqual(jan20.length, 0);
});

test('parseICS: comma-separated EXDATE values all excluded', () => {
  const ics = readFixture('exdate-comma-separated.ics');
  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  // Jan 6 and Jan 27 should be included, but Jan 13 and Jan 20 excluded
  const jan6 = events.filter((e) => e.startDate.getUTCDate() === 6);
  const jan13 = events.filter((e) => e.startDate.getUTCDate() === 13);
  const jan20 = events.filter((e) => e.startDate.getUTCDate() === 20);
  const jan27 = events.filter((e) => e.startDate.getUTCDate() === 27);

  assert.strictEqual(jan6.length, 1);
  assert.strictEqual(jan13.length, 0);
  assert.strictEqual(jan20.length, 0);
  assert.strictEqual(jan27.length, 1);
});

test('parseICS: RECURRENCE-ID override with time+title change', () => {
  const ics = readFixture('recurrence-override.ics');
  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  // Find the Jan 13 event (should be overridden)
  const jan13Events = events.filter((e) => e.startDate.getUTCDate() === 13);
  assert.strictEqual(jan13Events.length, 1);
  assert.strictEqual(jan13Events[0].summary, 'Weekly Standup (moved + renamed: Retro)');
  assert.strictEqual(jan13Events[0].startDate.getUTCHours(), 20); // 8pm instead of 6pm
});

test('parseICS: EXDATE and RECURRENCE-ID together in one feed', () => {
  const ics = readFixture('recurrence-override.ics');
  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  // Jan 6 - original, unmodified
  const jan6 = events.filter((e) => e.startDate.getUTCDate() === 6);
  assert.strictEqual(jan6.length, 1);
  assert.strictEqual(jan6[0].summary, 'Weekly Standup');

  // Jan 13 - overridden
  const jan13 = events.filter((e) => e.startDate.getUTCDate() === 13);
  assert.strictEqual(jan13.length, 1);
  assert.strictEqual(jan13[0].summary, 'Weekly Standup (moved + renamed: Retro)');

  // Jan 20 - excluded by EXDATE
  const jan20 = events.filter((e) => e.startDate.getUTCDate() === 20);
  assert.strictEqual(jan20.length, 0);

  // Jan 27 - original (after the EXDATE and override)
  const jan27 = events.filter((e) => e.startDate.getUTCDate() === 27);
  assert.strictEqual(jan27.length, 1);
  assert.strictEqual(jan27[0].summary, 'Weekly Standup');
});

test('parseICS: override appearing BEFORE master in file order still works', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-series
DTSTAMP:20260101T000000Z
RECURRENCE-ID:20260113T100000Z
DTSTART:20260113T120000Z
DTEND:20260113T130000Z
SUMMARY:Override (before master)
END:VEVENT
BEGIN:VEVENT
UID:test-series
DTSTAMP:20260101T000000Z
DTSTART:20260106T100000Z
DTEND:20260106T110000Z
SUMMARY:Weekly Meeting
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  // Should find the override in the right position
  const jan13 = events.filter((e) => e.startDate.getUTCDate() === 13);
  assert.strictEqual(jan13.length, 1);
  assert.strictEqual(jan13[0].summary, 'Override (before master)');
  assert.strictEqual(jan13[0].startDate.getUTCHours(), 12); // Overridden time
});

test('parseICS: override appearing AFTER master in file order works correctly', () => {
  // This is the standard case from recurrence-override.ics
  const ics = readFixture('recurrence-override.ics');
  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  const jan13 = events.filter((e) => e.startDate.getUTCDate() === 13);
  assert.strictEqual(jan13.length, 1);
  assert.strictEqual(jan13[0].summary, 'Weekly Standup (moved + renamed: Retro)');
  assert.strictEqual(jan13[0].startDate.getUTCHours(), 20); // Overridden time
});

test('parseICS: master with no overrides or EXDATE acts as before', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:simple-series
DTSTAMP:20260101T000000Z
DTSTART:20260106T100000Z
DTEND:20260106T110000Z
SUMMARY:Simple Weekly Event
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  assert.strictEqual(events.length, 3);
  assert.strictEqual(events[0].summary, 'Simple Weekly Event');
  assert.strictEqual(events[1].summary, 'Simple Weekly Event');
  assert.strictEqual(events[2].summary, 'Simple Weekly Event');
});

test('parseICS: UID-less events still work independently', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Event without UID
DTSTART:20260115T100000Z
DTEND:20260115T110000Z
RRULE:FREQ=WEEKLY;COUNT=2
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  // Should expand the RRULE even without UID
  assert.strictEqual(events.length, 2);
});

test('parseICS: multiple different UIDs do not cross-contaminate', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:series-a
DTSTAMP:20260101T000000Z
DTSTART:20260106T100000Z
DTEND:20260106T110000Z
SUMMARY:Series A
RRULE:FREQ=WEEKLY;COUNT=2
EXDATE:20260113T100000Z
END:VEVENT
BEGIN:VEVENT
UID:series-b
DTSTAMP:20260101T000000Z
DTSTART:20260106T140000Z
DTEND:20260106T150000Z
SUMMARY:Series B
RRULE:FREQ=WEEKLY;COUNT=2
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  // Series A: 1 event (Jan 6, Jan 13 excluded by EXDATE)
  // Series B: 2 events (Jan 6 and Jan 13, no EXDATE)
  assert.strictEqual(events.length, 3);

  const seriesA = events.filter((e) => e.summary === 'Series A');
  const seriesB = events.filter((e) => e.summary === 'Series B');

  assert.strictEqual(seriesA.length, 1);
  assert.strictEqual(seriesB.length, 2);
});

test('parseICS: override with STATUS:CANCELLED is treated as deletion', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:status-test
DTSTAMP:20260101T000000Z
DTSTART:20260106T100000Z
DTEND:20260106T110000Z
SUMMARY:Weekly Meeting
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
BEGIN:VEVENT
UID:status-test
DTSTAMP:20260101T000000Z
RECURRENCE-ID:20260113T100000Z
STATUS:CANCELLED
SUMMARY:Cancelled Occurrence
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 30);

  // Should have Jan 6 and Jan 20, but NOT Jan 13
  const jan13 = events.filter((e) => e.startDate.getUTCDate() === 13);
  assert.strictEqual(jan13.length, 0);
  assert.strictEqual(events.length, 2);
});

test('parseICS: orphaned override (no matching occurrence) is included standalone', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:orphan-test
DTSTAMP:20260101T000000Z
DTSTART:20260106T100000Z
DTEND:20260106T110000Z
SUMMARY:Weekly Meeting
RRULE:FREQ=WEEKLY;COUNT=2
END:VEVENT
BEGIN:VEVENT
UID:orphan-test
DTSTAMP:20260101T000000Z
RECURRENCE-ID:20260227T100000Z
DTSTART:20260227T100000Z
DTEND:20260227T110000Z
SUMMARY:Orphaned Override (no matching instance)
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');
  const events = parseICS(ics, now, 60);

  // Should have 2 regular occurrences + 1 orphaned override
  assert.strictEqual(events.length, 3);
  const orphaned = events.filter((e) => e.summary.includes('Orphaned'));
  assert.strictEqual(orphaned.length, 1);
});

test('parseICS: deliverable 1 regression suite still passes (no regressions from override refactor)', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Weekly Event
DTSTART:20260106T100000Z
DTEND:20260106T110000Z
RRULE:FREQ=WEEKLY
END:VEVENT
END:VCALENDAR`;

  const now = new Date('2026-01-01');

  // With 14-day lookahead, the 10-day-out occurrence should be included
  const eventsWithLarge = parseICS(ics, now, 14);
  assert(eventsWithLarge.some((e) => e.startDate.getTime() > now.getTime() + 9 * 24 * 60 * 60 * 1000));

  // With 7-day lookahead, it should not be
  const eventsWithSmall = parseICS(ics, now, 7);
  const hasOutstanding = eventsWithSmall.some(
    (e) => e.startDate.getTime() > now.getTime() + 7 * 24 * 60 * 60 * 1000
  );
  assert(!hasOutstanding);
});
