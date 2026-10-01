#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Configuration
const CALENDAR_URL = process.env.CALENDAR_URL || 'https://calendar.google.com/calendar/ical/7v5hqq6ro7gdt7b8rrkibrfvks%40group.calendar.google.com/public/basic.ics';

// Get the current US Eastern timezone offset in hours
function getUSEasternOffsetHours(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const easternHours = parseInt(parts.find(p => p.type === 'hour').value);
  const easternMinutes = parseInt(parts.find(p => p.type === 'minute').value);

  const utcHours = date.getUTCHours();
  const utcMinutes = date.getUTCMinutes();

  let offset = easternHours - utcHours;
  if (easternMinutes !== utcMinutes) {
    offset += (easternMinutes - utcMinutes) / 60;
  }

  if (offset > 12) offset -= 24;
  if (offset < -12) offset += 24;

  return offset;
}

// Parse RRULE to expand recurring events
function expandRecurrence(event, rruleStr, lookupDays = 7, now = new Date()) {
  if (!rruleStr || !event.startDate) return [event];

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
function parseICS(icsContent, now = new Date()) {
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
        rawStartStr: '',
        rawEndStr: '',
        startOffsetEastern: null,
        endOffsetEastern: null,
      };
      currentRRule = null;
    } else if (line === 'END:VEVENT' && currentEvent) {
      // Expand recurring events
      const expandedEvents = expandRecurrence(currentEvent, currentRRule, 7, now);
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
        currentEvent.rawStartStr = dateStr;
        const parsedStart = parseDate(dateStr);
        currentEvent.startDate = parsedStart.date;
        currentEvent.startOffsetEastern = parsedStart.offset;
        // All-day events don't have a time component (T separator)
        currentEvent.allDay = line.includes('VALUE=DATE') || dateStr.length === 8;
      } else if (line.startsWith('DTEND')) {
        const dateStr = line.substring(line.lastIndexOf(':') + 1);
        currentEvent.rawEndStr = dateStr;
        const parsedEnd = parseDate(dateStr);
        currentEvent.endDate = parsedEnd.date;
        currentEvent.endOffsetEastern = parsedEnd.offset;
      } else if (line.startsWith('RRULE:')) {
        currentRRule = line.substring(6);
      }
    }
  }

  return events;
}

function parseDate(dateStr) {
  if (!dateStr || dateStr.length === 0) return { date: null, offset: null };

  if (dateStr.length === 8) {
    // Format: YYYYMMDD (all-day event, no timezone)
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return { date: new Date(year, month, day), offset: null };
  } else {
    // Format: YYYYMMDDTHHmmssZ (GMT) or YYYYMMDDTHHmmss (local)
    const dateOnly = dateStr.substring(0, 8);
    const year = parseInt(dateOnly.substring(0, 4));
    const month = parseInt(dateOnly.substring(4, 6)) - 1;
    const day = parseInt(dateOnly.substring(6, 8));

    if (dateStr.includes('T')) {
      const timeOnly = dateStr.substring(9, 15);
      const hours = parseInt(timeOnly.substring(0, 2));
      const minutes = parseInt(timeOnly.substring(2, 4));
      const seconds = parseInt(timeOnly.substring(4, 6));

      // Check if this is GMT/UTC time (indicated by Z suffix)
      const isGMT = dateStr.endsWith('Z');

      if (isGMT) {
        // Parse as UTC time - keep the Date as UTC, don't adjust it
        const gmtDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
        const offset = getUSEasternOffsetHours(gmtDate);
        return { date: gmtDate, offset };
      } else {
        // No timezone info, assume local/unspecified
        return { date: new Date(year, month, day, hours, minutes, seconds), offset: null };
      }
    }

    return { date: new Date(year, month, day), offset: null };
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
  if (/\b(broadcast|lock|submit|mechanisms|built|programmed|integrated|complete|divisions|selection|deadline|due(?!\s+to)|opens|closes|registration|purchase|competitions|day \d+)\b/i.test(eventText)) {
    return 'administrative';
  }

  if (/\b(call|verifications|verification|volunteer|volunteering|interview|interviews|photo|team|drive|driving|hotel|sales|visit|fundraising|voting|fundraiser|spirit|subgroup|meetings|design|review|testing|mpr|all[-\s]*hands|pre[-\s]*leads|leads|meeting|hours|drive[-\s]*team|prep|preparation|practice|trailer|travel|software|em|electro|electrical|mechanical|scout|scouting|bacs|strategy|safety|business|load|un[-\s]*load|unloading|hbrb|pack|setup|cleanup|clean up)\b/i.test(eventText)) {
    return 'meeting';
  }

  if (/\b(competition|regional|district|qualifier|tournament|championship|governor's cup|governors cup|governor cup|gov cup|mayhem in merrimack|battle of the bay|cyberknight|river rage|girls behind the glass|dcmp|worlds|battle\s*cry|championship|district\s+event|\bweek\s+\d|minuteman|pine\s+tree|granite\s+state|western\s+ne|western\s+new\s+england|north\s+shore|waterbury|greater\s+boston|hartford|unh|uvm|wpi|uri)\b/i.test(eventText)){
    return 'competition';
  }

  return 'other';
}

function filterUpcomingEvents(events, days = 7, now = new Date()) {
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return events.filter((event) => {
    if (!event.startDate) return false;
    return event.startDate >= now && event.startDate <= cutoff;
  });
}

function formatEvent(event) {
  let start = 'N/A';
  let end = 'N/A';

  if (event.startDate) {
    // If this event had a GMT offset applied, format with America/New_York timezone
    if (event.startOffsetEastern !== null) {
      start = event.startDate.toLocaleString('en-US', { timeZone: 'America/New_York' });
    } else {
      start = event.startDate.toLocaleString();
    }
  }

  if (event.endDate) {
    // If this event had a GMT offset applied, format with America/New_York timezone
    if (event.endOffsetEastern !== null) {
      end = event.endDate.toLocaleString('en-US', { timeZone: 'America/New_York' });
    } else {
      end = event.endDate.toLocaleString();
    }
  }

  return {
    title: event.summary,
    start,
    end,
    location: event.location || 'No location',
    description: event.description || '',
    rawStart: event.rawStartStr,
    rawEnd: event.rawEndStr,
    startOffsetEastern: event.startOffsetEastern,
    endOffsetEastern: event.endOffsetEastern,
  };
}

function outputText(administrative, meetings, competitions, otherEvents) {
  if (administrative.length > 0) {
    console.log(`\n### Administrative Items (Next ${administrative.length})\n`);
    administrative.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   Start: ${event.start}`);
      console.log(`   End: ${event.end}`);
      if (event.location) console.log(`   Location: ${event.location}`);
    });
  }

  if (competitions.length > 0) {
    console.log(`\n### Next ${competitions.length} Competitions\n`);
    competitions.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   Start: ${event.start}`);
      console.log(`   End: ${event.end}`);
      if (event.location) console.log(`   Location: ${event.location}`);
    });
  }

  if (otherEvents.length > 0) {
    console.log(`\n### Next ${otherEvents.length} Events\n`);
    otherEvents.forEach((event, i) => {
      console.log(`\n${i + 1}. ${event.title}`);
      console.log(`   Start: ${event.start}`);
      console.log(`   End: ${event.end}`);
      if (event.location) console.log(`   Location: ${event.location}`);
    });
  }

  if (meetings.length > 0) {
    console.log('\n### This Week\'s Meetings\n');
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
  let endDate = new Date(event.end);

  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  let startDateStr = startDate.toLocaleDateString('en-US', dateOptions);
  let endDateStr = endDate.toLocaleDateString('en-US', dateOptions);

  // If end time is at midnight on a different day, adjust to treat as same-day event
  if (endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDateStr !== startDateStr) {
    endDate.setDate(endDate.getDate() - 1);
    endDateStr = endDate.toLocaleDateString('en-US', dateOptions);
  }

  // Check if exactly 24 hours (one-day all-day event)
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
    // Timed event on one day - show date and time range
    const dateWithTimeOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    const dateStr = startDate.toLocaleDateString('en-US', dateWithTimeOptions);
    const startTimeStr = startDate.toLocaleString('en-US', timeOptions);
    const endTimeStr = endDate.toLocaleString('en-US', timeOptions);
    return `${dateStr}; ${startTimeStr} to ${endTimeStr}`;
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
    const location = event.location && event.location !== 'No location' ? ` — *${event.location}*` : '';
    console.log(`- **${event.title}** — ${formatEventDate(event)}${location}`);
  });
}

function outputMarkdown(administrative, meetings, competitions, otherEvents) {
  let isFirst = true;

  if (administrative.length > 0) {
    console.log(`### Administrative Items (Next ${administrative.length})\n`);
    renderMarkdownEvents(administrative);
    isFirst = false;
  }

  if (competitions.length > 0) {
    if (!isFirst) console.log('');
    console.log(`### Next ${competitions.length} Competitions\n`);
    renderMarkdownEvents(competitions);
    isFirst = false;
  }

  if (otherEvents.length > 0) {
    if (!isFirst) console.log('');
    console.log(`### Next ${otherEvents.length} Events\n`);
    renderMarkdownEvents(otherEvents);
    isFirst = false;
  }

  if (meetings.length > 0) {
    if (!isFirst) console.log('');
    console.log('### This Week\'s Meetings\n');
    renderMarkdownEvents(meetings);
  }
}

function outputJSON(administrative, meetings, competitions, otherEvents) {
  console.log(
    JSON.stringify(
      {
        administrative,
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
  let format = 'json';
  // Default meeting days: a week from Sunday US Eastern time
  const offset = getUSEasternOffsetHours();
  const daysUntilSunday = (7 - new Date(new Date().getTime() + offset * 60 * 60 * 1000).getDay()) % 7;
  let meetingsDays = daysUntilSunday < 7 ? daysUntilSunday + 7 : daysUntilSunday;
  let competitionsLimit = 3;
  let eventsLimit = 3;
  let administrativeDays = 0;
  let startDate = new Date();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--text') {
      format = 'text';
    } else if (args[i] === '--markdown') {
      format = 'markdown';
    } else if (args[i] === '--json') {
      format = 'json';
    } else if (args[i] === '--meetings') {
      meetingsDays = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--competitions') {
      competitionsLimit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--events') {
      eventsLimit = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--administrative') {
      administrativeDays = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--date') {
      const dateStr = args[i + 1];
      startDate = new Date(dateStr);
      if (isNaN(startDate.getTime())) {
        console.error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--help') {
      console.log('Usage: parse-calendar.js [OPTIONS]');
      console.log('\nOptions:');
      console.log('  --text              Output as text (human-readable)');
      console.log('  --markdown          Output as markdown');
      console.log('  --json              Output as JSON (default)');
      console.log('  --meetings DAYS     Number of days to look ahead for meetings (default: 7)');
      console.log('  --competitions N    Number of competitions to show (default: 3)');
      console.log('  --events N          Number of events to show (default: 3)');
      console.log('  --administrative D  Number of days to look ahead for administrative events (default: 0)');
      console.log('  --date DATE         Start date for scanning (YYYY-MM-DD, default: today)');
      console.log('  --help              Show this help message');
      console.log('\nExamples:');
      console.log('  node parse-calendar.js');
      console.log('  node parse-calendar.js --text');
      console.log('  node parse-calendar.js --markdown --competitions 5');
      console.log('  node parse-calendar.js --meetings 365 --competitions 50 --events 50');
      console.log('  node parse-calendar.js --date 2026-01-01 --text');
      console.log('  node parse-calendar.js --administrative 30 --markdown');
      process.exit(0);
    }
  }

  return { format, meetingsDays, competitionsLimit, eventsLimit, administrativeDays, startDate };
}

async function main() {
  try {
    const { format, meetingsDays, competitionsLimit, eventsLimit, administrativeDays, startDate } = parseArgs();

    const icsContent = await fetchCalendar(CALENDAR_URL);
    const allEvents = parseICS(icsContent, startDate);

    // Get events for different periods: configurable for meetings/administrative, 12 months for competitions/other
    const meetingEvents = filterUpcomingEvents(allEvents, meetingsDays, startDate);
    const administrativeEvents = administrativeDays > 0 ? filterUpcomingEvents(allEvents, administrativeDays, startDate) : [];
    const allComingEvents = filterUpcomingEvents(allEvents, 365, startDate);

    let meetings = [];
    let competitions = [];
    let otherEvents = [];
    let administrative = [];

    // Process events with appropriate lookahead periods
    for (const event of allComingEvents) {
      const category = categorizeEvent(event);

      if (category === null) {
        continue;
      }

      const formattedEvent = formatEvent(event);

      if (category === 'administrative') {
        if (administrativeEvents.includes(event)) {
          administrative.push(formattedEvent);
        }
      } else if (category === 'meeting') {
        if (meetingEvents.includes(event)) {
          meetings.push(formattedEvent);
        }
      } else if (category === 'competition') {
        competitions.push(formattedEvent);
      } else {
        otherEvents.push(formattedEvent);
      }
    }

    const sortByDateDurationTitle = (a, b) => {
      const dateCompare = new Date(a.start) - new Date(b.start);
      if (dateCompare !== 0) return dateCompare;

      const endCompare = new Date(a.end) - new Date(b.end);
      if (endCompare !== 0) return endCompare;

      return a.title.localeCompare(b.title);
    };

    administrative.sort(sortByDateDurationTitle);
    meetings.sort(sortByDateDurationTitle);
    competitions.sort(sortByDateDurationTitle);
    otherEvents.sort(sortByDateDurationTitle);

    // Apply limits
    competitions = competitions.slice(0, competitionsLimit);
    otherEvents = otherEvents.slice(0, eventsLimit);

    // Output in requested format
    if (format === 'text') {
      outputText(administrative, meetings, competitions, otherEvents);
    } else if (format === 'markdown') {
      outputMarkdown(administrative, meetings, competitions, otherEvents);
    } else {
      outputJSON(administrative, meetings, competitions, otherEvents);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
