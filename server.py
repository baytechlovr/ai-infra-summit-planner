"""
AI Infra Summit 2026 - Web Server with Live Sync API
Serves static web files and provides /api/sync to update agenda data directly from the summit site.
"""

import os
import json
from http.server import SimpleHTTPRequestHandler, HTTPServer
import socketserver
from sync import sync_agenda, SYNC_META_PATH

PORT = 3000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class SummitAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Prevent caching on dynamic data and api endpoints
        if self.path.startswith('/api/') or self.path.endswith('.js') or self.path.endswith('.json'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        if self.path == '/api/sync' or self.path.startswith('/api/sync?'):
            print("[Server] Received /api/sync request. Fetching live agenda from summit website...")
            try:
                result = sync_agenda()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
            return

        elif self.path == '/api/status' or self.path.startswith('/api/status?'):
            sync_meta = {}
            if os.path.exists(SYNC_META_PATH):
                try:
                    with open(SYNC_META_PATH, "r", encoding="utf-8") as f:
                        sync_meta = json.load(f)
                except Exception:
                    pass
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "meta": sync_meta}).encode('utf-8'))
            return

        return super().do_GET()

def run_server():
    os.chdir(DIRECTORY)
    # Enable address reuse so restarts don't fail with port in use
    socketserver.TCPServer.allow_reuse_address = True
    with HTTPServer(("", PORT), SummitAppHandler) as httpd:
        print(f"==================================================")
        print(f"AI Infra Summit 2026 Planner Server")
        print(f"Serving at: http://localhost:{PORT}")
        print(f"Live Sync API: http://localhost:{PORT}/api/sync")
        print(f"Press Ctrl+C to stop.")
        print(f"==================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == '__main__':
    run_server()
