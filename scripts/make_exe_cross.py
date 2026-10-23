#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════╗
║     UNI DESK — CROSS-PLATFORM BUILD & RELEASE STUDIO                ║
║     Works identically on Linux and Windows                          ║
║     Builds: Windows (.exe / .zip / .msi / .msix) + Linux (.AppImage)║
╚══════════════════════════════════════════════════════════════════════╝
Run:
  python3 make_exe_cross.py          (Linux)
  python  make_exe_cross.py          (Windows)
"""

import json
import os
import re
import sys
import time


import shutil
import hashlib
import tempfile
import threading
import subprocess
import http.client
import urllib.parse
import urllib.request
import webbrowser
from datetime import datetime
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

# ── UTF-8 stdout fix for Windows terminals ────────────────────────────────────
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

IS_WIN   = sys.platform == 'win32'
IS_LINUX = sys.platform.startswith('linux')
NPM_CMD  = 'npm.cmd' if IS_WIN else 'npm'

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) in ('scripts', 'bin') else os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT_DIR)

# ─────────────────────────────────────────────────────────────────────────────
#  ENVIRONMENT & TOKEN MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────
def load_env():
    env_path = '.env'
    if not os.path.exists(env_path):
        return
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

def save_env_key(key: str, value: str):
    env_path = '.env'
    lines = []
    found = False
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if line.strip().startswith(f'{key}='):
                lines[i] = f'{key}="{value.strip()}"\n'
                found = True
                break
    if not found:
        lines.append(f'{key}="{value.strip()}"\n')
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    os.environ[key] = value.strip()

def save_github_token(token: str):
    save_env_key('GITHUB_TOKEN', token)

# ─────────────────────────────────────────────────────────────────────────────
#  DEPENDENCY CHECKS
# ─────────────────────────────────────────────────────────────────────────────
def _run_check(cmd: list):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=8, shell=IS_WIN)
        return r.returncode == 0, (r.stdout.strip() or r.stderr.strip())
    except Exception as e:
        return False, str(e)

def check_dependencies() -> dict:
    results = {}
    ok, ver = _run_check(['node', '--version'])
    results['node'] = (ok, ver if ok else 'Not found')
    ok, ver = _run_check(['npm', '--version'])
    results['npm'] = (ok, ver if ok else 'Not found')
    ok, ver = _run_check(['git', '--version'])
    results['git'] = (ok, ver.split()[-1] if ok and ver else 'Not found')
    makensis_exe = get_makensis_path()
    if makensis_exe:
        ok, ver = _run_check([makensis_exe, '-VERSION'])
        ver_str = ver.strip() if ok and ver else 'Available'
        results['makensis'] = (True, f'Ready ({ver_str})')
    else:
        results['makensis'] = (False, 'Not installed')
    wine = shutil.which('wine') or shutil.which('wine64')
    results['wine'] = (bool(wine), 'Available' if wine else 'Optional')
    iscc = get_iscc_path()
    if IS_WIN:
        results['iscc'] = (bool(iscc), f'Ready ({os.path.basename(os.path.dirname(iscc))})' if iscc else 'Not found')
    else:
        results['iscc'] = (True, 'Linux mode')
    tok = os.environ.get('GITHUB_TOKEN', '')
    tok_ok = bool(tok and 'your_github_token' not in tok and len(tok) > 8)
    results['github'] = (tok_ok, 'Configured' if tok_ok else 'Not set')
    return results

def get_makensis_path():
    candidates = [
        shutil.which('makensis'),
        shutil.which('makensis.exe'),
        os.path.expandvars(r'%LOCALAPPDATA%\Programs\NSIS\Bin\makensis.exe'),
        os.path.expandvars(r'%LOCALAPPDATA%\Programs\NSIS\makensis.exe'),
        os.path.expandvars(r'%LOCALAPPDATA%\electron-builder\Cache\nsis\nsis-3.0.4.1\Bin\makensis.exe'),
        r'C:\Program Files (x86)\NSIS\makensis.exe',
        r'C:\Program Files\NSIS\makensis.exe',
        os.path.expandvars(r'%LOCALAPPDATA%\NSIS\makensis.exe'),
    ]
    for p in candidates:
        if p and os.path.isabs(p) and os.path.exists(p):
            return p
        if p and not os.path.isabs(p) and shutil.which(p):
            return shutil.which(p)
    return shutil.which('makensis')

def get_iscc_path():
    candidates = [
        r'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
        r'C:\Program Files\Inno Setup 6\ISCC.exe',
        'ISCC.exe'
    ]
    for p in candidates:
        if os.path.isabs(p) and os.path.exists(p):
            return p
    return shutil.which('ISCC.exe') or shutil.which('ISCC')

# ─────────────────────────────────────────────────────────────────────────────
#  VERSION & FILE UTILITIES
# ─────────────────────────────────────────────────────────────────────────────
def get_current_version() -> str:
    try:
        with open('package.json', 'r', encoding='utf-8') as f:
            return json.load(f).get('version', '26.9.23')
    except Exception:
        return '26.9.23'

def sanitize_semver(v: str) -> str:
    if not v:
        return '26.9.23'
    v = v.strip().lstrip('vV')
    parts = v.split('.')
    if len(parts) >= 4:
        return f"{'.'.join(parts[:3])}-{'-'.join(parts[3:])}"
    return v

def compute_next_version(current: str) -> str:
    now = datetime.now()
    yy, mm = now.year % 100, now.month
    parts = current.strip().lstrip('vV').replace('-', '.').split('.')
    try:
        cur_yy = int(parts[0]) if parts else 0
        cur_mm = int(parts[1]) if len(parts) > 1 else 0
    except ValueError:
        cur_yy, cur_mm = 0, 0
    if cur_yy == yy and cur_mm == mm:
        try:
            parts[-1] = str(int(parts[-1]) + 1)
            return sanitize_semver('.'.join(parts))
        except ValueError:
            pass
    return sanitize_semver(f'{yy}.{mm}.0')

def resolve_version_path(filename: str) -> str:
    vp = os.path.join('version', filename)
    return vp if os.path.exists('version') else filename

def read_release_notes_file(filepath: str = 'release_notes.txt') -> dict:
    default = dict(version='', whats_new='', bugs_fixed='', improvements='', release_notes='')
    actual_path = filepath
    if not os.path.exists(actual_path):
        resolved = resolve_version_path(filepath)
        if os.path.exists(resolved):
            actual_path = resolved
        else:
            default['version'] = get_current_version() or compute_next_version(get_current_version())
            return default
    section_map = {'[VERSION]': 'version', '[WHATS_NEW]': 'whats_new',
                   '[BUGS_FIXED]': 'bugs_fixed', '[IMPROVEMENTS]': 'improvements',
                   '[RELEASE_NOTES]': 'release_notes'}
    buf = {k: [] for k in section_map.values()}
    cur = None
    try:
        with open(actual_path, 'r', encoding='utf-8') as f:
            for line in f:
                s = line.strip().upper()
                if s in section_map:
                    cur = section_map[s]
                elif cur:
                    buf[cur].append(line)
        res = {k: ''.join(v).strip() for k, v in buf.items()}
        if not res.get('version'):
            res['version'] = get_current_version()
        return res
    except Exception as e:
        print(f'[ReleaseNotes] Read error: {e}')
        return default

def write_release_notes_file(data: dict, filepath: str = 'release_notes.txt'):
    content = (
        f"[VERSION]\n{data.get('version','').strip()}\n\n"
        f"[WHATS_NEW]\n{data.get('whats_new','').strip()}\n\n"
        f"[BUGS_FIXED]\n{data.get('bugs_fixed','').strip()}\n\n"
        f"[IMPROVEMENTS]\n{data.get('improvements','').strip()}\n\n"
        f"[RELEASE_NOTES]\n{data.get('release_notes','').strip()}\n"
    )
    for p in set([filepath, resolve_version_path(filepath)]):
        try:
            with open(p, 'w', encoding='utf-8') as f:
                f.write(content)
        except Exception:
            pass

def update_version_in_files(old: str, new: str, log_fn):
    log_fn(f'[Version] {old} -> {new}')
    if os.path.exists('package.json'):
        try:
            with open('package.json', 'r', encoding='utf-8') as f:
                pkg = json.load(f)
            pkg['version'] = new
            with open('package.json', 'w', encoding='utf-8') as f:
                json.dump(pkg, f, indent=2)
            log_fn('  [Updated] package.json')
        except Exception as e:
            log_fn(f'  [Error] package.json: {e}')
    if os.path.exists('package-lock.json'):
        try:
            with open('package-lock.json', 'r', encoding='utf-8') as f:
                pl = json.load(f)
            pl['version'] = new
            if 'packages' in pl and '' in pl['packages']:
                pl['packages']['']['version'] = new
            with open('package-lock.json', 'w', encoding='utf-8') as f:
                json.dump(pl, f, indent=2)
            log_fn('  [Updated] package-lock.json')
        except Exception as e:
            log_fn(f'  [Error] package-lock.json: {e}')
    extra_files = [
        os.path.join('installer', 'installer.iss'),
        os.path.join('installer', 'installer.nsi'),
        os.path.join('src', 'renderer', 'src', 'components', 'Sidebar', 'Sidebar.tsx'),
        os.path.join('src', 'renderer', 'src', 'components', 'MorphingBrand', 'MorphingBrand.tsx'),
        os.path.join('src', 'renderer', 'src', 'components', 'SplashScreen', 'SplashScreen.tsx'),
        os.path.join('src', 'renderer', 'src', 'pages', 'Settings', 'Settings.tsx'),
        os.path.join('src', 'renderer', 'src', 'pages', 'Dashboard', 'Dashboard.tsx'),
        os.path.join('src', 'main', 'ipc', 'update.ipc.ts'),
        os.path.join('version', 'release_notes.txt'),
        os.path.join('release_notes.txt'),
        'README.md',
    ]
    ver_re = re.compile(r'\b\d+\.\d+\.\d+(\.\d+)?\b')
    for fp in extra_files:
        if not os.path.exists(fp):
            continue
        try:
            with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            if 'installer.iss' in fp:
                updated = re.sub(r'AppVersion=.*', f'AppVersion={new}', content)
                updated = re.sub(r'OutputBaseFilename=UniDesk_V.*_Setup',
                                 f'OutputBaseFilename=UniDesk_V{new}_Setup', updated)
            elif 'installer.nsi' in fp:
                updated = re.sub(r'!define\s+VERSION\s+".*"', f'!define VERSION "{new}"', content)
            elif old in content:
                updated = content.replace(old, new)
            else:
                updated = ver_re.sub(new, content, count=1)
            if content != updated:
                with open(fp, 'w', encoding='utf-8') as f:
                    f.write(updated)
                log_fn(f'  [Updated] {fp}')
        except Exception as e:
            log_fn(f'  [Error] {fp}: {e}')

def write_version_txt(version, whats_new, release_notes, bugs_fixed, improvements, log_fn):
    now = datetime.now()
    content = (
        f'Version:    {version}\n'
        f'Build Date: {now.strftime("%Y-%m-%d %H:%M:%S")}\n\n'
        f"=== What's New ===\n{whats_new}\n\n"
        f'=== Bugs Fixed ===\n{bugs_fixed}\n\n'
        f'=== Improvements ===\n{improvements}\n\n'
        f'=== Full Release Notes ===\n{release_notes}\n'
    )
    vf = resolve_version_path('version.txt')
    with open(vf, 'w', encoding='utf-8') as f:
        f.write(content)
    log_fn(f'  [Updated] {vf}')

def update_changelog_databases(version, whats_new, release_notes, bugs_fixed, improvements, log_fn):
    now = datetime.now()
    new_rel = {
        'version': version, 'date': now.strftime('%Y-%m-%d'),
        'whats_new': whats_new, 'release_notes': release_notes,
        'bugs_fixed': bugs_fixed, 'improvements': improvements
    }
    for db_path in [os.path.join('website', 'data', 'updates.json'), resolve_version_path('update.json')]:
        releases = []
        if os.path.exists(db_path):
            try:
                with open(db_path, 'r', encoding='utf-8') as f:
                    releases = json.load(f)
                if not isinstance(releases, list):
                    releases = []
            except Exception as e:
                log_fn(f'  [Warning] {db_path}: {e}')
        updated = False
        for i, r in enumerate(releases):
            if r.get('version') == version:
                releases[i] = new_rel
                updated = True
                break
        if not updated:
            releases.insert(0, new_rel)
        try:
            os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
            with open(db_path, 'w', encoding='utf-8') as f:
                json.dump(releases, f, indent=2, ensure_ascii=False)
            log_fn(f'  [Updated] {db_path}')
        except Exception as e:
            log_fn(f'  [Error] {db_path}: {e}')

def ensure_icon_ico(log_fn):
    ico_path = os.path.join('resources', 'icon.ico')
    png_path = os.path.join('resources', 'icon.png')
    logo_path = os.path.join('resources', 'app_logo.png')
    if not os.path.exists(png_path) and os.path.exists(logo_path):
        try:
            shutil.copyfile(logo_path, png_path)
            log_fn('[Build] Initialized icon.png from app_logo.png')
        except Exception:
            pass
    if os.path.exists(png_path):
        needs = not os.path.exists(ico_path) or os.path.getmtime(png_path) > os.path.getmtime(ico_path)
        if needs:
            try:
                from PIL import Image
                img = Image.open(png_path)
                img.save(ico_path, format='ICO', sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)])
                log_fn('[Build] icon.png -> icon.ico')
            except Exception as e:
                log_fn(f'[Build] Warning: icon auto-convert: {e}')

# ─────────────────────────────────────────────────────────────────────────────
#  BUILD FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────
def _stream_cmd(cmd: str, log_fn) -> bool:
    try:
        proc = subprocess.Popen(
            cmd, shell=True,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding='utf-8', errors='replace'
        )
        for line in iter(proc.stdout.readline, ''):
            if line:
                log_fn(f'  {line.rstrip()}')
        proc.stdout.close()
        proc.wait()
        return proc.returncode == 0
    except Exception as e:
        log_fn(f'[Error] Command failed: {e}')
        return False

def build_windows(log_fn) -> bool:
    """Build Windows .exe / .zip — cross-compiles from Linux via electron-builder."""
    ensure_icon_ico(log_fn)
    log_fn('\n' + '-'*56)
    log_fn('  COMPILING WINDOWS PACKAGES  (npm run build:win)')
    log_fn('-'*56 + '\n')
    return _stream_cmd(f'{NPM_CMD} run build:win', log_fn)

def build_msi(log_fn) -> bool:
    """Build Windows MSI installer package via electron-builder Wix."""
    ensure_icon_ico(log_fn)
    log_fn('\n' + '-'*56)
    log_fn('  COMPILING WINDOWS MSI INSTALLER  (npm run build:win:msi)')
    log_fn('-'*56 + '\n')
    return _stream_cmd(f'{NPM_CMD} run build:win:msi', log_fn)

def build_msix(log_fn) -> bool:
    """Build Windows Store MSIX package via electron-builder."""
    ensure_icon_ico(log_fn)
    log_fn('\n' + '-'*56)
    log_fn('  COMPILING WINDOWS STORE PACKAGE (.msix)  (npm run build:win:msix)')
    log_fn('-'*56 + '\n')
    return _stream_cmd(f'{NPM_CMD} run build:win:msix', log_fn)

def is_version_match(filename: str, target_version: str) -> bool:
    """Strictly checks if a filename belongs specifically to target_version and NOT an older/different version."""
    clean = target_version.strip().lstrip('vV')
    fn = filename.lower()
    clean_alt1 = clean.replace('.', '_')
    clean_alt2 = clean.replace('.', '-')
    if clean.lower() not in fn and clean_alt1.lower() not in fn and clean_alt2.lower() not in fn:
        return False
    found_versions = re.findall(r'\b\d+\.\d+\.\d+(?:\.\d+)?\b', filename)
    for v in found_versions:
        if v != clean:
            return False
    return True

def organize_version_release_folder(version: str, log_fn) -> tuple:
    """Organizes generated release assets into release/<version>/ folder and archives previous versions."""
    clean_ver = version.strip().lstrip('vV')
    target_dir = os.path.join('release', clean_ver)
    os.makedirs(target_dir, exist_ok=True)

    # Automatically archive older versions in release/ to release/old_versions/
    old_dir = os.path.join('release', 'old_versions')
    os.makedirs(old_dir, exist_ok=True)
    if os.path.exists('release'):
        for item in os.listdir('release'):
            item_path = os.path.join('release', item)
            if item in ('old_versions', clean_ver) or not os.path.isfile(item_path):
                continue
            item_vers = re.findall(r'\b\d+\.\d+\.\d+(?:\.\d+)?\b', item)
            if item_vers and any(v != clean_ver for v in item_vers):
                try:
                    shutil.move(item_path, os.path.join(old_dir, item))
                    log_fn(f'  [Archive Old] Moved older version asset {item} -> release/old_versions/')
                except Exception:
                    pass

    exts = ('.exe', '.msi', '.msix', '.appx', '.appimage', '.deb', '.zip', '.tar.gz', '.blockmap')
    collected = []

    for d in ['release', 'out']:
        if not os.path.exists(d):
            continue
        for item in os.listdir(d):
            src_path = os.path.join(d, item)
            if os.path.isdir(src_path):
                continue
            if not item.lower().endswith(exts):
                continue
            if 'uninstaller' in item.lower() or 'unideskstudio' in item.lower():
                continue
            if is_version_match(item, clean_ver):
                dest_path = os.path.join(target_dir, item)
                try:
                    if os.path.abspath(src_path) != os.path.abspath(dest_path):
                        shutil.copy2(src_path, dest_path)
                    if dest_path not in collected:
                        collected.append(dest_path)
                    log_fn(f'  [Release Archive] -> release/{clean_ver}/{item}')
                except Exception as e:
                    log_fn(f'  [Warning] Could not copy {item}: {e}')
                    if src_path not in collected:
                        collected.append(src_path)

    return target_dir, collected

def build_linux(log_fn) -> bool:
    """Build Linux .AppImage / .deb."""
    ensure_icon_ico(log_fn)
    log_fn('\n' + '-'*56)
    log_fn('  COMPILING LINUX PACKAGES  (npm run build:linux)')
    log_fn('-'*56 + '\n')
    return _stream_cmd(f'{NPM_CMD} run build:linux', log_fn)

def compile_installer(version: str, log_fn):
    """Run NSIS (Linux or Windows) or Inno Setup (Windows only) to produce Setup.exe."""
    nsis = get_makensis_path()
    iscc = get_iscc_path()
    if nsis:
        nsi_file = os.path.join('installer', 'installer.nsi')
        if not os.path.exists(nsi_file):
            log_fn(f'[Installer] NSIS script not found at {nsi_file}')
            return None
        log_fn('\n' + '-'*56)
        log_fn('  COMPILING NSIS SETUP INSTALLER  (makensis)')
        log_fn('-'*56 + '\n')
        ok = _stream_cmd(f'"{nsis}" -DVERSION="{version}" "{nsi_file}"', log_fn)
        if ok:
            for d in ['release', 'dist', 'out']:
                if not os.path.exists(d):
                    continue
                for f in os.listdir(d):
                    if f.lower().endswith('.exe') and 'setup' in f.lower() and version in f:
                        return os.path.join(d, f)
        return None
    if iscc and IS_WIN:
        iss_file = os.path.join('installer', 'installer.iss')
        if not os.path.exists(iss_file):
            log_fn(f'[Installer] Inno Setup script not found at {iss_file}')
            return None
        log_fn('\n' + '-'*56)
        log_fn('  COMPILING INNO SETUP INSTALLER  (ISCC)')
        log_fn('-'*56 + '\n')
        ok = _stream_cmd(f'"{iscc}" "{iss_file}"', log_fn)
        if ok:
            for d in ['release', 'dist', 'out']:
                if not os.path.exists(d):
                    continue
                for f in os.listdir(d):
                    if f.lower().endswith('.exe') and 'setup' in f.lower():
                        return os.path.join(d, f)
        return None
    log_fn('[Installer] No NSIS or Inno Setup found — skipping installer step.')
    return None



def find_all_release_assets(version: str) -> list:
    exts = ('.exe', '.msi', '.msix', '.appx', '.appimage', '.deb', '.zip', '.tar.gz')
    clean = version.strip().lstrip('vV')
    found = []
    seen_basenames = set()

    # Priority 1: Check release/<version>/ subfolder
    ver_dir = os.path.join('release', clean)
    if os.path.exists(ver_dir):
        for f in os.listdir(ver_dir):
            if f.lower().endswith(exts) and 'uninstaller' not in f.lower() and 'unideskstudio' not in f.lower():
                if is_version_match(f, clean):
                    fp = os.path.join(ver_dir, f)
                    if f.lower() not in seen_basenames:
                        seen_basenames.add(f.lower())
                        found.append(fp)

    # Priority 2: Check standard output directories with strict version match
    for d in ['release', 'out']:
        if not os.path.exists(d):
            continue
        for root, _, files in os.walk(d):
            if any(skip in root.lower() for skip in ('unpacked', 'old_versions', '__msi', '__appimage', 'node_modules', '_internal', 'unideskstudio')):
                continue
            for f in files:
                if not f.lower().endswith(exts):
                    continue
                if 'uninstaller' in f.lower() or 'unideskstudio' in f.lower():
                    continue
                if f.lower() in seen_basenames:
                    continue
                fp = os.path.join(root, f)
                # STRICT: MUST match the exact target version
                if is_version_match(f, clean):
                    seen_basenames.add(f.lower())
                    found.append(fp)
    return found

# ─────────────────────────────────────────────────────────────────────────────
#  GITHUB RELEASES UPLOAD
# ─────────────────────────────────────────────────────────────────────────────
def generate_github_markdown(version, whats_new, bugs_fixed, improvements, release_notes, checksums=None) -> str:
    body = f'# Uni Desk v{version}\n\n'
    body += f'### Welcome to Uni Desk v{version}\n\n'
    if whats_new.strip():
        body += f"### What's New\n{whats_new.strip()}\n\n"
    if bugs_fixed.strip():
        body += f'### Bugs Fixed\n{bugs_fixed.strip()}\n\n'
    if improvements.strip():
        body += f'### Performance & Improvements\n{improvements.strip()}\n\n'
    if release_notes.strip():
        body += f'### Detailed Release Notes\n{release_notes.strip()}\n\n'
    body += '---\n\n### System Requirements\n'
    body += '- **Windows**: Windows 10 / 11 (64-bit)\n'
    body += '- **Linux**: Ubuntu 20.04+ / Debian 11+ (AppImage works on most distros)\n'
    body += '- **RAM**: 8 GB minimum\n\n'
    body += '### Installation\n'
    body += f'**Windows**: Download Setup .exe from Assets below\n'
    body += '**Linux**: Download .AppImage -> `chmod +x *.AppImage` -> run\n'
    return body

def upload_to_github(version: str, file_paths: list, release_body: str, log_fn) -> bool:
    token = os.environ.get('GITHUB_TOKEN', '')
    repo  = os.environ.get('GITHUB_REPO', 'BSFrameWorks5253/onetap-workstation')
    if not token or 'your_github_token' in token:
        log_fn('[GitHub] GITHUB_TOKEN not set -- skipping upload.')
        return False
    if isinstance(file_paths, str):
        file_paths = [file_paths]
    log_fn(f'[GitHub] Publishing v{version} to {repo} ...')
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'UniDesk-Publisher',
        'Content-Type': 'application/json'
    }
    release_data = {
        'tag_name': f'v{version}', 'name': f'Uni Desk v{version}',
        'body': release_body, 'draft': False, 'prerelease': False
    }
    try:
        conn = http.client.HTTPSConnection('api.github.com', timeout=30)
        conn.request('POST', f'/repos/{repo}/releases', json.dumps(release_data).encode(), headers)
        resp = conn.getresponse()
        body = resp.read().decode()
        if resp.status not in (200, 201):
            if 'already_exists' in body:
                log_fn(f'  Tag v{version} already exists -- fetching existing release...')
                conn2 = http.client.HTTPSConnection('api.github.com', timeout=30)
                conn2.request('GET', f'/repos/{repo}/releases/tags/v{version}', headers=headers)
                r2 = conn2.getresponse()
                body = r2.read().decode()
                if r2.status != 200:
                    log_fn(f'  [Error] Could not fetch existing release: {body[:120]}')
                    return False
            else:
                log_fn(f'  [Error] Create release HTTP {resp.status}: {body[:120]}')
                return False
        rel_info = json.loads(body)
        upload_url = rel_info.get('upload_url', '').split('{')[0]
        existing = rel_info.get('assets', [])
        clean_target_ver = version.strip().lstrip('vV')

        # Purge any alien/stale assets on this release that belong to older/different versions
        for asset in existing:
            an = asset.get('name', '')
            aid = asset.get('id')
            other_vers = re.findall(r'\b\d+\.\d+\.\d+(?:\.\d+)?\b', an)
            if other_vers and any(v != clean_target_ver for v in other_vers):
                log_fn(f'[GitHub] Purging stale previous version asset from release: {an}')
                try:
                    dc = http.client.HTTPSConnection('api.github.com', timeout=30)
                    dc.request('DELETE', f'/repos/{repo}/releases/assets/{aid}', headers=headers)
                    dc.getresponse().read()
                except Exception as ex:
                    log_fn(f'  [Warning] Asset purge error: {ex}')

        all_ok = True
        for fp in file_paths:
            if not fp or not os.path.exists(fp):
                continue
            fname = os.path.basename(fp)
            size_mb = round(os.path.getsize(fp) / 1048576, 2)
            norm = fname.replace(' ', '.')
            for asset in existing:
                an = asset.get('name', '')
                if an in (fname, norm):
                    aid = asset.get('id')
                    log_fn(f'[GitHub] Removing duplicate existing asset before re-upload: {an}')
                    try:
                        dc = http.client.HTTPSConnection('api.github.com', timeout=30)
                        dc.request('DELETE', f'/repos/{repo}/releases/assets/{aid}', headers=headers)
                        dc.getresponse().read()
                    except Exception:
                        pass
            log_fn(f'[GitHub] Uploading {fname} ({size_mb} MB) ...')
            with open(fp, 'rb') as f:
                data = f.read()
            uc = http.client.HTTPSConnection('uploads.github.com', timeout=900)
            up = urllib.parse.urlparse(f'{upload_url}?name={urllib.parse.quote(fname)}')
            uh = dict(headers)
            uh['Content-Type'] = 'application/octet-stream'
            uh['Content-Length'] = str(len(data))
            uc.request('POST', f'{up.path}?{up.query}', data, uh)
            ur = uc.getresponse()
            ub = ur.read().decode()
            uc.close()
            if ur.status in (200, 201):
                log_fn(f'  [OK] Uploaded {fname}')
            else:
                log_fn(f'  [Error] Upload failed HTTP {ur.status}: {ub[:80]}')
                all_ok = False
        return all_ok
    except Exception as e:
        log_fn(f'[GitHub] Exception: {e}')
        return False

# ─────────────────────────────────────────────────────────────────────────────
#  GOOGLE SHEET EMAIL BROADCAST
# ─────────────────────────────────────────────────────────────────────────────
DEFAULT_WEBHOOK = os.environ.get(
    'CLIENT_NOTIFICATION_WEBHOOK_URL',
    'https://script.google.com/macros/s/AKfycbyjj8Cy1V7AAJH-PCPmB4H92OadcnAQd9IvwiBUHHVZEoTJpJrAzXlLgVqQ5LzcW36x/exec'
)

def fetch_google_clients(webhook_url=None) -> list:
    url = (webhook_url or DEFAULT_WEBHOOK).strip()
    if not url:
        return []
    try:
        sep = '&' if '?' in url else '?'
        req = urllib.request.Request(f'{url}{sep}action=list_users',
                                     headers={'User-Agent': 'UniDesk-Release-Manager'})
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.loads(res.read().decode('utf-8', errors='replace'))
            if data.get('status') == 'ok':
                return data.get('users', [])
    except Exception as e:
        print(f'[Email] Client fetch error: {e}')
    return []

def generate_release_email(version, whats_new, bugs_fixed, improvements, release_notes, repo=None):
    if not repo:
        repo = os.environ.get('GITHUB_REPO', 'BSFrameWorks5253/onetap-workstation')
    v = version.strip().lstrip('vV')
    release_url  = f'https://github.com/{repo}/releases/tag/v{v}'
    download_url = f'https://github.com/{repo}/releases/download/v{v}/Uni.Desk.Setup.v{v}.exe'
    subject = f"Important Workstation Update: Uni Desk v{v} Released -- What's New & Enhancements"

    def fmt_list(text: str) -> str:
        items = []
        for ln in text.split('\n'):
            ln = re.sub(r'^[*\-\*\d\.]+\s*', '', ln.strip())
            if not ln:
                continue
            if ':' in ln:
                p = ln.split(':', 1)
                items.append(f'<li style="margin-bottom:10px"><strong style="color:#0f172a">{p[0].strip()}:</strong> <span style="color:#334155">{p[1].strip()}</span></li>')
            else:
                items.append(f'<li style="margin-bottom:8px;color:#334155">{ln}</li>')
        return '\n'.join(items) or '<li>General stability improvements.</li>'

    html_body = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>{subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px">
    <tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.07);border:1px solid #e2e8f0">
      <tr><td style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:34px 30px;border-bottom:4px solid #b8860b">
        <div style="display:inline-block;padding:4px 14px;background:rgba(184,134,11,.22);border:1px solid #b8860b;border-radius:20px;color:#fef08a;font-size:11px;font-weight:700;text-transform:uppercase;margin-bottom:12px">Official Release</div>
        <h1 style="margin:0 0 6px;color:#fff;font-size:24px;font-weight:800">Uni Desk v{v}</h1>
        <p style="margin:0;color:#94a3b8;font-size:13px">Automated Media Organization &amp; Premiere Pro Integration</p>
      </td></tr>
      <tr><td style="padding:30px">
        <p style="margin:0 0 14px;font-size:15px;color:#1e293b"><strong>Salam &amp; Greetings,</strong></p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#475569">A new release of <strong>Uni Desk v{v}</strong> is now available.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0">
          <tr><td align="center" style="background:#f8fafc;border:1.5px dashed #cbd5e1;border-radius:12px;padding:20px 24px">
            <a href="{release_url}" style="display:inline-block;background:linear-gradient(135deg,#b8860b,#9a6a12);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 32px;border-radius:8px">Download &amp; View Release v{v}</a>
            <div style="margin-top:10px;font-size:11.5px;color:#64748b">Installer: <a href="{download_url}" style="color:#b8860b;font-weight:600">Uni.Desk.Setup.v{v}.exe</a></div>
          </td></tr>
        </table>
        <div style="border-left:4px solid #b8860b;padding-left:14px;margin-bottom:12px"><h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:700">What's New</h2></div>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:13px">{fmt_list(whats_new)}</ul>
        <div style="border-left:4px solid #059669;padding-left:14px;margin-bottom:12px"><h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:700">Improvements</h2></div>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:13px">{fmt_list(improvements)}</ul>
        <div style="border-left:4px solid #dc2626;padding-left:14px;margin-bottom:12px"><h2 style="margin:0;font-size:16px;color:#0f172a;font-weight:700">Bugs Fixed</h2></div>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:13px">{fmt_list(bugs_fixed)}</ul>
      </td></tr>
      <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:22px 30px;text-align:center">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#475569">BS Framework &middot; Media Automation &amp; Production Engineering</p>
        <p style="margin:0;font-size:11px;color:#94a3b8">Support: <a href="mailto:support@bsframework.com" style="color:#b8860b;font-weight:600">support@bsframework.com</a></p>
      </td></tr>
    </table></td></tr>
  </table>
</body></html>"""
    return subject, html_body

def send_email_broadcast(webhook_url, subject, html_body, recipients, log_fn):
    url = (webhook_url or DEFAULT_WEBHOOK).strip()
    if not url:
        log_fn('[Email] No webhook URL configured.')
        return False, 0, 0
    if not recipients:
        log_fn('[Email] No recipients found.')
        return False, 0, 0
    log_fn(f'[Email] Broadcasting to {len(recipients)} client(s)...')
    payload = {'action': 'send_broadcast', 'subject': subject, 'htmlBody': html_body, 'recipients': recipients}
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(url, data=data,
                                     headers={'Content-Type': 'application/json', 'User-Agent': 'UniDesk-Release-Manager'})
        with urllib.request.urlopen(req, timeout=90) as res:
            result = json.loads(res.read().decode('utf-8', errors='replace'))
            sent, failed = result.get('sent', 0), result.get('failed', 0)
            log_fn(f'[Email] Sent: {sent}, Failed: {failed}')
            return result.get('status') == 'ok', sent, failed
    except Exception as e:
        log_fn(f'[Email] Error: {e}')
        return False, 0, len(recipients)


# =============================================================================
#  CUSTOMTKINTER ULTRA-MODERN LIGHT STUDIO INTERFACE
# =============================================================================
try:
    import customtkinter as ctk  # type: ignore
except ImportError:
    import subprocess
    print('[System] Installing customtkinter...')
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'customtkinter', 'darkdetect'])
    import customtkinter as ctk  # type: ignore

try:
    from PIL import Image, ImageTk
except ImportError:
    import subprocess
    print('[System] Installing Pillow...')
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pillow'])
    from PIL import Image, ImageTk

# Configure CustomTkinter Appearance
ctk.set_appearance_mode('Light')
ctk.set_default_color_theme('blue')

# Modern Color Palette
C_CANVAS      = '#F8FAFC'   # Slate-50 main canvas background
C_CARD        = '#FFFFFF'   # Pure white elevated card surface
C_CARD_ALT    = '#F1F5F9'   # Slate-100 card header surface
C_BORDER      = '#E2E8F0'   # Slate-200 border
C_BORDER_SUB  = '#CBD5E1'   # Slate-300 input border
C_PRIMARY     = '#2563EB'   # Royal Blue
C_PRIMARY_HOV = '#1D4ED8'   # Royal Blue Hover
C_TEXT_MAIN   = '#0F172A'   # Slate-900 high-contrast text
C_TEXT_MUTED  = '#64748B'   # Slate-500 secondary text
C_GREEN       = '#059669'   # Emerald Green
C_RED         = '#DC2626'   # Rose Red
C_AMBER       = '#D97706'   # Amber Warning
C_PURPLE      = '#7C3AED'   # Violet

# Typography
FONT_NAME     = 'Segoe UI' if IS_WIN else 'DejaVu Sans'
FONT_MONO_NAME= 'Consolas' if IS_WIN else 'DejaVu Sans Mono'


class UniDeskStudio(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title('Uni Desk  |  Cross-Platform Release Studio')
        self.geometry('1280x880')
        self.minsize(1080, 740)
        self.configure(fg_color=C_CANVAS)

        self.is_building = False
        self.current_version = get_current_version()
        self.suggested_version = compute_next_version(self.current_version)
        self._token_visible = False

        # Center window on screen
        self._center_window(1280, 880)

        # Initialize Option variables
        self.opt_update_files = tk.BooleanVar(value=True)
        self.opt_update_json  = tk.BooleanVar(value=True)
        self.opt_build_win    = tk.BooleanVar(value=True)
        self.opt_build_msi    = tk.BooleanVar(value=True)
        self.opt_build_msix   = tk.BooleanVar(value=True)
        self.opt_build_linux  = tk.BooleanVar(value=IS_LINUX or not IS_WIN)
        self.opt_installer    = tk.BooleanVar(value=bool(get_makensis_path() or (IS_WIN and get_iscc_path())))
        self.opt_publish_git  = tk.BooleanVar(value=True)
        self.opt_send_email   = tk.BooleanVar(value=True)

        self._setup_window_decorations()
        self._build_header()
        self._build_preflight_bar()
        self._build_nav_tabs()
        self._build_bottom_dock()
        self._build_tab_frames()

        self._load_from_file()
        self._pulse_start()
        self._update_stages_summary()

    def _center_window(self, w: int, h: int):
        self.update_idletasks()
        sw = self.winfo_screenwidth()
        sh = self.winfo_screenheight()
        x = max(0, (sw - w) // 2)
        y = max(0, (sh - h) // 2)
        self.geometry(f'{w}x{h}+{x}+{y}')

    # ── Window Icon & Taskbar ─────────────────────────────────────────────────
    def _setup_window_decorations(self):
        if IS_WIN:
            try:
                import ctypes
                myappid = 'BSFrameworks.UniDesk.ReleaseStudio.CrossPlatform'
                ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
            except Exception:
                pass

        script_dir = os.path.dirname(os.path.abspath(__file__))
        ico_candidates = [
            os.path.join(script_dir, 'resources', 'icon.ico'),
            'resources/icon.ico',
            'assets/icon.ico'
        ]
        png_candidates = [
            os.path.join(script_dir, 'resources', 'icon.png'),
            'resources/icon.png',
            'assets/icon.png'
        ]

        if IS_WIN:
            for p in ico_candidates:
                if os.path.exists(p):
                    try:
                        self.iconbitmap(p)
                        break
                    except Exception:
                        pass

        for p in png_candidates:
            if os.path.exists(p):
                try:
                    pil_img = Image.open(p)
                    self._app_icon_photo = ImageTk.PhotoImage(pil_img)
                    self.iconphoto(True, self._app_icon_photo)
                    break
                except Exception:
                    pass

    # ── Header Bar ────────────────────────────────────────────────────────────
    def _build_header(self):
        hdr = ctk.CTkFrame(self, corner_radius=0, height=68, fg_color=C_CARD,
                           border_width=1, border_color=C_BORDER)
        hdr.pack(fill='x')
        hdr.pack_propagate(False)

        # Left branding block
        brand_frame = ctk.CTkFrame(hdr, fg_color='transparent')
        brand_frame.pack(side='left', padx=18, pady=10)

        logo_loaded = False
        script_dir = os.path.dirname(os.path.abspath(__file__))
        for p in (os.path.join(script_dir, 'resources', 'icon.png'), 'resources/icon.png'):
            if os.path.exists(p):
                try:
                    raw_img = Image.open(p)
                    self._header_logo_ctk = ctk.CTkImage(light_image=raw_img, dark_image=raw_img, size=(42, 42))
                    logo_lbl = ctk.CTkLabel(brand_frame, image=self._header_logo_ctk, text='')
                    logo_lbl.pack(side='left', padx=(0, 12))
                    logo_loaded = True
                    break
                except Exception:
                    pass

        if not logo_loaded:
            fallback_box = ctk.CTkFrame(brand_frame, width=42, height=42, corner_radius=10, fg_color=C_PRIMARY)
            fallback_box.pack(side='left', padx=(0, 12))
            fallback_box.pack_propagate(False)
            ctk.CTkLabel(fallback_box, text='⚡', font=(FONT_NAME, 18, 'bold'), text_color='#FFFFFF').place(relx=0.5, rely=0.5, anchor='center')

        text_frame = ctk.CTkFrame(brand_frame, fg_color='transparent')
        text_frame.pack(side='left')

        title_row = ctk.CTkFrame(text_frame, fg_color='transparent')
        title_row.pack(anchor='w')
        ctk.CTkLabel(title_row, text='Uni Desk', font=(FONT_NAME, 17, 'bold'),
                     text_color=C_TEXT_MAIN).pack(side='left')

        badge = ctk.CTkFrame(title_row, corner_radius=6, fg_color='#EFF6FF',
                             border_width=1, border_color='#BFDBFE')
        badge.pack(side='left', padx=(8, 0))
        ctk.CTkLabel(badge, text='RELEASE STUDIO', font=(FONT_NAME, 9, 'bold'),
                     text_color=C_PRIMARY).pack(padx=7, pady=2)

        plat_name = 'Linux (X11/Wayland)' if IS_LINUX else ('Windows 11/10' if IS_WIN else 'Unix')
        ctk.CTkLabel(
            text_frame,
            text=f'Automated Pipeline Engine  •  Host: {plat_name}  •  Outputs: Windows (.exe) + Linux (.AppImage/.deb)',
            font=(FONT_NAME, 10), text_color=C_TEXT_MUTED
        ).pack(anchor='w', pady=(1, 0))

        # Right header controls
        right_box = ctk.CTkFrame(hdr, fg_color='transparent')
        right_box.pack(side='right', padx=18)

        # Version Pill Badge
        ver_pill = ctk.CTkFrame(right_box, corner_radius=8, fg_color=C_CARD_ALT,
                                border_width=1, border_color=C_BORDER)
        ver_pill.pack(side='left', padx=(0, 10))
        ctk.CTkLabel(ver_pill, text='ACTIVE RELEASE', font=(FONT_NAME, 8, 'bold'),
                     text_color=C_TEXT_MUTED).pack(padx=10, pady=(3, 0))
        self.lbl_ver_badge = ctk.CTkLabel(ver_pill, text=f'v{self.current_version}',
                                          font=(FONT_MONO_NAME, 12, 'bold'), text_color=C_PRIMARY)
        self.lbl_ver_badge.pack(padx=10, pady=(0, 3))

        # Build App (EXE + MSI + MSIX) Header Button
        ctk.CTkButton(
            right_box, text='🚀 Build App (EXE + MSI + MSIX)', command=self._start_pipeline,
            corner_radius=8, height=34, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOV,
            text_color='#FFFFFF', font=(FONT_NAME, 11, 'bold')
        ).pack(side='left', padx=(0, 8))

        # Open Releases Folder Button (opens release/<version>/ containing EXE and MSI)
        ctk.CTkButton(
            right_box, text='📁 Releases Folder', command=self._open_dist_folder,
            corner_radius=8, height=34, fg_color=C_CARD_ALT, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 11, 'bold')
        ).pack(side='left')

    # ── Pre-flight Diagnostics Bar ────────────────────────────────────────────
    def _build_preflight_bar(self):
        self.diag_bar = ctk.CTkFrame(self, corner_radius=0, height=36, fg_color=C_CARD_ALT,
                                     border_width=1, border_color=C_BORDER)
        self.diag_bar.pack(fill='x')

        ctk.CTkLabel(self.diag_bar, text='DIAGNOSTICS:', font=(FONT_NAME, 9, 'bold'),
                     text_color=C_TEXT_MUTED).pack(side='left', padx=(18, 10))

        self.diag_chips_container = ctk.CTkFrame(self.diag_bar, fg_color='transparent')
        self.diag_chips_container.pack(side='left', fill='both', expand=True)

        self.diag_chips = {}
        self._refresh_diagnostics_ui()

        # Re-scan button on the right
        ctk.CTkButton(
            self.diag_bar, text='🔄 Re-scan', command=self._refresh_diagnostics,
            corner_radius=6, height=24, width=76, fg_color=C_CARD, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 9, 'bold')
        ).pack(side='right', padx=18)

    def _refresh_diagnostics_ui(self):
        for widget in self.diag_chips_container.winfo_children():
            widget.destroy()

        deps = check_dependencies()
        self.diag_chips = {}
        for name, (ok, detail) in deps.items():
            chip_bg = '#ECFDF5' if ok else ('#FFFBEB' if name in ('wine', 'makensis', 'github') else '#FEF2F2')
            chip_bd = '#A7F3D0' if ok else ('#FDE68A' if name in ('wine', 'makensis', 'github') else '#FECACA')
            chip_fg = '#065F46' if ok else ('#92400E' if name in ('wine', 'makensis', 'github') else '#991B1B')
            chip_dot = '●' if ok else '▲'

            cf = ctk.CTkFrame(self.diag_chips_container, corner_radius=10, fg_color=chip_bg,
                              border_width=1, border_color=chip_bd)
            cf.pack(side='left', padx=3, pady=4)
            lbl = ctk.CTkLabel(cf, text=f'{chip_dot} {name.upper()}: {detail}',
                               font=(FONT_NAME, 9, 'bold'), text_color=chip_fg)
            lbl.pack(padx=7, pady=1)
            self.diag_chips[name] = (cf, lbl)

    def _refresh_diagnostics(self):
        self._refresh_diagnostics_ui()
        if hasattr(self, '_render_settings_diagnostics'):
            self._render_settings_diagnostics()
        self._log('[Diagnostics] System toolchain re-scanned successfully.', 'cyan')

    # ── Segmented Navigation Bar ──────────────────────────────────────────────
    def _build_nav_tabs(self):
        nav_frame = ctk.CTkFrame(self, corner_radius=0, fg_color=C_CANVAS, height=44)
        nav_frame.pack(fill='x', padx=18, pady=(8, 2))

        self.tab_names = [
            '🚀  Pipeline & Console',
            '📝  Release Notes',
            '✉️  Email Broadcast',
            '⚙️  Settings & Diagnostics'
        ]

        self.nav_tabs = ctk.CTkSegmentedButton(
            nav_frame,
            values=self.tab_names,
            command=self._on_tab_change,
            corner_radius=8,
            height=34,
            font=(FONT_NAME, 11, 'bold'),
            selected_color=C_PRIMARY,
            selected_hover_color=C_PRIMARY_HOV,
            unselected_color=C_CARD,
            unselected_hover_color='#E2E8F0',
            text_color=C_TEXT_MAIN
        )
        self.nav_tabs.pack(side='left')
        self.nav_tabs.set(self.tab_names[0])

    # ── Bottom Docked Action Bar ──────────────────────────────────────────────
    def _build_bottom_dock(self):
        self.bottom_dock = ctk.CTkFrame(self, corner_radius=0, fg_color=C_CARD,
                                        border_width=1, border_color=C_BORDER, height=58)
        self.bottom_dock.pack(side='bottom', fill='x')
        self.bottom_dock.pack_propagate(False)

        inner = ctk.CTkFrame(self.bottom_dock, fg_color='transparent')
        inner.pack(fill='both', expand=True, padx=18, pady=8)

        # Left Info: Target Version Pill & Active Stages
        left_box = ctk.CTkFrame(inner, fg_color='transparent')
        left_box.pack(side='left')

        self.lbl_target_pill = ctk.CTkLabel(
            left_box, text=f'🎯 Target: v{self.suggested_version}',
            font=(FONT_MONO_NAME, 11, 'bold'), fg_color='#EFF6FF',
            text_color=C_PRIMARY, corner_radius=6, padx=10, pady=4
        )
        self.lbl_target_pill.pack(side='left', padx=(0, 10))

        self.lbl_stages_summary = ctk.CTkLabel(
            left_box, text='7 of 7 stages enabled',
            font=(FONT_NAME, 10), text_color=C_TEXT_MUTED
        )
        self.lbl_stages_summary.pack(side='left')

        # Center Status Pill & Progress Bar
        center_box = ctk.CTkFrame(inner, fg_color='transparent')
        center_box.pack(side='left', fill='x', expand=True, padx=20)

        self.lbl_status = ctk.CTkLabel(
            center_box, text='● Ready to build', font=(FONT_NAME, 11, 'bold'),
            text_color=C_GREEN
        )
        self.lbl_status.pack(side='left', padx=(0, 12))

        self.prog_bar = ctk.CTkProgressBar(center_box, mode='indeterminate', height=6,
                                           corner_radius=3, progress_color=C_PRIMARY)

        # Right Action Button
        self.btn_launch = ctk.CTkButton(
            inner, text='🚀  START RELEASE PIPELINE', command=self._start_pipeline,
            corner_radius=9, height=40, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOV,
            font=(FONT_NAME, 12, 'bold'), text_color='#FFFFFF', width=240
        )
        self.btn_launch.pack(side='right')

    def _update_stages_summary(self):
        switches = [
            self.opt_update_files, self.opt_update_json, self.opt_build_win,
            self.opt_build_msi, self.opt_build_msix, self.opt_build_linux, self.opt_installer,
            self.opt_publish_git, self.opt_send_email
        ]
        active = sum(1 for s in switches if s.get())
        if hasattr(self, 'lbl_stages_summary'):
            self.lbl_stages_summary.configure(text=f'{active} of {len(switches)} stages enabled')

    # ── Main Tab Frames ───────────────────────────────────────────────────────
    def _build_tab_frames(self):
        self.tab_container = ctk.CTkFrame(self, fg_color=C_CANVAS, corner_radius=0)
        self.tab_container.pack(fill='both', expand=True, padx=18, pady=(4, 6))

        # Create Tab Frames
        self.frames = {
            self.tab_names[0]: ctk.CTkFrame(self.tab_container, fg_color='transparent'),
            self.tab_names[1]: ctk.CTkFrame(self.tab_container, fg_color='transparent'),
            self.tab_names[2]: ctk.CTkFrame(self.tab_container, fg_color='transparent'),
            self.tab_names[3]: ctk.CTkFrame(self.tab_container, fg_color='transparent'),
        }

        self._build_tab_pipeline(self.frames[self.tab_names[0]])
        self._build_tab_notes(self.frames[self.tab_names[1]])
        self._build_tab_email(self.frames[self.tab_names[2]])
        self._build_tab_settings(self.frames[self.tab_names[3]])

        # Display first tab by default
        self.current_tab_name = self.tab_names[0]
        self.frames[self.current_tab_name].pack(fill='both', expand=True)

    def _on_tab_change(self, selected_name):
        if selected_name == self.current_tab_name:
            return
        if self.current_tab_name in self.frames:
            self.frames[self.current_tab_name].pack_forget()
        self.current_tab_name = selected_name
        if self.current_tab_name in self.frames:
            self.frames[self.current_tab_name].pack(fill='both', expand=True)

    # ── TAB 1: Pipeline & Console ─────────────────────────────────────────────
    def _build_tab_pipeline(self, parent):
        # 1. Pipeline Configuration Card
        cfg_card = ctk.CTkFrame(parent, corner_radius=12, fg_color=C_CARD,
                                border_width=1, border_color=C_BORDER)
        cfg_card.pack(fill='x', pady=(0, 10))

        # Row 1: Target Version Controls & Quick Bumps
        r1 = ctk.CTkFrame(cfg_card, fg_color='transparent')
        r1.pack(fill='x', padx=16, pady=(12, 8))

        ctk.CTkLabel(r1, text='Current Version:', font=(FONT_NAME, 11, 'bold'),
                     text_color=C_TEXT_MUTED).pack(side='left', padx=(0, 6))

        self.lbl_cur_ver = ctk.CTkLabel(
            r1, text=f'v{self.current_version}', font=(FONT_MONO_NAME, 11, 'bold'),
            fg_color=C_CARD_ALT, text_color=C_PRIMARY, corner_radius=6, padx=8, pady=3
        )
        self.lbl_cur_ver.pack(side='left', padx=(0, 20))

        ctk.CTkLabel(r1, text='Next Target Version:', font=(FONT_NAME, 11, 'bold'),
                     text_color=C_TEXT_MAIN).pack(side='left', padx=(0, 8))

        self.ver_entry = ctk.CTkEntry(
            r1, width=130, font=(FONT_MONO_NAME, 12, 'bold'), corner_radius=8,
            border_width=1, border_color=C_BORDER_SUB, fg_color=C_CARD, text_color=C_TEXT_MAIN, height=32
        )
        self.ver_entry.insert(0, self.suggested_version)
        self.ver_entry.pack(side='left', padx=(0, 8))
        self.ver_entry.bind('<KeyRelease>', lambda e: self._on_version_typed())

        ctk.CTkButton(
            r1, text='⚡ Suggested', command=self._apply_suggested,
            corner_radius=7, height=32, width=95, fg_color=C_CARD_ALT, hover_color='#E2E8F0',
            text_color=C_PRIMARY, border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 10, 'bold')
        ).pack(side='left', padx=(0, 5))

        ctk.CTkButton(
            r1, text='+ Patch', command=self._bump_patch,
            corner_radius=7, height=32, width=70, fg_color=C_CARD_ALT, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 10, 'bold')
        ).pack(side='left', padx=(0, 5))

        ctk.CTkButton(
            r1, text='+ Minor', command=self._bump_minor,
            corner_radius=7, height=32, width=70, fg_color=C_CARD_ALT, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 10, 'bold')
        ).pack(side='left')

        # Row 2: Pipeline Stage Switches
        r2 = ctk.CTkFrame(cfg_card, fg_color='transparent')
        r2.pack(fill='x', padx=16, pady=(0, 12))

        ctk.CTkLabel(r2, text='Active Stages:', font=(FONT_NAME, 10, 'bold'),
                     text_color=C_TEXT_MUTED).pack(side='left', padx=(0, 12))

        sw_defs = [
            ('Files', self.opt_update_files),
            ('Manifests', self.opt_update_json),
            ('Windows (.exe)', self.opt_build_win),
            ('Windows (.msi)', self.opt_build_msi),
            ('Windows Store (.msix)', self.opt_build_msix),
            ('Linux (.AppImage)', self.opt_build_linux),
            ('Setup Installer', self.opt_installer),
            ('GitHub Publish', self.opt_publish_git),
            ('Email Broadcast', self.opt_send_email),
        ]
        for text, var in sw_defs:
            sw = ctk.CTkSwitch(
                r2, text=text, variable=var, font=(FONT_NAME, 10, 'bold'),
                progress_color=C_PRIMARY, button_color='#FFFFFF',
                button_hover_color='#EFF6FF', text_color=C_TEXT_MAIN,
                command=self._update_stages_summary
            )
            sw.pack(side='left', padx=6)

        # 2. Live Full-Height Terminal Console
        console_box = ctk.CTkFrame(parent, corner_radius=12, fg_color='#0B0F19',
                                  border_width=1, border_color='#1E293B')
        console_box.pack(fill='both', expand=True)

        bar = ctk.CTkFrame(console_box, corner_radius=8, fg_color='#161B22', height=36)
        bar.pack(fill='x', padx=8, pady=(8, 4))

        ctk.CTkLabel(bar, text='>_  BUILD & RELEASE EXECUTION CONSOLE',
                     font=(FONT_MONO_NAME, 10, 'bold'), text_color='#E2E8F0').pack(side='left', padx=10)

        ctk.CTkButton(
            bar, text='🧹 Clear Console', command=self._clear_console,
            corner_radius=6, height=26, fg_color='#1E293B', hover_color='#334155',
            text_color='#E2E8F0', font=(FONT_NAME, 9, 'bold')
        ).pack(side='right', padx=(4, 8))

        ctk.CTkButton(
            bar, text='📋 Copy Logs', command=self._copy_console,
            corner_radius=6, height=26, fg_color='#1E293B', hover_color='#334155',
            text_color='#E2E8F0', font=(FONT_NAME, 9, 'bold')
        ).pack(side='right')

        # Large Monospace Terminal Text Window
        self.txt_console = ctk.CTkTextbox(
            console_box, fg_color='#0B0F19', text_color='#F1F5F9', font=(FONT_MONO_NAME, 11),
            corner_radius=8
        )
        self.txt_console.pack(fill='both', expand=True, padx=8, pady=(0, 8))

        tags = [
            ('accent', '#38BDF8'),
            ('green',  '#4ADE80'),
            ('red',    '#F87171'),
            ('yellow', '#FBBF24'),
            ('blue',   '#60A5FA'),
            ('purple', '#C084FC'),
            ('cyan',   '#22D3EE'),
            ('white',  '#F1F5F9'),
            ('dim',    '#64748B'),
        ]
        for tag, color in tags:
            self.txt_console.tag_config(tag, foreground=color)

        plat = 'Linux' if IS_LINUX else ('Windows' if IS_WIN else 'Unix')
        self._log('═' * 70, 'dim')
        self._log('  ◈ UNI DESK CROSS-PLATFORM RELEASE STUDIO', 'accent')
        self._log(f'  ◈ Platform Host: {plat} | Active Project Version: v{self.current_version}', 'dim')
        self._log('  ◈ Ready for multi-target compilation (Windows .exe + Linux AppImage)', 'dim')
        self._log('═' * 70, 'dim')
        self._log('', 'white')

    def _on_version_typed(self):
        val = self.ver_entry.get().strip()
        v = sanitize_semver(val)
        if hasattr(self, 'lbl_target_pill'):
            self.lbl_target_pill.configure(text=f'🎯 Target: v{v}')
        self._update_email_subject()

    def _bump_patch(self):
        cur = sanitize_semver(self.ver_entry.get().strip() or self.current_version)
        parts = cur.split('.')
        try:
            parts[-1] = str(int(parts[-1]) + 1)
            new_v = '.'.join(parts)
        except Exception:
            new_v = compute_next_version(cur)
        self.ver_entry.delete(0, 'end')
        self.ver_entry.insert(0, new_v)
        self._on_version_typed()

    def _bump_minor(self):
        cur = sanitize_semver(self.ver_entry.get().strip() or self.current_version)
        parts = cur.split('.')
        try:
            if len(parts) >= 2:
                parts[1] = str(int(parts[1]) + 1)
                parts[2] = '0'
                new_v = '.'.join(parts[:3])
            else:
                new_v = compute_next_version(cur)
        except Exception:
            new_v = compute_next_version(cur)
        self.ver_entry.delete(0, 'end')
        self.ver_entry.insert(0, new_v)
        self._on_version_typed()

    # ── TAB 2: Release Notes & Changelog ──────────────────────────────────────
    def _build_tab_notes(self, parent):
        notes_card = ctk.CTkFrame(parent, corner_radius=12, fg_color=C_CARD,
                                  border_width=1, border_color=C_BORDER)
        notes_card.pack(fill='both', expand=True)

        # Header toolbar
        notes_hdr = ctk.CTkFrame(notes_card, corner_radius=8, fg_color=C_CARD_ALT, height=44)
        notes_hdr.pack(fill='x', padx=12, pady=(10, 8))

        left_hdr = ctk.CTkFrame(notes_hdr, fg_color='transparent')
        left_hdr.pack(side='left', padx=10)

        ctk.CTkLabel(left_hdr, text='📝  Release Notes & Changelog Composition',
                     font=(FONT_NAME, 12, 'bold'), text_color=C_TEXT_MAIN).pack(side='left')

        badge = ctk.CTkFrame(left_hdr, corner_radius=6, fg_color='#EFF6FF',
                             border_width=1, border_color='#BFDBFE')
        badge.pack(side='left', padx=(8, 0))
        ctk.CTkLabel(badge, text='GITHUB & EMAIL COMPOSER', font=(FONT_NAME, 8, 'bold'),
                     text_color=C_PRIMARY).pack(padx=7, pady=2)

        # Right action toolbar
        ctk.CTkButton(
            notes_hdr, text='💾 Save Notes', command=self._save_to_file,
            corner_radius=7, height=30, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOV,
            text_color='#FFFFFF', font=(FONT_NAME, 10, 'bold')
        ).pack(side='right', padx=(4, 10))

        ctk.CTkButton(
            notes_hdr, text='✨ Auto-Compile Changelog', command=self._auto_compile_changelog,
            corner_radius=7, height=30, fg_color=C_PURPLE, hover_color='#6D28D9',
            text_color='#FFFFFF', font=(FONT_NAME, 10, 'bold')
        ).pack(side='right', padx=4)

        ctk.CTkButton(
            notes_hdr, text='🧹 Format Bullets', command=self._format_and_normalize_all,
            corner_radius=7, height=30, fg_color=C_CARD, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 10, 'bold')
        ).pack(side='right', padx=4)

        ctk.CTkButton(
            notes_hdr, text='📋 Markdown Preview', command=self._preview_changelog_modal,
            corner_radius=7, height=30, fg_color=C_CARD, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 10, 'bold')
        ).pack(side='right', padx=4)

        ctk.CTkButton(
            notes_hdr, text='📂 Reload File', command=self._load_from_file,
            corner_radius=7, height=30, fg_color=C_CARD, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 10, 'bold')
        ).pack(side='right', padx=4)

        # 2x2 Grid of roomy elevated cards
        rn_grid = ctk.CTkFrame(notes_card, fg_color='transparent')
        rn_grid.pack(fill='both', expand=True, padx=12, pady=(0, 12))
        rn_grid.columnconfigure(0, weight=1)
        rn_grid.columnconfigure(1, weight=1)
        rn_grid.rowconfigure(0, weight=1)
        rn_grid.rowconfigure(1, weight=1)

        def make_section(row, col, title, icon, accent_color, badge_text, badge_bg, badge_fg, hint_text):
            pad_x = (0, 6) if col == 0 else (6, 0)
            box = ctk.CTkFrame(rn_grid, fg_color=C_CARD, corner_radius=10,
                               border_width=1, border_color=C_BORDER)
            box.grid(row=row, column=col, sticky='nsew', padx=pad_x, pady=6)

            hdr = ctk.CTkFrame(box, fg_color=C_CARD_ALT, corner_radius=8, height=34)
            hdr.pack(fill='x', padx=8, pady=(8, 6))

            ctk.CTkLabel(hdr, text=f'{icon}  {title}', font=(FONT_NAME, 11, 'bold'),
                         text_color=accent_color).pack(side='left', padx=(8, 6))

            p_badge = ctk.CTkFrame(hdr, corner_radius=5, fg_color=badge_bg)
            p_badge.pack(side='left')
            ctk.CTkLabel(p_badge, text=badge_text, font=(FONT_NAME, 8, 'bold'),
                         text_color=badge_fg).pack(padx=6, pady=1)

            ctk.CTkLabel(hdr, text=hint_text, font=(FONT_NAME, 9),
                         text_color=C_TEXT_MUTED).pack(side='left', padx=8)

            txt = ctk.CTkTextbox(
                box, corner_radius=8, border_width=1,
                border_color=C_BORDER_SUB, fg_color='#FCFDFF', text_color=C_TEXT_MAIN,
                font=(FONT_NAME, 11), wrap='word'
            )
            txt.pack(fill='both', expand=True, padx=8, pady=(0, 8))

            ctk.CTkButton(
                hdr, text='+ Bullet', command=lambda t=txt: self._insert_bullet(t),
                corner_radius=5, height=22, width=64, fg_color=C_CARD, hover_color='#E2E8F0',
                text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
                font=(FONT_NAME, 9, 'bold')
            ).pack(side='right', padx=6)

            self._bind_smart_bullets(txt)
            return txt

        self.txt_whats_new     = make_section(0, 0, "What's New", '🚀', C_PRIMARY, 'FEATURES', '#EFF6FF', C_PRIMARY, 'Key user-facing features & additions')
        self.txt_bugs_fixed    = make_section(0, 1, 'Bug Fixes', '🐛', C_RED, 'FIXES', '#FEF2F2', C_RED, 'Resolved issues & stability patches')
        self.txt_improvements  = make_section(1, 0, 'Improvements', '⚡', C_GREEN, 'POLISH', '#ECFDF5', C_GREEN, 'Optimizations & UX refinements')
        self.txt_release_notes = make_section(1, 1, 'Full Changelog', '📜', C_PURPLE, 'MARKDOWN', '#F5F3FF', C_PURPLE, 'Unified summary published to GitHub Release')

    def _insert_bullet(self, txt_widget):
        txt_widget.insert('insert', '• ')
        txt_widget.focus_set()

    def _bind_smart_bullets(self, txt_widget):
        def _on_enter(event):
            try:
                line_idx = txt_widget.index('insert linestart')
                line = txt_widget.get(line_idx, 'insert')
                stripped = line.strip()
                if stripped.startswith(('•', '-', '*')):
                    # If empty bullet line, remove it so user exits list cleanly
                    if stripped in ('•', '-', '*'):
                        txt_widget.delete(line_idx, 'insert lineend')
                        return 'break'
                    txt_widget.insert('insert', '\n• ')
                    return 'break'
            except Exception:
                pass
            return None

        txt_widget.bind('<Return>', _on_enter)

    def _auto_compile_changelog(self):
        wn = self.txt_whats_new.get('1.0', 'end').strip()
        bf = self.txt_bugs_fixed.get('1.0', 'end').strip()
        imp = self.txt_improvements.get('1.0', 'end').strip()

        sections = []
        if wn:
            sections.append(f"### 🚀 What's New\n{wn}")
        if bf:
            sections.append(f"### 🐛 Bug Fixes\n{bf}")
        if imp:
            sections.append(f"### ⚡ Improvements\n{imp}")

        compiled = '\n\n'.join(sections) if sections else ''
        if not compiled:
            messagebox.showinfo('Auto-Compile', 'Fill in What\'s New, Bug Fixes, or Improvements first.')
            return

        self.txt_release_notes.delete('1.0', 'end')
        self.txt_release_notes.insert('end', compiled)
        self._log('[Release Notes] Unified Full Changelog compiled automatically from sections.', 'green')
        messagebox.showinfo('Compiled', 'Full Changelog synthesized from What\'s New, Bug Fixes, and Improvements!')

    def _format_and_normalize_all(self):
        for w in [self.txt_whats_new, self.txt_bugs_fixed, self.txt_improvements, self.txt_release_notes]:
            raw = w.get('1.0', 'end')
            lines = raw.split('\n')
            cleaned = []
            for l in lines:
                s = l.strip()
                if not s:
                    continue
                if s.startswith(('-', '*', '•')):
                    content = s.lstrip('-*• ').strip()
                    cleaned.append(f'• {content}')
                elif s.startswith('#'):
                    cleaned.append(s)
                else:
                    cleaned.append(f'• {s}')
            w.delete('1.0', 'end')
            w.insert('end', '\n'.join(cleaned))
        self._log('[Release Notes] Bullets formatted and normalized across all sections.', 'cyan')

    def _preview_changelog_modal(self):
        ver = sanitize_semver(self.ver_entry.get().strip()) or self.suggested_version
        wn = self.txt_whats_new.get('1.0', 'end').strip()
        bf = self.txt_bugs_fixed.get('1.0', 'end').strip()
        imp = self.txt_improvements.get('1.0', 'end').strip()
        rn = self.txt_release_notes.get('1.0', 'end').strip()

        md_body = generate_github_markdown(ver, wn, bf, imp, rn, {})

        modal = ctk.CTkToplevel(self)
        modal.title(f'Formatted Markdown Changelog Preview -- v{ver}')
        modal.geometry('780x580')
        modal.minsize(680, 480)
        modal.transient(self)
        modal.grab_set()

        hdr = ctk.CTkFrame(modal, fg_color=C_CARD_ALT, corner_radius=0, height=44)
        hdr.pack(fill='x')
        ctk.CTkLabel(hdr, text=f'📋 Formatted GitHub Markdown Preview  (v{ver})',
                     font=(FONT_NAME, 12, 'bold'), text_color=C_TEXT_MAIN).pack(side='left', padx=16)

        ctk.CTkButton(
            hdr, text='👁 Open HTML Email Preview', command=self._preview_email,
            corner_radius=7, height=28, fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOV,
            text_color='#FFFFFF', font=(FONT_NAME, 10, 'bold')
        ).pack(side='right', padx=16)

        txt = ctk.CTkTextbox(modal, font=(FONT_MONO_NAME, 11), fg_color=C_CARD, text_color=C_TEXT_MAIN)
        txt.pack(fill='both', expand=True, padx=16, pady=12)
        txt.insert('end', md_body)
        txt.configure(state='disabled')

    # ── TAB 3: Email Broadcast ────────────────────────────────────────────────
    def _build_tab_email(self, parent):
        scroll = ctk.CTkScrollableFrame(parent, fg_color='transparent', corner_radius=0)
        scroll.pack(fill='both', expand=True)

        # Subject Line Card
        subj_card = ctk.CTkFrame(scroll, corner_radius=12, fg_color=C_CARD,
                                 border_width=1, border_color=C_BORDER)
        subj_card.pack(fill='x', pady=(0, 12))

        ctk.CTkLabel(subj_card, text='✉️  Notification Subject Line', font=(FONT_NAME, 12, 'bold'),
                     text_color=C_TEXT_MAIN).pack(anchor='w', padx=16, pady=(14, 6))

        self.email_subj_entry = ctk.CTkEntry(
            subj_card, font=(FONT_NAME, 11), corner_radius=8,
            border_width=1, border_color=C_BORDER_SUB, fg_color=C_CARD,
            text_color=C_TEXT_MAIN, height=36
        )
        self.email_subj_entry.pack(fill='x', padx=16, pady=(0, 10))

        # Clients Card
        cli_card = ctk.CTkFrame(scroll, corner_radius=12, fg_color=C_CARD,
                                border_width=1, border_color=C_BORDER)
        cli_card.pack(fill='x', pady=(0, 12))

        cli_top = ctk.CTkFrame(cli_card, fg_color='transparent')
        cli_top.pack(fill='x', padx=16, pady=12)

        ctk.CTkLabel(cli_top, text='👥  Client Distribution Management', font=(FONT_NAME, 12, 'bold'),
                     text_color=C_TEXT_MAIN).pack(side='left')

        self.lbl_clients = ctk.CTkLabel(
            cli_top, text='👥 Clients: --', font=(FONT_NAME, 10, 'bold'),
            fg_color=C_CARD_ALT, text_color=C_TEXT_MUTED, corner_radius=8,
            padx=10, pady=5
        )
        self.lbl_clients.pack(side='left', padx=12)

        ctk.CTkButton(
            cli_top, text='Fetch Clients', command=self._fetch_clients, corner_radius=7,
            height=32, fg_color=C_CARD_ALT, hover_color='#E2E8F0', text_color='#334155',
            border_width=1, border_color=C_BORDER_SUB, font=(FONT_NAME, 10, 'bold')
        ).pack(side='right')

        # Broadcast Actions Card
        act_card = ctk.CTkFrame(scroll, corner_radius=12, fg_color=C_CARD,
                                border_width=1, border_color=C_BORDER)
        act_card.pack(fill='x', pady=(0, 12))

        ctk.CTkLabel(act_card, text='🚀  Broadcast Actions & Webhook Configuration', font=(FONT_NAME, 12, 'bold'),
                     text_color=C_TEXT_MAIN).pack(anchor='w', padx=16, pady=(14, 10))

        act_row = ctk.CTkFrame(act_card, fg_color='transparent')
        act_row.pack(fill='x', padx=16, pady=(0, 16))

        ctk.CTkButton(
            act_row, text='👁 Preview HTML in Browser', command=self._preview_email, corner_radius=8,
            height=36, fg_color=C_CARD_ALT, hover_color='#E2E8F0', text_color='#334155',
            border_width=1, border_color=C_BORDER_SUB, font=(FONT_NAME, 11, 'bold')
        ).pack(side='left', padx=(0, 8))

        ctk.CTkButton(
            act_row, text='✉ Send Test Email to Developer', command=self._test_email, corner_radius=8,
            height=36, fg_color=C_CARD_ALT, hover_color='#E2E8F0', text_color='#334155',
            border_width=1, border_color=C_BORDER_SUB, font=(FONT_NAME, 11, 'bold')
        ).pack(side='left', padx=(0, 8))

        ctk.CTkButton(
            act_row, text='⚙ Configure Webhook URL', command=self._config_webhook, corner_radius=8,
            height=36, fg_color=C_CARD_ALT, hover_color='#E2E8F0', text_color='#334155',
            border_width=1, border_color=C_BORDER_SUB, font=(FONT_NAME, 11, 'bold')
        ).pack(side='left')

    # ── TAB 4: Settings & Diagnostics ─────────────────────────────────────────
    def _build_tab_settings(self, parent):
        scroll = ctk.CTkScrollableFrame(parent, fg_color='transparent', corner_radius=0)
        scroll.pack(fill='both', expand=True)

        # 1. GitHub Token Card
        gh_card = ctk.CTkFrame(scroll, corner_radius=12, fg_color=C_CARD,
                               border_width=1, border_color=C_BORDER)
        gh_card.pack(fill='x', pady=(0, 12))

        ctk.CTkLabel(gh_card, text='🐙  GitHub Authentication & Repository', font=(FONT_NAME, 12, 'bold'),
                     text_color=C_TEXT_MAIN).pack(anchor='w', padx=16, pady=(14, 6))

        r_repo = ctk.CTkFrame(gh_card, fg_color='transparent')
        r_repo.pack(fill='x', padx=16, pady=(0, 10))

        ctk.CTkLabel(r_repo, text='Target Repository:', font=(FONT_NAME, 11, 'bold'),
                     text_color=C_TEXT_MUTED).pack(side='left', padx=(0, 8))
        repo_name = os.environ.get('GITHUB_REPO', 'BSFrameWorks5253/onetap-workstation')
        ctk.CTkLabel(r_repo, text=repo_name, font=(FONT_MONO_NAME, 11, 'bold'),
                     fg_color=C_CARD_ALT, text_color=C_PRIMARY, corner_radius=6, padx=8, pady=3).pack(side='left')

        r_tok = ctk.CTkFrame(gh_card, fg_color='transparent')
        r_tok.pack(fill='x', padx=16, pady=(0, 14))

        ctk.CTkLabel(r_tok, text='Personal Access Token:', font=(FONT_NAME, 11, 'bold'),
                     text_color=C_TEXT_MUTED).pack(side='left', padx=(0, 8))

        self.tok_entry = ctk.CTkEntry(
            r_tok, width=380, show='•', font=(FONT_MONO_NAME, 11), corner_radius=8,
            border_width=1, border_color=C_BORDER_SUB, fg_color=C_CARD, text_color=C_TEXT_MAIN, height=34
        )
        cur_tok = os.environ.get('GITHUB_TOKEN', '')
        if cur_tok and 'your_github_token' not in cur_tok:
            self.tok_entry.insert(0, cur_tok)
        self.tok_entry.pack(side='left', padx=(0, 8))

        self.btn_toggle_tok = ctk.CTkButton(
            r_tok, text='👁 Show', command=self._toggle_token_visibility,
            corner_radius=8, height=34, width=76, fg_color=C_CARD_ALT, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 10, 'bold')
        )
        self.btn_toggle_tok.pack(side='left', padx=(0, 8))

        ctk.CTkButton(
            r_tok, text='💾 Save Token to .env', command=self._save_token,
            corner_radius=8, height=34, fg_color=C_GREEN, hover_color='#047857',
            text_color='#FFFFFF', font=(FONT_NAME, 10, 'bold')
        ).pack(side='left')

        # 2. Detailed System Toolchain Diagnostics Card
        self.diag_details_card = ctk.CTkFrame(scroll, corner_radius=12, fg_color=C_CARD,
                                             border_width=1, border_color=C_BORDER)
        self.diag_details_card.pack(fill='x', pady=(0, 12))
        self._render_settings_diagnostics()

    def _render_settings_diagnostics(self):
        for w in self.diag_details_card.winfo_children():
            w.destroy()

        hdr = ctk.CTkFrame(self.diag_details_card, fg_color='transparent')
        hdr.pack(fill='x', padx=16, pady=(14, 8))

        ctk.CTkLabel(hdr, text='🛠  Toolchain & Environment Diagnostics', font=(FONT_NAME, 12, 'bold'),
                     text_color=C_TEXT_MAIN).pack(side='left')

        ctk.CTkButton(
            hdr, text='🔄 Re-scan System', command=self._refresh_diagnostics,
            corner_radius=7, height=30, fg_color=C_CARD_ALT, hover_color='#E2E8F0',
            text_color='#334155', border_width=1, border_color=C_BORDER_SUB,
            font=(FONT_NAME, 10, 'bold')
        ).pack(side='right')

        rows_box = ctk.CTkFrame(self.diag_details_card, fg_color='transparent')
        rows_box.pack(fill='x', padx=16, pady=(0, 14))

        deps = check_dependencies()
        makensis_path = get_makensis_path() or 'Not found'
        iscc_path = get_iscc_path() or 'Not found'

        items = [
            ('Node.js Runtime', deps.get('node', (False, ''))[1], deps.get('node', (False, ''))[0]),
            ('NPM Package Manager', deps.get('npm', (False, ''))[1], deps.get('npm', (False, ''))[0]),
            ('Git Version Control', deps.get('git', (False, ''))[1], deps.get('git', (False, ''))[0]),
            ('NSIS Installer (makensis)', f"{deps.get('makensis', (False, ''))[1]}  •  {makensis_path}", deps.get('makensis', (False, ''))[0]),
            ('Inno Setup Compiler', f"{deps.get('iscc', (False, ''))[1]}  •  {iscc_path}", deps.get('iscc', (False, ''))[0]),
            ('Wine Linux Emulation', deps.get('wine', (False, ''))[1], deps.get('wine', (False, ''))[0]),
            ('Python Interpreter', sys.executable, True),
        ]

        for label, val, is_ok in items:
            row = ctk.CTkFrame(rows_box, fg_color='transparent')
            row.pack(fill='x', pady=3)

            dot_color = C_GREEN if is_ok else C_AMBER
            dot_symbol = '●' if is_ok else '▲'
            ctk.CTkLabel(row, text=f'{dot_symbol} {label}:', font=(FONT_NAME, 10, 'bold'),
                         text_color=dot_color, width=170, anchor='w').pack(side='left')

            ctk.CTkLabel(row, text=str(val), font=(FONT_MONO_NAME, 10),
                         text_color=C_TEXT_MAIN, anchor='w').pack(side='left', fill='x', expand=True)

    # ── Token Visibility Toggle ───────────────────────────────────────────────
    def _toggle_token_visibility(self):
        self._token_visible = not self._token_visible
        if self._token_visible:
            self.tok_entry.configure(show='')
            self.btn_toggle_tok.configure(text='🙈 Hide')
        else:
            self.tok_entry.configure(show='•')
            self.btn_toggle_tok.configure(text='👁 Show')

    # ── Folder Open Helper ────────────────────────────────────────────────────
    def _open_dist_folder(self):
        target = sanitize_semver(self.ver_entry.get().strip()) if hasattr(self, 'ver_entry') else self.current_version
        folder = os.path.abspath(os.path.join('release', target))
        if not os.path.exists(folder):
            folder = os.path.abspath('release')
        if not os.path.exists(folder):
            os.makedirs(folder, exist_ok=True)
        try:
            if IS_WIN:
                os.startfile(folder)
            elif IS_LINUX:
                subprocess.Popen(['xdg-open', folder])
            else:
                subprocess.Popen(['open', folder])
        except Exception:
            messagebox.showinfo('Release Folder', f'Release folder path:\n{folder}')

    # ── Compile Studio Standalone .exe Helper ─────────────────────────────────
    def _compile_studio_exe(self):
        """Compiles make_exe_cross.py into a standalone executable with custom icon."""
        if self.is_building:
            messagebox.showwarning('Studio Busy', 'Pipeline is currently executing. Wait for it to complete.')
            return

        icon_path = os.path.abspath('resources/icon.ico')
        if not os.path.exists(icon_path):
            messagebox.showerror('Icon Missing', f'Could not find icon file at:\n{icon_path}')
            return

        msg = (
            "Compile UniDesk Release Studio (this management tool) into a standalone .exe?\n\n"
            f"• Output Name: UniDeskStudio.exe\n"
            f"• Custom Icon: {icon_path}\n"
            f"• Target Folder: dist/UniDeskStudio/\n\n"
            "💡 NOTE: To build the actual Uni Desk application (.exe & .msi) for users, click the blue button '🚀 START RELEASE PIPELINE' at the bottom right instead!\n\n"
            "Proceed with compiling the Studio tool executable?"
        )
        if not messagebox.askyesno('Compile Studio Executable', msg):
            return

        self._log('\n' + '─' * 60, 'purple')
        self._log('  🔨 COMPILING UNIDESK STUDIO STANDALONE EXECUTABLE', 'purple')
        self._log(f'  • Custom Icon: {icon_path}', 'cyan')
        self._log('─' * 60, 'purple')

        def _worker():
            target_script = os.path.abspath(__file__)
            cmd = [
                sys.executable, '-m', 'PyInstaller',
                '--noconfirm',
                '--onedir',
                '--windowed',
                f'--icon={icon_path}',
                '--collect-all=customtkinter',
                '--name=UniDeskStudio',
                f'--distpath={os.path.join(ROOT_DIR, "dist")}',
                f'--workpath={os.path.join(ROOT_DIR, "build")}',
                f'--specpath={os.path.join(ROOT_DIR, "build")}',
                target_script
            ]
            self._log(f"[Build] Executing: {' '.join(cmd)}", 'dim')
            try:
                proc = subprocess.Popen(
                    cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    text=True, bufsize=1, encoding='utf-8', errors='replace',
                    cwd=ROOT_DIR
                )
                for line in proc.stdout:
                    l = line.strip()
                    if l:
                        self._log(f'  [PyInstaller] {l}', 'dim')
                proc.wait()
                if proc.returncode == 0:
                    exe_out = os.path.abspath(os.path.join(ROOT_DIR, 'dist', 'UniDeskStudio', 'UniDeskStudio.exe'))
                    self._log(f'\n✔ Standalone Studio compiled successfully!\n  Executable: {exe_out}\n', 'green')
                    self.after(0, lambda: messagebox.showinfo(
                        'Compilation Complete',
                        f'Standalone Studio successfully compiled with custom icon!\n\nPath:\n{exe_out}'
                    ))
                else:
                    self._log(f'[ERROR] PyInstaller exited with code {proc.returncode}', 'red')
                    self.after(0, lambda: messagebox.showerror('Compilation Error', 'PyInstaller compilation failed. Check console.'))
            except Exception as ex:
                self._log(f'[ERROR] Failed to launch PyInstaller: {ex}', 'red')
                self.after(0, lambda: messagebox.showerror('Error', str(ex)))

        threading.Thread(target=_worker, daemon=True).start()

    # ── Pulsing Status LED ────────────────────────────────────────────────────
    def _pulse_start(self):
        colors = [C_GREEN, '#10B981', '#34D399', '#10B981']
        self._pi = 0

        def _tick():
            if not self.is_building:
                self.lbl_status.configure(text_color=colors[self._pi % len(colors)])
                self._pi += 1
            self.after(500, _tick)

        _tick()

    def _set_status(self, text: str, color: str = C_GREEN):
        def _u():
            self.lbl_status.configure(text=f'● {text}', text_color=color)
        self.after(0, _u)

    # ── Console Operations ────────────────────────────────────────────────────
    def _log(self, msg: str, tag: str = 'white'):
        def _a():
            ts = datetime.now().strftime('%H:%M:%S')
            prefix = f'[{ts}]  ' if msg and not msg.startswith(('═', '─', '  ◈')) else ''
            self.txt_console.insert('end', prefix + msg + '\n', tag)
            self.txt_console.see('end')
        self.after(0, _a)

    def _log_fn(self, msg: str):
        tag = 'white'
        ml = msg.lower()
        if any(k in ml for k in ('[success]', '[updated]', 'ok]', 'complete')):
            tag = 'green'
        elif any(k in ml for k in ('[error]', 'failed')):
            tag = 'red'
        elif any(k in ml for k in ('[warning]', '[warn]')):
            tag = 'yellow'
        elif any(k in ml for k in ('[github]', '[email]')):
            tag = 'cyan'
        elif any(k in ml for k in ('[version]', '[build]', '[installer]')):
            tag = 'accent'
        elif any(k in ml for k in ('checksum', 'sha-256')):
            tag = 'purple'
        elif '-' * 8 in msg or '=' * 8 in msg:
            tag = 'dim'
        self._log(msg, tag)

    def _clear_console(self):
        self.txt_console.delete('1.0', 'end')

    def _copy_console(self):
        txt = self.txt_console.get('1.0', 'end').strip()
        if txt:
            self.clipboard_clear()
            self.clipboard_append(txt)
            messagebox.showinfo('Copied', 'Terminal logs copied to clipboard!')

    # ── Version Helpers ───────────────────────────────────────────────────────
    def _apply_suggested(self):
        self.current_version = get_current_version()
        self.suggested_version = compute_next_version(self.current_version)
        self.lbl_cur_ver.configure(text=f'v{self.current_version}')
        self.lbl_ver_badge.configure(text=f'v{self.current_version}')
        self.ver_entry.delete(0, 'end')
        self.ver_entry.insert(0, self.suggested_version)
        self._on_version_typed()

    def _update_email_subject(self):
        ver = sanitize_semver(self.ver_entry.get().strip()) or self.suggested_version
        subj = f"Important Workstation Update: Uni Desk v{ver} Released -- What's New & Enhancements"
        self.email_subj_entry.delete(0, 'end')
        self.email_subj_entry.insert(0, subj)

    def _save_token(self):
        val = self.tok_entry.get().strip()
        if not val:
            messagebox.showwarning('Token', 'Token field is empty.')
            return
        save_github_token(val)
        self._log('[Config] GitHub Token saved to .env', 'green')
        messagebox.showinfo('Token Saved', 'GitHub Token saved to .env successfully!')

    # ── Release Notes File I/O ────────────────────────────────────────────────
    def _load_from_file(self):
        data = read_release_notes_file('release_notes.txt')
        fv = data.get('version', '').strip()
        self.ver_entry.delete(0, 'end')
        self.ver_entry.insert(0, fv if fv else self.suggested_version)
        for k, w in [('whats_new', self.txt_whats_new), ('bugs_fixed', self.txt_bugs_fixed),
                     ('improvements', self.txt_improvements), ('release_notes', self.txt_release_notes)]:
            w.delete('1.0', 'end')
            w.insert('end', data.get(k, ''))
        self._on_version_typed()
        self._log('[File] Loaded configuration from release_notes.txt', 'cyan')

    def _save_to_file(self):
        write_release_notes_file({
            'version':       self.ver_entry.get().strip(),
            'whats_new':     self.txt_whats_new.get('1.0', 'end').strip(),
            'bugs_fixed':    self.txt_bugs_fixed.get('1.0', 'end').strip(),
            'improvements':  self.txt_improvements.get('1.0', 'end').strip(),
            'release_notes': self.txt_release_notes.get('1.0', 'end').strip(),
        })
        self._log('[File] Configuration saved to release_notes.txt', 'green')
        messagebox.showinfo('Saved', 'Saved release notes successfully!')

    # ── Email Broadcast Subsystem ─────────────────────────────────────────────
    def _get_webhook(self) -> str:
        return os.environ.get('CLIENT_NOTIFICATION_WEBHOOK_URL', DEFAULT_WEBHOOK).strip()

    def _fetch_clients(self):
        self.lbl_clients.configure(text='👥 Fetching...', text_color=C_AMBER)
        def _bg():
            clients = fetch_google_clients(self._get_webhook())
            def _ui():
                if clients:
                    self.lbl_clients.configure(text=f'👥 {len(clients)} Clients', text_color=C_GREEN)
                    self._log(f'[Email] {len(clients)} registered broadcast client(s) found:', 'green')
                    for c in clients:
                        self._log(f"  • {c.get('name','?')} <{c.get('email','')}>", 'dim')
                else:
                    self.lbl_clients.configure(text='👥 0 Clients', text_color=C_RED)
                    self._log('[Email] No clients found from webhook.', 'yellow')
            self.after(0, _ui)
        threading.Thread(target=_bg, daemon=True).start()

    def _email_data(self):
        return (sanitize_semver(self.ver_entry.get().strip()),
                self.txt_whats_new.get('1.0', 'end').strip(),
                self.txt_bugs_fixed.get('1.0', 'end').strip(),
                self.txt_improvements.get('1.0', 'end').strip(),
                self.txt_release_notes.get('1.0', 'end').strip())

    def _preview_email(self):
        ver, wn, bf, imp, rn = self._email_data()
        subj, html = generate_release_email(ver, wn, bf, imp, rn)
        c = self.email_subj_entry.get().strip()
        if c:
            subj = c
        try:
            pf = os.path.join(tempfile.gettempdir(), f'UniDesk_Preview_v{ver}.html')
            with open(pf, 'w', encoding='utf-8') as f:
                f.write(html)
            webbrowser.open(f'file://{os.path.abspath(pf)}')
            self._log(f'[Email] HTML preview opened in browser: {pf}', 'cyan')
        except Exception as e:
            messagebox.showerror('Preview Error', str(e))

    def _test_email(self):
        ver, wn, bf, imp, rn = self._email_data()
        subj, html = generate_release_email(ver, wn, bf, imp, rn)
        c = self.email_subj_entry.get().strip()
        if c:
            subj = c

        win = ctk.CTkToplevel(self)
        win.title('Send Test Release Email')
        win.geometry('480x180')
        win.resizable(False, False)
        win.transient(self)
        win.grab_set()

        ctk.CTkLabel(win, text='Test Email Recipient Address:', font=(FONT_NAME, 11, 'bold'),
                     text_color=C_TEXT_MAIN).pack(pady=(18, 6))
        e = ctk.CTkEntry(win, font=(FONT_NAME, 11), width=360, corner_radius=8,
                         border_width=1, border_color=C_BORDER_SUB)
        e.pack(pady=4)
        e.insert(0, 'sounasathburhan5252@gmail.com')
        e.focus()

        def _do():
            addr = e.get().strip()
            if not addr or '@' not in addr:
                messagebox.showwarning('Invalid', 'Please enter a valid email address.', parent=win)
                return
            win.destroy()
            self._log(f'[Email] Sending test notification email to {addr}...', 'cyan')
            def _bg():
                ok, sent, fail = send_email_broadcast(
                    self._get_webhook(), f'[TEST] {subj}', html,
                    [{'name': 'Test Engineer', 'email': addr}], self._log_fn
                )
                if ok:
                    self._log(f'[Email] Test email successfully delivered to {addr}', 'green')
                    self.after(0, lambda: messagebox.showinfo('Delivered', f'Test email delivered to {addr}!'))
                else:
                    self._log(f'[Email] Failed to deliver test email to {addr}', 'red')
            threading.Thread(target=_bg, daemon=True).start()

        ctk.CTkButton(win, text='Send Test Now', command=_do, corner_radius=8,
                      fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOV,
                      font=(FONT_NAME, 11, 'bold')).pack(pady=14)

    def _config_webhook(self):
        cur = self._get_webhook()
        win = ctk.CTkToplevel(self)
        win.title('Configure Client Notification Webhook')
        win.geometry('640x180')
        win.resizable(False, False)
        win.transient(self)
        win.grab_set()

        ctk.CTkLabel(win, text='Google Apps Script Notification Webhook URL:',
                     font=(FONT_NAME, 11, 'bold'), text_color=C_TEXT_MAIN).pack(pady=(18, 6))
        e = ctk.CTkEntry(win, font=(FONT_MONO_NAME, 10), width=560, corner_radius=8,
                         border_width=1, border_color=C_BORDER_SUB)
        e.pack(pady=4)
        e.insert(0, cur)

        def _save():
            new_u = e.get().strip()
            if not new_u:
                return
            save_env_key('CLIENT_NOTIFICATION_WEBHOOK_URL', new_u)
            win.destroy()
            self._log('[Config] Client Webhook URL updated in .env', 'green')

        ctk.CTkButton(win, text='Save Webhook URL', command=_save, corner_radius=8,
                      fg_color=C_PRIMARY, hover_color=C_PRIMARY_HOV,
                      font=(FONT_NAME, 11, 'bold')).pack(pady=14)

    # ── Release Pipeline Execution ────────────────────────────────────────────
    def _start_pipeline(self):
        if self.is_building:
            return
        target = sanitize_semver(self.ver_entry.get().strip())
        if not target:
            messagebox.showerror('Version Error', 'Please enter a valid target version (e.g. 26.9.24).')
            return
        self._save_to_file()
        self.is_building = True

        # Auto-switch to Pipeline tab so user sees live logs immediately
        self.nav_tabs.set(self.tab_names[0])
        self._on_tab_change(self.tab_names[0])

        self.btn_launch.configure(state='disabled', text='⏳  BUILDING PIPELINE...')
        self.prog_bar.pack(side='left', fill='x', expand=True, padx=(0, 12))
        self.prog_bar.start()
        self._set_status('Pipeline running...', C_AMBER)
        threading.Thread(target=self._run_pipeline, args=(target,), daemon=True).start()

    def _run_pipeline(self, target: str):
        t0 = time.time()
        current = get_current_version()
        wn  = self.txt_whats_new.get('1.0', 'end').strip()
        bf  = self.txt_bugs_fixed.get('1.0', 'end').strip()
        imp = self.txt_improvements.get('1.0', 'end').strip()
        rn  = self.txt_release_notes.get('1.0', 'end').strip()

        self._log('\n' + '═' * 66, 'accent')
        self._log(f'  🚀 STARTING PRODUCTION RELEASE PIPELINE v{target}', 'accent')
        self._log('═' * 66 + '\n', 'accent')

        # 1. Update version files
        if self.opt_update_files.get():
            self._set_status('Step 1/9: Updating version files...', C_AMBER)
            update_version_in_files(current, target, self._log_fn)
            write_version_txt(target, wn, rn, bf, imp, self._log_fn)

        # 2. Manifests
        if self.opt_update_json.get():
            self._set_status('Step 2/9: Updating changelog manifests...', C_AMBER)
            update_changelog_databases(target, wn, rn, bf, imp, self._log_fn)

        # 3. Windows build (.exe)
        if self.opt_build_win.get():
            self._set_status('Step 3/9: Building Windows binaries (.exe)...', C_AMBER)
            ok = build_windows(self._log_fn)
            if not ok:
                self._log('[ERROR] Windows compilation failed -- pipeline halted.', 'red')
                self._set_status('Windows build failed', C_RED)
                self._finish(False, target)
                return

        # 4. Windows MSI build (.msi)
        if self.opt_build_msi.get():
            self._set_status('Step 4/9: Building Windows MSI package (.msi)...', C_AMBER)
            ok = build_msi(self._log_fn)
            if not ok:
                self._log('[WARNING] MSI compilation encountered issues -- continuing.', 'yellow')

        # 5. Windows Store build (.msix)
        if self.opt_build_msix.get():
            self._set_status('Step 5/9: Building Windows Store package (.msix)...', C_AMBER)
            ok = build_msix(self._log_fn)
            if not ok:
                self._log('[WARNING] MSIX compilation encountered issues -- continuing.', 'yellow')

        # 6. Linux build
        if self.opt_build_linux.get():
            self._set_status('Step 6/9: Building Linux binaries (.AppImage)...', C_AMBER)
            ok = build_linux(self._log_fn)
            if not ok:
                self._log('[WARNING] Linux compilation encountered issues -- continuing.', 'yellow')

        # 7. Installer
        inno = None
        if self.opt_installer.get():
            self._set_status('Step 7/9: Compiling Setup installer...', C_AMBER)
            inno = compile_installer(target, self._log_fn)
            if inno and os.path.exists(inno):
                self._log(f'[Installer] Successfully generated installer: {inno}', 'green')

        # 8. Organize into Version-Wise Directory: release/<target>/
        self._set_status(f'Step 8/9: Organizing release/{target}/ archive...', C_AMBER)
        target_dir, arch_assets = organize_version_release_folder(target, self._log_fn)
        if inno and os.path.exists(inno):
            dest_inno = os.path.join(target_dir, os.path.basename(inno))
            try:
                if os.path.abspath(inno) != os.path.abspath(dest_inno):
                    shutil.copy2(inno, dest_inno)
                if dest_inno not in arch_assets:
                    arch_assets.append(dest_inno)
            except Exception:
                pass

        # Collect all final artifacts
        assets = list(arch_assets)
        for fp in find_all_release_assets(target):
            if fp not in assets and os.path.exists(fp):
                assets.append(fp)

        # 9. Publish to GitHub Releases
        if self.opt_publish_git.get():
            self._set_status('Step 9/9: Publishing to GitHub Releases...', C_AMBER)
            if assets:
                body = generate_github_markdown(target, wn, bf, imp, rn)
                pub_ok = upload_to_github(target, assets, body, self._log_fn)
                if not pub_ok:
                    self._log('[WARNING] GitHub release incomplete -- verify GITHUB_TOKEN.', 'yellow')
            else:
                self._log(f'[WARNING] No artifacts found for v{target} -- skipping GitHub publish.', 'yellow')

        # 10. Broadcast email notifications
        if self.opt_send_email.get():
            self._set_status('Step 10/10: Broadcasting email release notifications...', C_AMBER)
            webhook = self._get_webhook()
            clients = fetch_google_clients(webhook)
            if clients:
                self._log(f'[Email] {len(clients)} client recipient(s) identified:', 'green')
                for c in clients:
                    self._log(f"  • {c.get('name','?')} <{c.get('email','')}>", 'dim')
                subj, html = generate_release_email(target, wn, bf, imp, rn)
                cust = self.email_subj_entry.get().strip()
                if cust:
                    subj = cust
                ok, sent, fail = send_email_broadcast(webhook, subj, html, clients, self._log_fn)
                if ok:
                    self._log(f'[Email] Broadcast successfully dispatched to {sent} client(s)!', 'green')
                else:
                    self._log(f'[Email] Broadcast finished with {fail} delivery failure(s).', 'yellow')
            else:
                self._log('[Email] No clients found via webhook -- skipping broadcast.', 'yellow')

        elapsed = round(time.time() - t0, 1)
        self._log(f'\n✔ Pipeline successfully completed for v{target} in {elapsed}s!\n', 'green')
        self._set_status(f'v{target} complete ({elapsed}s)', C_GREEN)
        self._finish(True, target)

    def _finish(self, success: bool, version: str):
        def _reset():
            self.is_building = False
            self.prog_bar.stop()
            self.prog_bar.pack_forget()
            self.btn_launch.configure(state='normal', text='🚀  START RELEASE PIPELINE')
            self.current_version = get_current_version()
            self.lbl_cur_ver.configure(text=f'v{self.current_version}')
            self.lbl_ver_badge.configure(text=f'v{self.current_version}')
            if hasattr(self, 'lbl_target_pill'):
                self.lbl_target_pill.configure(text=f'🎯 Target: v{self.ver_entry.get().strip()}')
            if success:
                messagebox.showinfo('Build Complete', f'Uni Desk release v{version} successfully built and published!')
        self.after(0, _reset)


# ─────────────────────────────────────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
def main():
    ok_node, _ = _run_check(['node', '--version'])
    ok_npm,  _ = _run_check(['npm', '--version'])
    missing = []
    if not ok_node:
        missing.append('Node.js  ->  https://nodejs.org')
    if not ok_npm:
        missing.append('npm  (install with Node.js)')
    if missing:
        print('Missing required tools:')
        for m in missing:
            print(f'  * {m}')
        sys.exit(1)

    app = UniDeskStudio()
    app.mainloop()


if __name__ == '__main__':
    main()


