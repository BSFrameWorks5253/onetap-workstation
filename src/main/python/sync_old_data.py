#!/usr/bin/env python3
"""
============================================================
SYNC OLD DATA TO STATS (src/main/python/sync_old_data.py)

Locates and synchronizes historical video archives into SQLite:
1. Supports single Safar directory or root container (e.g. "E:\\In Process"
   or "E:\\In Process\\1448-10-Istefada ilmiyah").
2. Automatically identifies Safar subfolders and "Final" directory.
3. Parses exact Hijri Year, Month, Day, and Session (e.g. 1448-04-18 _01M ->
   Year: 1448, Month: 4, Day: 18, Session: 01M).
4. Fast MP4 duration extraction (< 2ms per video via atom parser with ffprobe fallback).
5. Normalized event prefixes (Q, N, Z, M, ZO, MZ, H, MF, AQ, Namaz, etc.).
6. Upserts into stats.db and synchronizes output with settings.
============================================================
"""

import sys
import os
import re
import json
import struct
import sqlite3
import argparse
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List

# Import database functions from stats_db.py in the same directory
try:
    from stats_db import get_db_path, init_db, insert_records
except ImportError:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    from stats_db import get_db_path, init_db, insert_records

VIDEO_EXTENSIONS = {'.mp4', '.mov', '.mkv', '.m4v', '.avi', '.ts'}

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

            # Traverse top-level atoms
            while f.tell() < file_len:
                atom_header = f.read(8)
                if len(atom_header) < 8:
                    break
                atom_size, atom_type = struct.unpack('>I4s', atom_header)
                atom_type_str = atom_type.decode('latin1', errors='ignore')

                if atom_size == 1:
                    ext_size = f.read(8)
                    if len(ext_size) < 8:
                        break
                    atom_size = struct.unpack('>Q', ext_size)[0]
                    content_size = atom_size - 16
                elif atom_size == 0:
                    content_size = file_len - f.tell()
                else:
                    content_size = atom_size - 8

                if content_size < 0:
                    break

                if atom_type_str == 'moov':
                    moov_data = f.read(min(content_size, 1024 * 512))
                    mvhd_pos = moov_data.find(b'mvhd')
                    if mvhd_pos != -1:
                        start = mvhd_pos + 4
                        if start + 24 <= len(moov_data):
                            version = moov_data[start]
                            if version == 0:
                                timescale = struct.unpack('>I', moov_data[start + 12 : start + 16])[0]
                                duration = struct.unpack('>I', moov_data[start + 16 : start + 20])[0]
                                if timescale > 0:
                                    return round(duration / timescale, 2)
                            elif version == 1:
                                timescale = struct.unpack('>I', moov_data[start + 20 : start + 24])[0]
                                duration = struct.unpack('>Q', moov_data[start + 24 : start + 32])[0]
                                if timescale > 0:
                                    return round(duration / timescale, 2)
                    return 0.0
                else:
                    f.seek(content_size, os.SEEK_CUR)
    except Exception:
        pass
    return 0.0


def find_ffprobe() -> Optional[str]:
    """Finds ffprobe executable across system PATH and common vendor paths."""
    candidates = [
        'ffprobe',
        os.path.join(os.getcwd(), 'tools', 'ffmpeg', 'bin', 'ffprobe.exe'),
        os.path.join(os.getcwd(), 'resources', 'ffmpeg', 'bin', 'ffprobe.exe'),
        os.path.join(os.getcwd(), 'ffmpeg', 'bin', 'ffprobe.exe'),
        r'C:\ffmpeg\bin\ffprobe.exe',
        r'D:\ffmpeg\bin\ffprobe.exe',
        r'C:\Program Files\ffmpeg\bin\ffprobe.exe'
    ]
    for c in candidates:
        try:
            res = subprocess.run([c, '-version'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2)
            if res.returncode == 0:
                return c
        except Exception:
            continue
    return None


def get_video_duration(file_path: str, ffprobe_exe: Optional[str]) -> float:
    """Extracts duration in seconds using fast atom parser with ffprobe fallback."""
    if not os.path.exists(file_path):
        return 0.0

    # 1. Try fast binary parser first
    d_fast = get_mp4_duration_fast(file_path)
    if d_fast > 0:
        return d_fast

    # 2. Fallback to ffprobe
    if ffprobe_exe:
        try:
            cmd = [
                ffprobe_exe,
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                file_path
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if res.returncode == 0 and res.stdout.strip():
                return round(float(res.stdout.strip()), 2)
        except Exception:
            pass
    return 0.0


def extract_city(text: str) -> str:
    """Detects city from text string."""
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
    """Normalizes raw event code token to standard prefix."""
    if not code:
        return 'OTHER'
    up = code.upper().strip()
    if up in ('NIKAAH', 'NIKAH', 'N'):
        return 'N'
    if up in ('NAMAZ',):
        return 'NAMAZ'
    if up in ('BETHAK', 'AQIQA', 'AQUEEQAH', 'AQ'):
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
    if up in ('BQMZ', 'BQ_MZ'):
        return 'BQMZ'
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
    if up in ('KG_SHARAF', 'KGSHARAF', 'KGS', 'KG'):
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
        return 'TNQ'
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
    if up in ('OT', 'OTHER'):
        return 'OTHER'
    return up


def extract_event_code_from_string(text: str) -> str:
    """
    Extracts event prefix code from filename or folder name.
    Supports patterns:
      - '1448-04-18 _01M-01-01Q-20398749' -> 'Q'
      - '1448-04-05 _02E-03-22ZO-30444199' -> 'ZO'
      - '1448-04-05 _02E-16-01N-50473950' -> 'N'
      - '1448-04-05 _02E-50-Namaz-' -> 'NAMAZ'
      - '001 03-12 _02E-02-11BQMZ-20320523' -> 'BQMZ'
      - '01-Z' -> 'Z'
      - '16-Q' -> 'Q'
    """
    if not text:
        return ''

    # Pattern A: Standard sequence item pattern e.g. "-02-01AQ-", "-07-04ZO-", "-18-01N-", "-01-TNQ-", "-05-H-"
    m1 = re.search(r'-\d{1,3}[a-zA-Z]?-(\d{1,3})?([a-zA-Z]+)(?:-\d+)?', text)
    if m1 and m1.group(2):
        return normalize_event_code(m1.group(2))

    # Pattern B: Simple prefix file format: e.g. "01-Z", "16-Q", "07b-N"
    m2 = re.match(r'^\d{1,3}[a-z]?-([A-Za-z]+)', text)
    if m2:
        return normalize_event_code(m2.group(1))

    # Pattern C: Direct code token in name
    m3 = re.search(r'(?:^|[\s._\-])([A-Za-z]{1,4})(?:[\s._\-]|$)', text)
    if m3:
        cand = m3.group(1).upper()
        if cand not in ('THE', 'FOR', 'AND', 'CAM', 'CLIP', 'RUN', 'RAW', 'ALL', 'OUT', 'IN', 'VID', 'NEW', 'FINAL'):
            return normalize_event_code(cand)
    return ''


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


def parse_safar_dir(dir_name: str, full_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Extracts year, serial, safar name, and city from Safar folder name or container path.
    Example: '1448-10-Istefada ilmiyah' -> year=1448, serial='10', safarName='Istefada ilmiyah', city='Surat'
    """
    container_safar = extract_safar_from_container_path(full_path or dir_name)
    target_name = container_safar if container_safar else os.path.basename(os.path.normpath(dir_name))

    safar_info = {
        'safar': target_name,
        'safarYear': None,
        'safarSerial': None,
        'safarName': target_name,
        'city': extract_city(target_name)
    }

    # Format 1: "1448-10-Istefada ilmiyah" or "1447-08 Mumbai - Urs Mubarak..."
    m1 = re.match(r'^(\d{4})[\s\-_]+(\d{1,3})[\s\-_]+(.+)$', target_name)
    if m1:
        safar_info['safarYear'] = int(m1.group(1))
        safar_info['safarSerial'] = m1.group(2).zfill(2)
        safar_info['safarName'] = m1.group(3).strip()
        detected_city = extract_city(safar_info['safarName'])
        safar_info['city'] = detected_city if detected_city != 'Unassigned' else safar_info['city']
        return safar_info

    # Format 2: "08-Mumbai - Urs..."
    m2 = re.match(r'^(\d{1,3})[\s\-_]+([A-Za-z].+)$', target_name)
    if m2:
        safar_info['safarSerial'] = m2.group(1).zfill(2)
        safar_info['safarName'] = m2.group(2).strip()
        detected_city = extract_city(safar_info['safarName'])
        safar_info['city'] = detected_city if detected_city != 'Unassigned' else safar_info['city']
        return safar_info

    # Format 3: "1447-Mumbai..."
    m3 = re.match(r'^(\d{4})[\s\-_]+([A-Za-z].+)$', target_name)
    if m3:
        safar_info['safarYear'] = int(m3.group(1))
        safar_info['safarName'] = m3.group(2).strip()
        safar_info['city'] = extract_city(safar_info['safarName']) or safar_info['city']
        return safar_info

    return safar_info


def parse_date_folder(seg: str) -> Dict[str, Any]:
    """
    Extracts hijri year, month, day, and session tag (_01M, _02E) from slot folder.
    Example: '1448-04-18 _01M' -> hijriYear=1448, hijriMonth=4, hijriDay=18, sessionTag='_01M', session='01M'
    """
    info = {
        'sessionTag': None,
        'session': None,
        'hijriYear': None,
        'hijriMonth': None,
        'hijriDay': None
    }
    if not seg:
        return info

    tag_m = re.search(r'(_\d{1,2}[A-Za-z])', seg)
    if tag_m:
        raw_tag = tag_m.group(1).upper()
        info['sessionTag'] = raw_tag
        info['session'] = raw_tag.lstrip('_')

    # YYYY-MM-DD or YYYY-MM
    dm1 = re.search(r'(\d{4})[\s._\-](\d{1,2})(?:[\s._\-](\d{1,2}))?', seg)
    if dm1:
        y = int(dm1.group(1))
        m = int(dm1.group(2))
        if 1400 <= y <= 1500 and 1 <= m <= 12:
            info['hijriYear'] = y
            info['hijriMonth'] = m
            if dm1.group(3):
                info['hijriDay'] = int(dm1.group(3))
    else:
        # MM-DD
        dm2 = re.search(r'^(\d{1,2})[\s._\-](\d{1,2})(?:$|[\s_])', seg)
        if dm2:
            m = int(dm2.group(1))
            d = int(dm2.group(2))
            if 1 <= m <= 12 and 1 <= d <= 31:
                info['hijriMonth'] = m
                info['hijriDay'] = d
    return info


def is_date_folder_segment(seg: str) -> bool:
    """Determines if a directory segment represents a slot / date folder."""
    if not seg:
        return False
    # Exclude clip/sequence item subfolders: e.g. "-02-01AQ-", "-18-01N-", "30338708"
    if re.search(r'-\d{1,3}[a-zA-Z]?-(\d{1,3})?[A-Za-z]+', seg):
        return False
    if re.search(r'^\d{6,8}$', seg):
        return False
    # Exclude city names or root containers
    seg_lower = seg.lower()
    if any(c.lower() in seg_lower for c in COMMON_CITIES):
        return False
    if re.match(r'^\d{4}[\s\-_]+\d{1,3}[\s\-_]+[A-Za-z]{2,}', seg):
        return False

    # YYYY-MM-DD or YYYY-MM-DD _01M
    if re.match(r'^\d{4}[\s._\-]\d{1,2}[\s._\-]\d{1,2}(?:\s*_\d{1,2}[A-Za-z])?$', seg):
        return True
    # DD-MM-YYYY
    if re.match(r'^\d{1,2}[\s._\-]\d{1,2}[\s._\-]\d{4}(?:\s*_\d{1,2}[A-Za-z])?$', seg):
        return True
    # YYYY-MM _01M
    if re.match(r'^\d{4}[\s._\-]\d{1,2}\s*_\d{1,2}[A-Za-z]$', seg):
        return True
    # Exact YYYY-MM (e.g. 1448-03)
    if re.match(r'^\d{4}[\s._\-]\d{1,2}$', seg):
        return True
    # MM-DD or MM-DD _01M
    if re.match(r'^\d{1,2}[\s._\-]\d{1,2}(?:\s*_\d{1,2}[A-Za-z])?$', seg):
        return True
    return False


def scan_safar_main_directory(safar_dir: str) -> Dict[str, Any]:
    """
    Scans a single Safar directory, strictly SKIPPING any folder named 'Final'.
    Builds an index of slot folders, session names (Bethak, QMZ, etc.), and event items.
    """
    safar_dir = os.path.abspath(safar_dir)
    if not os.path.isdir(safar_dir):
        return {}

    safar_meta = parse_safar_dir(os.path.basename(safar_dir), safar_dir)
    slot_index = {}

    for root, dirs, _ in os.walk(safar_dir):
        # STRICTLY skip 'Final' and 'Final Titles'
        dirs[:] = [d for d in dirs if d.lower() != 'final' and d.lower() != 'final titles']

        rel_parts = os.path.relpath(root, safar_dir).split(os.sep)
        if not rel_parts or rel_parts == ['.']:
            continue

        slot_name = None
        slot_info = None
        session_category = None

        for part in rel_parts:
            if not slot_name and is_date_folder_segment(part):
                slot_name = part
                slot_info = parse_date_folder(part)

            if re.search(r'bethak', part, re.I):
                session_category = 'Bethak'
            elif re.search(r'qmz', part, re.I):
                session_category = 'QMZ'
            elif re.search(r'majlis', part, re.I):
                session_category = 'Majlis'
            elif re.search(r'namaz', part, re.I):
                session_category = 'Namaz'
            elif re.search(r'ziyarat', part, re.I):
                session_category = 'Ziyarat'
            elif re.search(r'waaz', part, re.I):
                session_category = 'Waaz'

        if slot_name:
            norm_key = slot_name.lower().strip()
            if norm_key not in slot_index:
                slot_index[norm_key] = {
                    'rawSlotFolder': slot_name,
                    'safarInfo': safar_meta,
                    'dateInfo': slot_info or {},
                    'sessionCategory': session_category or 'Session',
                    'session': (slot_info.get('session') if slot_info else None) or session_category or 'Session',
                    'eventItems': set()
                }

            # Index by normalized YYYY-MM-DD
            if slot_info and slot_info.get('hijriYear') and slot_info.get('hijriMonth') and slot_info.get('hijriDay'):
                h_key = f"{slot_info['hijriYear']}-{slot_info['hijriMonth']:02d}-{slot_info['hijriDay']:02d}"
                if h_key not in slot_index:
                    slot_index[h_key] = slot_index[norm_key]

            # Collect any event codes from subfolders
            cur_dir = os.path.basename(root)
            code = extract_event_code_from_string(cur_dir)
            if code and code != 'OTHER':
                slot_index[norm_key]['eventItems'].add(code)

    return slot_index


def scan_safar_final_directory(final_dir: str, default_safar_meta: Dict[str, Any], slot_index: Dict[str, Any], ffprobe_exe: Optional[str]) -> List[Dict[str, Any]]:
    """
    Scans the Final directory for rendered videos, extracting duration and mapping
    slot, session, Hijri month/year, and event prefix.
    """
    final_dir = os.path.abspath(final_dir)
    if not os.path.isdir(final_dir):
        return []

    records = []
    seen_keys = set()

    for root, _, files in os.walk(final_dir):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext not in VIDEO_EXTENSIONS:
                continue

            file_path = os.path.join(root, f)
            stem = os.path.splitext(f)[0]

            rel_parts = os.path.relpath(file_path, final_dir).split(os.sep)
            all_parts = file_path.split(os.sep)

            matched_slot_entry = None
            slot_candidate = None

            # 1. Match against slot_index
            for part in rel_parts:
                norm = part.lower().strip()
                if norm in slot_index:
                    matched_slot_entry = slot_index[norm]
                    slot_candidate = part
                    break
                for s_key, s_val in slot_index.items():
                    if s_key == norm or (len(s_key) > 4 and s_key in norm):
                        matched_slot_entry = s_val
                        slot_candidate = part
                        break
                if matched_slot_entry:
                    break

            # 2. Match stem against slot_index keys
            if not matched_slot_entry:
                for s_key, s_val in slot_index.items():
                    if len(s_key) > 4 and (s_key in stem.lower() or s_key in root.lower()):
                        matched_slot_entry = s_val
                        slot_candidate = s_val['rawSlotFolder']
                        break

            # 3. Direct path inspection
            path_slot = None
            path_slot_info = {}
            for seg in all_parts:
                if not path_slot and is_date_folder_segment(seg):
                    path_slot = seg
                    path_slot_info = parse_date_folder(seg)

            if matched_slot_entry:
                safar_meta = matched_slot_entry['safarInfo']
                date_meta = matched_slot_entry['dateInfo']
                session = matched_slot_entry['session']
                folder_name = matched_slot_entry['rawSlotFolder']
            else:
                safar_meta = default_safar_meta
                date_meta = path_slot_info or parse_date_folder(path_slot or os.path.basename(root))
                folder_name = path_slot or os.path.basename(root)
                session = (date_meta.get('session') if date_meta else None) or 'Session'

            # Extract event code
            prefix = extract_event_code_from_string(stem)
            if not prefix or prefix == 'OTHER':
                prefix = extract_event_code_from_string(os.path.basename(root))
            if not prefix or prefix == 'OTHER':
                if matched_slot_entry and matched_slot_entry.get('eventItems'):
                    items = list(matched_slot_entry['eventItems'])
                    if len(items) == 1:
                        prefix = items[0]
            if not prefix:
                prefix = 'OTHER'

            file_date = int(os.path.getmtime(file_path) * 1000)
            h_year = date_meta.get('hijriYear') or safar_meta.get('safarYear')
            h_month = date_meta.get('hijriMonth')
            h_day = date_meta.get('hijriDay')

            # Approximate Gregorian timestamp for sorting
            if h_year and h_month and h_day:
                try:
                    import datetime
                    approx_g = datetime.datetime(h_year + 579, h_month, min(28, h_day), 12, 0)
                    file_date = int(approx_g.timestamp() * 1000)
                except Exception:
                    pass

            duration = get_video_duration(file_path, ffprobe_exe)
            is_reedit = bool(re.search(r'(?:reedit|re-edit|v2|_edit)', stem, re.I))

            dedup_key = f"{prefix}::{stem}::{file_date}"
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            safar_name = safar_meta.get('safar') or 'Unassigned'
            s_year = safar_meta.get('safarYear')
            s_serial = safar_meta.get('safarSerial')
            city = safar_meta.get('city') or 'Unassigned'

            records.append({
                'prefix': prefix,
                'name': stem,
                'date': file_date,
                'folder': folder_name or session,
                'duration': duration,
                'safar': safar_name,
                'safarYear': s_year,
                'safarSerial': s_serial,
                'city': city,
                'hijriYear': h_year,
                'hijriMonth': h_month,
                'hijriDay': h_day,
                'session': session,
                'filePath': file_path,
                'isReedit': is_reedit
            })

    return records


def run_safar_sync(target_path: str, db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Main entry point for syncing stats from a folder.
    Accepts either:
      1. A single Safar directory (e.g. 'E:\\In Process\\1448-10-Istefada ilmiyah')
      2. A container directory containing multiple Safars (e.g. 'E:\\In Process')
    """
    target_path = os.path.abspath(target_path)
    if not os.path.isdir(target_path):
        return {'success': False, 'error': f"Directory does not exist: {target_path}"}

    ffprobe_exe = find_ffprobe()
    target_db = get_db_path(db_path)

    # Determine if target_path is a single Safar folder or a root container
    final_direct = os.path.join(target_path, 'Final')
    is_single_safar = os.path.isdir(final_direct) or re.match(r'^\d{4}[\s\-_]+\d{1,3}[\s\-_]+.+', os.path.basename(target_path))

    safar_dirs_to_process = []
    if is_single_safar and os.path.isdir(final_direct):
        safar_dirs_to_process.append(target_path)
    else:
        # Check subdirectories for Safar folders
        for sub in os.listdir(target_path):
            sub_path = os.path.join(target_path, sub)
            if os.path.isdir(sub_path):
                sub_final = os.path.join(sub_path, 'Final')
                if os.path.isdir(sub_final):
                    safar_dirs_to_process.append(sub_path)
        if not safar_dirs_to_process:
            # Fallback: Treat target_path itself as Safar directory even if Final is missing
            safar_dirs_to_process.append(target_path)

    all_records = []
    processed_safars = set()

    for s_dir in safar_dirs_to_process:
        safar_meta = parse_safar_dir(os.path.basename(s_dir), s_dir)
        final_dir = os.path.join(s_dir, 'Final')
        slot_index = scan_safar_main_directory(s_dir)

        if os.path.isdir(final_dir):
            records = scan_safar_final_directory(final_dir, safar_meta, slot_index, ffprobe_exe)
            all_records.extend(records)
            if records:
                processed_safars.add(safar_meta['safar'])

    # Upsert into SQLite
    conn = sqlite3.connect(target_db)
    init_db(conn)
    inserted_count = insert_records(conn, all_records)
    conn.close()

    return {
        'success': True,
        'totalScanned': len(all_records),
        'inserted': inserted_count,
        'safars': sorted(list(processed_safars)),
        'records': all_records,
        'db': target_db
    }


def run_sync_legacy(main_dir: str, final_dir: str, db_path: Optional[str] = None) -> Dict[str, Any]:
    """Legacy compatibility mode with separate --main-dir and --final-dir."""
    ffprobe_exe = find_ffprobe()
    target_db = get_db_path(db_path)

    safar_meta = parse_safar_dir(os.path.basename(main_dir), main_dir)
    slot_index = scan_safar_main_directory(main_dir)
    records = scan_safar_final_directory(final_dir, safar_meta, slot_index, ffprobe_exe)

    conn = sqlite3.connect(target_db)
    init_db(conn)
    inserted_count = insert_records(conn, records)
    conn.close()

    unique_safars = sorted(list(set(r['safar'] for r in records if r.get('safar'))))
    return {
        'success': True,
        'totalScanned': len(records),
        'inserted': inserted_count,
        'safars': unique_safars,
        'records': records,
        'db': target_db
    }


def launch_gui():
    """Tkinter GUI for standalone interactive folder selection."""
    try:
        import tkinter as tk
        from tkinter import filedialog, messagebox
    except ImportError:
        print("Tkinter not available. Please pass --safar-dir via command line.")
        sys.exit(1)

    root = tk.Tk()
    root.title("One Tap — Old Stats Locator & Sync")
    root.geometry("560x360")
    root.resizable(False, False)
    root.configure(bg="#121317")

    safar_dir_var = tk.StringVar()
    status_var = tk.StringVar(value="Select a Safar folder (or In Process container) to analyze.")

    def browse_safar():
        p = filedialog.askdirectory(title="Select Safar Folder (e.g. 1448-10-Istefada ilmiyah or E:\\In Process)")
        if p:
            safar_dir_var.set(p)

    def start_sync():
        s_dir = safar_dir_var.get().strip()
        if not s_dir or not os.path.isdir(s_dir):
            messagebox.showwarning("Missing Directory", "Please select a valid Safar folder.")
            return

        status_var.set("Analyzing folder structure and extracting video durations...")
        root.update_idletasks()

        try:
            res = run_safar_sync(s_dir)
            status_var.set(f"Done! Imported {res['inserted']} videos across {len(res['safars'])} Safars.")
            messagebox.showinfo(
                "Sync Complete",
                f"Successfully scanned {res['totalScanned']} videos!\n"
                f"Saved {res['inserted']} records into stats.db.\n"
                f"Safars: {', '.join(res['safars']) if res['safars'] else 'Unassigned'}"
            )
        except Exception as e:
            status_var.set("Error during sync.")
            messagebox.showerror("Sync Error", str(e))

    tk.Label(root, text="One Tap — Safar Stats Importer", font=("Helvetica", 14, "bold"), fg="#818cf8", bg="#121317").pack(pady=(18, 4))
    tk.Label(root, text="Automatically parses Safar name, Hijri months/dates, and video durations", font=("Helvetica", 9), fg="#94a3b8", bg="#121317").pack(pady=(0, 16))

    frame = tk.Frame(root, bg="#121317")
    frame.pack(fill="x", padx=24, pady=10)
    tk.Label(frame, text="Safar Directory or Container (e.g. E:\\In Process\\1448-10-Istefada ilmiyah):", font=("Helvetica", 9, "bold"), fg="#e2e8f0", bg="#121317").pack(anchor="w")
    row = tk.Frame(frame, bg="#121317")
    row.pack(fill="x", pady=6)
    tk.Entry(row, textvariable=safar_dir_var, font=("Helvetica", 9), bg="#1e2028", fg="#ffffff", insertbackground="#fff").pack(side="left", fill="x", expand=True, padx=(0, 8))
    tk.Button(row, text="Browse...", command=browse_safar, bg="#334155", fg="#ffffff", relief="flat", padx=12).pack(side="right")

    tk.Button(root, text="🚀 Start Analysis & Add to Stats", command=start_sync, font=("Helvetica", 11, "bold"), bg="#6366f1", fg="#ffffff", activebackground="#4f46e5", activeforeground="#fff", relief="flat", pady=8, cursor="hand2").pack(fill="x", padx=24, pady=(20, 8))
    tk.Label(root, textvariable=status_var, font=("Helvetica", 9), fg="#38bdf8", bg="#121317").pack(pady=4)

    root.mainloop()


def main():
    parser = argparse.ArgumentParser(description="One Tap Old Stats Locator & Sync")
    parser.add_argument('--safar-dir', help="Main Safar directory (e.g. E:\\In Process\\1448-10-Istefada ilmiyah) or root container")
    parser.add_argument('--main-dir', help="Legacy: Main project directory containing folder structure (skips 'Final')")
    parser.add_argument('--final-dir', help="Legacy: Final rendered videos directory organized date-wise")
    parser.add_argument('--db', help="Path to sqlite db file")
    parser.add_argument('--gui', action='store_true', help="Open interactive GUI folder picker")

    args = parser.parse_args()

    if args.gui or (not args.safar_dir and not args.main_dir):
        launch_gui()
        return

    try:
        if args.safar_dir:
            res = run_safar_sync(args.safar_dir, args.db)
        elif args.main_dir and args.final_dir:
            res = run_sync_legacy(args.main_dir, args.final_dir, args.db)
        elif args.main_dir and not args.final_dir:
            # Main dir specified alone: check for Final directory inside it
            res = run_safar_sync(args.main_dir, args.db)
        else:
            print(json.dumps({'success': False, 'error': 'Either --safar-dir or --main-dir is required.'}))
            sys.exit(1)

        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
