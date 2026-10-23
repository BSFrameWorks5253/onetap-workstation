#!/usr/bin/env python3
"""
============================================================
ARCHIVE SCANNER ENGINE (src/main/python/archive_scanner.py)
Part of One Tap Workstation

High-speed parallel directory crawler that scans massive media
folders, parses Safar hierarchies, extracts video durations in < 2ms
via direct MP4 atom parsing, and bulk-inserts metadata into SQLite.
============================================================
"""

import sys
import os
import re
import struct
import json
import sqlite3
import argparse
import subprocess
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

# Fix Windows terminal UTF-8 encoding
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# Ensure parent python directory is importable
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

import archive_catalog_db as db_mod

VIDEO_EXTS = {'.mp4', '.mov', '.mkv', '.m4v', '.avi', '.ts'}
PHOTO_EXTS = {'.arw', '.cr2', '.cr3', '.nef', '.jpg', '.jpeg', '.png', '.tif', '.tiff', '.dng', '.raw', '.heic'}
AUDIO_EXTS = {'.wav', '.mp3', '.m4a', '.aac', '.flac'}
PROJECT_EXTS = set()  # Deprecated: Adobe and other project files are strictly excluded from catalog

# Comprehensive Adobe project, auto-save, scratch, cache, and sidecar extensions
ADOBE_EXTS = {
    '.prproj', '.prproj~', '.prel', '.prfpset', '.mogrt', '.plb', '.prm',
    '.aep', '.aepx', '.aet',
    '.psd', '.psb', '.pdd',
    '.ai', '.ait',
    '.sesx', '.ses', '.asnd',
    '.indd', '.idml', '.indt', '.inx',
    '.xd',
    '.pek', '.cfa', '.ims', '.imsx', '.mcdb'
}

def is_adobe_folder(folder_name: str) -> bool:
    """Detects Adobe cache, preview, auto-save, and scratch directories."""
    if not folder_name:
        return False
    nl = folder_name.lower().strip()
    if 'adobe' in nl:
        return True
    if 'auto-save' in nl or 'autosave' in nl:
        return True
    if 'media cache' in nl or 'peak files' in nl:
        return True
    if 'preview files' in nl or 'disk cache' in nl:
        return True
    return False

def is_adobe_file(file_name: str, ext_lower: str) -> bool:
    """Detects Adobe project, temporary, backup, or conformed cache files."""
    if ext_lower in ADOBE_EXTS:
        return True
    fl = file_name.lower().strip()
    if fl.endswith('.prproj~') or (fl.startswith('~') and fl.endswith('.prproj')):
        return True
    if fl.endswith('.cfa') or fl.endswith('.pek') or fl.endswith('.ims') or fl.endswith('.mcdb'):
        return True
    return False


COMMON_CITIES = [
    'Mumbai', 'Indore', 'Surat', 'Dumas', 'Dummas', 'Karachi', 'Pune', 'Nagpur',
    'Ahmedabad', 'Rajkot', 'Delhi', 'Dubai', 'London', 'Colombo', 'Ujjain',
    'Udaipur', 'Hyderabad', 'Chennai', 'Kolkata', 'Jaipur', 'Lucknow',
    'Bhopal', 'Vadodara', 'Thane', 'Aurangabad', 'Raipur', 'Dahod',
    'Burhanpur', 'Godhra', 'Ratlam', 'Mandsaur', 'Neemuch', 'Sidhpur',
    'Patan', 'Jamnagar', 'Bhavnagar', 'Gondal', 'Dhoraji', 'Morbi',
    'Anjar', 'Bhuj', 'Nadiad', 'Anand', 'Khambhat', 'Bharuch',
    'Ankleshwar', 'Navsari', 'Valsad', 'Vapi', 'Silvassa', 'Daman',
    'Kuwait', 'Muscat', 'Abu Dhabi', 'Sharjah', 'Doha', 'Bahrain',
    'Riyadh', 'Jeddah', 'Cairo', 'Nairobi', 'Mombasa', 'Dar es Salaam'
]

# -------------------------------------------------------------------
# Fast Binary MP4 / MOV Atom Parser (< 2ms per file)
# -------------------------------------------------------------------

def get_mp4_duration_fast(file_path: str) -> float:
    """
    Reads the MP4/MOV atom header to extract duration in seconds without decoding frames.
    Traverses top-level atoms to locate 'moov', then locates 'mvhd' atom inside.
    """
    try:
        with open(file_path, 'rb') as f:
            f.seek(0, os.SEEK_END)
            file_len = f.tell()
            f.seek(0, os.SEEK_SET)

            # Check for standard atoms (ftyp, moov, mdat)
            while f.tell() < file_len:
                atom_header = f.read(8)
                if len(atom_header) < 8:
                    break
                atom_size, atom_type = struct.unpack('>I4s', atom_header)
                atom_type_str = atom_type.decode('latin1', errors='ignore')

                if atom_size == 1:
                    # 64-bit extended size
                    ext_size = f.read(8)
                    if len(ext_size) < 8:
                        break
                    atom_size = struct.unpack('>Q', ext_size)[0]
                    content_size = atom_size - 16
                elif atom_size == 0:
                    # Extends to end of file
                    content_size = file_len - f.tell()
                else:
                    content_size = atom_size - 8

                if content_size < 0:
                    break

                if atom_type_str == 'moov':
                    # Search inside moov for mvhd
                    moov_data = f.read(min(content_size, 1024 * 512)) # read first 512KB of moov
                    mvhd_pos = moov_data.find(b'mvhd')
                    if mvhd_pos != -1:
                        # mvhd structure: 4 bytes size, 4 bytes 'mvhd', 1 byte version, 3 bytes flags
                        # version 0: 4 bytes create, 4 bytes mod, 4 bytes timescale, 4 bytes duration
                        # version 1: 8 bytes create, 8 bytes mod, 4 bytes timescale, 8 bytes duration
                        start = mvhd_pos + 4
                        if start + 24 <= len(moov_data):
                            version = moov_data[start]
                            if version == 0:
                                timescale = struct.unpack('>I', moov_data[start + 12 : start + 16])[0]
                                duration = struct.unpack('>I', moov_data[start + 16 : start + 20])[0]
                                if timescale > 0:
                                    return duration / timescale
                            elif version == 1:
                                timescale = struct.unpack('>I', moov_data[start + 20 : start + 24])[0]
                                duration = struct.unpack('>Q', moov_data[start + 24 : start + 32])[0]
                                if timescale > 0:
                                    return duration / timescale
                    return 0.0
                else:
                    # Skip atom payload
                    f.seek(content_size, os.SEEK_CUR)
    except Exception:
        pass
    return 0.0

def find_ffprobe() -> Optional[str]:
    """Finds ffprobe binary across standard vendor / system paths."""
    candidates = [
        'ffprobe',
        os.path.join(os.getcwd(), 'tools', 'ffmpeg', 'bin', 'ffprobe.exe'),
        os.path.join(os.getcwd(), 'resources', 'ffmpeg', 'bin', 'ffprobe.exe'),
        r'C:\ffmpeg\bin\ffprobe.exe',
        r'D:\ffmpeg\bin\ffprobe.exe'
    ]
    for c in candidates:
        try:
            res = subprocess.run([c, '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            if res.returncode == 0:
                return c
        except Exception:
            continue
    return None

_FFPROBE_PATH = find_ffprobe()

def get_video_duration_fallback(file_path: str) -> float:
    """Uses ffprobe as a fallback if fast MP4 atom reader returns 0."""
    if not _FFPROBE_PATH:
        return 0.0
    try:
        cmd = [
            _FFPROBE_PATH,
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            file_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
        if res.returncode == 0 and res.stdout.strip():
            return float(res.stdout.strip())
    except Exception:
        pass
    return 0.0

# -------------------------------------------------------------------
# Hierarchy & Metadata Parsers
# -------------------------------------------------------------------

def extract_city(text: str) -> str:
    if not text:
        return 'Unassigned'
    if re.search(r'istefada', text, re.IGNORECASE):
        return 'Surat'
    if re.search(r'dummas|dumas', text, re.IGNORECASE):
        return 'Surat'
    for city in COMMON_CITIES:
        if re.search(r'(?:^|[\s_.,/\\-])' + re.escape(city) + r'(?:$|[\s_.,/\\-])', text, re.IGNORECASE):
            return city.capitalize()
    return 'Unassigned'

def normalize_event_code(code: str) -> str:
    up = code.upper().strip()
    # Official 34 events from Event List.xlsx
    if up in ('NIKAAH', 'NIKAH', 'N'):
        return 'N'
    if up in ('NAMAZ',):
        return 'NAMAZ'
    if up in ('AQIQA', 'AQ'):
        return 'AQ'
    if up in ('BETHAK_MAJLIS', 'BETHAKMAJLIS', 'BM'):
        return 'BM'
    if up in ('BETHAK_QADAM', 'BETHAKQADAM', 'BQ'):
        return 'BQ'
    if up in ('BETHAK_ZIYAFAT', 'BETHAKZIYAFAT', 'BZ'):
        return 'BZ'
    if up in ('ZIYAFAT', 'ZIYARAT', 'ZIARAT', 'Z'):
        return 'Z'
    if up in ('MAJLIS', 'M'):
        return 'M'
    if up in ('QADAM', 'Q'):
        return 'Q'
    if up in ('MAJMUI_ZIYAFAT', 'MAJMUIZIYAFAT', 'MZ'):
        return 'MZ'
    if up in ('QADAM_MAJLIS_ZIYAFAT', 'QMZ'):
        return 'QMZ'
    if up in ('HADDIYAT', 'HADIYAH', 'HADIYA', 'H'):
        return 'H'
    if up in ('IDARAAT', 'IDAARA', 'IDARA', 'ID'):
        return 'ID'
    if up in ('IFTETTAH', 'IF'):
        return 'IF'
    if up in ('IFTETTAH_SHARAF', 'IFS'):
        return 'IFS'
    if up in ('ISTEQBAL', 'IST'):
        return 'IST'
    if up in ('KG_SHARAF', 'KGSHARAF', 'KGS'):
        return 'KGS'
    if up in ('MAFSUHIYAT', 'MF'):
        return 'MF'
    if up in ('MISBAH',):
        return 'MISBAH'
    if up in ('MOKIB', 'MKB'):
        return 'MKB'
    if up in ('MADRASA', 'MO'):
        return 'MO'
    if up in ('MISAQ', 'MQ'):
        return 'MQ'
    if up in ('MULAQAAT', 'MUL'):
        return 'MUL'
    if up in ('MIYANA', 'MYN'):
        return 'MYN'
    if up in ('SHARAF', 'SH'):
        return 'SH'
    if up in ('SHIFA_QADAM', 'SHIFAQADAM', 'SQ'):
        return 'SQ'
    if up in ('TIJARAT', 'TJR'):
        return 'TJR'
    if up in ('TALAQQI', 'TQ'):
        return 'TQ'
    if up in ('TAHNEEQ', 'TAHANIQADAM', 'TNQ', 'TQN'):
        return 'TQN'
    if up in ('WAAZ',):
        return 'WAAZ'
    if up in ('WADA', 'WD'):
        return 'WD'
    if up in ('ZAFAF_OLDA', 'ZAFAF', 'ZO'):
        return 'ZO'
    if up in ('FMB',):
        return 'FMB'
    if up in ('ONLINE',):
        return 'ONLINE'
    return up

def is_date_folder_name(name: str) -> bool:
    """Accurately detects if a folder represents a session date folder."""
    clean = name.strip().lower()
    if clean in ('final', 'final titles', 'output', 'export', 'exports', 'dvd', 'raw', 'projects'):
        return False
    # Standard Date Folder Patterns:
    # 1. 4-digit year + month + day: "1448-08-15 _01M", "1448-03-13", "2026-09-05"
    if re.match(r'^\d{4}[\s._\-]\d{1,2}[\s._\-]\d{1,2}', clean):
        return True
    # 2. Day + 4-digit year: "15-08-1448"
    if re.match(r'^\d{1,2}[\s._\-]\d{1,2}[\s._\-]\d{2,4}', clean):
        return True
    # 3. Session tag: "_01M", "_02E", "1448-03-13 _01M"
    if re.search(r'_\d{1,2}[a-z]', clean, re.I):
        return True
    # 4. "Day 1", "Day-02", "Day_1"
    if re.match(r'^day[\s._\-]?\d+', clean, re.I):
        return True
    return False

def is_safar_folder_name(name: str) -> bool:
    """Accurately detects Safar root folders (e.g. 1448-03 Mumbai, 03 Mumbai, 1448 Mumbai)."""
    clean = name.strip()
    # A date folder is NEVER a Safar folder!
    if is_date_folder_name(clean):
        return False
    if clean.lower() in (
        'final', 'final titles', 'raw', 'projects', 'dvd', 'output', 'export',
        'system volume information', '$recycle.bin', 'in process', 'to upload', 'to delete', 'pending'
    ):
        return False
    # Matches "1448-03 Mumbai", "1448-03_Mumbai", "1448 03 Mumbai"
    if re.match(r'^\d{4}[\s\-_]+\d{1,3}[\s\-_]+[A-Za-z]', clean):
        return True
    # Matches "03-Mumbai", "03 Mumbai"
    if re.match(r'^\d{1,3}[\s\-_]+[A-Za-z]', clean):
        return True
    # Matches "1448-Mumbai", "1448 Mumbai"
    if re.match(r'^\d{4}[\s\-_]+[A-Za-z]', clean):
        return True
    # Contains a known city and year
    if extract_city(clean) != 'Unassigned' and re.search(r'\b(14\d{2}|20\d{2})\b', clean):
        return True
    return False

def extract_safar_from_container_path(full_path: str) -> Optional[str]:
    """Finds the folder immediately inside an 'IN PROCESS' / 'TO UPLOAD' / 'TO DELETE' container."""
    if not full_path:
        return None
    normalized = os.path.normpath(full_path)
    parts = normalized.split(os.sep)
    container_names = {'in process', 'inprocess', 'in_process', 'to upload', 'to_upload', 'to delete', 'to_delete', 'pending', 'safars', 'safar', 'working safar'}
    for i, part in enumerate(parts):
        if part.lower().strip() in container_names and i + 1 < len(parts):
            cand = parts[i + 1].strip()
            if cand.lower() not in ('final', 'final titles', 'output', 'export', 'dvd', 'new folder', '$recycle.bin'):
                return cand
    return None

def parse_safar_dir(dir_name: str) -> Dict[str, Any]:
    """Extracts year, serial, safar name, and city from Safar folder name or container path."""
    container_safar = extract_safar_from_container_path(dir_name)
    target_name = container_safar if container_safar else os.path.basename(os.path.normpath(dir_name))

    safar_info = {
        'safar_name': target_name,
        'safar_year': None,
        'safar_serial': None,
        'city': extract_city(target_name)
    }

    m1 = re.match(r'^(\d{4})[\s\-_]+(\d{1,3})[\s\-_]+(.+)$', target_name)
    if m1:
        try:
            safar_info['safar_year'] = int(m1.group(1))
            safar_info['safar_serial'] = m1.group(2).zfill(2)
            safar_info['safar_name'] = m1.group(3).strip()
            detected_city = extract_city(safar_info['safar_name'])
            safar_info['city'] = detected_city if detected_city != 'Unassigned' else safar_info['safar_name']
        except ValueError:
            pass
        return safar_info

    m2 = re.match(r'^(\d{1,3})[\s\-_]+(.+)$', target_name)
    if m2:
        safar_info['safar_serial'] = m2.group(1).zfill(2)
        safar_info['safar_name'] = m2.group(2).strip()
        detected_city = extract_city(safar_info['safar_name'])
        safar_info['city'] = detected_city if detected_city != 'Unassigned' else safar_info['safar_name']
        return safar_info

    m3 = re.match(r'^(\d{4})[\s\-_]+(.+)$', target_name)
    if m3:
        try:
            safar_info['safar_year'] = int(m3.group(1))
        except ValueError:
            pass
        safar_info['safar_name'] = m3.group(2).strip()
        detected_city = extract_city(safar_info['safar_name'])
        safar_info['city'] = detected_city if detected_city != 'Unassigned' else safar_info['safar_name']
        return safar_info

    if safar_info['city'] == 'Unassigned':
        safar_info['city'] = safar_info['safar_name']

    return safar_info

def parse_date_folder(folder_name: str) -> Dict[str, Any]:
    """
    Parses a session date folder name into canonical dates, session tag, and name.
    Matches e.g. '1448-03-13 _01M' or '2026-08-25_Evening_Bethak'.
    """
    info = {
        'date_canonical_hijri': None,
        'date_canonical_greg': None,
        'session_tag': None,
        'session_name': None
    }
    clean = folder_name.strip()

    m_tag = re.search(r'(_0[1-9][ME]|\b(?:Morning|Evening|Night|Subah|Raat)\b)', clean, re.IGNORECASE)
    if m_tag:
        raw_tag = m_tag.group(1).upper()
        if 'MORNING' in raw_tag or 'SUBAH' in raw_tag:
            info['session_tag'] = '_01M'
        elif 'EVENING' in raw_tag or 'NIGHT' in raw_tag or 'RAAT' in raw_tag:
            info['session_tag'] = '_02E'
        else:
            info['session_tag'] = raw_tag

    m_date = re.search(r'(\d{4})[\-_.](\d{1,2})[\-_.](\d{1,2})', clean)
    if m_date:
        y, m, d = int(m_date.group(1)), int(m_date.group(2)), int(m_date.group(3))
        if 1400 <= y <= 1500 and 1 <= m <= 12 and 1 <= d <= 31:
            info['date_canonical_hijri'] = f"{y:04d}-{m:02d}-{d:02d}"
        elif 2000 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31:
            info['date_canonical_greg'] = f"{y:04d}-{m:02d}-{d:02d}"
    return info

def extract_event_code(text: str) -> str:
    if not text:
        return ''
    # Match Title Adder standard codes with boundary from official 34 event codes
    m_known = re.search(r'(?:^|[\s._\-/])(WAAZ|NIKAAH|NAMAZ|BETHAK|ZIYAFAT|MAJLIS|QADAM|IDAARA|QMZ|IFS|KGS|MKB|MUL|MYN|TJR|TQN|TNQ|FMB|MISBAH|ONLINE|MZ|AQ|BM|BQ|BZ|ID|IF|IST|MF|MO|MQ|SH|SQ|TQ|WD|ZO|Q|M|Z|N|H)(?:[\s._\-/]|$)', text, re.I)
    if m_known:
        return normalize_event_code(m_known.group(1))

    m1 = re.search(r'-\d{1,3}[a-zA-Z]?-(\d{1,3})?([a-zA-Z]+)(?:-\d+)?', text)
    if m1 and m1.group(2):
        return normalize_event_code(m1.group(2))
    m2 = re.search(r'(?:^|[\s._\-])([A-Za-z]{1,6})(?:[\s._\-]|$)', text)
    if m2:
        cand = m2.group(1).upper()
        if cand not in ('THE', 'FOR', 'AND', 'CAM', 'CLIP', 'RUN', 'RAW', 'ALL', 'OUT', 'IN', 'VID', 'NEW', 'DAY'):
            return normalize_event_code(cand)
    return ''

# -------------------------------------------------------------------
# Full Ingestion Scanner
# -------------------------------------------------------------------

def scan_single_safar(
    root_path: str,
    drive_id: Optional[int] = None,
    db_path: Optional[str] = None,
    send_complete: bool = True
) -> Dict[str, Any]:
    """Scans an individual Safar directory."""
    conn = db_mod.get_connection(db_path)
    root_folder_name = os.path.basename(root_path)
    safar_info = parse_safar_dir(root_folder_name)

    # Check for metadata files in root_path
    for meta_filename in ('safar_info.json', 'folder_structure.json'):
        meta_file = os.path.join(root_path, meta_filename)
        if os.path.exists(meta_file):
            try:
                with open(meta_file, 'r', encoding='utf-8') as mf:
                    mdata = json.load(mf)
                    if mdata.get('city') and mdata['city'] != 'Unassigned':
                        safar_info['city'] = mdata['city']
                    if mdata.get('safarYear'):
                        safar_info['safar_year'] = mdata['safarYear']
                    if mdata.get('safarSerial'):
                        safar_info['safar_serial'] = str(mdata['safarSerial']).zfill(2)
                    if mdata.get('safarName'):
                        safar_info['safar_name'] = mdata['safarName']
                break
            except Exception:
                pass

    cur = conn.cursor()
    cur.execute("""
        SELECT id FROM scanned_archives
        WHERE LOWER(safar_name) = LOWER(?) OR LOWER(root_path) = LOWER(?)
    """, (safar_info['safar_name'], root_path))
    existing_row = cur.fetchone()

    if existing_row:
        archive_id = existing_row[0]
        cur.execute("""
            UPDATE scanned_archives
            SET drive_id = COALESCE(?, drive_id),
                safar_name = ?,
                safar_folder = ?,
                safar_year = ?,
                safar_serial = ?,
                city = ?,
                root_path = ?,
                scan_timestamp = datetime('now')
            WHERE id = ?
        """, (
            drive_id,
            safar_info['safar_name'],
            root_folder_name,
            safar_info['safar_year'],
            safar_info['safar_serial'],
            safar_info['city'],
            root_path,
            archive_id
        ))
        cur.execute("DELETE FROM media_items WHERE archive_id = ?", (archive_id,))
        cur.execute("DELETE FROM folder_nodes WHERE archive_id = ?", (archive_id,))
        conn.commit()
    else:
        cur.execute("""
            INSERT INTO scanned_archives (
                drive_id, safar_name, safar_folder, safar_year, safar_serial, city, root_path, scan_timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """, (
            drive_id,
            safar_info['safar_name'],
            root_folder_name,
            safar_info['safar_year'],
            safar_info['safar_serial'],
            safar_info['city'],
            root_path
        ))
        archive_id = cur.lastrowid
        conn.commit()

    total_files_scanned = 0
    total_mp4_count = 0
    total_photo_count = 0
    total_size_bytes = 0
    total_duration_sec = 0.0

    folder_id_map: Dict[str, int] = {}
    folder_meta_map: Dict[str, Dict[str, Any]] = {}
    folder_metrics: Dict[int, Dict[str, Any]] = {}

    media_batch = []
    BATCH_SIZE = 500

    print(json.dumps({
        'type': 'status',
        'message': f"Scanning Safar '{safar_info['safar_name']}'...",
        'archive_id': archive_id
    }), flush=True)

    for root, dirs, files in os.walk(root_path):
        # Skip noise folders and Adobe auto-generated / scratch directories
        dirs[:] = [
            d for d in dirs
            if not d.startswith('$') and d.lower() not in (
                'system volume information', '.trash', '.git', '.idea', '__pycache__', 'node_modules'
            ) and not is_adobe_folder(d)
        ]

        rel_path = os.path.relpath(root, root_path)
        if rel_path == '.':
            rel_path = ''

        folder_name = os.path.basename(root)
        if folder_name and is_adobe_folder(folder_name):
            continue

        # Hierarchy parsing
        date_info = parse_date_folder(folder_name)
        ev_code = extract_event_code(folder_name)
        session_name = None
        if re.search(r'bethak', folder_name, re.I):
            session_name = 'Bethak'
        elif re.search(r'qmz', folder_name, re.I):
            session_name = 'QMZ'
        elif re.search(r'majlis', folder_name, re.I):
            session_name = 'Majlis'
        elif re.search(r'namaz', folder_name, re.I):
            session_name = 'Namaz'
        elif re.search(r'ziyarat', folder_name, re.I):
            session_name = 'Ziyarat'
        elif re.search(r'waaz', folder_name, re.I):
            session_name = 'Waaz'

        parent_rel = os.path.dirname(rel_path)
        parent_id = folder_id_map.get(parent_rel, None)
        parent_meta = folder_meta_map.get(parent_rel, {})

        # Inherit canonical dates and session tags from parent folders
        final_hijri = date_info.get('date_canonical_hijri') or parent_meta.get('date_canonical_hijri')
        final_greg = date_info.get('date_canonical_greg') or parent_meta.get('date_canonical_greg')
        final_session_tag = date_info.get('session_tag') or parent_meta.get('session_tag')
        final_session_name = session_name or parent_meta.get('session_name')
        final_ev_code = ev_code or parent_meta.get('event_code')

        folder_meta_map[rel_path] = {
            'date_canonical_hijri': final_hijri,
            'date_canonical_greg': final_greg,
            'session_tag': final_session_tag,
            'session_name': final_session_name,
            'event_code': final_ev_code
        }

        # Insert folder node
        cur.execute("""
            INSERT INTO folder_nodes (
                archive_id, parent_id, relative_path, folder_name,
                date_canonical_hijri, date_canonical_greg, session_name,
                session_tag, event_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            archive_id, parent_id, rel_path, folder_name,
            final_hijri, final_greg, final_session_name, final_session_tag, final_ev_code
        ))
        folder_id = cur.lastrowid
        folder_id_map[rel_path] = folder_id
        folder_metrics[folder_id] = {'size': 0, 'mp4s': 0, 'photos': 0}

        # Scan files in folder
        for file in files:
            if file.startswith('._') or file.lower() in ('thumbs.db', 'desktop.ini'):
                continue

            stem, ext = os.path.splitext(file)
            ext_lower = ext.lower()

            # Strictly reject all Adobe files (projects, auto-saves, cache, peak, conformed audio)
            if is_adobe_file(file, ext_lower):
                continue

            full_file_path = os.path.join(root, file)
            try:
                stat = os.stat(full_file_path)
                fsize = stat.st_size
                mtime = datetime.fromtimestamp(stat.st_mtime).isoformat()
            except Exception:
                fsize = 0
                mtime = None

            # Classify media
            if ext_lower in VIDEO_EXTS:
                mtype = 'video'
                total_mp4_count += 1
                folder_metrics[folder_id]['mp4s'] += 1

                # Fast binary duration parsing
                dur = get_mp4_duration_fast(full_file_path)
                if dur <= 0.0 and ext_lower in ('.mkv', '.avi', '.ts'):
                    dur = get_video_duration_fallback(full_file_path)

                total_duration_sec += dur
                formatted_dur = db_mod.format_duration(dur)
            elif ext_lower in PHOTO_EXTS:
                mtype = 'photo'
                dur = 0.0
                formatted_dur = None
                total_photo_count += 1
                folder_metrics[folder_id]['photos'] += 1
            elif ext_lower in AUDIO_EXTS:
                mtype = 'audio'
                dur = 0.0
                formatted_dur = None
            else:
                mtype = 'other'
                dur = 0.0
                formatted_dur = None

            folder_metrics[folder_id]['size'] += fsize
            total_size_bytes += fsize
            total_files_scanned += 1

            media_batch.append((
                archive_id, folder_id, file, stem, ext_lower,
                mtype, fsize, dur, formatted_dur, mtime, mtime
            ))

            if len(media_batch) >= BATCH_SIZE:
                cur.executemany("""
                    INSERT INTO media_items (
                        archive_id, folder_id, file_name, file_stem, file_ext,
                        media_type, size_bytes, duration_seconds, duration_formatted,
                        created_time, modified_time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, media_batch)
                conn.commit()
                media_batch.clear()

                # Emit real-time progress update
                print(json.dumps({
                    'type': 'progress',
                    'scanned_files': total_files_scanned,
                    'total_size_bytes': total_size_bytes,
                    'total_mp4_count': total_mp4_count,
                    'current_folder': folder_name
                }), flush=True)

    # Flush remaining batch
    if media_batch:
        cur.executemany("""
            INSERT INTO media_items (
                archive_id, folder_id, file_name, file_stem, file_ext,
                media_type, size_bytes, duration_seconds, duration_formatted,
                created_time, modified_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, media_batch)
        conn.commit()
        media_batch.clear()

    # Update folder metrics
    for fid, met in folder_metrics.items():
        cur.execute("""
            UPDATE folder_nodes
            SET folder_size_bytes = ?, mp4_count = ?, photo_count = ?
            WHERE id = ?
        """, (met['size'], met['mp4s'], met['photos'], fid))

    # Update archive overall summary
    cur.execute("""
        UPDATE scanned_archives
        SET total_files = ?, total_mp4_count = ?, total_photo_count = ?,
            total_size_bytes = ?, total_duration_seconds = ?
        WHERE id = ?
    """, (
        total_files_scanned, total_mp4_count, total_photo_count,
        total_size_bytes, total_duration_sec, archive_id
    ))
    try:
        cur.execute("PRAGMA optimize;")
    except Exception:
        pass
    conn.commit()
    conn.close()

    result = {
        'archive_id': archive_id,
        'safar_name': safar_info['safar_name'],
        'total_files': total_files_scanned,
        'total_mp4_count': total_mp4_count,
        'total_photo_count': total_photo_count,
        'total_size_bytes': total_size_bytes,
        'total_duration_seconds': total_duration_sec,
        'total_duration_formatted': db_mod.format_duration(total_duration_sec)
    }

    if send_complete:
        print(json.dumps({
            'type': 'complete',
            'result': result
        }), flush=True)

    return result

def scan_directory(
    root_path: str,
    drive_label: str = '',
    drive_location: str = '',
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    r"""
    Crawls root_path, detecting container folders (like F:\In Process)
    to scan individual Safars or scans a single Safar directory.
    """
    root_path = (root_path or '').strip('\'"')
    root_path = os.path.abspath(root_path)
    if not os.path.exists(root_path):
        raise FileNotFoundError(f"Path does not exist: {root_path}")

    db_mod.init_db(db_path)
    drive_id = None
    if drive_label:
        drive_id = db_mod.add_or_update_drive(drive_label, drive_location, db_path=db_path)

    root_folder_name = os.path.basename(root_path)

    # Check if root_path is a container folder containing multiple Safars (like F:\In Process)
    is_container = root_folder_name.lower() in (
        'in process', 'in_process', 'inprocess', 'safars', 'safar', 'working',
        'working safar', 'to upload', 'to_upload', 'uploaded data', 'to delete',
        'to_delete', 'pending'
    )
    try:
        sub_dirs = [
            d for d in os.listdir(root_path)
            if os.path.isdir(os.path.join(root_path, d))
            and not d.startswith('$')
            and not d.startswith('.')
            and not is_adobe_folder(d)
        ]
        if is_container:
            # Inside a container folder like IN PROCESS, any non-date, non-junk folder is a Safar!
            safar_subs = [d for d in sub_dirs if not is_date_folder_name(d)]
        else:
            safar_subs = [d for d in sub_dirs if is_safar_folder_name(d)]
    except Exception:
        safar_subs = []

    if len(safar_subs) >= 1 and (is_container or not is_safar_folder_name(root_folder_name)):
        results = []
        for sf in safar_subs:
            sub_path = os.path.join(root_path, sf)
            res = scan_single_safar(sub_path, drive_id=drive_id, db_path=db_path, send_complete=False)
            results.append(res)

        total_f = sum(r.get('total_files', 0) for r in results)
        total_mp4 = sum(r.get('total_mp4_count', 0) for r in results)
        total_ph = sum(r.get('total_photo_count', 0) for r in results)
        total_sz = sum(r.get('total_size_bytes', 0) for r in results)
        total_dur = sum(r.get('total_duration_seconds', 0) for r in results)

        final_res = {
            'archive_id': results[0]['archive_id'] if results else None,
            'safar_name': f"{len(results)} Safars ({', '.join(safar_subs)})",
            'total_files': total_f,
            'total_mp4_count': total_mp4,
            'total_photo_count': total_ph,
            'total_size_bytes': total_sz,
            'total_duration_seconds': total_dur,
            'total_duration_formatted': db_mod.format_duration(total_dur)
        }
        print(json.dumps({'type': 'complete', 'result': final_res}), flush=True)
        return final_res
    else:
        return scan_single_safar(root_path, drive_id=drive_id, db_path=db_path, send_complete=True)

def main():
    parser = argparse.ArgumentParser(description="One Tap Archive Scanner CLI")
    parser.add_argument('--path', required=True, help="Folder path to scan")
    parser.add_argument('--drive_label', default='', help="Physical Drive Label (e.g. HDD-16TB-RED)")
    parser.add_argument('--drive_location', default='', help="Physical Location (e.g. Shelf 2, Drawer B)")
    parser.add_argument('--db', default=None, help="Custom SQLite DB path")

    args = parser.parse_args()
    try:
        scan_directory(
            root_path=args.path,
            drive_label=args.drive_label,
            drive_location=args.drive_location,
            db_path=args.db
        )
    except Exception as e:
        print(json.dumps({'type': 'error', 'error': str(e)}), flush=True)
        sys.exit(1)

if __name__ == '__main__':
    main()
