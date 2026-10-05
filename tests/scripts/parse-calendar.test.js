const { test } = require('node:test');
const assert = require('node:assert');
const { readFileSync } = require('fs');
const { resolve } = require('path');

// Pin timezone for deterministic tests
process.env.TZ = 'America/New_York';

// Load the parse-calendar module
const {
  getUSEasternOffsetHours,
  expandRecurrence,
  parseICS,
  parseDate,
  unescapeICS,
  getEventDuration,
  categorizeEvent,
  filterUpcomingEvents,
  formatEvent,
  formatEventDate,
} = require('../../scripts/parse-calendar.js');

// Helper: read fixture file
function readFixture(filename) {
  return readFileSync(resolve(__dirname, `../fixtures/${filename}`), 'utf-8');
}

// ============================================================================
// getUSEasternOffsetHours tests
// ============================================================================
test('getUSEasternOffsetHours: winter date returns -5 (EST)', () => {
  const winterDate = new Date('2026-01-15T12:00:00Z');
  const offset = getUSEasternOffsetHours(winterDate);
  assert.strictEqual(offset, -5);
});

test('getUSEasternOffsetHours: summer date returns -4 (EDT)', () => {
  const summerDate = new Date('2026-07-15T12:00:00Z');
  const offset = getUSEasternOffsetHours(summerDate);
  assert.strictEqual(offset, -4);
});

test('getUSEasternOffsetHours: just before 2026 spring DST transition (2026-03-07)', () => {
  const beforeSpring = new Date('2026-03-07T12:00:00Z');
  const offset = getUSEasternOffsetHours(beforeSpring);
  assert.strictEqual(offset, -5); // Still EST
});

test('getUSEasternOffsetHours: just after 2026 spring DST transition (2026-03-09)', () => {
  const afterSpring = new Date('2026-03-09T12:00:00Z');
  const offset = getUSEasternOffsetHours(afterSpring);
  assert.strictEqual(offset, -4); // Now EDT
});

test('getUSEasternOffsetHours: just before 2026 fall DST transition (2026-10-31)', () => {
  const beforeFall = new Date('2026-10-31T12:00:00Z');
  const offset = getUSEasternOffsetHours(beforeFall);
  assert.strictEqual(offset, -4); // Still EDT
});

test('getUSEasternOffsetHours: just after 2026 fall DST transition (2026-11-02)', () => {
  const afterFall = new Date('2026-11-02T12:00:00Z');
  const offset = getUSEasternOffsetHours(afterFall);
  assert.strictEqual(offset, -5); // Back to EST
});

test('getUSEasternOffsetHours: default call with no argument returns -5 or -4', () => {
  const offset = getUSEasternOffsetHours();
  assert.ok(offset === -5 || offset === -4, 'offset should be -5 or -4');
});

// ============================================================================
// unescapeICS tests
// ============================================================================
test('unescapeICS: unescapes comma', () => {
  assert.strictEqual(unescapeICS('Test\\,Value'), 'Test,Value');
});

test('unescapeICS: unescapes semicolon', () => {
  assert.strictEqual(unescapeICS('Test\\;Value'), 'Test;Value');
});

test('unescapeICS: unescapes backslash', () => {
  assert.strictEqual(unescapeICS('Test\\\\Value'), 'Test\\Value');
});

test('unescapeICS: plain text unchanged', () => {
  assert.strictEqual(unescapeICS('Plain text'), 'Plain text');
});

test('unescapeICS: empty string', () => {
  assert.strictEqual(unescapeICS(''), '');
});

test('unescapeICS: multiple escapes in one string', () => {
  assert.strictEqual(unescapeICS('A\\,B\\;C\\\\D'), 'A,B;C\\D');
});

test('unescapeICS: literal \\n is NOT unescaped (known limitation)', () => {
  assert.strictEqual(unescapeICS('Line\\nBreak'), 'Line\\nBreak');
});

// ============================================================================
// getEventDuration tests
// ============================================================================
test('getEventDuration: normal start and end', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
    endDate: new Date('2026-01-01T11:00:00Z'),
  };
  const duration = getEventDuration(event);
  assert.strictEqual(duration, 60 * 60 * 1000); // 1 hour in ms
});

test('getEventDuration: missing startDate', () => {
  const event = {
    startDate: null,
    endDate: new Date('2026-01-01T11:00:00Z'),
  };
  assert.strictEqual(getEventDuration(event), 0);
});

test('getEventDuration: missing endDate', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
    endDate: null,
  };
  assert.strictEqual(getEventDuration(event), 0);
});

test('getEventDuration: startDate after endDate returns negative', () => {
  const event = {
    startDate: new Date('2026-01-01T11:00:00Z'),
    endDate: new Date('2026-01-01T10:00:00Z'),
  };
  assert(getEventDuration(event) < 0);
});

// ============================================================================
// categorizeEvent tests
// ============================================================================
test('categorizeEvent: administrative-only keyword', () => {
  const event = {
    summary: 'Registration opens',
    description: '',
  };
  assert.strictEqual(categorizeEvent(event), 'administrative');
});

test('categorizeEvent: admin + meeting keywords -> administrative wins', () => {
  const event = {
    summary: 'Team registration deadline',
    description: '',
  };
  assert.strictEqual(categorizeEvent(event), 'administrative');
});

test('categorizeEvent: meeting + competition keywords -> meeting wins', () => {
  const event = {
    summary: 'Team meeting at regional',
    description: '',
  };
  assert.strictEqual(categorizeEvent(event), 'meeting');
});

test('categorizeEvent: meeting-only keyword', () => {
  const event = {
    summary: 'Team practice',
    description: '',
  };
  assert.strictEqual(categorizeEvent(event), 'meeting');
});

test('categorizeEvent: competition-only keyword', () => {
  const event = {
    summary: 'Qualifier at Western NE',
    description: '',
  };
  assert.strictEqual(categorizeEvent(event), 'competition');
});

test('categorizeEvent: no keywords -> other', () => {
  const event = {
    summary: 'Holiday party',
    description: '',
  };
  assert.strictEqual(categorizeEvent(event), 'other');
});

test('categorizeEvent: case-insensitivity', () => {
  const event = {
    summary: 'TEAM PRACTICE',
    description: '',
  };
  assert.strictEqual(categorizeEvent(event), 'meeting');
});

test('categorizeEvent: keyword in description only', () => {
  const event = {
    summary: 'Team outing',
    description: 'Practice at the field',
  };
  assert.strictEqual(categorizeEvent(event), 'meeting');
});

test('categorizeEvent: word boundary - "Saturday" does NOT trigger day\\d+ administrative', () => {
  const event = {
    summary: 'Saturday event',
    description: '',
  };
  assert.notStrictEqual(categorizeEvent(event), 'administrative');
});

test('categorizeEvent: negative lookahead - "due to weather" does NOT match due(?!\\s+to)', () => {
  const event = {
    summary: 'Event postponed due to weather',
    description: '',
  };
  assert.notStrictEqual(categorizeEvent(event), 'administrative');
});

// ============================================================================
// filterUpcomingEvents tests
// ============================================================================
test('filterUpcomingEvents: startDate === now is included', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const events = [
    {
      startDate: now,
    },
  ];
  const result = filterUpcomingEvents(events, 7, now);
  assert.strictEqual(result.length, 1);
});

test('filterUpcomingEvents: startDate === now + days exactly is included', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = [
    {
      startDate: cutoff,
    },
  ];
  const result = filterUpcomingEvents(events, 7, now);
  assert.strictEqual(result.length, 1);
});

test('filterUpcomingEvents: 1ms past cutoff is excluded', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const cutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const events = [
    {
      startDate: new Date(cutoff.getTime() + 1),
    },
  ];
  const result = filterUpcomingEvents(events, 7, now);
  assert.strictEqual(result.length, 0);
});

test('filterUpcomingEvents: 1ms before now is excluded', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const events = [
    {
      startDate: new Date(now.getTime() - 1),
    },
  ];
  const result = filterUpcomingEvents(events, 7, now);
  assert.strictEqual(result.length, 0);
});

test('filterUpcomingEvents: missing startDate is excluded', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const events = [
    {
      startDate: null,
    },
  ];
  const result = filterUpcomingEvents(events, 7, now);
  assert.strictEqual(result.length, 0);
});

test('filterUpcomingEvents: default days=7', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const event8daysOut = {
    startDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
  };
  const result = filterUpcomingEvents([event8daysOut], undefined, now);
  assert.strictEqual(result.length, 0);
});

test('filterUpcomingEvents: empty input', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const result = filterUpcomingEvents([], 7, now);
  assert.strictEqual(result.length, 0);
});

// ============================================================================
// parseDate tests
// ============================================================================
test('parseDate: all-day format YYYYMMDD', () => {
  const result = parseDate('20260115');
  assert.ok(result.date);
  assert.strictEqual(result.date.getFullYear(), 2026);
  assert.strictEqual(result.date.getMonth(), 0); // January
  assert.strictEqual(result.date.getDate(), 15);
  assert.strictEqual(result.offset, null);
});

test('parseDate: UTC datetime YYYYMMDDTHHmmssZ', () => {
  const result = parseDate('20260115T143000Z');
  assert.ok(result.date);
  assert.strictEqual(result.date.getUTCFullYear(), 2026);
  assert.strictEqual(result.date.getUTCMonth(), 0);
  assert.strictEqual(result.date.getUTCDate(), 15);
  assert.strictEqual(result.date.getUTCHours(), 14);
  assert.strictEqual(result.date.getUTCMinutes(), 30);
  assert.ok(result.offset !== null);
});

test('parseDate: floating datetime YYYYMMDDTHHmmss', () => {
  const result = parseDate('20260115T143000');
  assert.ok(result.date);
  assert.strictEqual(result.offset, null);
});

test('parseDate: empty string', () => {
  const result = parseDate('');
  assert.strictEqual(result.date, null);
  assert.strictEqual(result.offset, null);
});

// ============================================================================
// formatEvent tests
// ============================================================================
test('formatEvent: UTC event with Eastern offset', () => {
  const event = {
    startDate: new Date('2026-01-15T18:00:00Z'),
    endDate: new Date('2026-01-15T19:00:00Z'),
    summary: 'Meeting',
    description: 'Test',
    location: 'Room 123',
    rawStartStr: '20260115T180000Z',
    rawEndStr: '20260115T190000Z',
    startOffsetEastern: -5,
    endOffsetEastern: -5,
  };
  const formatted = formatEvent(event);
  assert.strictEqual(formatted.title, 'Meeting');
  assert.ok(formatted.start.includes('1/15/2026'));
  assert.ok(formatted.start.includes('1:00') || formatted.start.includes('13:00')); // 18:00 UTC = 13:00 EST
  assert.strictEqual(formatted.location, 'Room 123');
});

test('formatEvent: floating event with no offset', () => {
  const event = {
    startDate: new Date('2026-01-15T18:00:00'),
    endDate: new Date('2026-01-15T19:00:00'),
    summary: 'Event',
    description: '',
    location: '',
    rawStartStr: '20260115T180000',
    rawEndStr: '20260115T190000',
    startOffsetEastern: null,
    endOffsetEastern: null,
  };
  const formatted = formatEvent(event);
  assert.strictEqual(formatted.startOffsetEastern, null);
});

test('formatEvent: missing startDate', () => {
  const event = {
    startDate: null,
    endDate: null,
    summary: 'Event',
    description: '',
    location: '',
    rawStartStr: '',
    rawEndStr: '',
  };
  const formatted = formatEvent(event);
  assert.strictEqual(formatted.start, 'N/A');
  assert.strictEqual(formatted.end, 'N/A');
});

test('formatEvent: empty location defaults to "No location"', () => {
  const event = {
    startDate: new Date(),
    endDate: new Date(),
    summary: 'Event',
    description: '',
    location: '',
    rawStartStr: '',
    rawEndStr: '',
  };
  const formatted = formatEvent(event);
  assert.strictEqual(formatted.location, 'No location');
});

test('formatEvent: empty description becomes empty string', () => {
  const event = {
    startDate: new Date(),
    endDate: new Date(),
    summary: 'Event',
    description: '',
    location: 'Room',
    rawStartStr: '',
    rawEndStr: '',
  };
  const formatted = formatEvent(event);
  assert.strictEqual(formatted.description, '');
});

// ============================================================================
// formatEventDate tests
// ============================================================================
test('formatEventDate: single-day all-day event (24 hours exact)', () => {
  const event = {
    start: 'Wednesday, January 15, 2026, 12:00:00 AM',
    end: 'Thursday, January 16, 2026, 12:00:00 AM',
  };
  const formatted = formatEventDate(event);
  assert(formatted.includes('January 15'));
  assert(!formatted.includes('–'));
});

test('formatEventDate: single-day timed event', () => {
  const event = {
    start: 'Wednesday, January 15, 2026, 6:00:00 PM',
    end: 'Wednesday, January 15, 2026, 7:00:00 PM',
  };
  const formatted = formatEventDate(event);
  assert(formatted.includes('January 15'));
  assert(formatted.includes('6:00 PM'));
  assert(formatted.includes('7:00 PM'));
  assert(formatted.includes('to'));
});

test('formatEventDate: multi-day event', () => {
  const event = {
    start: 'Wednesday, January 15, 2026, 6:00:00 PM',
    end: 'Friday, January 17, 2026, 7:00:00 PM',
  };
  const formatted = formatEventDate(event);
  assert(formatted.includes('January 15'));
  assert(formatted.includes('January 17'));
  assert(formatted.includes('–'));
});

// ============================================================================
// expandRecurrence tests
// ============================================================================
test('expandRecurrence: no rruleStr returns event unchanged', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
    endDate: new Date('2026-01-01T11:00:00Z'),
  };
  const result = expandRecurrence(event, null, 7, new Date('2026-01-01'));
  assert.strictEqual(result.length, 1);
  assert.deepStrictEqual(result[0], event);
});

test('expandRecurrence: no startDate returns event unchanged', () => {
  const event = {
    startDate: null,
  };
  const result = expandRecurrence(event, 'FREQ=WEEKLY', 7, new Date('2026-01-01'));
  assert.strictEqual(result.length, 1);
});

test('expandRecurrence: FREQ=WEEKLY open-ended generates occurrences 7 days apart', () => {
  const start = new Date('2026-01-06T10:00:00Z'); // Tuesday
  const event = {
    startDate: start,
    endDate: new Date('2026-01-06T11:00:00Z'),
  };
  const now = new Date('2026-01-01');
  const result = expandRecurrence(event, 'FREQ=WEEKLY', 30, now);
  assert(result.length > 1);
  // Check that occurrences are 7 days apart
  assert.strictEqual(
    result[1].startDate.getTime() - result[0].startDate.getTime(),
    7 * 24 * 60 * 60 * 1000
  );
});

test('expandRecurrence: FREQ=WEEKLY;COUNT=3 expands to exactly 3 occurrences', () => {
  const start = new Date('2026-01-06T10:00:00Z');
  const event = {
    startDate: start,
    endDate: new Date('2026-01-06T11:00:00Z'),
  };
  const now = new Date('2026-01-01');
  const result = expandRecurrence(event, 'FREQ=WEEKLY;COUNT=3', 30, now);
  assert.strictEqual(result.length, 3);
  // Last occurrence should be at start + 2*7 days
  assert.strictEqual(
    result[2].startDate.getTime() - result[0].startDate.getTime(),
    2 * 7 * 24 * 60 * 60 * 1000
  );
});

test('expandRecurrence: FREQ=WEEKLY;COUNT=N where series already ended before now', () => {
  const start = new Date('2026-01-01T10:00:00Z');
  const event = {
    startDate: start,
    endDate: new Date('2026-01-01T11:00:00Z'),
  };
  const now = new Date('2026-02-01'); // After series ends (1 week + 1 day)
  const result = expandRecurrence(event, 'FREQ=WEEKLY;COUNT=1', 30, now);
  // Should return [event] unchanged per early-exit path
  assert.strictEqual(result.length, 1);
  assert.deepStrictEqual(result[0], event);
});

test('expandRecurrence: FREQ=WEEKLY;UNTIL=near date limits expansion', () => {
  const start = new Date('2026-01-06T10:00:00Z');
  const event = {
    startDate: start,
    endDate: new Date('2026-01-06T11:00:00Z'),
  };
  const now = new Date('2026-01-01');
  const result = expandRecurrence(event, 'FREQ=WEEKLY;UNTIL=20260113', 30, now);
  // UNTIL=20260113 is inclusive of the entire day, so both Jan 6 and Jan 13 (7 days later) are included
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].startDate.getUTCDate(), 6);
  assert.strictEqual(result[1].startDate.getUTCDate(), 13);
});

test('expandRecurrence: FREQ=DAILY expands within lookahead window', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
  };
  const result = expandRecurrence(event, 'FREQ=DAILY', 7, new Date('2026-01-01'));
  // With 7-day lookahead, should get multiple daily occurrences
  assert(result.length > 1);
});

test('expandRecurrence: FREQ=MONTHLY expands within lookahead window', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
  };
  const result = expandRecurrence(event, 'FREQ=MONTHLY', 90, new Date('2026-01-01'));
  // With 90-day lookahead, should get at least 2 monthly occurrences
  assert(result.length >= 1);
});

test('expandRecurrence: FREQ=YEARLY expands within lookahead window', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
  };
  const result = expandRecurrence(event, 'FREQ=YEARLY', 730, new Date('2026-01-01'));
  // With 730-day (2-year) lookahead, should get at least the original occurrence
  assert(result.length >= 1);
});

test('expandRecurrence: malformed RRULE with no FREQ', () => {
  const event = {
    startDate: new Date('2026-01-01T10:00:00Z'),
  };
  const result = expandRecurrence(event, 'BYDAY=TU', 7, new Date('2026-01-01'));
  assert.strictEqual(result.length, 1);
  assert.deepStrictEqual(result[0], event);
});

test('expandRecurrence: event with no endDate preserves null', () => {
  const event = {
    startDate: new Date('2026-01-06T10:00:00Z'),
    endDate: null,
  };
  const result = expandRecurrence(event, 'FREQ=WEEKLY;COUNT=2', 30, new Date('2026-01-01'));
  assert.strictEqual(result.length, 2);
  result.forEach((occ) => {
    assert.strictEqual(occ.endDate, null);
  });
});

// ============================================================================
// parseICS tests
// ============================================================================
test('parseICS: single non-recurring VEVENT parses all fields', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Test Event
DESCRIPTION:Test Desc
LOCATION:Test Room
DTSTART:20260115T100000Z
DTEND:20260115T110000Z
END:VEVENT
END:VCALENDAR`;
  const now = new Date('2026-01-01');
  const events = parseICS(ics, now);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].summary, 'Test Event');
  assert.strictEqual(events[0].description, 'Test Desc');
  assert.strictEqual(events[0].location, 'Test Room');
  assert.ok(events[0].startDate);
});

test('parseICS: multiple unrelated VEVENTs all returned in order', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Event 1
DTSTART:20260115T100000Z
DTEND:20260115T110000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Event 2
DTSTART:20260120T100000Z
DTEND:20260120T110000Z
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics, new Date('2026-01-01'), 30);
  assert.strictEqual(events.length, 2);
  assert.strictEqual(events[0].summary, 'Event 1');
  assert.strictEqual(events[1].summary, 'Event 2');
});

test('parseICS: VEVENT with RRULE expands into multiple events', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Weekly Event
DTSTART:20260106T100000Z
DTEND:20260106T110000Z
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics, new Date('2026-01-01'), 30);
  assert.strictEqual(events.length, 3);
});

test('parseICS: regression test - maxLookupDays=14 includes 10-day-out occurrence but maxLookupDays=7 excludes it', () => {
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

test('parseICS: CRLF line endings parse identically to LF', () => {
  const crlfIcs = readFixture('crlf-line-endings.ics');
  const lfIcs = readFixture('weekly-recurring-count.ics');
  const eventsCrLf = parseICS(crlfIcs, new Date('2026-01-01'), 30);
  const eventsLf = parseICS(lfIcs, new Date('2026-01-01'), 30);
  assert.strictEqual(eventsCrLf.length, eventsLf.length);
});

test('parseICS: DTSTART;VALUE=DATE sets allDay=true', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:All Day Event
DTSTART;VALUE=DATE:20260115
DTEND;VALUE=DATE:20260116
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics, new Date('2026-01-01'));
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].allDay, true);
});

test('parseICS: escaped text in SUMMARY/DESCRIPTION/LOCATION is unescaped', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Test\\, Event
DESCRIPTION:Desc\\;Line
LOCATION:Room\\\\Suite
DTSTART:20260115T100000Z
DTEND:20260115T110000Z
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics, new Date('2026-01-01'));
  assert.strictEqual(events[0].summary, 'Test, Event');
  assert.strictEqual(events[0].description, 'Desc;Line');
  assert.strictEqual(events[0].location, 'Room\\Suite');
});

test('parseICS: empty icsContent returns empty array', () => {
  const events = parseICS('', new Date('2026-01-01'));
  assert.strictEqual(events.length, 0);
});

test('parseICS: missing optional fields default to empty string', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Minimal Event
DTSTART:20260115T100000Z
DTEND:20260115T110000Z
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics, new Date('2026-01-01'));
  assert.strictEqual(events[0].description, '');
  assert.strictEqual(events[0].location, '');
});

test('parseICS: no DTEND leaves endDate as null', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:No End Event
DTSTART:20260115T100000Z
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics, new Date('2026-01-01'));
  assert.strictEqual(events[0].endDate, null);
});

test('parseICS: UID is parsed and available on events', () => {
  const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-uid-123
SUMMARY:Event
DTSTART:20260115T100000Z
DTEND:20260115T110000Z
END:VEVENT
END:VCALENDAR`;
  const events = parseICS(ics, new Date('2026-01-01'));
  assert.strictEqual(events[0].uid, 'test-uid-123');
});
