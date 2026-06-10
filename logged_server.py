#!/usr/bin/env python3
"""
Simple HTTP server with CORS + request logging
"""

import http.server
import socketserver
import os
import sys
from datetime import datetime

PORT = 8080
DIRECTORY = "/root/ARVIO/scrapers"

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, format, *args):
        timestamp = datetime.now().strftime('%H:%M:%S')
        print(f"[{timestamp}] {self.address_string()} - {format % args}")
        sys.stdout.flush()

    def do_GET(self):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] GET {self.path} from {self.address_string()}")
        return super().do_GET()

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("0.0.0.0", PORT), CORSRequestHandler) as httpd:
        print(f"Serving {DIRECTORY} on port {PORT} with CORS + logging")
        sys.stdout.flush()
        httpd.serve_forever()