# FRC Team 1073 Scripts

## Calendar Parser

### Overview

The `calendar-parse.js` script fetches and parses your Google Calendar, categorizing events into three categories:

1. **Meetings** - Evening events (typically 5pm-9pm) lasting 2-4 hours
2. **Competitions** - All-day events containing FRC-related keywords
3. **Other Events** - Everything else

### Usage

#### Basic Usage (uses default Team 1073 calendar)
```bash
node scripts/calendar-parse.js
```

#### With Custom Calendar URL
```bash
CALENDAR_URL="https://calendar.google.com/calendar/ical/YOUR_CALENDAR_ID%40group.calendar.google.com/public/basic.ics" node scripts/calendar-parse.js
```

#### With npm script (add to package.json)
```bash
npm run calendar
```

### Output

The script outputs:
- **Human-readable format** - Listed by category with dates and locations
- **JSON format** - At the end for programmatic use

### How It Works

#### Event Categorization

**Meetings:**
- Evening time (5pm-9pm start time)
- Duration 2-4 hours
- Not matching FRC event patterns

**Competitions:**
- All-day events, OR
- Contain keywords: FRC, FIRST, competition, regional, district, championship

**Other Events:**
- Anything that doesn't fit above categories

### Customization

Edit `calendar-parse.js` to:

1. **Change meeting time window:**
   ```javascript
   // Currently: 17-21 (5pm-9pm)
   return hour >= 17 && hour <= 21;
   ```

2. **Adjust meeting duration:**
   ```javascript
   // Currently: 2-4 hours
   duration >= 2 * 60 * 60 * 1000 &&
   duration <= 4 * 60 * 60 * 1000
   ```

3. **Add/modify FRC event keywords:**
   ```javascript
   const FRC_EVENT_PATTERNS = [
     /your-pattern/i,
     // Add more patterns
   ];
   ```

4. **Change lookahead period:**
   ```javascript
   // Currently: 7 days
   filterUpcomingEvents(allEvents, 7)
   // Change 7 to desired number of days
   ```

### Getting Your Calendar's ICS Feed URL

If you need to find your calendar's ICS feed URL:

1. Go to [Google Calendar](https://calendar.google.com)
2. Right-click your calendar name → Settings
3. Scroll to "Integrate calendar"
4. Copy the "Calendar ID" (looks like: `abc123@group.calendar.google.com`)
5. Your ICS URL is: `https://calendar.google.com/calendar/ical/{CALENDAR_ID}/public/basic.ics`
   - Replace `{CALENDAR_ID}` with your actual ID
   - URL-encode the `@` as `%40`

### Team 1073 Calendar ID

The default calendar used is: `7v5hqq6ro7gdt7b8rrkibrfvks@group.calendar.google.com`
