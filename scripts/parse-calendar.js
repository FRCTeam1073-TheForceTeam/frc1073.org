#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Configuration
const CALENDAR_URL = process.env.CALENDAR_URL || 'https://calendar.google.com/calendar/ical/7v5hqq6ro7gdt7b8rrkibrfvks%40group.calendar.google.com/public/basic.ics';

// Parse RRULE to expand recurring events
function expandRecurrence(event, rruleStr, lookupDays = 7) {
  if (!rruleStr || !event.startDate) return [event];

  const now = new Date();
  const cutoff = new Date(now.getTime() + lookupDays * 24 * 60 * 60 * 1000);

  // Parse RRULE parameters
  const freqMatch = rruleStr.match(/FREQ=(\w+)/);
  const untilMatch = rruleStr.match(/UNTIL=(\d{8})/);
  const countMatch = rruleStr.match(/COUNT=(\d+)/);

  if (!freqMatch) return [event];

  const freq = freqMatch[1];
  let untilDate = cutoff;
  let maxCount = Infinity;

  if (untilMatch) {
    const untilStr = untilMatch[1];
    untilDate = new Date(
      parseInt(untilStr.substring(0, 4)),
      parseInt(untilStr.substring(4, 6)) - 1,
      parseInt(untilStr.substring(6, 8))
    );
  }

  if (countMatch) {
    maxCount = parseInt(countMatch[1]);
    // If COUNT is set, calculate when the last occurrence should be
    // For WEEKLY: last = start + (count-1)*7 days
    if (freq === 'WEEKLY') {
      const recurrenceEndDate = new Date(event.startDate);
      recurrenceEndDate.setDate(recurrenceEndDate.getDate() + (maxCount - 1) * 7);
      // If the entire recurrence series ended before now, don't expand
      if (recurrenceEndDate < now) {
        return [event]; // Will be filtered out by filterUpcomingEvents
      }
    }
  }

  const expanded = [];
  let occurrenceCount = 0;

  if (freq === 'WEEKLY') {
    let currentDate = new Date(event.startDate);

    // Add the first occurrence if it's in range
    if (event.startDate >= now && event.startDate <= cutoff && event.startDate <= untilDate) {
      expanded.push(event);
      occurrenceCount = 1;
    } else if (event.startDate < now) {
      occurrenceCount = 1; // Count the original even if it's in the past
    }

    // Generate future occurrences
    while (occurrenceCount < maxCount && currentDate <= untilDate) {
      currentDate.setDate(currentDate.getDate() + 7);
      occurrenceCount++;

      if (occurrenceCount <= maxCount && currentDate >= now && currentDate <= cutoff && currentDate <= untilDate) {
        const newEvent = { ...event };
        const duration = event.endDate ? event.endDate.getTime() - event.startDate.getTime() : 0;

        newEvent.startDate = new Date(currentDate);
        if (duration) {
          newEvent.endDate = new Date(currentDate.getTime() + duration);
        }

        expanded.push(newEvent);
      }
    }
  }

  return expanded.length > 0 ? expanded : [event];
}

// Parse ICS format
function parseICS(icsContent) {
  const events = [];
  const lines = icsContent.split('\n');
  let currentEvent = null;
  let currentRRule = null;

  for (let line of lines) {
    line = line.trim();

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {
        summary: '',
        description: '',
        startDate: null,
        endDate: null,
        allDay: false,
        location: '',
      };
      currentRRule = null;
    } else if (line === 'END:VEVENT' && currentEvent) {
      // Expand recurring events
      const expandedEvents = expandRecurrence(currentEvent, currentRRule);
      events.push(...expandedEvents);
      currentEvent = null;
      currentRRule = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = unescapeICS(line.substring(8));
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = unescapeICS(line.substring(12));
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = unescapeICS(line.substring(9));
      } else if (line.startsWith('DTSTART')) {
        const dateStr = line.substring(line.lastIndexOf(':') + 1);
        currentEvent.startDate = parseDate(dateStr);
        // All-day events don't have a time component (T separator)
        currentEvent.allDay = line.includes('VALUE=DATE') || dateStr.length === 8;
      } else if (line.startsWith('DTEND')) {
        const dateStr = line.substring(line.lastIndexOf(':') + 1);
        currentEvent.endDate = parseDate(dateStr);
      } else if (line.startsWith('RRULE:')) {
        currentRRule = line.substring(6);
      }
    }
  }

  return events;
}

function parseDate(dateStr) {
  if (!dateStr || dateStr.length === 0) return null;

  if (dateStr.length === 8) {
    // Format: YYYYMMDD
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
  } else {
    // Format: YYYYMMDDTHHmmssZ
    const dateOnly = dateStr.substring(0, 8);
    const year = parseInt(dateOnly.substring(0, 4));
    const month = parseInt(dateOnly.substring(4, 6)) - 1;
    const day = parseInt(dateOnly.substring(6, 8));

    if (dateStr.includes('T')) {
      const timeOnly = dateStr.substring(9, 15);
      const hours = parseInt(timeOnly.substring(0, 2));
      const minutes = parseInt(timeOnly.substring(2, 4));
      const seconds = parseInt(timeOnly.substring(4, 6));
      return new Date(year, month, day, hours, minutes, seconds);
    }

    return new Date(year, month, day);
  }
}

function unescapeICS(text) {
  return text.replace(/\\([,;\\])/g, '$1');
}

function fetchCalendar(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    }).on('error', reject);
  });
}

function getEventDuration(event) {
  if (!event.startDate || !event.endDate) return 0;
  return event.endDate - event.startDate;
}

function categorizeEvent(event) {
  const eventText = `${event.summary} ${event.description}`.toLowerCase();

  // Administrative events - never show these
  if (/\b(selection|deadline|due|opens|closes|registration|purchase)\b/i.test(eventText)) {
    return 'administrative';
  }

  if (/\b(mpr|all[-\s]*hands|pre[-\s]*leads|leads|meeting|drive[-\s]*team|prep|preparation|practice|trailer|travel|software|em|electro|electrical|mechanical|scout|scouting|bacs|strategy|safety|business|load|un[-\s]*load|unloading|hbrb|pack)\b/i.test(eventText)) {
    return 'meeting';
  }

  if (/\b(competition|regional|district|qualifier|tournament|championship|governor's cup|gov cup|mayhem in merrimack|battle of the bay|cyberknight|river rage|girls behind the glass|dcmp|worlds|battle\s*cry|championship|district\s+event|\bweek\s+\d|minuteman|pine\s+tree|granite\s+state|western\s+ne|north\s+shore|waterbury|greater\s+boston|hartford|unh|uvm|wpi|uri)\b/i.test(eventText)){
    return 'competition';
  }

  return 'other';
}

function filterUpcomingEvents(events, days = 7) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return events.filter((event) => {
    if (!event.startDate) return false;
    return event.startDate >= now && event.startDate <= cutoff;
  });
}

function formatEvent(event) {
  const start = event.startDate ? event.startDate.toLocaleString() : 'N/A';
  const end = event.endDate ? event.endDate.toLocaleString() : 'N/A';

  return {
    title: event.summary,
    start,
    end,
    location: event.location || 'No location',
    description: event.description || '',
  };
}

function outputText(meetings, competitions, otherEvents) {
  console.log('\n=== NEXT COMPETITIONS (Next 3) ===');
  if (competitions.length === 0) {
    console.log('No competitions scheduled');
  } else {
    competitions.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   Start: ${event.start}`);
      console.log(`   End: ${event.end}`);
      if (event.location) console.log(`   Location: ${event.location}`);
    });
  }

  console.log('\n=== OTHER EVENTS (Next 3) ===');
  if (otherEvents.length === 0) {
    console.log('No other events scheduled');
  } else {
    otherEvents.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   Start: ${event.start}`);
      console.log(`   End: ${event.end}`);
      if (event.location) console.log(`   Location: ${event.location}`);
    });
  }
  console.log('\n=== UPCOMING MEETINGS (Next 7 Days) ===');
  if (meetings.length === 0) {
    console.log('No meetings scheduled');
  } else {
    meetings.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   Start: ${event.start}`);
      console.log(`   End: ${event.end}`);
      if (event.location) console.log(`   Location: ${event.location}`);
    });
  }
}

function formatEventDate(event) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const startDateStr = startDate.toLocaleDateString('en-US', dateOptions);
  const endDateStr = endDate.toLocaleDateString('en-US', dateOptions);

  // Check if exactly 24 hours (one-day event spanning midnight)
  const durationMs = endDate.getTime() - startDate.getTime();
  const is24Hours = durationMs === 24 * 60 * 60 * 1000;

  if (is24Hours) {
    return startDateStr;
  }

  // Check if it's a one-day or all-day event (same day or midnight times)
  if (startDateStr === endDateStr) {
    // Same day - check if it's all-day (midnight times)
    if (startDate.getHours() === 0 && startDate.getMinutes() === 0 &&
        endDate.getHours() === 0 && endDate.getMinutes() === 0) {
      // All-day event, just show date
      return startDateStr;
    }
    // Timed event on one day
    const timeOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return startDate.toLocaleString('en-US', timeOptions);
  }

  // Multi-day event
  return `${startDateStr} – ${endDateStr}`;
}

function renderMarkdownEvents(events) {
  if (events.length === 0) {
    console.log('No events scheduled');
    return;
  }

  events.forEach((event) => {
    const location = event.location && event.location !== 'No location' ? `— *${event.location}*` : '';
    console.log(`- **${event.title}** — ${formatEventDate(event)} ${location}`);
  });
}

function outputMarkdown(meetings, competitions, otherEvents) {
  if (competitions.length > 0) {
    console.log('\n### Next 3 Competitions\n');
    renderMarkdownEvents(competitions);
  }

  if (otherEvents.length > 0) {
    console.log('\n### Next 3 Events\n');
    renderMarkdownEvents(otherEvents);
  }

  if (meetings.length > 0) {
    console.log('\n### This Week\'s Meetings\n');
    renderMarkdownEvents(meetings);
  }
}

function outputJSON(meetings, competitions, otherEvents) {
  console.log(
    JSON.stringify(
      {
        competitions,
        otherEvents,
        meetings,
      },
      null,
      2
    )
  );
}

function parseArgs() {
  const args = process.argv.slice(2);
  let format = 'json'; // default

  if (args.includes('--text')) {
    format = 'text';
  } else if (args.includes('--markdown')) {
    format = 'markdown';
  } else if (args.includes('--json')) {
    format = 'json';
  } else if (args.includes('--help')) {
    console.log('Usage: parse-calendar.js [OPTIONS]');
    console.log('\nOptions:');
    console.log('  --text       Output as text (human-readable)');
    console.log('  --markdown   Output as markdown');
    console.log('  --json       Output as JSON (default)');
    console.log('  --help       Show this help message');
    console.log('\nExamples:');
    console.log('  node parse-calendar.js');
    console.log('  node parse-calendar.js --text');
    console.log('  node parse-calendar.js --markdown');
    process.exit(0);
  }

  return format;
}

async function main() {
  try {
    const format = parseArgs();

    const icsContent = await fetchCalendar(CALENDAR_URL);
    const allEvents = parseICS(icsContent);

    // Get events for different periods: 1 week for meetings, 12 months for competitions/other
    const meetingEvents = filterUpcomingEvents(allEvents, 7);
    const allComingEvents = filterUpcomingEvents(allEvents, 365);

    let meetings = [];
    let competitions = [];
    let otherEvents = [];

    // Process events with appropriate lookahead periods
    for (const event of allComingEvents) {
      const category = categorizeEvent(event);

      if (category === null || category === 'administrative') {
        continue;
      }

      const formattedEvent = formatEvent(event);

      if (category === 'meeting') {
        if (meetingEvents.includes(event)) {
          meetings.push(formattedEvent);
        }
      } else if (category === 'competition') {
        competitions.push(formattedEvent);
      } else {
        otherEvents.push(formattedEvent);
      }
    }

    meetings.sort((a, b) => new Date(a.start) - new Date(b.start));
    competitions.sort((a, b) => new Date(a.start) - new Date(b.start));
    otherEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    // Apply limits
    competitions = competitions.slice(0, 3);
    otherEvents = otherEvents.slice(0, 3);

    // Output in requested format
    if (format === 'text') {
      outputText(meetings, competitions, otherEvents);
    } else if (format === 'markdown') {
      outputMarkdown(meetings, competitions, otherEvents);
    } else {
      outputJSON(meetings, competitions, otherEvents);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
