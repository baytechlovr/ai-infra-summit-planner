"""
AI Infra Summit 2026 - Live Agenda Sync Script
Fetches latest agenda directly from https://www.ai-infra-summit.com/2026agenda,
detects differences/updates, and updates data/sessions.js without losing user bookmarks.
"""

import os
import re
import json
import html
import urllib.request
from datetime import datetime

SUMMIT_AGENDA_URL = "https://www.ai-infra-summit.com/2026agenda"
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
SESSIONS_JS_PATH = os.path.join(DATA_DIR, "sessions.js")
SYNC_META_PATH = os.path.join(DATA_DIR, "sync_meta.json")

KNOWN_FORMATS = [
    ('keynote fireside chat', 'Keynote Fireside Chat'),
    ('keynote presentation', 'Keynote Presentation'),
    ('keynote panel', 'Keynote Panel'),
    ('keynote', 'Keynote'),
    ('fireside chat', 'Fireside Chat'),
    ('panel', 'Panel Discussion'),
    ('presentation', 'Presentation'),
    ('workshop', 'Workshop'),
    ('session', 'Session'),
    ('roundtable', 'Roundtable')
]

DAY_NAMES = {
    '15-sep-2026': {'day': 'Day 1', 'date': '2026-09-15', 'label': 'Tuesday, Sep 15, 2026'},
    '16-sep-2026': {'day': 'Day 2', 'date': '2026-09-16', 'label': 'Wednesday, Sep 16, 2026'},
    '17-sep-2026': {'day': 'Day 3', 'date': '2026-09-17', 'label': 'Thursday, Sep 17, 2026'},
}

def fetch_live_agenda_html():
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    req = urllib.request.Request(SUMMIT_AGENDA_URL, headers=headers)
    with urllib.request.urlopen(req, timeout=25) as resp:
        return resp.read().decode('utf-8', errors='ignore')

def parse_agenda_html(raw_content):
    desktop_idx = raw_content.find('m-seminar-list__list__desktop')
    mobile_idx = raw_content.find('m-seminar-list__list__mobile')
    desktop = raw_content[desktop_idx:mobile_idx] if desktop_idx != -1 else raw_content

    day_ids = ['15-sep-2026', '16-sep-2026', '17-sep-2026']
    day_slices = []
    for i, d in enumerate(day_ids):
        pos = desktop.find(f'id="{d}"')
        next_pos = desktop.find(f'id="{day_ids[i+1]}"') if i + 1 < len(day_ids) else len(desktop)
        if pos != -1:
            day_slices.append((d, desktop[pos:next_pos]))

    all_sessions = []
    session_id_counter = 1

    for day_id, slice_content in day_slices:
        day_info = DAY_NAMES.get(day_id, {'day': 'Day 1', 'date': '2026-09-15', 'label': 'Tuesday, Sep 15, 2026'})
        column_splits = re.split(r'<div class="m-seminar-list__list__content__column u-width-100">', slice_content)

        for col in column_splits[1:]:
            header_match = re.search(r'<div class="m-seminar-list__list__content__column__header\b[^"]*"[^>]*>(.*?)</div>', col, re.DOTALL)
            track_name = "General"
            if header_match:
                t = re.sub(r'<div class="m-seminar-list__list__content__column__header__description">.*?</div>', '', header_match.group(1), flags=re.DOTALL)
                track_name = re.sub(r'<[^>]+>', ' ', t).strip()
                track_name = html.unescape(track_name)

            pass_match = re.search(r'<div class="m-seminar-list__list__content__column__header__standard-pass\b[^"]*"[^>]*>(.*?)</div>', col, re.DOTALL)
            ticket_type = "Full-Access & VIP"
            if pass_match and "EXPO TICKET" in pass_match.group(1).upper():
                if 'visibility: hidden' not in pass_match.group(0):
                    ticket_type = "Expo Pass Eligible"

            li_items = re.findall(r'<li class="m-seminar-list__list__content__column__items__item\b([^"]*)"(.*?)</li>', col, re.DOTALL)

            for class_extra, body in li_items:
                class_lower = class_extra.lower()
                format_type = "Session"
                for pattern, label in KNOWN_FORMATS:
                    if pattern in class_lower:
                        format_type = label
                        break

                start_time_match = re.search(r'<span class="m-seminar-list__list__content__column__items__item__time__start">\s*<time datetime="([^"]*)">([^<]*)</time>', body, re.DOTALL)
                end_time_match = re.search(r'<span class="m-seminar-list__list__content__column__items__item__time__end">\s*<time datetime="([^"]*)">([^<]*)</time>', body, re.DOTALL)

                start_24 = start_time_match.group(1).strip() if start_time_match else ""
                start_time = start_time_match.group(2).strip() if start_time_match else ""
                end_24 = end_time_match.group(1).strip() if end_time_match else ""
                end_time = end_time_match.group(2).strip() if end_time_match else ""

                if start_24 and len(start_24) == 4 and start_24[1] == ':':
                    start_24 = "0" + start_24
                if end_24 and len(end_24) == 4 and end_24[1] == ':':
                    end_24 = "0" + end_24

                title_match = re.search(r'<div class="m-seminar-list__list__content__column__items__item__title[^"]*">\s*<a[^>]*>(.*?)</a>', body, re.DOTALL)
                title = ""
                if title_match:
                    title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()
                    title = html.unescape(title)

                link_match = re.search(r'openRemoteModal\(\s*[\'"]([^\'"]+)[\'"]', body)
                modal_slug = link_match.group(1) if link_match else ""

                loc_match = re.search(r'<div class="m-seminar-list__list__content__column__items__item__location[^"]*">(.*?)</div>', body, re.DOTALL)
                location = track_name
                if loc_match:
                    loc_text = re.sub(r'<[^>]+>', ' ', loc_match.group(1)).strip()
                    loc_text = html.unescape(loc_text)
                    if loc_text:
                        location = loc_text

                speakers = []
                sp_parts = re.split(r'<div class="m-seminar-list__list__content__column__items__item__speakers__speaker">', body)
                for p in sp_parts[1:]:
                    img_m = re.search(r'<img[^>]*src="([^"]+)"', p)
                    img = img_m.group(1) if img_m else ""
                    name_m = re.search(r'<span class="m-seminar-list__list__content__column__items__item__speakers__speaker__name[^"]*">\s*<a[^>]*>(.*?)</a>', p, re.DOTALL)
                    if name_m:
                        sp_text = re.sub(r'<[^>]+>', '', name_m.group(1)).strip()
                        sp_text = html.unescape(sp_text)
                        parts = [pt.strip() for pt in sp_text.split(',', 1)]
                        speakers.append({
                            'name': parts[0],
                            'role': parts[1] if len(parts) > 1 else "",
                            'image': img
                        })

                duration_minutes = 0
                if start_24 and end_24:
                    try:
                        sh, sm = map(int, start_24.split(':'))
                        eh, em = map(int, end_24.split(':'))
                        duration_minutes = (eh * 60 + em) - (sh * 60 + sm)
                        if duration_minutes < 0:
                            duration_minutes += 24 * 60
                    except Exception:
                        pass

                if title:
                    all_sessions.append({
                        'id': f"sess-{session_id_counter}",
                        'day': day_info['day'],
                        'date': day_info['date'],
                        'dayLabel': day_info['label'],
                        'track': track_name,
                        'ticketType': ticket_type,
                        'start24': start_24,
                        'startTime': start_time,
                        'end24': end_24,
                        'endTime': end_time,
                        'durationMinutes': duration_minutes,
                        'title': title,
                        'format': format_type,
                        'location': location,
                        'speakers': speakers,
                        'slug': modal_slug
                    })
                    session_id_counter += 1

    return all_sessions

def sync_agenda():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Connecting to {SUMMIT_AGENDA_URL}...")
    try:
        raw_html = fetch_live_agenda_html()
        print(f"Downloaded {len(raw_html)} bytes of live agenda HTML.")
    except Exception as e:
        print(f"Error connecting to summit website: {e}")
        return {"success": False, "error": str(e)}

    new_sessions = parse_agenda_html(raw_html)
    if not new_sessions:
        print("Warning: Parser returned 0 sessions. Keeping existing dataset.")
        return {"success": False, "error": "No sessions found in response"}

    # Load existing sessions to calculate diff
    existing_sessions = []
    if os.path.exists(SESSIONS_JS_PATH):
        try:
            with open(SESSIONS_JS_PATH, "r", encoding="utf-8") as f:
                js_content = f.read()
            m = re.search(r'const SUMMIT_SESSIONS = (\[.*\]);', js_content, re.DOTALL)
            if m:
                existing_sessions = json.loads(m.group(1))
        except Exception as e:
            print(f"Note: Could not parse existing sessions for diff: {e}")

    # Map existing by (title + date + start24) to preserve stable IDs where possible
    existing_map = {}
    for s in existing_sessions:
        key = (s['title'].strip().lower(), s['date'], s['start24'])
        existing_map[key] = s

    new_count = 0
    modified_count = 0
    preserved_sessions = []

    for s in new_sessions:
        key = (s['title'].strip().lower(), s['date'], s['start24'])
        if key in existing_map:
            old_s = existing_map[key]
            # Keep existing session ID so user's attending bookmarks and notes are NOT lost!
            s['id'] = old_s['id']
            # Check if any attributes changed (e.g. room/speakers)
            if (s['location'] != old_s.get('location') or 
                s['end24'] != old_s.get('end24') or 
                len(s['speakers']) != len(old_s.get('speakers', []))):
                modified_count += 1
        else:
            new_count += 1
        preserved_sessions.append(s)

    # Re-write sessions.js
    js_output = f"""/**
 * AI Infra Summit 2026 - Schedule Dataset
 * Last Live Sync: {datetime.now().isoformat()}
 * Total Sessions: {len(preserved_sessions)}
 */

const SUMMIT_SESSIONS = {json.dumps(preserved_sessions, indent=2, ensure_ascii=False)};

if (typeof window !== 'undefined') {{
  window.SUMMIT_SESSIONS = SUMMIT_SESSIONS;
}}

if (typeof module !== 'undefined' && module.exports) {{
  module.exports = {{ SUMMIT_SESSIONS }};
}}
"""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SESSIONS_JS_PATH, "w", encoding="utf-8") as f:
        f.write(js_output)

    sync_meta = {
        "lastSynced": datetime.now().strftime("%b %d, %Y %I:%M %p"),
        "lastSyncedIso": datetime.now().isoformat(),
        "totalSessions": len(preserved_sessions),
        "newSessions": new_count,
        "modifiedSessions": modified_count,
        "sourceUrl": SUMMIT_AGENDA_URL
    }

    with open(SYNC_META_PATH, "w", encoding="utf-8") as f:
        json.dump(sync_meta, f, indent=2)

    print(f"Sync complete! Total sessions: {len(preserved_sessions)}, New: {new_count}, Modified: {modified_count}")
    return {
        "success": True,
        "meta": sync_meta,
        "sessions": preserved_sessions
    }

if __name__ == "__main__":
    result = sync_agenda()
    if result.get("success"):
        print("Success! Data updated in data/sessions.js")
    else:
        print(f"Sync failed: {result.get('error')}")
