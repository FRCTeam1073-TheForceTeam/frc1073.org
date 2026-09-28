#!/bin/bash
# Update the calendar section in home.md with latest events

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INDEX_FILE="$PROJECT_ROOT/home.md"

# Create temporary files
TEMP_CALENDAR=$(mktemp)
TEMP_INDEX=$(mktemp)

# Get markdown output from calendar parser, passing through all arguments
node "$SCRIPT_DIR/parse-calendar.js" --markdown "$@" > "$TEMP_CALENDAR"

# Extract the section before the markers
sed -n '1,/<!-- begin auto-generated events -->/p' "$INDEX_FILE" > "$TEMP_INDEX"

# Add the calendar content
cat "$TEMP_CALENDAR" >> "$TEMP_INDEX"

# Add the section after the markers
sed -n '/<!-- end auto-generated events -->/,$p' "$INDEX_FILE" >> "$TEMP_INDEX"

# Replace original file
mv "$TEMP_INDEX" "$INDEX_FILE"

# Cleanup
rm "$TEMP_CALENDAR"
