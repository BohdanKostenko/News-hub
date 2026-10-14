import http.server
import socketserver
import json
import subprocess
import threading

PORT = 8000
is_updating = False

def run_feed_async():
    global is_updating
    if is_updating:
        return
    is_updating = True
    print("[Сервер] Запуск парсингу новин у фоні...")
    try:
        subprocess.run(["python", "run_feed.py"], check=False)
        print("[Сервер] Фоновий парсинг завершено успішно!")
    except Exception as e:
        print(f"[Сервер] Помилка виконання run_feed.py: {e}")
    finally:
        is_updating = False

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        global is_updating
        if self.path == '/api/sources':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            try:
                new_data = json.loads(body.decode('utf-8'))
                with open('sources.json', 'w', encoding='utf-8') as f:
                    json.dump(new_data, f, ensure_ascii=False, indent=2)
                
                # Запускаємо збір новин у фоновому потоці
                threading.Thread(target=run_feed_async, daemon=True).start()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status": "ok", "updating": true}')
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))

        elif self.path == '/api/refresh':
            # Ручне оновлення за запитом користувача
            if not is_updating:
                threading.Thread(target=run_feed_async, daemon=True).start()
                msg = b'{"status": "started"}'
            else:
                msg = b'{"status": "already_running"}'
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(msg)
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            status_json = json.dumps({"updating": is_updating})
            self.wfile.write(status_json.encode('utf-8'))
        else:
            super().do_GET()

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    print(f"Сервер із фоновим оновленням працює на http://127.0.0.1:{PORT}")
    httpd.serve_forever()
