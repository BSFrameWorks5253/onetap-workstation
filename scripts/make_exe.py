import json
import os
import re
import sys
import time
import threading
import subprocess
import http.client
import urllib.parse
import urllib.request
import tempfile
import webbrowser
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

# Fix Windows terminal UTF-8 encoding for unicode print output
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('scripts', 'bin') else os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT_DIR)

# ─────────────────────────────────────────────────────────────────────────────
#  ENVIRONMENT INITIALIZATION
# ─────────────────────────────────────────────────────────────────────────────
def load_env():
    env_path = '.env'
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

def save_github_token(token: str):
    env_path = '.env'
    lines = []
    found = False
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if line.strip().startswith('GITHUB_TOKEN='):
                lines[i] = f'GITHUB_TOKEN="{token.strip()}"\n'
                found = True
                break
    if not found:
        lines.append(f'GITHUB_TOKEN="{token.strip()}"\n')
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    os.environ['GITHUB_TOKEN'] = token.strip()


def check_dependencies():
    results = {}
    try:
        r = subprocess.run(["node", "--version"], capture_output=True, text=True, shell=True)
        results["node"] = (r.returncode == 0, r.stdout.strip())
    except Exception:
        results["node"] = (False, "Not found")

    try:
        r = subprocess.run(["npm", "--version"], capture_output=True, text=True, shell=True)
        results["npm"] = (r.returncode == 0, r.stdout.strip())
    except Exception:
        results["npm"] = (False, "Not found")

    try:
        r = subprocess.run(["git", "--version"], capture_output=True, text=True, shell=True)
        results["git"] = (r.returncode == 0, r.stdout.strip())
    except Exception:
        results["git"] = (False, "Not found")

    iscc_p = get_iscc_path()
    if os.name != "nt":
        results["iscc"] = (True, "Portable .EXE (Linux Mode)")
    else:
        results["iscc"] = (bool(iscc_p), f"Ready ({os.path.basename(os.path.dirname(iscc_p))})" if iscc_p else "Not detected")

    tok = os.environ.get('GITHUB_TOKEN', '')
    tok_ok = bool(tok and 'your_github_token' not in tok)
    results["github"] = (tok_ok, "Configured" if tok_ok else "Not Set")

    return results


def get_iscc_path() -> str | None:
    iscc_paths = [
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
        "ISCC.exe"
    ]
    for p in iscc_paths:
        if os.path.isabs(p) and os.path.exists(p):
            return p
    import shutil
    which_iscc = shutil.which("ISCC.exe") or shutil.which("ISCC")
    if which_iscc:
        return which_iscc
    return None

# ─────────────────────────────────────────────────────────────────────────────
#  VERSION & FILE UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def get_current_version() -> str:
    package_json_path = 'package.json'
    if not os.path.exists(package_json_path):
        return '26.8.8'
    try:
        with open(package_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('version', '26.8.8')
    except Exception:
        return '26.8.8'


def sanitize_semver(version_str: str) -> str:
    if not version_str:
        return '26.8.8'
    v = version_str.strip().lstrip('vV')
    parts = v.split('.')
    if len(parts) >= 4:
        base = ".".join(parts[:3])
        extra = "-".join(parts[3:])
        return f"{base}-{extra}"
    return v


def compute_next_version(current: str) -> str:
    now = datetime.now()
    yy = now.year % 100
    mm = now.month

    normalized = current.strip().lstrip('vV').replace('-', '.')
    parts = normalized.split('.')
    try:
        cur_yy = int(parts[0]) if len(parts) >= 1 else 0
        cur_mm = int(parts[1]) if len(parts) >= 2 else 0
    except ValueError:
        cur_yy, cur_mm = 0, 0

    if cur_yy == yy and cur_mm == mm:
        try:
            last_num = int(parts[-1])
            parts[-1] = str(last_num + 1)
            return sanitize_semver(".".join(parts))
        except ValueError:
            pass

    if len(parts) >= 4:
        return sanitize_semver(f"{yy}.{mm}.0.1")
    else:
        return sanitize_semver(f"{yy}.{mm}.0")


def resolve_version_path(filename: str) -> str:
    v_path = os.path.join('version', filename)
    if os.path.exists(v_path) or os.path.exists('version'):
        return v_path
    return filename


def read_release_notes_file(filepath: str = None) -> dict:
    if not filepath:
        filepath = resolve_version_path('release_notes.txt')
    default_data = {
        "version": "",
        "whats_new": "",
        "bugs_fixed": "",
        "improvements": "",
        "release_notes": ""
    }
    if not os.path.exists(filepath):
        # Create a default template if missing
        default_data["version"] = compute_next_version(get_current_version())
        default_data["whats_new"] = "• Arabic & Lisan-ud-Dawat Welcome Screen on first launch / version updates.\n• Clean, lightweight Tkinter-based Executable Compiler & Release Manager.\n• Automatic update manifest generator for website/data/updates.json & update.json.\n• Standardized GitHub Releases with System Requirements & Download Steps."
        default_data["bugs_fixed"] = "Fixed false-positive camera color matching on description words (e.g. Zen matching Z prefix).\nRemoved dev/demo preview popup in Title Adder."
        default_data["improvements"] = "Fast folder marker parser and instant launch response.\nResponsive SVG vector teardrop banner with zero pixelation."
        default_data["release_notes"] = "* Native Arabic (Amiri) & Lisan-ud-Dawat Welcome Interface\n* Lightweight Tkinter Build Tool (make_exe.py)\n* Automatic Release Manifest & GitHub Distribution Sync\n* Verified TypeScript compilation and packaging pipeline"
        write_release_notes_file(default_data, filepath)
        return default_data

    current_section = None
    section_content = {
        "version": [],
        "whats_new": [],
        "bugs_fixed": [],
        "improvements": [],
        "release_notes": []
    }

    section_map = {
        "[VERSION]": "version",
        "[WHATS_NEW]": "whats_new",
        "[BUGS_FIXED]": "bugs_fixed",
        "[IMPROVEMENTS]": "improvements",
        "[RELEASE_NOTES]": "release_notes"
    }

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                sline = line.strip()
                if sline.upper() in section_map:
                    current_section = section_map[sline.upper()]
                    continue
                if current_section:
                    section_content[current_section].append(line)

        return {
            "version": "".join(section_content["version"]).strip(),
            "whats_new": "".join(section_content["whats_new"]).strip(),
            "bugs_fixed": "".join(section_content["bugs_fixed"]).strip(),
            "improvements": "".join(section_content["improvements"]).strip(),
            "release_notes": "".join(section_content["release_notes"]).strip(),
        }
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return default_data


def write_release_notes_file(data: dict, filepath: str = None):
    if not filepath:
        filepath = resolve_version_path('release_notes.txt')
    content = (
        f"[VERSION]\n{data.get('version', '').strip()}\n\n"
        f"[WHATS_NEW]\n{data.get('whats_new', '').strip()}\n\n"
        f"[BUGS_FIXED]\n{data.get('bugs_fixed', '').strip()}\n\n"
        f"[IMPROVEMENTS]\n{data.get('improvements', '').strip()}\n\n"
        f"[RELEASE_NOTES]\n{data.get('release_notes', '').strip()}\n"
    )
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)


def update_version_in_files(old_version: str, new_version: str, log_fn):
    log_fn(f"[Version] Updating version strings: {old_version} -> {new_version}...")

    # 1. Update package.json
    if os.path.exists('package.json'):
        try:
            with open('package.json', 'r', encoding='utf-8') as f:
                pkg = json.load(f)
            pkg['version'] = new_version
            with open('package.json', 'w', encoding='utf-8') as f:
                json.dump(pkg, f, indent=2)
            log_fn("  [Updated]  package.json")
        except Exception as e:
            log_fn(f"  [Error] package.json: {e}")

    # 2. Update package-lock.json if present
    if os.path.exists('package-lock.json'):
        try:
            with open('package-lock.json', 'r', encoding='utf-8') as f:
                pkg_lock = json.load(f)
            pkg_lock['version'] = new_version
            if 'packages' in pkg_lock and '' in pkg_lock['packages']:
                pkg_lock['packages']['']['version'] = new_version
            with open('package-lock.json', 'w', encoding='utf-8') as f:
                json.dump(pkg_lock, f, indent=2)
            log_fn("  [Updated]  package-lock.json")
        except Exception as e:
            log_fn(f"  [Error] package-lock.json: {e}")

    files_to_update = [
        os.path.join('google-apps-script', 'Code.gs'),
        os.path.join('installer', 'installer.iss'),
        os.path.join('installer', 'installer.nsi'),
        os.path.join('src', 'renderer', 'src', 'components', 'Sidebar.tsx'),
        os.path.join('src', 'renderer', 'src', 'components', 'MorphingBrand.tsx'),
        os.path.join('src', 'renderer', 'src', 'components', 'SplashScreen.tsx'),
        os.path.join('src', 'renderer', 'src', 'pages', 'Dashboard', 'Dashboard.tsx'),
        os.path.join('src', 'renderer', 'src', 'pages', 'Settings', 'Settings.tsx'),
        'README.md',
        'build-win.bat'
    ]

    version_regex = re.compile(r'\b\d+\.\d+\.\d+(\.\d+)?\b')

    success_count = 1  # package.json
    for file_path in files_to_update:
        if not os.path.exists(file_path):
            continue
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            if 'installer.iss' in file_path.lower():
                updated = re.sub(r'AppVersion=.*', f'AppVersion={new_version}', content)
                updated = re.sub(r'OutputBaseFilename=UniDesk_V.*_Setup', f'OutputBaseFilename=UniDesk_V{new_version}_Setup', updated)
                if old_version != new_version and old_version in updated:
                    updated = updated.replace(old_version, new_version)
            elif 'installer.nsi' in file_path.lower():
                updated = re.sub(r'!define\s+VERSION\s+".*"', f'!define VERSION "{new_version}"', content)
            elif old_version != new_version and old_version in content:
                updated = content.replace(old_version, new_version)
            else:
                updated = version_regex.sub(new_version, content, count=1)

            if content != updated:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(updated)
                log_fn(f"  [Updated]  {file_path}")
                success_count += 1
            else:
                log_fn(f"  [Verified] {file_path}")
        except Exception as e:
            log_fn(f"  [Error]    {file_path}: {e}")

    log_fn(f"[Version] Update complete. {success_count} file(s) patched successfully.\n")


def write_version_txt(version: str, whats_new: str, release_notes: str, bugs_fixed: str, improvements: str, log_fn):
    now = datetime.now()
    content = (
        f"Version:      {version}\n"
        f"Build Date:   {now.strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"Year-Month:   {now.year % 100}.{now.month}\n"
        f"\n"
        f"=== What's New ===\n"
        f"{whats_new}\n"
        f"\n"
        f"=== Bugs Fixed ===\n"
        f"{bugs_fixed}\n"
        f"\n"
        f"=== Improvements ===\n"
        f"{improvements}\n"
        f"\n"
        f"=== Full Release Notes ===\n"
        f"{release_notes}\n"
    )
    v_file = resolve_version_path('version.txt')
    with open(v_file, 'w', encoding='utf-8') as f:
        f.write(content)
    log_fn(f"  [Updated]  {v_file}")


def update_changelog_databases(version: str, whats_new: str, release_notes: str, bugs_fixed: str, improvements: str, log_fn):
    now = datetime.now()
    date_str = now.strftime('%Y-%m-%d')
    
    new_release = {
        "version": version,
        "date": date_str,
        "whats_new": whats_new,
        "release_notes": release_notes,
        "bugs_fixed": bugs_fixed,
        "improvements": improvements
    }
    
    target_paths = [
        os.path.join('website', 'data', 'updates.json'),
        resolve_version_path('update.json')
    ]

    for changelog_path in target_paths:
        releases = []
        if os.path.exists(changelog_path):
            try:
                with open(changelog_path, 'r', encoding='utf-8') as f:
                    releases = json.load(f)
                    if not isinstance(releases, list):
                        releases = []
            except Exception as e:
                log_fn(f"  [Warning] Failed reading {changelog_path}: {e}")
                releases = []

        updated = False
        for i, rel in enumerate(releases):
            if rel.get('version') == version:
                releases[i] = new_release
                updated = True
                break

        if not updated:
            releases.insert(0, new_release)

        try:
            os.makedirs(os.path.dirname(os.path.abspath(changelog_path)), exist_ok=True)
            with open(changelog_path, 'w', encoding='utf-8') as f:
                json.dump(releases, f, indent=2, ensure_ascii=False)
            log_fn(f"  [Updated]  {changelog_path}")
        except Exception as e:
            log_fn(f"  [Error] Failed writing {changelog_path}: {e}")


def ensure_icon_ico(log_fn):
    ico_path = os.path.join('resources', 'icon.ico')
    png_path = os.path.join('resources', 'icon.png')
    logo_path = os.path.join('resources', 'app_logo.png')
    if not os.path.exists(png_path) and os.path.exists(logo_path):
        try:
            import shutil
            shutil.copyfile(logo_path, png_path)
            log_fn(f"[Build] Initialized {png_path} from {logo_path}")
        except Exception:
            pass

    if os.path.exists(png_path):
        needs_convert = not os.path.exists(ico_path) or os.path.getmtime(png_path) > os.path.getmtime(ico_path)
        if needs_convert:
            try:
                from PIL import Image
                img = Image.open(png_path)
                img.save(ico_path, format='ICO', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
                log_fn(f"[Build] Converted {png_path} -> {ico_path}")
            except Exception as e:
                log_fn(f"[Build] Warning auto-converting icon.ico: {e}")


def build_electron_app(log_fn) -> bool:
    ensure_icon_ico(log_fn)
    log_fn("\n=======================================================")
    log_fn("  COMPILING WINDOWS APPLICATION (npm run build:win)     ")
    log_fn("=======================================================\n")
    
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    try:
        process = subprocess.Popen(
            f"{npm_cmd} run build:win", 
            shell=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True, 
            encoding='utf-8', 
            errors='replace'
        )

        for line in iter(process.stdout.readline, ''):
            if line:
                log_fn(f"  {line.rstrip()}")
        process.stdout.close()
        process.wait()

        if process.returncode == 0:
            log_fn("\n[SUCCESS] Windows packaging completed successfully (Exit Code 0).\n")
            return True
        else:
            log_fn(f"\n[ERROR] Windows packaging failed with exit code {process.returncode}.\n")
            return False
    except Exception as e:
        log_fn(f"\n[ERROR] Failed to execute build command: {e}\n")
        return False


def build_linux_app(log_fn) -> bool:
    ensure_icon_ico(log_fn)
    log_fn("\n=======================================================")
    log_fn("  COMPILING LINUX PACKAGES (npm run build:linux)        ")
    log_fn("=======================================================\n")
    
    npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
    try:
        process = subprocess.Popen(
            f"{npm_cmd} run build:linux", 
            shell=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True, 
            encoding='utf-8', 
            errors='replace'
        )

        for line in iter(process.stdout.readline, ''):
            if line:
                log_fn(f"  {line.rstrip()}")
        process.stdout.close()
        process.wait()

        if process.returncode == 0:
            log_fn("\n[SUCCESS] Linux packages (.deb / AppImage) created successfully (Exit Code 0).\n")
            return True
        else:
            log_fn(f"\n[ERROR] Linux packaging failed with exit code {process.returncode}.\n")
            return False
    except Exception as e:
        log_fn(f"\n[ERROR] Failed to execute Linux build command: {e}\n")
        return False


def compile_inno_setup(version: str, log_fn) -> str | None:
    iscc = get_iscc_path()
    if not iscc:
        import shutil
        which_nsis = shutil.which("makensis")
        if which_nsis:
            log_fn("\n=======================================================")
            log_fn("  COMPILING PROFESSIONAL SETUP INSTALLER (NSIS makensis)")
            log_fn("=======================================================\n")
            nsi_file = os.path.join('installer', 'installer.nsi')
            if not os.path.exists(nsi_file):
                log_fn(f"\n[ERROR] NSIS installer script not found at {nsi_file}\n")
                return None
            cmd = f'makensis -DVERSION="{version}" "{nsi_file}"'
            log_fn(f"  Executing: {cmd}\n")
            process = subprocess.Popen(
                cmd,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace'
            )
            for line in iter(process.stdout.readline, ''):
                if line:
                    log_fn(f"  {line.rstrip()}")
            process.stdout.close()
            process.wait()
            if process.returncode == 0:
                log_fn("\n[SUCCESS] NSIS compilation completed successfully (Exit Code 0).\n")
                expected_name = f"UniDesk_V{version}_Setup.exe"
                expected_path = os.path.join('release', expected_name)
                if os.path.exists(expected_path):
                    return expected_path
                for f in os.listdir('release'):
                    if f.lower().startswith('unidesk') and f.lower().endswith('.exe') and 'setup' in f.lower():
                        return os.path.join('release', f)
                return None
            else:
                log_fn(f"\n[ERROR] NSIS compilation failed with exit code {process.returncode}.\n")
                return None

        log_fn("\n[WARN] Neither Inno Setup compiler (ISCC.exe) nor NSIS (makensis) detected. Skipping Setup build.\n")
        return None

    iss_file = os.path.join('installer', 'installer.iss')
    if not os.path.exists(iss_file):
        log_fn(f"\n[ERROR] Inno Setup script not found at {iss_file}\n")
        return None

    win_unpacked = os.path.join('release', 'win-unpacked')
    if not os.path.exists(win_unpacked):
        log_fn(f"\n[ERROR] Pre-requisite directory not found: {win_unpacked}. electron-builder must produce win-unpacked first.\n")
        return None

    log_fn("\n=======================================================")
    log_fn(f"  COMPILING INNO SETUP INSTALLER ({os.path.basename(iscc)})")
    log_fn("=======================================================\n")

    try:
        cmd = f'"{iscc}" "{iss_file}"'
        log_fn(f"  Executing: {cmd}\n")
        process = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        for line in iter(process.stdout.readline, ''):
            if line:
                log_fn(f"  {line.rstrip()}")
        process.stdout.close()
        process.wait()

        if process.returncode == 0:
            log_fn("\n[SUCCESS] Inno Setup compilation completed successfully (Exit Code 0).\n")
            expected_name = f"UniDesk_V{version}_Setup.exe"
            expected_path = os.path.join('release', expected_name)
            if os.path.exists(expected_path):
                return expected_path
            for f in os.listdir('release'):
                if f.lower().startswith('unidesk') and f.lower().endswith('.exe') and 'setup' in f.lower():
                    return os.path.join('release', f)
            return None
        else:
            log_fn(f"\n[ERROR] Inno Setup failed with exit code {process.returncode}.\n")
            return None
    except Exception as e:
        log_fn(f"\n[ERROR] Failed to run Inno Setup: {e}\n")
        return None


def compute_sha256(filepath: str) -> str:
    import hashlib
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(1024 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()


def generate_release_checksums(version: str, file_paths: list, log_fn) -> dict:
    checksums = {}
    lines = [
        f"# Uni Desk v{version} — SHA-256 Release Checksums",
        f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"# Formatted for ManageEngine Endpoint Central & IT Audits",
        ""
    ]
    valid_files = [p for p in file_paths if p and os.path.exists(p)]
    if not valid_files:
        return checksums

    log_fn("\n=======================================================")
    log_fn("  GENERATING SHA-256 PACKAGE INTEGRITY CHECKSUMS       ")
    log_fn("=======================================================\n")

    for fp in valid_files:
        fname = os.path.basename(fp)
        sha = compute_sha256(fp)
        checksums[fname] = sha
        lines.append(f"{sha} *{fname}")

        sha_file = f"{fp}.sha256"
        with open(sha_file, 'w', encoding='utf-8') as f:
            f.write(f"{sha} *{fname}\n")
        log_fn(f"  [SHA-256] {fname}:")
        log_fn(f"            {sha}")
        log_fn(f"  [Created] {os.path.basename(sha_file)}")

    master_file = os.path.join('release', 'checksums.txt')
    with open(master_file, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines) + "\n")
    log_fn(f"  [Created] {master_file}\n")
    return checksums


def find_compiled_installer(version: str) -> str | None:
    search_dirs = ['release', 'dist', 'out']
    clean_ver = version.strip().lstrip('vV')
    candidates = []

    for build_dir in search_dirs:
        if not os.path.exists(build_dir):
            continue
        for root, _, files in os.walk(build_dir):
            if 'win-unpacked' in root.lower():
                continue
            for file in files:
                if not file.endswith('.exe'):
                    continue
                if 'uninstaller' in file.lower():
                    continue
                full_path = os.path.join(root, file)
                try:
                    mtime = os.path.getmtime(full_path)
                except OSError:
                    mtime = 0

                # Priority 1: Inno Setup executable containing version and setup
                if clean_ver in file and 'setup' in file.lower() and 'unidesk' in file.lower():
                    candidates.append((12, mtime, full_path))
                # Priority 2: Contains exact version string and 'setup'
                elif clean_ver in file and 'setup' in file.lower():
                    candidates.append((10, mtime, full_path))
                # Priority 3: Contains exact version string
                elif clean_ver in file:
                    candidates.append((8, mtime, full_path))
                # Priority 4: Contains 'setup' and was modified recently (within 4 hours)
                elif 'setup' in file.lower() and (time.time() - mtime < 14400):
                    candidates.append((5, mtime, full_path))
                # Priority 5: Any Windows executable modified recently (within 4 hours)
                elif file.lower().endswith('.exe') and (time.time() - mtime < 14400):
                    candidates.append((4, mtime, full_path))

    if candidates:
        # Sort by priority desc, then newest modification time desc
        candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return candidates[0][2]

    return None


def find_all_compiled_installers(version: str) -> list[str]:
    search_dirs = ['release', 'dist', 'out']
    clean_ver = version.strip().lstrip('vV')
    found = []
    extensions = ('.exe', '.appimage', '.deb', '.zip', '.tar.gz')

    for build_dir in search_dirs:
        if not os.path.exists(build_dir):
            continue
        for root, _, files in os.walk(build_dir):
            if 'win-unpacked' in root.lower() or 'linux-unpacked' in root.lower():
                continue
            for file in files:
                if not file.lower().endswith(extensions):
                    continue
                if 'uninstaller' in file.lower() or file.startswith('__'):
                    continue
                full_path = os.path.join(root, file)
                try:
                    mtime = os.path.getmtime(full_path)
                except OSError:
                    mtime = 0
                # Match either version in filename or modified within last 1 hour
                if (clean_ver in file) or (time.time() - mtime < 3600):
                    if full_path not in found:
                        found.append(full_path)
    return found


def generate_github_release_markdown(version: str, whats_new: str, bugs_fixed: str, improvements: str, release_notes: str, checksums: dict = None) -> str:
    body = f"# 🎬 Uni Desk v{version}\n\n"
    body += "### أَهْلًا وَسَهْلًا — Welcome to Uni Desk Release v" + version + "\n\n"
    
    if whats_new.strip():
        body += "### ✨ What's New\n" + whats_new.strip() + "\n\n"
    if bugs_fixed.strip():
        body += "### 🛠️ Bugs Fixed\n" + bugs_fixed.strip() + "\n\n"
    if improvements.strip():
        body += "### ⚡ Performance & Improvements\n" + improvements.strip() + "\n\n"
    if release_notes.strip():
        body += "### 📋 Detailed Release Notes\n" + release_notes.strip() + "\n\n"

    if checksums:
        body += "---\n\n"
        body += "### 🔒 Package Integrity & Deployment Checksums (SHA-256)\n"
        body += "| Package / Installer File | SHA-256 Checksum |\n"
        body += "| :--- | :--- |\n"
        for name, sha in checksums.items():
            body += f"| `{name}` | `{sha}` |\n"
        body += "\n> **Endpoint Central / Intune Note**: Use the SHA-256 hash above to configure package integrity verification in your deployment policy.\n\n"

    body += "---\n\n"
    body += "### 💻 System Requirements\n"
    body += "- **Operating System**: Windows 10 / Windows 11 (64-bit)\n"
    body += "- **Processor**: Intel Core i5 / AMD Ryzen 5 or higher\n"
    body += "- **Memory (RAM)**: 8 GB minimum (16 GB+ recommended for multi-track 4K video workflows)\n"
    body += "- **Storage**: 2 GB free disk space for runtime cache & FFmpeg temporary render buffers\n"
    body += "- **Integrations**: Adobe Premiere Pro 2021 – 2025 (Optional for automated CEP markers & sequence generator)\n\n"

    body += "---\n\n"
    body += "### 📥 Steps to Download & Install\n"
    body += f"1. **Download**: Click on the installer executable (`UniDesk_V{version}_Setup.exe` or `Uni.Desk.Setup.{version}.exe`) in the **Assets** section below.\n"
    body += "2. **Run Setup**: Open the downloaded file to run the automated installation wizard.\n"
    body += "3. **Launch Uni Desk**: Open the application from your Desktop or Start Menu.\n"
    body += "4. **Settings Folder**: On initial startup, select your settings storage directory when prompted (e.g. Documents).\n"
    body += "5. **Ready!** Enjoy fast video automation, marker coloring, and sequence generators.\n"

    return body


def upload_to_github_releases(version: str, file_paths: list[str] | str, release_body: str, log_fn) -> bool:
    token = os.environ.get('GITHUB_TOKEN')
    repo = os.environ.get('GITHUB_REPO', 'BSFrameWorks5253/onetap-workstation')
    
    if not token or not repo or 'your_github_token' in token:
        log_fn("[WARNING] GITHUB_TOKEN not configured in .env - skipping GitHub release upload.")
        return False

    if isinstance(file_paths, str):
        file_paths = [file_paths]

    # Automatically include release/checksums.txt if present
    master_chk = os.path.join('release', 'checksums.txt')
    if os.path.exists(master_chk) and master_chk not in file_paths:
        file_paths.append(master_chk)

    log_fn(f"\n[GitHub] Publishing release v{version} to repository: {repo}...")
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'UniDesk-App-Publisher',
        'Content-Type': 'application/json'
    }

    release_data = {
        "tag_name": f"v{version}",
        "name": f"Uni Desk Release v{version}",
        "body": release_body,
        "draft": False,
        "prerelease": False
    }

    try:
        parsed_url = urllib.parse.urlparse(f"https://api.github.com/repos/{repo}/releases")
        conn = http.client.HTTPSConnection(parsed_url.netloc, timeout=30)
        payload = json.dumps(release_data).encode('utf-8')
        conn.request("POST", parsed_url.path, body=payload, headers=headers)
        resp = conn.getresponse()
        body = resp.read().decode('utf-8')

        if resp.status not in (200, 201):
            if "already_exists" in body:
                log_fn(f"  Release tag v{version} already exists. Fetching existing release asset URL...")
                parsed_get = urllib.parse.urlparse(f"https://api.github.com/repos/{repo}/releases/tags/v{version}")
                get_conn = http.client.HTTPSConnection(parsed_get.netloc, timeout=30)
                get_conn.request("GET", parsed_get.path, headers=headers)
                get_resp = get_conn.getresponse()
                get_body = get_resp.read().decode('utf-8')
                if get_resp.status == 200:
                    release_info = json.loads(get_body)
                else:
                    log_fn(f"  [ERROR] Failed to get existing release: {get_body[:150]}")
                    return False
            else:
                log_fn(f"  [ERROR] Failed to create release: Status {resp.status} - {body[:150]}")
                return False
        else:
            release_info = json.loads(body)
            
        upload_url_raw = release_info.get('upload_url', '')
        upload_url = upload_url_raw.split('{')[0]

        existing_assets = release_info.get('assets', [])
        all_ok = True

        for file_path in file_paths:
            if not file_path or not os.path.exists(file_path):
                continue

            file_name = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            size_mb = round(file_size / (1024 * 1024), 2)

            # Remove existing asset with the same name if it already exists on this release
            normalized_name = file_name.replace(' ', '.')
            for asset in existing_assets:
                aname = asset.get('name', '')
                if aname == file_name or aname == normalized_name or aname.replace(' ', '.') == normalized_name:
                    aid = asset.get('id')
                    log_fn(f"[GitHub] Deleting existing asset: {aname} (ID: {aid})...")
                    try:
                        del_parsed = urllib.parse.urlparse(f"https://api.github.com/repos/{repo}/releases/assets/{aid}")
                        del_conn = http.client.HTTPSConnection(del_parsed.netloc, timeout=30)
                        del_conn.request("DELETE", del_parsed.path, headers=headers)
                        del_resp = del_conn.getresponse()
                        del_resp.read()
                        del_conn.close()
                    except Exception as ex:
                        log_fn(f"  [Warning] Could not delete existing asset: {ex}")

            log_fn(f"[GitHub] Uploading asset: {file_name} ({size_mb} MB)...")
            
            with open(file_path, 'rb') as f:
                file_data = f.read()

            parsed_upload = urllib.parse.urlparse(f"{upload_url}?name={urllib.parse.quote(file_name)}")
            upload_conn = http.client.HTTPSConnection(parsed_upload.netloc, timeout=900)
            
            upload_headers = {
                'Authorization': f'token {token}',
                'User-Agent': 'UniDesk-App-Publisher',
                'Content-Type': 'application/octet-stream',
                'Content-Length': str(len(file_data))
            }
            
            upload_conn.request("POST", f"{parsed_upload.path}?{parsed_upload.query}", body=file_data, headers=upload_headers)
            upload_resp = upload_conn.getresponse()
            upload_body = upload_resp.read().decode('utf-8')
            upload_conn.close()
            
            if upload_resp.status in (200, 201):
                log_fn(f"  [SUCCESS] Uploaded {file_name} successfully!")
            else:
                log_fn(f"  [ERROR] Upload {file_name} failed: Status {upload_resp.status} - {upload_body[:150]}")
                all_ok = False

        return all_ok

    except Exception as e:
        log_fn(f"[ERROR] GitHub upload exception: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
#  GOOGLE SHEET CLIENT EMAIL NOTIFICATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

DEFAULT_CLIENT_WEBHOOK_URL = os.environ.get(
    'CLIENT_NOTIFICATION_WEBHOOK_URL',
    'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'
)

def fetch_google_sheet_clients(webhook_url: str = None) -> list:
    url = (webhook_url or DEFAULT_CLIENT_WEBHOOK_URL).strip()
    if not url:
        return []
    try:
        req_url = f"{url}{'&' if '?' in url else '?'}action=list_users"
        req = urllib.request.Request(
            req_url,
            headers={"User-Agent": "UniDesk-Release-Manager"}
        )
        with urllib.request.urlopen(req, timeout=15) as res:
            raw = res.read().decode('utf-8', errors='replace')
            data = json.loads(raw)
            if data.get("status") == "ok":
                return data.get("users", [])
    except Exception as e:
        print(f"[Email] Failed fetching client list: {e}")
    return []


def generate_release_email(version: str, whats_new: str, bugs_fixed: str, improvements: str, release_notes: str, repo: str = None) -> tuple:
    if not repo:
        repo = os.environ.get('GITHUB_REPO', 'BSFrameWorks5253/onetap-workstation')

    clean_ver = version.strip().lstrip('vV')
    release_url = f"https://github.com/{repo}/releases/tag/v{clean_ver}"
    download_url = f"https://github.com/{repo}/releases/download/v{clean_ver}/Uni.Desk.Setup.v{clean_ver}.exe"
    subject = f"🎬 Important Workstation Update: Uni Desk v{clean_ver} Released — What's New & Enhancements"

    def format_list_items(text: str) -> str:
        lines = [ln.strip() for ln in text.split('\n') if ln.strip()]
        html_items = []
        for ln in lines:
            cleaned = re.sub(r'^[•\-\*\d\.]+\s*', '', ln).strip()
            if cleaned:
                if ':' in cleaned:
                    parts = cleaned.split(':', 1)
                    html_items.append(
                        f'<li style="margin-bottom: 10px; line-height: 1.55;">'
                        f'<strong style="color: #0f172a; font-size: 13.5px;">{parts[0].strip()}:</strong> '
                        f'<span style="color: #334155;">{parts[1].strip()}</span></li>'
                    )
                else:
                    html_items.append(f'<li style="margin-bottom: 8px; line-height: 1.5; color: #334155;">{cleaned}</li>')
        return '\n'.join(html_items) if html_items else '<li>General stability and performance improvements.</li>'

    whats_new_html = format_list_items(whats_new)
    bugs_fixed_html = format_list_items(bugs_fixed)
    improvements_html = format_list_items(improvements)

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">

          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 34px 30px; text-align: left; border-bottom: 4px solid #b8860b;">
              <div style="display: inline-block; padding: 4px 14px; background: rgba(184, 134, 11, 0.22); border: 1px solid #b8860b; border-radius: 20px; color: #fef08a; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 12px;">
                Official Workstation Release
              </div>
              <h1 style="margin: 0 0 6px 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                🎬 Uni Desk Workstation v{clean_ver}
              </h1>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; font-weight: 500;">
                Automated Media Organization, Video Automation & Premiere Pro Integration
              </p>
            </td>
          </tr>

          <!-- Salutation & Overview -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <p style="margin: 0 0 14px 0; font-size: 15px; line-height: 1.6; color: #1e293b;">
                <strong>Salam & Greetings,</strong>
              </p>
              <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.65; color: #475569;">
                A new production release of your <strong>Uni Desk Workstation (v{clean_ver})</strong> is now available. This update introduces direct media workflow enhancements, strict date folder protections, high-performance database preservation, and zero-latency stats navigation.
              </p>

              <!-- Download Hero Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 22px 0;">
                <tr>
                  <td align="center" style="background-color: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 20px 24px;">
                    <a href="{release_url}" style="display: inline-block; background: linear-gradient(135deg, #b8860b 0%, #9a6a12 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 32px; border-radius: 8px; box-shadow: 0 4px 14px rgba(184, 134, 11, 0.35);">
                      🚀 Download & View Release v{clean_ver}
                    </a>
                    <div style="margin-top: 10px; font-size: 11.5px; color: #64748b;">
                      Direct installer executable: <a href="{download_url}" style="color: #b8860b; text-decoration: underline; font-weight: 600;">Uni.Desk.Setup.v{clean_ver}.exe</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What's New Section -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="border-left: 4px solid #b8860b; padding-left: 14px; margin-bottom: 12px;">
                <h2 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 700;">✨ What's New & Highlights</h2>
              </div>
              <ul style="margin: 0 0 16px 0; padding-left: 20px; font-size: 13px;">
                {whats_new_html}
              </ul>
            </td>
          </tr>

          <!-- Performance & Fixes Section -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="border-left: 4px solid #059669; padding-left: 14px; margin-bottom: 12px;">
                <h2 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 700;">⚡ Performance & Improvements</h2>
              </div>
              <ul style="margin: 0 0 16px 0; padding-left: 20px; font-size: 13px;">
                {improvements_html}
              </ul>

              <div style="border-left: 4px solid #dc2626; padding-left: 14px; margin: 18px 0 12px 0;">
                <h2 style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 700;">🛠️ Key Fixes & Stability</h2>
              </div>
              <ul style="margin: 0 0 16px 0; padding-left: 20px; font-size: 13px;">
                {bugs_fixed_html}
              </ul>
            </td>
          </tr>

          <!-- Database Preservation Guarantee -->
          <tr>
            <td style="padding: 0 30px 28px 30px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px;">
                <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #0f172a; font-weight: 700;">
                  🔒 Automatic Database & Setting Retention
                </h3>
                <p style="margin: 0 0 10px 0; font-size: 12.5px; line-height: 1.6; color: #475569;">
                  <strong>Zero reconfiguration needed:</strong> If you already have Uni Desk or One Tap installed on your computer, running this setup will seamlessly preserve your database placement, asset directories, and settings. You will not be asked to re-select any folders.
                </p>
                <ol style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.6; color: #475569;">
                  <li>Download the update installer from the link above.</li>
                  <li>Run the setup wizard to replace previous binaries.</li>
                  <li>Launch Uni Desk and resume video automation immediately!</li>
                </ol>
              </div>
            </td>
          </tr>

          <!-- System Requirements -->
          <tr>
            <td style="padding: 0 30px 28px 30px;">
              <div style="border-top: 1px solid #e2e8f0; padding-top: 18px;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                  💻 System Requirements
                </h4>
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                  • Windows 10 / Windows 11 (64-bit) &bull; 8 GB+ RAM &bull; Adobe Premiere Pro 2021 – 2025 compatible
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 30px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">
                BS Framework &bull; Media Automation & Production Engineering
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                Need help or have questions? Contact technical support at <a href="mailto:support@bsframework.com" style="color: #b8860b; text-decoration: none; font-weight: 600;">support@bsframework.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""
    return subject, html_body


def send_release_email_broadcast(webhook_url: str, subject: str, html_body: str, recipients: list, log_fn) -> tuple:
    url = (webhook_url or DEFAULT_CLIENT_WEBHOOK_URL).strip()
    if not url:
        log_fn("[Email] [ERROR] No Google Sheet Webhook URL provided.")
        return False, 0, 0

    if not recipients:
        log_fn("[Email] [WARNING] No recipients found to send broadcast to.")
        return False, 0, 0

    log_fn(f"[Email] Dispatching broadcast to {len(recipients)} client(s) via Google Sheet Webhook...")
    payload = {
        "action": "send_broadcast",
        "subject": subject,
        "htmlBody": html_body,
        "recipients": recipients
    }

    try:
        data_bytes = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "UniDesk-Release-Manager"
            }
        )
        with urllib.request.urlopen(req, timeout=90) as res:
            resp_text = res.read().decode('utf-8', errors='replace')
            try:
                result = json.loads(resp_text)
                sent = result.get("sent", 0)
                failed = result.get("failed", 0)
                total = result.get("total", len(recipients))
                log_fn(f"[Email] Broadcast result: {sent} sent, {failed} failed (Total: {total}).")
                return result.get("status") == "ok", sent, failed
            except Exception:
                log_fn(f"[Email] Raw Webhook response: {resp_text[:200]}")
                return True, len(recipients), 0
    except Exception as e:
        log_fn(f"[Email] [ERROR] Broadcast request failed: {e}")
        return False, 0, len(recipients)

# ─────────────────────────────────────────────────────────────────────────────
#  TKINTER APPLICATION GUI - LUXURY LIGHT THEME WITH SMOOTH HOVER BUTTONS
# ─────────────────────────────────────────────────────────────────────────────

class HoverButton(tk.Button):
    def __init__(self, master=None, bg_color="#FAF6EE", hover_bg="#EFE7D8", fg_color="#231F1B", hover_fg="#231F1B", active_bg=None, **kw):
        self.default_bg = bg_color
        self.hover_bg = hover_bg
        self.default_fg = fg_color
        self.hover_fg = hover_fg
        self.active_bg = active_bg or hover_bg
        
        super().__init__(master, **kw)
        self.configure(
            bg=self.default_bg,
            fg=self.default_fg,
            activebackground=self.active_bg,
            activeforeground=self.hover_fg,
            relief="solid",
            bd=1,
            cursor="hand2",
            highlightthickness=0
        )
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)

    def on_enter(self, e):
        if str(self['state']) != 'disabled':
            self.configure(bg=self.hover_bg, fg=self.hover_fg)

    def on_leave(self, e):
        if str(self['state']) != 'disabled':
            self.configure(bg=self.default_bg, fg=self.default_fg)


class UniDeskBuilderApp(tk.Tk):
    def __init__(self):
        super().__init__()

        self.title("Uni Desk — Executable Compiler & Release Manager")
        self.geometry("980x800")
        self.minsize(860, 700)

        # Light palette configuration (Luxury Beige & Porcelain)
        self.configure(bg="#F4EFE6")
        self.setup_styles()

        # Build execution state
        self.is_building = False
        self.current_version = get_current_version()
        self.suggested_version = compute_next_version(self.current_version)

        self.create_widgets()
        self.load_from_file()

    def setup_styles(self):
        style = ttk.Style(self)
        try:
            style.theme_use('clam')
        except Exception:
            pass

        # Warm Light Palette Tokens
        style.configure(".", background="#F4EFE6", foreground="#231F1B", font=("Segoe UI", 9))
        style.configure("TFrame", background="#F4EFE6")
        style.configure("Card.TFrame", background="#FAF6EE", relief="flat")
        style.configure("TLabel", background="#F4EFE6", foreground="#231F1B", font=("Segoe UI", 9))
        style.configure("Card.TLabel", background="#FAF6EE", foreground="#231F1B", font=("Segoe UI", 9))
        style.configure("Header.TLabel", background="#F4EFE6", foreground="#8B5A2B", font=("Segoe UI", 13, "bold"))
        style.configure("SubHeader.TLabel", background="#F4EFE6", foreground="#7E7368", font=("Segoe UI", 8))
        style.configure("Section.TLabel", background="#FAF6EE", foreground="#B8860B", font=("Segoe UI", 9, "bold"))
        style.configure("TCheckbutton", background="#FAF6EE", foreground="#231F1B", font=("Segoe UI", 9))

    def create_widgets(self):
        # ── Header Bar ──
        header_frame = ttk.Frame(self)
        header_frame.pack(fill="x", padx=16, pady=(12, 6))

        title_lbl = ttk.Label(header_frame, text="🎬 Uni Desk Build & Release Studio", style="Header.TLabel")
        title_lbl.pack(anchor="w")
        sub_lbl = ttk.Label(header_frame, text="Automated Executable Compiler, Manifest Sync, and GitHub Release Publisher", style="SubHeader.TLabel")
        sub_lbl.pack(anchor="w")

        # ── Pinned Bottom Bar: Pipeline Options, Email Broadcast & Launch Button ──
        action_card = tk.Frame(self, bg="#FAF6EE", relief="solid", bd=1, highlightbackground="#DDD1BC", padx=12, pady=8)
        action_card.pack(side="bottom", fill="x", padx=16, pady=(4, 10))

        opts_frame = tk.Frame(action_card, bg="#FAF6EE")
        opts_frame.pack(fill="x", pady=(0, 6))

        self.opt_update_files = tk.BooleanVar(value=True)
        self.opt_update_json  = tk.BooleanVar(value=True)
        self.opt_build_win    = tk.BooleanVar(value=True)
        self.opt_build_linux  = tk.BooleanVar(value=True if os.name != "nt" else False)
        import shutil
        self.opt_inno_setup   = tk.BooleanVar(value=bool(get_iscc_path() or shutil.which("makensis")))
        self.opt_publish_git  = tk.BooleanVar(value=True)
        self.opt_send_email   = tk.BooleanVar(value=True)

        for text, var in [
            ("1. Files", self.opt_update_files),
            ("2. updates.json", self.opt_update_json),
            ("3. Win (exe/zip)", self.opt_build_win),
            ("4. Linux (deb/AppImage)", self.opt_build_linux),
            ("5. Setup (Inno/NSIS)", self.opt_inno_setup),
            ("6. GitHub", self.opt_publish_git),
            ("7. Email", self.opt_send_email)
        ]:
            tk.Checkbutton(
                opts_frame, 
                text=text, 
                variable=var, 
                bg="#FAF6EE", 
                fg="#231F1B", 
                activebackground="#FAF6EE", 
                activeforeground="#231F1B", 
                selectcolor="#FFFFFF",
                font=("Segoe UI", 9)
            ).pack(side="left", padx=(0, 10))

        # ── Email Broadcast Settings Bar ──
        email_frame = tk.Frame(action_card, bg="#FAF6EE", relief="solid", bd=1, highlightbackground="#DDD1BC", padx=10, pady=6)
        email_frame.pack(fill="x", pady=(0, 8))

        # Subject Row
        subj_row = tk.Frame(email_frame, bg="#FAF6EE")
        subj_row.pack(fill="x", pady=(0, 4))
        tk.Label(subj_row, text="📧 Email Subject:", bg="#FAF6EE", fg="#8B5A2B", font=("Segoe UI", 9, "bold")).pack(side="left", padx=(0, 8))
        self.email_subj_entry = tk.Entry(
            subj_row, bg="#FFFFFF", fg="#231F1B", insertbackground="#231F1B", font=("Segoe UI", 9),
            relief="solid", bd=1, highlightthickness=1, highlightcolor="#B8860B"
        )
        self.email_subj_entry.pack(side="left", fill="x", expand=True)

        # Actions & Client counter row
        btn_row = tk.Frame(email_frame, bg="#FAF6EE")
        btn_row.pack(fill="x")

        self.lbl_client_count = tk.Label(btn_row, text="👥 Registered Clients: (Click Fetch to check)", bg="#FAF6EE", fg="#059669", font=("Segoe UI", 9, "bold"))
        self.lbl_client_count.pack(side="left", padx=(0, 12))

        btn_fetch = HoverButton(
            btn_row, text="🔄 Fetch Clients", bg_color="#EFE7D8", hover_bg="#DDD1BC", fg_color="#231F1B",
            font=("Segoe UI", 8, "bold"), padx=8, pady=2, command=self.fetch_clients_action
        )
        btn_fetch.pack(side="left", padx=(0, 6))

        btn_prev = HoverButton(
            btn_row, text="👁️ Preview Email (Browser)", bg_color="#EFE7D8", hover_bg="#DDD1BC", fg_color="#6D28D9",
            font=("Segoe UI", 8, "bold"), padx=8, pady=2, command=self.preview_email_action
        )
        btn_prev.pack(side="left", padx=(0, 6))

        btn_test = HoverButton(
            btn_row, text="✉️ Send Test Email", bg_color="#EFE7D8", hover_bg="#DDD1BC", fg_color="#B8860B",
            font=("Segoe UI", 8, "bold"), padx=8, pady=2, command=self.test_email_action
        )
        btn_test.pack(side="left", padx=(0, 6))

        btn_webhook = HoverButton(
            btn_row, text="⚙️ Webhook URL", bg_color="#EFE7D8", hover_bg="#DDD1BC", fg_color="#7E7368",
            font=("Segoe UI", 8), padx=6, pady=2, command=self.configure_webhook_action
        )
        btn_webhook.pack(side="right")

        self.btn_build = HoverButton(
            action_card, 
            text="🚀  START BUILD & RELEASE PIPELINE", 
            bg_color="#B8860B", 
            hover_bg="#9A6A12", 
            fg_color="#FFFFFF", 
            hover_fg="#FFFFFF", 
            font=("Segoe UI", 10, "bold"), 
            padx=16, 
            pady=8, 
            command=self.start_pipeline_thread
        )
        self.btn_build.pack(fill="x")

        # ── Main Content PanedWindow (Top: Settings & Inputs, Bottom: Console) ──
        paned = tk.PanedWindow(self, orient=tk.VERTICAL, bg="#DDD1BC", sashrelief=tk.FLAT, sashwidth=4)
        paned.pack(fill="both", expand=True, padx=16, pady=4)

        top_container = ttk.Frame(paned)
        paned.add(top_container, minsize=320)

        # ── Pre-flight Dependency Bar ──
        dep_card = tk.Frame(top_container, bg="#FAF6EE", relief="solid", bd=1, highlightbackground="#DDD1BC", padx=10, pady=6)
        dep_card.pack(fill="x", pady=(0, 8))
        
        deps = check_dependencies()

        tk.Label(dep_card, text="🔍 Pre-flight Checks:", bg="#FAF6EE", fg="#8B5A2B", font=("Segoe UI", 9, "bold")).pack(side="left", padx=(0, 8))

        for name, (ok, detail) in deps.items():
            icon = "✓" if ok else "✗"
            color = "#059669" if ok else ("#DC2626" if name != "github" else "#D97706")
            label_text = f"{name.upper()}: {icon} {detail}"
            tk.Label(dep_card, text=label_text, bg="#FAF6EE", fg=color, font=("Consolas", 8, "bold")).pack(side="left", padx=6)

        # ── Card 1: Version & GitHub Configuration ──
        ver_card = tk.Frame(top_container, bg="#FAF6EE", relief="solid", bd=1, highlightbackground="#DDD1BC", padx=12, pady=10)
        ver_card.pack(fill="x", pady=(0, 8))

        tk.Label(ver_card, text="📌 Version & GitHub Configuration", bg="#FAF6EE", fg="#B8860B", font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(0, 6))

        ver_grid = tk.Frame(ver_card, bg="#FAF6EE")
        ver_grid.pack(fill="x")

        tk.Label(ver_grid, text="Current Version:", bg="#FAF6EE", fg="#584E44", font=("Segoe UI", 9)).grid(row=0, column=0, sticky="w", padx=(0, 8), pady=2)
        self.lbl_cur_ver = tk.Label(ver_grid, text=f"v{self.current_version}", bg="#FAF6EE", fg="#8B5A2B", font=("Consolas", 10, "bold"))
        self.lbl_cur_ver.grid(row=0, column=1, sticky="w", padx=(0, 20), pady=2)

        tk.Label(ver_grid, text="Target / Custom Version:", bg="#FAF6EE", fg="#584E44", font=("Segoe UI", 9)).grid(row=0, column=2, sticky="w", padx=(0, 8), pady=2)
        self.ver_entry = tk.Entry(ver_grid, bg="#FFFFFF", fg="#059669", insertbackground="#059669", font=("Consolas", 10, "bold"), relief="solid", bd=1, highlightthickness=1, highlightcolor="#B8860B", width=16)
        self.ver_entry.insert(0, self.suggested_version)
        self.ver_entry.grid(row=0, column=3, sticky="w", padx=(0, 8), pady=2)

        btn_suggest = HoverButton(
            ver_grid, 
            text="Use Suggested Increment", 
            bg_color="#EFE7D8", 
            hover_bg="#DDD1BC", 
            fg_color="#231F1B", 
            hover_fg="#000000",
            font=("Segoe UI", 8, "bold"), 
            padx=8, 
            pady=3,
            command=self.apply_suggested_version
        )
        btn_suggest.grid(row=0, column=4, sticky="w", padx=(4, 0), pady=2)

        # Row 1: GitHub Token Vault
        tk.Label(ver_grid, text="GitHub Access Token:", bg="#FAF6EE", fg="#584E44", font=("Segoe UI", 9)).grid(row=1, column=0, sticky="w", padx=(0, 8), pady=(8, 2))
        self.tok_entry = tk.Entry(ver_grid, bg="#FFFFFF", fg="#B8860B", insertbackground="#B8860B", font=("Consolas", 9), relief="solid", bd=1, highlightthickness=1, highlightcolor="#B8860B", show="•", width=36)
        cur_tok = os.environ.get('GITHUB_TOKEN', '')
        if cur_tok and 'your_github_token' not in cur_tok:
            self.tok_entry.insert(0, cur_tok)
        self.tok_entry.grid(row=1, column=1, columnspan=3, sticky="we", padx=(0, 8), pady=(8, 2))

        btn_save_tok = HoverButton(
            ver_grid, 
            text="💾 Save Token", 
            bg_color="#EFE7D8", 
            hover_bg="#DDD1BC", 
            fg_color="#8B5A2B", 
            hover_fg="#500A0F",
            font=("Segoe UI", 8, "bold"), 
            padx=8, 
            pady=3,
            command=self.save_token_action
        )             
        btn_save_tok.grid(row=1, column=4, sticky="w", padx=(4, 0), pady=(8, 2))

        # ── Card 2: Release Notes & Changelog ──
        notes_card = tk.Frame(top_container, bg="#FAF6EE", relief="solid", bd=1, highlightbackground="#DDD1BC", padx=12, pady=10)
        notes_card.pack(fill="both", expand=True, pady=(0, 8))

        notes_header = tk.Frame(notes_card, bg="#FAF6EE")
        notes_header.pack(fill="x", pady=(0, 6))

        tk.Label(notes_header, text="📝 Release Notes & Changelog (Loaded from release_notes.txt)", bg="#FAF6EE", fg="#8B5A2B", font=("Segoe UI", 9, "bold")).pack(side="left")
        
        btn_reload = HoverButton(
            notes_header, 
            text="🔄 Reload from File", 
            bg_color="#EFE7D8", 
            hover_bg="#DDD1BC", 
            fg_color="#231F1B", 
            font=("Segoe UI", 8, "bold"), 
            padx=8, 
            pady=2,
            command=self.load_from_file
        )
        btn_reload.pack(side="right", padx=(4, 0))

        btn_save = HoverButton(
            notes_header, 
            text="💾 Save to File", 
            bg_color="#EFE7D8", 
            hover_bg="#DDD1BC", 
            fg_color="#231F1B", 
            font=("Segoe UI", 8, "bold"), 
            padx=8, 
            pady=2,
            command=self.save_to_file
        )
        btn_save.pack(side="right", padx=(4, 0))

        # 2x2 grid for changelog fields
        notes_grid = tk.Frame(notes_card, bg="#FAF6EE")
        notes_grid.pack(fill="both", expand=True)
        notes_grid.columnconfigure(0, weight=1)
        notes_grid.columnconfigure(1, weight=1)
        notes_grid.rowconfigure(1, weight=1)
        notes_grid.rowconfigure(3, weight=1)

        # Field 1: What's New
        tk.Label(notes_grid, text="✨ What's New (Highlights):", bg="#FAF6EE", fg="#8B5A2B", font=("Segoe UI", 8, "bold")).grid(row=0, column=0, sticky="w", padx=(0, 6), pady=(0, 2))
        self.txt_whats_new = scrolledtext.ScrolledText(notes_grid, bg="#FFFFFF", fg="#231F1B", insertbackground="#231F1B", font=("Segoe UI", 9), height=4, relief="solid", bd=1)
        self.txt_whats_new.grid(row=1, column=0, sticky="nsew", padx=(0, 6), pady=(0, 6))

        # Field 2: Bugs Fixed
        tk.Label(notes_grid, text="🛠️ Bugs Fixed:", bg="#FAF6EE", fg="#B91C1C", font=("Segoe UI", 8, "bold")).grid(row=0, column=1, sticky="w", padx=(6, 0), pady=(0, 2))
        self.txt_bugs_fixed = scrolledtext.ScrolledText(notes_grid, bg="#FFFFFF", fg="#231F1B", insertbackground="#231F1B", font=("Segoe UI", 9), height=4, relief="solid", bd=1)
        self.txt_bugs_fixed.grid(row=1, column=1, sticky="nsew", padx=(6, 0), pady=(0, 6))

        # Field 3: Performance & Improvements
        tk.Label(notes_grid, text="⚡ Performance Improvements:", bg="#FAF6EE", fg="#059669", font=("Segoe UI", 8, "bold")).grid(row=2, column=0, sticky="w", padx=(0, 6), pady=(4, 2))
        self.txt_improvements = scrolledtext.ScrolledText(notes_grid, bg="#FFFFFF", fg="#231F1B", insertbackground="#231F1B", font=("Segoe UI", 9), height=4, relief="solid", bd=1)
        self.txt_improvements.grid(row=3, column=0, sticky="nsew", padx=(0, 6), pady=(0, 2))

        # Field 4: Full Release Notes
        tk.Label(notes_grid, text="📋 Full Release Notes (Markdown):", bg="#FAF6EE", fg="#6D28D9", font=("Segoe UI", 8, "bold")).grid(row=2, column=1, sticky="w", padx=(6, 0), pady=(4, 2))
        self.txt_release_notes = scrolledtext.ScrolledText(notes_grid, bg="#FFFFFF", fg="#231F1B", insertbackground="#231F1B", font=("Segoe UI", 9), height=4, relief="solid", bd=1)
        self.txt_release_notes.grid(row=3, column=1, sticky="nsew", padx=(6, 0), pady=(0, 2))

        # ── Bottom Section: Console Log ──
        bottom_container = tk.Frame(paned, bg="#F4EFE6")
        paned.add(bottom_container, minsize=200)

        log_header = tk.Frame(bottom_container, bg="#F4EFE6")
        log_header.pack(fill="x", pady=(4, 2))
        tk.Label(log_header, text="💻 Execution Logs", bg="#F4EFE6", fg="#584E44", font=("Segoe UI", 9, "bold")).pack(side="left")
        self.lbl_status = tk.Label(log_header, text="Ready", bg="#F4EFE6", fg="#059669", font=("Segoe UI", 9, "bold"))
        self.lbl_status.pack(side="right")

        self.txt_console = scrolledtext.ScrolledText(
            bottom_container,
            bg="#1E1A17",
            fg="#F4EFE6",
            insertbackground="#F4EFE6",
            font=("Consolas", 9),
            relief="solid",
            bd=1
        )
        self.txt_console.pack(fill="both", expand=True)

        # Configure console text tags
        self.txt_console.tag_config("cyan", foreground="#38BDF8")
        self.txt_console.tag_config("green", foreground="#34D399")
        self.txt_console.tag_config("pink", foreground="#F472B6")
        self.txt_console.tag_config("yellow", foreground="#FBBF24")
        self.txt_console.tag_config("red", foreground="#F87171")
        self.txt_console.tag_config("white", foreground="#F4EFE6")

        self.log("// Uni Desk Builder Studio initialized (Light Theme). Ready to compile and package.", "cyan")

    def save_token_action(self):
        val = self.tok_entry.get().strip()
        if not val:
            messagebox.showwarning("GitHub Token", "Token field is empty.")
            return
        save_github_token(val)
        self.log("[Config] GitHub Access Token saved successfully to .env", "green")
        messagebox.showinfo("GitHub Token", "GitHub Token saved successfully to .env and environment.")

    def apply_suggested_version(self):
        self.current_version = get_current_version()
        self.suggested_version = compute_next_version(self.current_version)
        self.lbl_cur_ver.config(text=f"v{self.current_version}")
        self.ver_entry.delete(0, tk.END)
        self.ver_entry.insert(0, self.suggested_version)
        self.update_email_subject()

    def update_email_subject(self):
        ver = sanitize_semver(self.ver_entry.get().strip()) if hasattr(self, 'ver_entry') else self.suggested_version
        if not ver:
            ver = self.suggested_version
        subj = f"🎬 Important Workstation Update: Uni Desk v{ver} Released — What's New & Enhancements"
        if hasattr(self, 'email_subj_entry'):
            self.email_subj_entry.delete(0, tk.END)
            self.email_subj_entry.insert(0, subj)

    def get_webhook_url(self) -> str:
        return os.environ.get('CLIENT_NOTIFICATION_WEBHOOK_URL', DEFAULT_CLIENT_WEBHOOK_URL).strip()

    def fetch_clients_action(self):
        url = self.get_webhook_url()
        self.lbl_client_count.config(text="👥 Fetching clients...", fg="#B8860B")

        def _bg():
            clients = fetch_google_sheet_clients(url)
            def _ui():
                if clients:
                    self.lbl_client_count.config(text=f"👥 {len(clients)} Client(s) in Google Sheet", fg="#059669")
                    self.log(f"[Email] Successfully loaded {len(clients)} client(s) from Google Sheet:", "green")
                    for c in clients:
                        self.log(f"  • {c.get('name', 'Client')} <{c.get('email', '')}> - App v{c.get('appVersion', 'unknown')}", "white")
                else:
                    self.lbl_client_count.config(text="👥 0 Clients in Sheet", fg="#DC2626")
                    self.log("[Email] [Warning] No registered clients found in Google Sheet.", "yellow")
            self.after(0, _ui)

        threading.Thread(target=_bg, daemon=True).start()

    def preview_email_action(self):
        target_version = sanitize_semver(self.ver_entry.get().strip())
        whats_new = self.txt_whats_new.get("1.0", tk.END).strip()
        bugs_fixed = self.txt_bugs_fixed.get("1.0", tk.END).strip()
        improvements = self.txt_improvements.get("1.0", tk.END).strip()
        release_notes = self.txt_release_notes.get("1.0", tk.END).strip()

        subject, html_body = generate_release_email(
            target_version, whats_new, bugs_fixed, improvements, release_notes,
            repo=os.environ.get('GITHUB_REPO', 'BSFrameWorks5253/onetap-workstation')
        )
        custom_subj = self.email_subj_entry.get().strip()
        if custom_subj:
            subject = custom_subj

        try:
            temp_dir = tempfile.gettempdir()
            preview_file = os.path.join(temp_dir, f"UniDesk_Email_Preview_v{target_version}.html")
            with open(preview_file, "w", encoding="utf-8") as f:
                f.write(html_body)
            webbrowser.open(f"file://{os.path.abspath(preview_file)}")
            self.log(f"[Email] Launched visual browser preview: {preview_file}", "cyan")
        except Exception as e:
            messagebox.showerror("Preview Error", f"Could not launch browser preview: {e}")

    def test_email_action(self):
        target_version = sanitize_semver(self.ver_entry.get().strip())
        whats_new = self.txt_whats_new.get("1.0", tk.END).strip()
        bugs_fixed = self.txt_bugs_fixed.get("1.0", tk.END).strip()
        improvements = self.txt_improvements.get("1.0", tk.END).strip()
        release_notes = self.txt_release_notes.get("1.0", tk.END).strip()

        subject, html_body = generate_release_email(
            target_version, whats_new, bugs_fixed, improvements, release_notes,
            repo=os.environ.get('GITHUB_REPO', 'BSFrameWorks5253/onetap-workstation')
        )
        custom_subj = self.email_subj_entry.get().strip()
        if custom_subj:
            subject = custom_subj

        prompt_win = tk.Toplevel(self)
        prompt_win.title("Send Test Update Email")
        prompt_win.geometry("480x180")
        prompt_win.configure(bg="#F4EFE6")
        prompt_win.resizable(False, False)
        prompt_win.transient(self)
        prompt_win.grab_set()

        tk.Label(prompt_win, text="✉️ Send Sample Update Email Broadcast", bg="#F4EFE6", fg="#8B5A2B", font=("Segoe UI", 10, "bold")).pack(pady=(14, 4))
        tk.Label(prompt_win, text="Enter a recipient email address to verify delivery and visual styling:", bg="#F4EFE6", fg="#584E44", font=("Segoe UI", 8)).pack(pady=(0, 8))

        entry_email = tk.Entry(prompt_win, font=("Segoe UI", 9), width=44, relief="solid", bd=1)
        entry_email.pack(pady=4)
        entry_email.insert(0, "sounasathburhan5252@gmail.com")
        entry_email.focus()

        def _do_send():
            test_addr = entry_email.get().strip()
            if not test_addr or "@" not in test_addr:
                messagebox.showwarning("Invalid Email", "Please enter a valid email address.")
                return
            prompt_win.destroy()
            self.log(f"[Email] Sending test email broadcast to: {test_addr}...", "cyan")

            def _send_bg():
                ok, sent, failed = send_release_email_broadcast(
                    self.get_webhook_url(),
                    f"[TEST] {subject}",
                    html_body,
                    [{"name": "Admin / Test Recipient", "email": test_addr}],
                    lambda m: self.log(m, "white")
                )
                if ok:
                    self.log(f"🎉 [Email] Test email successfully delivered to {test_addr}!", "green")
                    messagebox.showinfo("Email Sent", f"Test email sent successfully to {test_addr}!")
                else:
                    self.log(f"[Email] [ERROR] Failed to deliver test email to {test_addr}.", "red")
                    messagebox.showerror("Send Failed", "Could not deliver test email. Check console log for details.")

            threading.Thread(target=_send_bg, daemon=True).start()

        btn_send = HoverButton(
            prompt_win, text="🚀 Send Test Email Now", bg_color="#B8860B", hover_bg="#9A6A12", fg_color="#FFFFFF",
            font=("Segoe UI", 9, "bold"), padx=14, pady=5, command=_do_send
        )
        btn_send.pack(pady=10)

    def configure_webhook_action(self):
        cur_url = self.get_webhook_url()
        prompt_win = tk.Toplevel(self)
        prompt_win.title("Google Sheet Webhook URL")
        prompt_win.geometry("580x180")
        prompt_win.configure(bg="#F4EFE6")
        prompt_win.resizable(False, False)
        prompt_win.transient(self)
        prompt_win.grab_set()

        tk.Label(prompt_win, text="⚙️ Google Apps Script Webhook Configuration", bg="#F4EFE6", fg="#8B5A2B", font=("Segoe UI", 10, "bold")).pack(pady=(14, 4))
        tk.Label(prompt_win, text="Webhook fetches clients from your Google Sheet & broadcasts emails via Google's quota:", bg="#F4EFE6", fg="#584E44", font=("Segoe UI", 8)).pack(pady=(0, 6))

        entry_url = tk.Entry(prompt_win, font=("Consolas", 8), width=70, relief="solid", bd=1)
        entry_url.pack(pady=4)
        entry_url.insert(0, cur_url)

        def _save_url():
            new_u = entry_url.get().strip()
            if not new_u:
                messagebox.showwarning("Empty URL", "Webhook URL cannot be empty.")
                return
            env_path = '.env'
            lines = []
            found = False
            if os.path.exists(env_path):
                with open(env_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                for i, l in enumerate(lines):
                    if l.strip().startswith('CLIENT_NOTIFICATION_WEBHOOK_URL='):
                        lines[i] = f'CLIENT_NOTIFICATION_WEBHOOK_URL="{new_u}"\n'
                        found = True
                        break
            if not found:
                lines.append(f'CLIENT_NOTIFICATION_WEBHOOK_URL="{new_u}"\n')
            with open(env_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            os.environ['CLIENT_NOTIFICATION_WEBHOOK_URL'] = new_u
            prompt_win.destroy()
            self.log("[Config] Saved updated Google Sheet Webhook URL to .env", "green")
            messagebox.showinfo("Saved", "Webhook URL updated successfully.")

        btn_save = HoverButton(
            prompt_win, text="💾 Save Webhook URL", bg_color="#B8860B", hover_bg="#9A6A12", fg_color="#FFFFFF",
            font=("Segoe UI", 9, "bold"), padx=14, pady=5, command=_save_url
        )
        btn_save.pack(pady=10)

    def load_from_file(self):
        data = read_release_notes_file('release_notes.txt')
        
        file_ver = data.get("version", "").strip()
        if file_ver:
            self.ver_entry.delete(0, tk.END)
            self.ver_entry.insert(0, file_ver)
        else:
            self.apply_suggested_version()

        self.txt_whats_new.delete("1.0", tk.END)
        self.txt_whats_new.insert(tk.END, data.get("whats_new", ""))

        self.txt_bugs_fixed.delete("1.0", tk.END)
        self.txt_bugs_fixed.insert(tk.END, data.get("bugs_fixed", ""))

        self.txt_improvements.delete("1.0", tk.END)
        self.txt_improvements.insert(tk.END, data.get("improvements", ""))

        self.txt_release_notes.delete("1.0", tk.END)
        self.txt_release_notes.insert(tk.END, data.get("release_notes", ""))

        self.update_email_subject()
        self.log("[File] Loaded release notes from release_notes.txt", "cyan")

    def save_to_file(self):
        data = {
            "version": self.ver_entry.get().strip(),
            "whats_new": self.txt_whats_new.get("1.0", tk.END).strip(),
            "bugs_fixed": self.txt_bugs_fixed.get("1.0", tk.END).strip(),
            "improvements": self.txt_improvements.get("1.0", tk.END).strip(),
            "release_notes": self.txt_release_notes.get("1.0", tk.END).strip(),
        }
        write_release_notes_file(data, 'release_notes.txt')
        self.log("[File] Saved current release configuration to release_notes.txt", "green")
        messagebox.showinfo("Saved", "Configuration successfully saved to release_notes.txt")

    def log(self, message: str, tag: str = None):
        def _append():
            self.txt_console.insert(tk.END, message + "\n", tag)
            self.txt_console.see(tk.END)
        self.after(0, _append)

    def set_status(self, text: str, color: str = "#10B981"):
        def _update():
            self.lbl_status.config(text=text, foreground=color)
        self.after(0, _update)

    def start_pipeline_thread(self):
        if self.is_building:
            return
        
        target_version = sanitize_semver(self.ver_entry.get().strip())
        if not target_version:
            messagebox.showerror("Version Error", "Please provide a valid target version (e.g. 26.8.9).")
            return

        # Auto-save release notes before building
        self.save_to_file()

        self.is_building = True
        self.btn_build.config(state="disabled", text="⚡  BUILD PIPELINE RUNNING...")
        self.set_status("Executing Pipeline...", "#38BDF8")

        thread = threading.Thread(target=self.run_pipeline, args=(target_version,), daemon=True)
        thread.start()

    def run_pipeline(self, target_version: str):
        start_time = time.time()
        current_ver = get_current_version()
        whats_new = self.txt_whats_new.get("1.0", tk.END).strip()
        bugs_fixed = self.txt_bugs_fixed.get("1.0", tk.END).strip()
        improvements = self.txt_improvements.get("1.0", tk.END).strip()
        release_notes = self.txt_release_notes.get("1.0", tk.END).strip()

        self.log("\n" + "="*60, "cyan")
        self.log(f"  LAUNCHING UNI DESK BUILD PIPELINE: v{target_version}", "cyan")
        self.log("="*60 + "\n", "cyan")

        # Step 1: Update workspace files
        if self.opt_update_files.get():
            self.set_status("Step 1/5: Updating Version Strings...", "#FBBF24")
            update_version_in_files(current_ver, target_version, lambda m: self.log(m, "white"))
            write_version_txt(target_version, whats_new, release_notes, bugs_fixed, improvements, lambda m: self.log(m, "white"))

        # Step 2: Update databases
        if self.opt_update_json.get():
            self.set_status("Step 2/5: Updating Release Manifests...", "#FBBF24")
            self.log("[Manifest] Updating website/data/updates.json & update.json...", "cyan")
            update_changelog_databases(target_version, whats_new, release_notes, bugs_fixed, improvements, lambda m: self.log(m, "white"))

        # Step 3: Build Windows Application
        if self.opt_build_win.get():
            self.set_status("Step 3/7: Compiling Windows Package...", "#FBBF24")
            build_ok = build_electron_app(lambda m: self.log(m, "white" if "[Build]" not in m else "green"))
            if not build_ok:
                self.log("[ERROR] Windows packaging failed! Pipeline aborted.", "red")
                self.set_status("Build Failed ❌", "#F87171")
                self.finish_build(False)
                return

        # Step 4: Build Linux Packages
        if self.opt_build_linux.get():
            self.set_status("Step 4/7: Compiling Linux Packages (.deb / AppImage)...", "#FBBF24")
            linux_ok = build_linux_app(lambda m: self.log(m, "white" if "[Build]" not in m else "green"))
            if not linux_ok:
                self.log("[WARNING] Linux package compilation encountered an issue.", "yellow")

        # Step 5: Compile Inno Setup Enterprise Installer (ISCC)
        inno_installer_path = None
        if self.opt_inno_setup.get():
            self.set_status("Step 5/7: Compiling Inno Setup Installer (ISCC)...", "#FBBF24")
            inno_installer_path = compile_inno_setup(target_version, lambda m: self.log(m, "white" if "[ERROR]" not in m else "red"))
            if inno_installer_path and os.path.exists(inno_installer_path):
                self.log(f"[Inno Setup] Successfully created installer: {inno_installer_path}", "green")

        # Collect compiled installers (Windows & Linux) and generate SHA-256 checksums
        release_assets = []
        if inno_installer_path and os.path.exists(inno_installer_path):
            release_assets.append(inno_installer_path)

        all_installers = find_all_compiled_installers(target_version)
        for inst in all_installers:
            if inst not in release_assets and os.path.exists(inst):
                release_assets.append(inst)

        checksums = {}
        if release_assets:
            checksums = generate_release_checksums(target_version, release_assets, lambda m: self.log(m, "cyan"))
            self.log("\n" + "="*60, "green")
            self.log("  SHA-256 CHECKSUM CODES (FOR ENDPOINT CENTRAL / IT DEPLOYMENT)", "green")
            self.log("="*60, "green")
            for fname, sha in checksums.items():
                self.log(f"  File: {fname}", "white")
                self.log(f"  SHA:  {sha}\n", "yellow")
            self.log("="*60 + "\n", "green")

        # Step 5: Publish to GitHub
        if self.opt_publish_git.get():
            self.set_status("Step 5/6: Publishing to GitHub Releases...", "#FBBF24")
            if release_assets:
                release_body = generate_github_release_markdown(target_version, whats_new, bugs_fixed, improvements, release_notes, checksums)
                pub_ok = upload_to_github_releases(target_version, release_assets, release_body, lambda m: self.log(m, "cyan"))
                if not pub_ok:
                    self.log("[WARNING] GitHub release upload could not complete. Check your GITHUB_TOKEN in .env", "yellow")
            else:
                self.log(f"[WARNING] No compiled installer found for v{target_version}. Skipping asset upload.", "yellow")

        # Step 6: Send Notification Email to Clients from Google Sheet
        if self.opt_send_email.get():
            self.set_status("Step 6/6: Sending Update Email to Clients...", "#FBBF24")
            self.log("\n" + "-"*50, "cyan")
            self.log("  STEP 6: DISPATCHING CLIENT EMAIL NOTIFICATIONS", "cyan")
            self.log("-"*50, "cyan")

            webhook_url = self.get_webhook_url()
            self.log("[Email] Fetching client recipients from Google Sheet via webhook...", "white")
            clients = fetch_google_sheet_clients(webhook_url)
            if clients:
                self.log(f"[Email] Retrieved {len(clients)} registered client(s) from Google Sheet:", "green")
                for c in clients:
                    self.log(f"  • {c.get('name', 'Client')} <{c.get('email', '')}>", "white")

                subject, html_body = generate_release_email(
                    target_version, whats_new, bugs_fixed, improvements, release_notes,
                    repo=os.environ.get('GITHUB_REPO', 'BSFrameWorks5253/onetap-workstation')
                )
                custom_subj = self.email_subj_entry.get().strip()
                if custom_subj:
                    subject = custom_subj

                ok, sent, failed = send_release_email_broadcast(
                    webhook_url, subject, html_body, clients, lambda m: self.log(m, "white" if "[ERROR]" not in m else "red")
                )
                if ok:
                    self.log(f"🎉 [Email] Successfully broadcasted update email to {sent} client(s)!", "green")
                else:
                    self.log(f"[Email] [WARNING] Email broadcast completed with {failed} failure(s). Check logs.", "yellow")
            else:
                self.log("[Email] [WARNING] No registered client email addresses found in Google Sheet. Skipping broadcast.", "yellow")

        elapsed = round(time.time() - start_time, 1)
        self.log(f"\n🎉 [SUCCESS] Pipeline completed successfully in {elapsed}s for v{target_version}!\n", "green")
        self.set_status(f"Completed v{target_version} ({elapsed}s) ✓", "#34D399")
        self.finish_build(True)

    def finish_build(self, success: bool):
        def _reset():
            self.is_building = False
            self.btn_build.config(state="normal", text="🚀  START BUILD & RELEASE PIPELINE")
            self.current_version = get_current_version()
            self.lbl_cur_ver.config(text=f"v{self.current_version}")
            if success:
                messagebox.showinfo("Build Success", f"Release v{self.ver_entry.get().strip()} successfully built and processed!")
        self.after(0, _reset)


# ─────────────────────────────────────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main():
    app = UniDeskBuilderApp()
    app.mainloop()

if __name__ == '__main__':
    main()
