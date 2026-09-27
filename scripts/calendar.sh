#!/bin/bash
# Convenience script to run the calendar parser

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Parse arguments
FORMAT_FLAG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --text)
      FORMAT_FLAG="--text"
      shift
      ;;
    --markdown)
      FORMAT_FLAG="--markdown"
      shift
      ;;
    --json)
      FORMAT_FLAG="--json"
      shift
      ;;
    --help)
      echo "Usage: ./scripts/calendar.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --text          Output as text (human-readable)"
      echo "  --markdown      Output as markdown"
      echo "  --json          Output as JSON (default)"
      echo "  --help          Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./scripts/calendar.sh"
      echo "  ./scripts/calendar.sh --text"
      echo "  ./scripts/calendar.sh --markdown"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

# Run the calendar parser with format flag
node scripts/parse-calendar.js $FORMAT_FLAG
