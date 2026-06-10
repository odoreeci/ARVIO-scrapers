#!/usr/bin/env python3
"""CORS-enabled HTTP server for ARVIO plugin hosting"""
import http.server
import socketserver
import os

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

if __name__ == "__main__":
    os.chdir('/root/ARVIO/scrapers')
    PORT = 8080
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print(f"Serving with CORS on port {PORT}")
        httpd.serve_forever()