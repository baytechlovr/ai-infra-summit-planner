# AI Infra Summit 2026 — Interactive Itinerary & Schedule Planner

A web application designed for attendees of the **AI Infra Summit 2026** (September 15–17, 2026, Santa Clara Convention Center).

## Features

- **Full Summit Agenda:** 343 sessions across all 10 stages (Main Stage, Data & Models, Compute, Data Movement, AI Data Center, Physical AI, Expo Theaters 1 & 2, Workshops, Breakfast Briefings).
- **Personal Itinerary Builder:** One-click attendance tracking saved directly to your browser (`localStorage`).
- **Real-Time Conflict Detection:** Flags overlapping sessions on the same day with visual indicators and clashing session lists.
- **Calendar Export (.ics):** One-click download of an `.ics` file compatible with Google Calendar, Apple Calendar, and Outlook (with 15-minute alarms, stage locations, and speaker details).
- **Personal Notes:** Add custom notes to any session (e.g. questions for speakers, key contacts).
- **Multi-Factor Filtering:** Search by keyword, speaker, topic, track, format (Keynotes, Panels, Fireside Chats), ticket requirement (Expo vs Full Access), and time of day.
- **Print / PDF Schedule:** Clean, printable chronological itinerary.
- **Backup & Restore:** Export or import your selections as JSON.

## How to Run

### Option 1: Double Click
Simply double-click `run.bat` or open `index.html` directly in any web browser.

### Option 2: Python HTTP Server
```bash
cd C:\Users\anura\.gemini\antigravity\scratch\ai-infra-summit-planner
python -m http.server 3000
```
Then visit `http://localhost:3000`.
