import json
import os
import re
import sys
import time
import zipfile
import threading
import subprocess
import http.client
import urllib.parse
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

# Fix Windows terminal UTF-8 encoding for unicode print output
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Helper to ensure pywebview dependency is available
def ensure_dependencies():
    try:
        import webview
    except ImportError:
        print("[Build Studio] Installing pywebview for native display...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pywebview"])
        except Exception as e:
            print(f"[Build Studio] Warning: Could not install pywebview: {e}")

# ─────────────────────────────────────────────────────────────────────────────
#  ENVIRONMENT INITIALIZATION
# ─────────────────────────────────────────────────────────────────────────────
def load_env():
    # Check current dir or parent dir for .env
    for env_path in ['.env', os.path.join('..', '..', '.env')]:
        if os.path.exists(env_path):
            with open(env_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#') or '=' not in line:
                        continue
                    k, v = line.split('=', 1)
                    k, v = k.strip(), v.strip()
                    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                        v = v[1:-1]
                    os.environ[k] = v

load_env()

DEFAULT_REPO_OWNER = "BSFrameWorks5253"
DEFAULT_REPO_NAME = "onetap-adobe-extenstion"
TARGET_GITHUB_REPO = os.environ.get('GITHUB_REPO_EXTENSION', f"{DEFAULT_REPO_OWNER}/{DEFAULT_REPO_NAME}")

# ─────────────────────────────────────────────────────────────────────────────
#  VERSION HELPERS & BACKEND UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def get_current_version():
    version_json_path = 'version.json'
    if not os.path.exists(version_json_path):
        return '1.0.0'
    try:
        with open(version_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('version', '1.0.0')
    except Exception:
        return '1.0.0'


def sanitize_semver(version_str: str) -> str:
    if not version_str:
        return '1.0.0'
    v = version_str.strip()
    parts = v.split('.')
    if len(parts) >= 4:
        base = ".".join(parts[:3])
        extra = "-".join(parts[3:])
        return f"{base}-{extra}"
    return v


def compute_next_version(current: str) -> str:
    v = current.strip().replace('-', '.')
    parts = v.split('.')
    try:
        if len(parts) >= 3:
            parts[-1] = str(int(parts[-1]) + 1)
            return sanitize_semver(".".join(parts))
        elif len(parts) == 2:
            return sanitize_semver(f"{v}.1")
    except ValueError:
        pass
    return sanitize_semver(f"{v}.1")


# Global state for GUI/HTTP Server
BUILD_STATE = {
    "status": "idle",
    "logs": [],
    "current_version": get_current_version(),
    "suggested_version": compute_next_version(get_current_version()),
    "repo": TARGET_GITHUB_REPO
}

def add_log(msg: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    print(formatted)
    BUILD_STATE["logs"].append(formatted)


def update_version_in_files(old_version: str, new_version: str, release_notes: str, log_fn):
    log_fn(f"Updating version strings: {old_version} -> {new_version}...")

    repo_parts = TARGET_GITHUB_REPO.split('/')
    owner = repo_parts[0] if len(repo_parts) > 0 else DEFAULT_REPO_OWNER
    repo_name = repo_parts[1] if len(repo_parts) > 1 else DEFAULT_REPO_NAME

    version_data = {
        "version": new_version,
        "repoOwner": owner,
        "repoName": repo_name,
        "releaseNotes": release_notes,
        "downloadUrl": f"https://github.com/{owner}/{repo_name}/releases/download/v{new_version}/one-tap-parent-extension.zip",
        "updatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    # Write version.json
    v_json_path = os.path.join('version', 'version.json') if os.path.exists('version') else 'version.json'
    v_txt_path = os.path.join('version', 'version.txt') if os.path.exists('version') else 'version.txt'
    try:
        with open(v_json_path, 'w', encoding='utf-8') as f:
            json.dump(version_data, f, indent=2)
        log_fn(f"  [Updated] {v_json_path}")
    except Exception as e:
        log_fn(f"  [Error] {v_json_path}: {e}")

    # Write version.txt
    try:
        with open(v_txt_path, 'w', encoding='utf-8') as f:
            f.write(f"Version: {new_version}\nDate: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\nNotes: {release_notes}\n")
        log_fn(f"  [Updated] {v_txt_path}")
    except Exception as e:
        log_fn(f"  [Error] {v_txt_path}: {e}")

    BUILD_STATE["current_version"] = new_version
    BUILD_STATE["suggested_version"] = compute_next_version(new_version)
    log_fn(f"Version update complete. version.json set to v{new_version}")


def zip_extension_folder(new_version: str, log_fn) -> str | None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(script_dir, 'dist')
    os.makedirs(dist_dir, exist_ok=True)

    zip_filename = os.path.join(dist_dir, 'one-tap-parent-extension.zip')
    log_fn(f"Zipping extension directory into payload: {zip_filename}...")

    exclude_dirs = {'.git', '.vscode', 'dist', '__pycache__', 'node_modules', '.idea'}
    exclude_files = {'package_extension.py', '.gitignore', '.DS_Store'}

    try:
        with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(script_dir):
                dirs[:] = [d for d in dirs if d not in exclude_dirs]
                for file in files:
                    if file in exclude_files or file.endswith('.pyc') or file.endswith('.zip'):
                        continue
                    file_full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(file_full_path, script_dir)
                    zipf.write(file_full_path, rel_path)
                    
        size_mb = os.path.getsize(zip_filename) / (1024 * 1024)
        log_fn(f"[SUCCESS] Extension packaged successfully ({size_mb:.2f} MB)")
        return zip_filename
    except Exception as e:
        log_fn(f"[ERROR] Zipping failed: {e}")
        return None


def ensure_github_repo_initialized(token: str, repo: str, log_fn) -> bool:
    """If repository is empty, initializes main branch by pushing version.json via GitHub API."""
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "OneTap-Extension-BuildStudio"
    }

    try:
        conn = http.client.HTTPSConnection("api.github.com")
        conn.request("GET", f"/repos/{repo}/contents/version.json", headers=headers)
        res = conn.getresponse()
        res.read()

        if res.status == 404:
            log_fn(f"[Initializing Repo] Pushing initial version.json to empty repository {repo}...")
            import base64
            v_path = 'version.json'
            if not os.path.exists(v_path):
                v_path = os.path.join('extensions', 'one-tap-parent-extension', 'version.json')
            
            with open(v_path, 'r', encoding='utf-8') as f:
                v_content = f.read()

            b64_content = base64.b64encode(v_content.encode('utf-8')).decode('utf-8')
            put_payload = json.dumps({
                "message": "Initial commit - version.json",
                "content": b64_content,
                "branch": "main"
            }).encode('utf-8')

            conn_put = http.client.HTTPSConnection("api.github.com")
            conn_put.request("PUT", f"/repos/{repo}/contents/version.json", body=put_payload, headers=headers)
            put_res = conn_put.getresponse()
            put_body = put_res.read().decode('utf-8')

            if put_res.status in (200, 201):
                log_fn(f"[SUCCESS] Initialized GitHub repository {repo} with main branch!")
                time.sleep(2) # Give GitHub API a moment to propagate default branch
                return True
            else:
                log_fn(f"[Warning] Repo init response: {put_res.status} - {put_body}")
                return False
    except Exception as e:
        log_fn(f"[Warning] Could not auto-initialize repo: {e}")
    return True


def upload_to_github_releases(version: str, file_path: str, release_notes: str, log_fn) -> bool:
    token = os.environ.get('GITHUB_TOKEN')
    repo = TARGET_GITHUB_REPO
    
    if not token or 'your_github_token' in token:
        log_fn("[WARNING] GITHUB_TOKEN not found in environment/.env.")
        log_fn(f"[ACTION REQUIRED] Please upload 'dist/one-tap-parent-extension.zip' manually to https://github.com/{repo}/releases/new (Tag: v{version})")
        return False

    # Auto-initialize empty repository if needed
    ensure_github_repo_initialized(token, repo, log_fn)

    log_fn(f"Publishing release v{version} to GitHub repository: {repo}...")
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "OneTap-Extension-BuildStudio"
    }

    # 1. Create Github Release
    payload = json.dumps({
        "tag_name": f"v{version}",
        "name": f"One Tap Extension v{version}",
        "body": release_notes,
        "draft": False,
        "prerelease": False
    }).encode('utf-8')

    try:
        conn = http.client.HTTPSConnection("api.github.com")
        conn.request("POST", f"/repos/{repo}/releases", body=payload, headers=headers)
        res = conn.getresponse()
        res_data = res.read().decode('utf-8')
        
        if res.status not in (200, 201):
            log_fn(f"[ERROR] Failed to create release: HTTP {res.status} - {res_data}")
            if "Repository is empty" in res_data:
                log_fn(f"[SOLUTION] The GitHub repository '{repo}' has no commits yet.")
                log_fn("Please run the following commands once in terminal to push the initial commit & create the main branch:")
                log_fn(f"  cd \"d:\\One Tap_V20.6.5\\extensions\\one-tap-parent-extension\"")
                log_fn(f"  git init")
                log_fn(f"  git remote add origin https://github.com/{repo}.git")
                log_fn(f"  git add .")
                log_fn(f"  git commit -m \"Initial extension release\"")
                log_fn(f"  git branch -M main")
                log_fn(f"  git push -u origin main")
            return False

        rel_json = json.loads(res_data)
        upload_url_raw = rel_json.get("upload_url", "")
        upload_url = upload_url_raw.split("{")[0]
        log_fn(f"[SUCCESS] Created GitHub Release v{version} (ID: {rel_json.get('id')})")

        # 2. Upload zip asset
        file_name = os.path.basename(file_path)
        log_fn(f"Uploading asset asset '{file_name}' to GitHub Releases...")
        
        with open(file_path, "rb") as f:
            file_bytes = f.read()

        parsed_url = urllib.parse.urlparse(upload_url)
        asset_headers = {
            "Authorization": f"token {token}",
            "Content-Type": "application/zip",
            "Content-Length": str(len(file_bytes)),
            "User-Agent": "OneTap-Extension-BuildStudio"
        }

        conn_upload = http.client.HTTPSConnection(parsed_url.netloc)
        conn_upload.request("POST", f"{parsed_url.path}?name={file_name}", body=file_bytes, headers=asset_headers)
        up_res = conn_upload.getresponse()
        up_data = up_res.read().decode('utf-8')

        if up_res.status in (200, 201):
            log_fn(f"[SUCCESS] Successfully uploaded '{file_name}' to GitHub Release v{version}!")
            return True
        else:
            log_fn(f"[ERROR] Asset upload failed: HTTP {up_res.status} - {up_data}")
            return False

    except Exception as e:
        log_fn(f"[ERROR] Exception during GitHub upload: {e}")
        return False


def run_build_pipeline(new_version: str, whats_new: str, release_notes: str, bugs_fixed: str, improvements: str):
    BUILD_STATE["status"] = "building"
    BUILD_STATE["logs"] = []

    full_notes = f"{whats_new}\n\nBugs Fixed:\n{bugs_fixed}\n\nImprovements:\n{improvements}\n\n{release_notes}".strip()

    add_log("================================================================")
    add_log(" 🚀 STARTING ONE TAP ADOBE EXTENSION RELEASE BUILD")
    add_log("================================================================")
    add_log(f" Target Version : v{new_version}")
    add_log(f" Target Repo    : {TARGET_GITHUB_REPO}")
    add_log("================================================================")

    old_v = BUILD_STATE["current_version"]
    update_version_in_files(old_v, new_version, full_notes, add_log)

    zip_file = zip_extension_folder(new_version, add_log)
    if not zip_file:
        BUILD_STATE["status"] = "error"
        add_log("[FATAL ERROR] Build pipeline stopped due to zip error.")
        return

    published = upload_to_github_releases(new_version, zip_file, full_notes, add_log)

    add_log("================================================================")
    if published:
        add_log(f" 🎉 RELEASE v{new_version} IS LIVE ON GITHUB!")
        add_log(" All user devices running Premiere Pro will auto-update! ✨")
    else:
        add_log(f" 📦 ZIP Package created at: {zip_file}")
        add_log(f" Upload to: https://github.com/{TARGET_GITHUB_REPO}/releases/new")
    add_log("================================================================")

    BUILD_STATE["status"] = "completed"


# ─────────────────────────────────────────────────────────────────────────────
#  EMBEDDED BUILD STUDIO WEB UI & HTTP SERVER
# ─────────────────────────────────────────────────────────────────────────────

STUDIO_HTML = """<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>One Tap Adobe Extension Build Studio</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #0B0B10;
            --surface: #14141F;
            --border: rgba(255, 255, 255, 0.1);
            --accent: #6366F1;
            --accent-glow: rgba(99, 102, 241, 0.4);
            --text-main: #F1F5F9;
            --text-sub: #94A3B8;
            --success: #10B981;
            --warning: #F59E0B;
        }

        * { box-sizing: border-box; }
        body {
            margin: 0; padding: 18px;
            background: var(--bg);
            color: var(--text-main);
            font-family: 'Outfit', sans-serif;
            display: flex; flex-direction: column; height: 100vh;
        }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 16px;
        }

        .title { font-size: 20px; font-weight: 800; margin: 0; background: linear-gradient(135deg, #FFF, #A5B4FC); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .repo-badge { font-size: 10px; font-weight: 800; color: #818CF8; background: rgba(99,102,241,0.15); padding: 3px 8px; border-radius: 99px; border: 1px solid rgba(99,102,241,0.3); }

        .content { display: grid; grid-template-columns: 340px 1fr; gap: 16px; flex: 1; overflow: hidden; }

        .panel {
            background: var(--surface); border: 1px solid var(--border);
            border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto;
        }

        label { font-size: 11px; font-weight: 700; color: var(--text-sub); text-transform: uppercase; letter-spacing: 0.5px; }
        input, textarea {
            width: 100%; background: rgba(0,0,0,0.4); border: 1px solid var(--border);
            color: var(--text-main); font-family: inherit; font-size: 12px; padding: 8px 10px; border-radius: 8px; outline: none;
        }
        input:focus, textarea:focus { border-color: var(--accent); }

        .btn-build {
            background: linear-gradient(135deg, var(--accent), #4F46E5);
            color: #FFF; border: none; padding: 12px; border-radius: 10px;
            font-weight: 800; font-size: 13px; cursor: pointer; margin-top: 6px;
            box-shadow: 0 4px 15px var(--accent-glow); transition: all 0.2s ease;
        }
        .btn-build:hover { transform: translateY(-1px); box-shadow: 0 6px 20px var(--accent-glow); }
        .btn-build:disabled { opacity: 0.5; cursor: not-allowed; }

        .terminal {
            background: #040407; border: 1px solid var(--border); border-radius: 12px;
            padding: 12px; font-family: monospace; font-size: 11.5px; color: #A7F3D0;
            overflow-y: auto; white-space: pre-wrap; line-height: 1.5; flex: 1;
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="title">📦 One Tap Extension Build Studio</h1>
            <div style="font-size:11px; color:var(--text-sub); margin-top:2px;">Target Repo: <span id="repoName" class="repo-badge">BSFrameWorks5253/onetap-adobe-extenstion</span></div>
        </div>
        <div id="statusBadge" style="font-size:11px; font-weight:800; color:var(--success);">● IDLE READY</div>
    </div>

    <div class="content">
        <div class="panel">
            <div>
                <label>Release Version</label>
                <input type="text" id="verInput" value="1.0.1">
            </div>
            <div>
                <label>What's New</label>
                <input type="text" id="whatsNew" value="Added Light Theme & Auto-Update Engine">
            </div>
            <div>
                <label>Bugs Fixed</label>
                <input type="text" id="bugsFixed" value="Fixed custom marker timeline export sync">
            </div>
            <div>
                <label>Improvements</label>
                <input type="text" id="improvements" value="Faster panel launch & high contrast buttons">
            </div>
            <div>
                <label>Full Release Notes</label>
                <textarea id="notes" rows="4">Official update release for One Tap Parent Extension inside Adobe Premiere Pro.</textarea>
            </div>
            <button id="buildBtn" class="btn-build" onclick="startBuild()">🚀 Build & Publish Extension</button>
        </div>

        <div id="terminalLog" class="terminal">[Build Studio] Initialized and connected to release engine...\n</div>
    </div>

    <script>
        function fetchState() {
            fetch('/api/state')
                .then(r => r.json())
                .then(data => {
                    document.getElementById('repoName').innerText = data.repo;
                    var term = document.getElementById('terminalLog');
                    term.innerText = data.logs.join('\\n');
                    term.scrollTop = term.scrollHeight;

                    var btn = document.getElementById('buildBtn');
                    var badge = document.getElementById('statusBadge');
                    if (data.status === 'building') {
                        btn.disabled = true;
                        btn.innerText = '⚡ Building & Publishing...';
                        badge.style.color = 'var(--warning)';
                        badge.innerText = '● BUILDING';
                    } else {
                        btn.disabled = false;
                        btn.innerText = '🚀 Build & Publish Extension';
                        badge.style.color = 'var(--success)';
                        badge.innerText = '● IDLE READY';
                    }
                });
        }

        setInterval(fetchState, 1000);
        fetchState();

        function startBuild() {
            var version = document.getElementById('verInput').value;
            var whatsNew = document.getElementById('whatsNew').value;
            var bugsFixed = document.getElementById('bugsFixed').value;
            var improvements = document.getElementById('improvements').value;
            var notes = document.getElementById('notes').value;

            fetch('/api/build', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version, whatsNew, bugsFixed, improvements, notes })
            });
        }
    </script>
</body>
</html>
"""

class StudioHTTPHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass # Suppress default HTTP logging

    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(STUDIO_HTML.encode('utf-8'))
        elif self.path == '/api/state':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(BUILD_STATE).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/api/build':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            data = json.loads(body)

            v = data.get('version', BUILD_STATE["suggested_version"])
            wn = data.get('whatsNew', '')
            bf = data.get('bugsFixed', '')
            imp = data.get('improvements', '')
            notes = data.get('notes', '')

            threading.Thread(target=run_build_pipeline, args=(v, wn, notes, bf, imp), daemon=True).start()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "started"}).encode('utf-8'))


def run_cli_mode():
    add_log("Starting Release CLI...")
    suggested = compute_next_version(get_current_version())
    print("=" * 60)
    print(" 📦 ONE TAP ADOBE EXTENSION — RELEASE BUILD STUDIO")
    print("=" * 60)
    print(f" Current Version : v{get_current_version()}")
    print(f" Target Repo     : https://github.com/{TARGET_GITHUB_REPO}")
    print("-" * 60)

    ver = input(f" Enter release version [{suggested}]: ").strip() or suggested
    notes = input(" Enter Release Notes [Performance & UI Update]: ").strip() or "Performance & UI Update"

    run_build_pipeline(ver, "General Release", notes, "Bug fixes", "UI polish")


def main():
    ensure_dependencies()
    
    if '--cli' in sys.argv:
        run_cli_mode()
        return

    # Start local Studio HTTP server
    port = 8899
    server = HTTPServer(('127.0.0.1', port), StudioHTTPHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    add_log(f"Build Studio HTTP Server active on http://127.0.0.1:{port}")

    try:
        import webview
        window = webview.create_window(
            'One Tap Adobe Extension Build Studio',
            f'http://127.0.0.1:{port}',
            width=900, height=620,
            resizable=True
        )
        webview.start()
    except Exception as e:
        print(f"[Build Studio] Webview GUI failed ({e}), falling back to browser/CLI mode...")
        import webbrowser
        webbrowser.open(f'http://127.0.0.1:{port}')
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down Build Studio.")

if __name__ == "__main__":
    main()
