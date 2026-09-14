"""
Bundle the AI Infra Summit Planner into a single self-contained HTML file.
Contains all 343 sessions, CSS styles, and application logic.
Can be uploaded to Google Drive, emailed, or opened on any device offline.
"""

import os
import re

BASE_DIR = r"C:\Users\anura\.gemini\antigravity\scratch\ai-infra-summit-planner"

html_file = os.path.join(BASE_DIR, "index.html")
css_file = os.path.join(BASE_DIR, "styles.css")
sessions_file = os.path.join(BASE_DIR, "data", "sessions.js")
app_file = os.path.join(BASE_DIR, "app.js")
out_file = os.path.join(BASE_DIR, "ai_infra_summit_planner_single_file.html")

with open(html_file, "r", encoding="utf-8") as f:
    html_content = f.read()

with open(css_file, "r", encoding="utf-8") as f:
    css_content = f.read()

with open(sessions_file, "r", encoding="utf-8") as f:
    sessions_content = f.read()

with open(app_file, "r", encoding="utf-8") as f:
    app_content = f.read()

# Replace css link with inline style
html_content = re.sub(
    r'<link rel="stylesheet" href="styles\.css">',
    f'<style>\n{css_content}\n</style>',
    html_content
)

# Replace scripts with inline scripts
inline_scripts = f"""
  <script>
{sessions_content}
  </script>
  <script>
{app_content}
  </script>
"""

html_content = re.sub(
    r'<script src="data/sessions\.js"></script>\s*<script src="app\.js"></script>',
    inline_scripts,
    html_content
)

with open(out_file, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Standalone bundle created successfully at: {out_file}")
print(f"File size: {os.path.getsize(out_file):,} bytes")
