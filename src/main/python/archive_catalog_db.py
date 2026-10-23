#!/usr/bin/env python3
"""
============================================================
ARCHIVE CATALOG DATABASE ENGINE (src/main/python/archive_catalog_db.py)
Part of One Tap Workstation

Lightweight, high-speed SQLite database engine with FTS5
full-text search for cataloging millions of media files with
sub-millisecond lookups and near-zero local storage footprint.
============================================================
"""

import sys
import os
import json
import sqlite3
import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

# Fix Windows terminal UTF-8 encoding
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def get_default_db_path(custom_path: Optional[str] = None) -> str:
    """Returns path to archive_catalog.db inside One Tap user data directory or custom location."""
    if custom_path and os.path.exists(os.path.dirname(custom_path) or '.'):
        return custom_path

    appdata = os.environ.get('APPDATA') or os.path.expanduser('~')
    locator_dir = os.path.join(appdata, 'One Tap')
    locator_file = os.path.join(locator_dir, 'settings_location.ini')

    if os.path.exists(locator_file):
        try:
            with open(locator_file, 'r', encoding='utf-8') as f:
                target_folder = f.read().strip()
                if target_folder and os.path.isdir(target_folder):
                    return os.path.join(target_folder, 'archive_catalog.db')
        except Exception:
            pass

    os.makedirs(locator_dir, exist_ok=True)
    return os.path.join(locator_dir, 'archive_catalog.db')

def get_tracker_db_path(custom_path: Optional[str] = None) -> str:
    """Returns path to tracker.db inside One Tap user data directory or custom location."""
    if custom_path and os.path.exists(os.path.dirname(custom_path) or '.'):
        return custom_path

    appdata = os.environ.get('APPDATA') or os.path.expanduser('~')
    locator_dir = os.path.join(appdata, 'One Tap')
    locator_file = os.path.join(locator_dir, 'settings_location.ini')

    if os.path.exists(locator_file):
        try:
            with open(locator_file, 'r', encoding='utf-8') as f:
                target_folder = f.read().strip()
                if target_folder and os.path.isdir(target_folder):
                    return os.path.join(target_folder, 'tracker.db')
        except Exception:
            pass

    os.makedirs(locator_dir, exist_ok=True)
    return os.path.join(locator_dir, 'tracker.db')

def get_settings_json_path() -> Optional[str]:
    """Finds settings.json path from settings_location.ini or APPDATA."""
    appdata = os.environ.get('APPDATA') or os.path.expanduser('~')
    locator_dir = os.path.join(appdata, 'One Tap')
    locator_file = os.path.join(locator_dir, 'settings_location.ini')

    if os.path.exists(locator_file):
        try:
            with open(locator_file, 'r', encoding='utf-8') as f:
                target_folder = f.read().strip()
                if target_folder and os.path.isdir(target_folder):
                    cand = os.path.join(target_folder, 'settings.json')
                    if os.path.exists(cand):
                        return cand
        except Exception:
            pass

    default_cand = os.path.join(locator_dir, 'settings.json')
    return default_cand if os.path.exists(default_cand) else None

def load_tracker_status_map(tracker_db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Loads task statuses, paths, and media resource categories from tracker.db
    as well as real-time TO UPLOAD and TO DELETE folder scans from disk into memory.
    Enforces strict priority: to_delete (4) > to_upload (3) > final_render (2) > raw_footage/folder (1).
    """
    path = tracker_db_path or get_tracker_db_path()
    result: Dict[str, Any] = {
        'tasks_by_date': {},
        'tasks_by_safar_date': {},
        'resources_by_name': {},
        'resources_by_stem': {},
        'resources_by_path': {},
        'resource_path_by_name': {}
    }

    # Helper to register resource with priority
    priority_order = {'to_delete': 4, 'to_upload': 3, 'final_render': 2, 'raw_footage': 1, 'folder': 0}
    def register_res(name: str, pth: str, cat: str):
        fn_clean = (name or '').strip().lower()
        fp_clean = os.path.normpath(pth).strip().lower() if pth else ''
        cat_clean = (cat or '').strip().lower()
        if not fn_clean or not cat_clean:
            return

        stem_clean = os.path.splitext(fn_clean)[0].lower()
        curr_cat = result['resources_by_name'].get(fn_clean)
        if not curr_cat or priority_order.get(cat_clean, 1) >= priority_order.get(curr_cat, 1):
            result['resources_by_name'][fn_clean] = cat_clean
            if pth:
                result['resource_path_by_name'][fn_clean] = pth
        if stem_clean:
            curr_stem_cat = result['resources_by_stem'].get(stem_clean)
            if not curr_stem_cat or priority_order.get(cat_clean, 1) >= priority_order.get(curr_stem_cat, 1):
                result['resources_by_stem'][stem_clean] = cat_clean
        if fp_clean:
            curr_path_cat = result['resources_by_path'].get(fp_clean)
            if not curr_path_cat or priority_order.get(cat_clean, 1) >= priority_order.get(curr_path_cat, 1):
                result['resources_by_path'][fp_clean] = cat_clean

    # 1. Load from tracker.db
    if path and os.path.exists(path):
        try:
            conn = sqlite3.connect(path, timeout=5.0)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tracker_tasks'")
            if cur.fetchone():
                cur.execute("""
                    SELECT safar_name, date_folder, status, working_path, final_path, upload_path, delete_path
                    FROM tracker_tasks
                """)
                for r in cur.fetchall():
                    s_name = (r['safar_name'] or '').strip().lower()
                    d_folder = (r['date_folder'] or '').strip().lower()
                    status = (r['status'] or 'editing_pending').strip().lower()
                    task_data = {
                        'safar_name': r['safar_name'],
                        'date_folder': r['date_folder'],
                        'status': status,
                        'working_path': r['working_path'] or '',
                        'final_path': r['final_path'] or '',
                        'upload_path': r['upload_path'] or '',
                        'delete_path': r['delete_path'] or ''
                    }
                    if d_folder:
                        result['tasks_by_date'][d_folder] = task_data
                    if s_name and d_folder:
                        result['tasks_by_safar_date'][(s_name, d_folder)] = task_data

            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tracker_media_resources'")
            if cur.fetchone():
                cur.execute("""
                    SELECT file_name, file_path, category, date_folder, safar_name
                    FROM tracker_media_resources
                    ORDER BY CASE LOWER(category)
                        WHEN 'final_render' THEN 1
                        WHEN 'to_upload' THEN 2
                        WHEN 'to_delete' THEN 3
                        ELSE 0
                    END ASC
                """)
                for r in cur.fetchall():
                    fn = (r['file_name'] or '').strip()
                    fp = (r['file_path'] or '').strip()
                    cat = (r['category'] or '').strip()
                    register_res(fn, fp, cat)

            conn.close()
        except Exception:
            pass

    # 2. Real-time folder scan from task_tracker_drives in settings.json + standard drive locations
    to_upload_dirs = set()
    to_delete_dirs = set()

    settings_file = get_settings_json_path()
    if settings_file and os.path.exists(settings_file):
        try:
            with open(settings_file, 'r', encoding='utf-8') as f:
                settings_data = json.load(f)
            tt_drives = settings_data.get('task_tracker_drives') or []
            for d in tt_drives:
                up_p = (d.get('toUploadPath') or '').strip()
                del_p = (d.get('toDeletePath') or '').strip()
                if up_p and os.path.isdir(up_p):
                    to_upload_dirs.add(up_p)
                if del_p and os.path.isdir(del_p):
                    to_delete_dirs.add(del_p)
        except Exception:
            pass

    # Auto-detect common drive roots if not already included
    for drv_letter in ['C', 'D', 'E', 'F', 'G', 'H']:
        drv_prefix = f"{drv_letter}:\\"
        if os.path.exists(drv_prefix):
            for up_name in ['TO UPLOAD', 'To Upload', 'UPLOADED DATA', 'Uploaded Data']:
                cand = os.path.join(drv_prefix, up_name)
                if os.path.isdir(cand):
                    to_upload_dirs.add(cand)
            for del_name in ['TO DELETE', 'To Delete', 'DELETED DATA']:
                cand = os.path.join(drv_prefix, del_name)
                if os.path.isdir(cand):
                    to_delete_dirs.add(cand)

    # Walk TO UPLOAD folders
    for up_dir in to_upload_dirs:
        try:
            for root, _, files in os.walk(up_dir):
                for f in files:
                    if f.startswith('.') or f.lower().endswith(('.ini', '.db', '.tmp')):
                        continue
                    full_p = os.path.join(root, f)
                    register_res(f, full_p, 'to_upload')
        except Exception:
            pass

    # Walk TO DELETE folders
    for del_dir in to_delete_dirs:
        try:
            for root, _, files in os.walk(del_dir):
                for f in files:
                    if f.startswith('.') or f.lower().endswith(('.ini', '.db', '.tmp')):
                        continue
                    full_p = os.path.join(root, f)
                    register_res(f, full_p, 'to_delete')
        except Exception:
            pass

    return result

def extract_date_session_key(rel_path: str = '', folder_name: str = '') -> Optional[str]:
    """Extracts date folder pattern like 1448-02-28 _02E or 1448-03-01 from path or folder name."""
    norm = (rel_path or '').replace('/', '\\')
    for seg in norm.split('\\'):
        m = re.search(r'(\d{4}[-_.]\d{1,2}(?:[-_.]\d{1,2})?(?:\s*_\d{1,2}[A-Za-z])?)', seg)
        if m:
            return m.group(1).strip().lower()
    if folder_name:
        m = re.search(r'(\d{4}[-_.]\d{1,2}(?:[-_.]\d{1,2})?(?:\s*_\d{1,2}[A-Za-z])?)', folder_name)
        if m:
            return m.group(1).strip().lower()
    return None

def resolve_item_tracker_status(item: Dict[str, Any], tracker_map: Dict[str, Any]) -> Tuple[str, Optional[str]]:
    """
    Returns (status, matched_path_or_note) for a media item or folder node using tracker_map.
    Lifecycle statuses:
      - 'submitted'        (AlJamea Archived / To Delete)
      - 'uploaded'         (Ready in To Upload / Uploaded Data)
      - 'rendered_pending' (Rendered output in Final, pending upload)
      - 'review'           (Editing complete, in review)
      - 'editing'          (Actively in editing)
      - 'not_uploaded'     (Not yet uploaded / pending)
    """
    fn = (item.get('file_name') or '').strip().lower()
    fn_stem = (item.get('file_stem') or (os.path.splitext(fn)[0] if fn else '')).strip().lower()
    full_p = os.path.normpath(item.get('full_path') or '').strip().lower()
    rel_p = (item.get('relative_path') or '').replace('/', '\\')
    folder_n = item.get('folder_name') or ''
    safar_n = (item.get('safar_name') or '').strip().lower()

    # 0. DVD exclusion: DVD folders are local distribution cuts and are never uploaded
    rel_p_parts = [p.lower().strip() for p in rel_p.replace('/', '\\').split('\\') if p.strip()]
    if 'dvd' in rel_p_parts or folder_n.lower().strip() == 'dvd' or fn.startswith('dvd_') or '_dvd_' in fn:
        return 'dvd_local', 'Local DVD Cut (Excluded from Upload)'

    # 1. Exact full file path match in resources_by_path
    if full_p and full_p in tracker_map.get('resources_by_path', {}):
        cat = tracker_map['resources_by_path'][full_p]
        if cat == 'to_delete':
            return 'submitted', tracker_map.get('resource_path_by_name', {}).get(fn) or 'Tracker: TO DELETE'
        elif cat == 'to_upload':
            return 'uploaded', tracker_map.get('resource_path_by_name', {}).get(fn) or 'Tracker: TO UPLOAD'
        elif cat == 'final_render':
            return 'rendered_pending', 'Tracker: Final Render'

    # 2. File name exact match in resources_by_name
    if fn and fn in tracker_map.get('resources_by_name', {}):
        cat = tracker_map['resources_by_name'][fn]
        matched_loc = tracker_map.get('resource_path_by_name', {}).get(fn)
        if cat == 'to_delete':
            return 'submitted', matched_loc or 'Tracker: Matched File in TO DELETE'
        elif cat == 'to_upload':
            return 'uploaded', matched_loc or 'Tracker: Matched File in TO UPLOAD'
        elif cat == 'final_render':
            return 'rendered_pending', 'Tracker: Matched Final Render'

    # 2.5 File stem match in resources_by_stem (for matching video rendered to different container)
    if fn_stem and fn_stem in tracker_map.get('resources_by_stem', {}):
        cat = tracker_map['resources_by_stem'][fn_stem]
        if cat == 'to_delete':
            return 'submitted', 'Tracker: Matched Stem in TO DELETE'
        elif cat == 'to_upload':
            return 'uploaded', 'Tracker: Matched Stem in TO UPLOAD'

    # 3. Match via date folder in tracker_tasks
    date_key = extract_date_session_key(rel_p, folder_n)
    if date_key:
        task = tracker_map.get('tasks_by_safar_date', {}).get((safar_n, date_key)) or tracker_map.get('tasks_by_date', {}).get(date_key)
        if task:
            t_status = task.get('status')
            if t_status == 'submitted':
                return 'submitted', f"Tracker Task ({task.get('date_folder')}): Submitted"
            elif t_status == 'uploaded':
                return 'uploaded', f"Tracker Task ({task.get('date_folder')}): Uploaded"
            elif t_status == 'upload_pending':
                return 'rendered_pending', f"Tracker Task ({task.get('date_folder')}): Rendered, Pending Upload"
            elif t_status == 'review':
                return 'review', f"Tracker Task ({task.get('date_folder')}): In Review"
            elif t_status == 'editing':
                return 'editing', f"Tracker Task ({task.get('date_folder')}): In Editing"
            elif t_status == 'editing_pending':
                return 'not_uploaded', f"Tracker Task ({task.get('date_folder')}): Not Uploaded"

    # 4. Fallback to existing upload_status on record if valid (preserve manual overrides)
    existing = (item.get('upload_status') or '').strip().lower()
    if existing and existing not in ('unknown', ''):
        return existing, item.get('uploaded_path')

    # 5. Default fallback
    if 'final' in rel_p.lower() or 'final' in folder_n.lower():
        return 'rendered_pending', 'Final Directory'
    return 'not_uploaded', None

def sync_tracker_statuses(archive_id: Optional[int] = None, db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Synchronizes all task statuses from tracker.db into archive_catalog.db media_items.upload_status.
    """
    path = db_path or get_default_db_path()
    t_map = load_tracker_status_map()
    if not t_map.get('tasks_by_date') and not t_map.get('resources_by_name'):
        return {'success': True, 'synced_count': 0, 'message': 'Tracker DB has no tasks yet.'}

    conn = get_connection(path)
    cur = conn.cursor()

    query = """
        SELECT m.id, m.file_name, f.relative_path, f.folder_name, a.safar_name, a.root_path, m.upload_status
        FROM media_items m
        JOIN folder_nodes f ON f.id = m.folder_id
        JOIN scanned_archives a ON a.id = m.archive_id
    """
    params = []
    if archive_id:
        query += " WHERE m.archive_id = ?"
        params.append(archive_id)

    cur.execute(query, params)
    rows = cur.fetchall()

    updates = []
    synced_count = 0
    for r in rows:
        item_dict = {
            'file_name': r['file_name'],
            'relative_path': r['relative_path'],
            'folder_name': r['folder_name'],
            'safar_name': r['safar_name'],
            'full_path': os.path.normpath(os.path.join(r['root_path'] or '', r['relative_path'] or '', r['file_name'] or '')),
            'upload_status': r['upload_status']
        }
        st, p = resolve_item_tracker_status(item_dict, t_map)
        if st and st != r['upload_status']:
            updates.append((st, p, r['id']))
            synced_count += 1

    if updates:
        cur.executemany("UPDATE media_items SET upload_status = ?, uploaded_path = ? WHERE id = ?", updates)
        conn.commit()

    conn.close()
    return {'success': True, 'synced_count': synced_count, 'total_evaluated': len(rows)}

# Comprehensive Adobe project, auto-save, scratch, cache, and sidecar extensions to exclude
ADOBE_EXCLUDE_EXTS = (
    '.prproj', '.prproj~', '.prel', '.prfpset', '.mogrt', '.plb', '.prm', '.prmf',
    '.aep', '.aepx', '.aet',
    '.psd', '.psb', '.pdd',
    '.ai', '.ait',
    '.sesx', '.ses', '.asnd',
    '.indd', '.idml', '.indt', '.inx',
    '.xd',
    '.pek', '.cfa', '.ims', '.imsx', '.mcdb'
)

def purge_adobe_artifacts(conn: sqlite3.Connection) -> None:
    """Purges any legacy Adobe project files, conformed audio, or auto-save nodes."""
    try:
        cur = conn.cursor()
        ext_placeholders = ', '.join(['?'] * len(ADOBE_EXCLUDE_EXTS))
        cur.execute(f"""
            DELETE FROM media_items 
            WHERE LOWER(file_ext) IN ({ext_placeholders}) 
               OR media_type = 'project'
        """, [e.lower() for e in ADOBE_EXCLUDE_EXTS])

        cur.execute("""
            DELETE FROM folder_nodes
            WHERE LOWER(folder_name) LIKE '%adobe%'
               OR LOWER(folder_name) LIKE '%auto-save%'
               OR LOWER(folder_name) LIKE '%autosave%'
               OR LOWER(folder_name) LIKE '%preview files%'
               OR LOWER(folder_name) LIKE '%media cache%'
               OR LOWER(folder_name) LIKE '%peak files%'
               OR LOWER(folder_name) LIKE '%disk cache%'
        """)
        conn.commit()
    except Exception:
        pass

def ensure_schema_migrations(conn: sqlite3.Connection) -> None:
    """Ensures newly added columns exist in older database files without needing a manual reset."""
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='media_items'")
        if cur.fetchone():
            cur.execute("PRAGMA table_info(media_items)")
            cols = [col[1] for col in cur.fetchall()]
            if 'upload_status' not in cols:
                cur.execute("ALTER TABLE media_items ADD COLUMN upload_status TEXT DEFAULT 'unknown'")
            if 'uploaded_path' not in cols:
                cur.execute("ALTER TABLE media_items ADD COLUMN uploaded_path TEXT")
            conn.commit()
    except Exception:
        pass

def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Connects to SQLite database with optimized WAL mode and foreign key support."""
    path = db_path or get_default_db_path()
    conn = sqlite3.connect(path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA busy_timeout = 10000;")
    # High performance memory and caching pragmas
    conn.execute("PRAGMA cache_size = -64000;")     # 64MB RAM page cache
    conn.execute("PRAGMA mmap_size = 268435456;")   # 256MB direct kernel memory map for ultra-fast I/O
    conn.execute("PRAGMA temp_store = MEMORY;")     # Keep temp tables and sorting operations in RAM
    ensure_schema_migrations(conn)
    return conn

def init_db(db_path: Optional[str] = None) -> None:
    """Initializes tables and high-performance covering indexes."""
    conn = get_connection(db_path)
    cur = conn.cursor()

    # Drop legacy/broken FTS virtual table & triggers if present
    cur.execute("DROP TRIGGER IF EXISTS trg_media_ai;")
    cur.execute("DROP TRIGGER IF EXISTS trg_media_ad;")
    cur.execute("DROP TRIGGER IF EXISTS trg_media_au;")
    cur.execute("DROP TABLE IF EXISTS media_fts;")

    cur.executescript("""
    -- 1. Physical Drive / Volume Tracker
    CREATE TABLE IF NOT EXISTS drive_volumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        volume_label TEXT NOT NULL UNIQUE,
        serial_number TEXT,
        physical_location TEXT, -- e.g. "Shelf 2, Drawer B"
        notes TEXT,
        last_seen_date TEXT
    );

    -- 2. Scanned Archive Root Records (One per Safar)
    CREATE TABLE IF NOT EXISTS scanned_archives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        drive_id INTEGER REFERENCES drive_volumes(id) ON DELETE SET NULL,
        safar_name TEXT NOT NULL,
        safar_folder TEXT NOT NULL,
        safar_year INTEGER,
        safar_serial TEXT,
        city TEXT,
        root_path TEXT NOT NULL,
        total_files INTEGER DEFAULT 0,
        total_mp4_count INTEGER DEFAULT 0,
        total_photo_count INTEGER DEFAULT 0,
        total_size_bytes INTEGER DEFAULT 0,
        total_duration_seconds REAL DEFAULT 0.0,
        scan_timestamp TEXT NOT NULL
    );

    -- 3. Folder Hierarchy Nodes
    CREATE TABLE IF NOT EXISTS folder_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        archive_id INTEGER NOT NULL REFERENCES scanned_archives(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES folder_nodes(id) ON DELETE CASCADE,
        relative_path TEXT NOT NULL,
        folder_name TEXT NOT NULL,
        date_canonical_hijri TEXT, -- YYYY-MM-DD
        date_canonical_greg TEXT,  -- YYYY-MM-DD
        session_name TEXT,         -- Bethak, QMZ, Majlis, Namaz, etc.
        session_tag TEXT,          -- _01M, _02E
        event_code TEXT,           -- AQ, N, Z, M, Q, WAAZ, etc.
        folder_size_bytes INTEGER DEFAULT 0,
        mp4_count INTEGER DEFAULT 0,
        photo_count INTEGER DEFAULT 0
    );

    -- 4. Media Items (Video, Photo, Audio, Project files)
    CREATE TABLE IF NOT EXISTS media_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        archive_id INTEGER NOT NULL REFERENCES scanned_archives(id) ON DELETE CASCADE,
        folder_id INTEGER NOT NULL REFERENCES folder_nodes(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_stem TEXT NOT NULL,
        file_ext TEXT NOT NULL,
        media_type TEXT NOT NULL, -- 'video', 'photo', 'audio', 'project', 'other'
        size_bytes INTEGER DEFAULT 0,
        duration_seconds REAL DEFAULT 0.0,
        duration_formatted TEXT,
        upload_status TEXT DEFAULT 'unknown',
        uploaded_path TEXT,
        created_time TEXT,
        modified_time TEXT
    );

    -- 5. Optimized Composite & Covering Indexes for Sub-Millisecond Queries
    CREATE INDEX IF NOT EXISTS idx_scanned_archives_sort ON scanned_archives(safar_year DESC, safar_serial DESC, scan_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_scanned_archives_name ON scanned_archives(safar_name);
    CREATE INDEX IF NOT EXISTS idx_scanned_archives_drive ON scanned_archives(drive_id);

    CREATE INDEX IF NOT EXISTS idx_folder_archive ON folder_nodes(archive_id);
    CREATE INDEX IF NOT EXISTS idx_folder_archive_path ON folder_nodes(archive_id, relative_path);
    CREATE INDEX IF NOT EXISTS idx_folder_archive_date ON folder_nodes(archive_id, date_canonical_hijri);
    CREATE INDEX IF NOT EXISTS idx_folder_name ON folder_nodes(folder_name);
    CREATE INDEX IF NOT EXISTS idx_folder_event ON folder_nodes(archive_id, event_code);

    CREATE INDEX IF NOT EXISTS idx_media_archive ON media_items(archive_id);
    CREATE INDEX IF NOT EXISTS idx_media_folder ON media_items(folder_id);
    CREATE INDEX IF NOT EXISTS idx_media_archive_folder ON media_items(archive_id, folder_id);
    CREATE INDEX IF NOT EXISTS idx_media_archive_type ON media_items(archive_id, media_type);
    CREATE INDEX IF NOT EXISTS idx_media_filename ON media_items(file_name);
    CREATE INDEX IF NOT EXISTS idx_media_stem ON media_items(file_stem);
    CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(media_type);
    CREATE INDEX IF NOT EXISTS idx_media_upload_status ON media_items(upload_status);
    CREATE INDEX IF NOT EXISTS idx_media_duration ON media_items(archive_id, duration_seconds);
    CREATE INDEX IF NOT EXISTS idx_media_recon ON media_items(archive_id, file_name, size_bytes);

    CREATE INDEX IF NOT EXISTS idx_drive_volumes_label ON drive_volumes(volume_label);
    """)

    # Ensure schema migrations for existing databases
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(media_items)")
    existing_cols = [col[1] for col in cur.fetchall()]
    if 'upload_status' not in existing_cols:
        cur.execute("ALTER TABLE media_items ADD COLUMN upload_status TEXT DEFAULT 'unknown'")
    if 'uploaded_path' not in existing_cols:
        cur.execute("ALTER TABLE media_items ADD COLUMN uploaded_path TEXT")

    purge_adobe_artifacts(conn)
    conn.commit()
    conn.close()

def format_duration(seconds: float) -> str:
    """Formats seconds into HH:MM:SS or MM:SS."""
    if not seconds or seconds <= 0:
        return "00:00"
    total_sec = int(round(seconds))
    hrs = total_sec // 3600
    rem = total_sec % 3600
    mins = rem // 60
    secs = rem % 60
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"

def list_safars(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns all scanned Safars with aggregated stats, total days count, and physical drive information."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            a.id,
            a.safar_name,
            a.safar_folder,
            a.safar_year,
            a.safar_serial,
            a.city,
            a.root_path,
            a.total_files,
            a.total_mp4_count,
            a.total_photo_count,
            a.total_size_bytes,
            a.total_duration_seconds,
            a.scan_timestamp,
            d.volume_label as drive_label,
            d.physical_location as drive_location,
            (
                SELECT COUNT(DISTINCT COALESCE(f.date_canonical_hijri, f.date_canonical_greg, f.folder_name))
                FROM folder_nodes f
                WHERE f.archive_id = a.id
                  AND (f.date_canonical_hijri IS NOT NULL OR f.date_canonical_greg IS NOT NULL OR f.folder_name GLOB '[0-9]*')
            ) as total_days_count
        FROM scanned_archives a
        LEFT JOIN drive_volumes d ON d.id = a.drive_id
        ORDER BY a.safar_year DESC, a.safar_serial DESC, a.scan_timestamp DESC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    for r in rows:
        r['duration_formatted'] = format_duration(r.get('total_duration_seconds') or 0.0)
        days = r.get('total_days_count')
        if not days or days <= 0:
            r['total_days_count'] = 1
    return rows

def get_safar_summary(archive_id: int, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Returns detailed metrics for a specific Safar including category breakdown."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("""
        SELECT a.*, d.volume_label, d.physical_location
        FROM scanned_archives a
        LEFT JOIN drive_volumes d ON d.id = a.drive_id
        WHERE a.id = ?
    """, (archive_id,))
    archive = cur.fetchone()
    if not archive:
        conn.close()
        return None

    res = dict(archive)
    res['duration_formatted'] = format_duration(res['total_duration_seconds'])

    # Media type distribution
    cur.execute("""
        SELECT media_type, COUNT(*) as count, SUM(size_bytes) as total_size, SUM(duration_seconds) as total_duration
        FROM media_items
        WHERE archive_id = ?
        GROUP BY media_type
    """, (archive_id,))
    res['media_distribution'] = [dict(r) for r in cur.fetchall()]

    # Event code distribution
    cur.execute("""
        SELECT event_code, COUNT(*) as count, SUM(folder_size_bytes) as size
        FROM folder_nodes
        WHERE archive_id = ? AND event_code IS NOT NULL AND event_code != ''
        GROUP BY event_code
        ORDER BY count DESC
    """, (archive_id,))
    res['event_distribution'] = [dict(r) for r in cur.fetchall()]

    # Date folders count
    cur.execute("""
        SELECT COUNT(DISTINCT date_canonical_hijri) as unique_dates
        FROM folder_nodes
        WHERE archive_id = ? AND date_canonical_hijri IS NOT NULL
    """, (archive_id,))
    row = cur.fetchone()
    res['unique_dates_count'] = row['unique_dates'] if row else 0

    conn.close()
    return res

def list_archive_folders(archive_id: int, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all folder nodes in a specific archive for hierarchical folder selection."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            f.id,
            f.archive_id,
            f.relative_path,
            f.folder_name,
            f.date_canonical_hijri,
            f.date_canonical_greg,
            f.session_name,
            f.session_tag,
            f.event_code,
            f.folder_size_bytes,
            f.mp4_count,
            f.photo_count
        FROM folder_nodes f
        WHERE f.archive_id = ?
        ORDER BY f.relative_path ASC
    """, (archive_id,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def list_archive_dates(archive_id: int, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists distinct date folders/sessions in a specific archive with clip and photo counts."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            COALESCE(f.date_canonical_hijri, f.date_canonical_greg, 'Unknown Date') as date_val,
            f.date_canonical_hijri,
            f.date_canonical_greg,
            f.session_tag,
            COUNT(DISTINCT f.id) as folder_count,
            SUM(f.mp4_count) as total_mp4_count,
            SUM(f.photo_count) as total_photo_count,
            SUM(f.folder_size_bytes) as total_size_bytes
        FROM folder_nodes f
        WHERE f.archive_id = ? AND (f.date_canonical_hijri IS NOT NULL OR f.date_canonical_greg IS NOT NULL)
        GROUP BY COALESCE(f.date_canonical_hijri, f.date_canonical_greg), f.session_tag
        ORDER BY date_val ASC, f.session_tag ASC
    """, (archive_id,))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows

def get_safar_days_breakdown(archive_id: int, db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Computes an extensive, day-by-day chronological breakdown of a Safar.
    Returns:
      - Safar info (name, city, year, drive, path)
      - Summary totals (days count, total clips, photos, duration, size)
      - Date range (first and last dates)
      - Chronological list of days with per-day stats, subfolders, and sessions
    """
    import re
    conn = get_connection(db_path)
    cur = conn.cursor()

    # 1. Fetch Safar metadata
    cur.execute("""
        SELECT a.*, d.volume_label, d.physical_location
        FROM scanned_archives a
        LEFT JOIN drive_volumes d ON d.id = a.drive_id
        WHERE a.id = ?
    """, (archive_id,))
    archive_row = cur.fetchone()
    if not archive_row:
        conn.close()
        return {'success': False, 'error': f"Archive ID {archive_id} not found"}
    archive = dict(archive_row)

    # 2. Fetch all folder nodes for this archive
    cur.execute("""
        SELECT 
            id, folder_name, relative_path, session_name, session_tag,
            event_code, date_canonical_hijri, date_canonical_greg,
            mp4_count, photo_count, folder_size_bytes
        FROM folder_nodes
        WHERE archive_id = ?
        ORDER BY COALESCE(date_canonical_hijri, date_canonical_greg, folder_name) ASC, session_tag ASC
    """, (archive_id,))
    folder_rows = [dict(r) for r in cur.fetchall()]

    # Also fetch media item durations grouped by folder_id
    cur.execute("""
        SELECT folder_id, SUM(duration_seconds) as total_duration
        FROM media_items
        WHERE archive_id = ? AND media_type = 'video'
        GROUP BY folder_id
    """, (archive_id,))
    duration_map = {r['folder_id']: (r['total_duration'] or 0.0) for r in cur.fetchall()}

    conn.close()

    # 3. Group folders by date
    days_map: Dict[str, Dict[str, Any]] = {}

    for f in folder_rows:
        date_key = f.get('date_canonical_hijri') or f.get('date_canonical_greg')
        if not date_key:
            # Try to extract date pattern like 14-02-1446 or 2024-08-19 from folder_name
            m = re.search(r'(\d{1,4}[-_\.]\d{1,2}[-_\.]\d{1,4})', f.get('folder_name', ''))
            if m:
                date_key = m.group(1)
            else:
                date_key = f.get('folder_name') or 'General Day'

        if date_key not in days_map:
            days_map[date_key] = {
                'date_key': date_key,
                'date_hijri': f.get('date_canonical_hijri'),
                'date_greg': f.get('date_canonical_greg'),
                'folders': [],
                'sessions': set(),
                'mp4_count': 0,
                'photo_count': 0,
                'size_bytes': 0,
                'duration_seconds': 0.0
            }

        d_entry = days_map[date_key]
        d_entry['folders'].append({
            'id': f['id'],
            'folder_name': f['folder_name'],
            'relative_path': f['relative_path'],
            'session_name': f['session_name'],
            'session_tag': f['session_tag'],
            'mp4_count': f.get('mp4_count') or 0,
            'photo_count': f.get('photo_count') or 0,
            'size_bytes': f.get('folder_size_bytes') or 0
        })
        if f.get('session_tag'):
            d_entry['sessions'].add(f['session_tag'])
        elif f.get('session_name'):
            d_entry['sessions'].add(f['session_name'])

        d_entry['mp4_count'] += f.get('mp4_count') or 0
        d_entry['photo_count'] += f.get('photo_count') or 0
        d_entry['size_bytes'] += f.get('folder_size_bytes') or 0
        d_entry['duration_seconds'] += duration_map.get(f['id'], 0.0)

    # 4. Convert days_map into sorted array with day numbers
    sorted_date_keys = sorted(days_map.keys())
    days_list = []
    for idx, dk in enumerate(sorted_date_keys, 1):
        item = days_map[dk]
        days_list.append({
            'day_number': idx,
            'date_key': dk,
            'date_hijri': item['date_hijri'],
            'date_greg': item['date_greg'],
            'folders': item['folders'],
            'sessions': sorted(list(item['sessions'])),
            'mp4_count': item['mp4_count'],
            'photo_count': item['photo_count'],
            'size_bytes': item['size_bytes'],
            'duration_seconds': item['duration_seconds'],
            'duration_formatted': format_duration(item['duration_seconds'])
        })

    total_days = len(days_list) or 1
    total_mp4 = sum(d['mp4_count'] for d in days_list) or (archive.get('total_mp4_count') or 0)
    total_photo = sum(d['photo_count'] for d in days_list) or (archive.get('total_photo_count') or 0)
    total_size = sum(d['size_bytes'] for d in days_list) or (archive.get('total_size_bytes') or 0)
    total_dur = sum(d['duration_seconds'] for d in days_list) or (archive.get('total_duration_seconds') or 0.0)

    first_date = days_list[0]['date_key'] if days_list else '—'
    last_date = days_list[-1]['date_key'] if days_list else '—'

    return {
        'success': True,
        'archive_id': archive_id,
        'safar_name': archive.get('safar_name'),
        'city': archive.get('city'),
        'safar_year': archive.get('safar_year'),
        'safar_serial': archive.get('safar_serial'),
        'root_path': archive.get('root_path'),
        'drive_label': archive.get('volume_label'),
        'drive_location': archive.get('physical_location'),
        'total_days_count': total_days,
        'total_mp4_count': total_mp4,
        'total_photo_count': total_photo,
        'total_size_bytes': total_size,
        'total_duration_seconds': total_dur,
        'total_duration_formatted': format_duration(total_dur),
        'first_date': first_date,
        'last_date': last_date,
        'days': days_list
    }

def search_media(
    query: str = '',
    archive_id: Optional[int] = None,
    media_type: Optional[str] = None,
    event_code: Optional[str] = None,
    final_only: bool = False,
    search_target: Optional[str] = 'all',
    min_duration: Optional[float] = None,
    max_duration: Optional[float] = None,
    limit: int = 100,
    offset: int = 0,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    High-speed filtered search across all or selected archives.
    - Sourced with real-time status overlay directly from Task Tracker (tracker.db).
    - When searching for files: matches file_name, file_stem, parent event/folder.
    - When searching for folders: matches folder_name, relative_path, session_name.
    - Relevance ranking: exact name match > prefix match > substring match > path.
    - When final_only is True: filters strictly for master/rendered outputs (excluding raw camera files).
    """
    conn = get_connection(db_path)
    cur = conn.cursor()

    clean_query = (query or '').strip()
    target = (search_target or 'all').lower()
    m_type = (media_type or 'all').lower()

    tracker_map = load_tracker_status_map()

    # Exclusion clauses for Adobe files & folders
    ext_placeholders = ', '.join(['?'] * len(ADOBE_EXCLUDE_EXTS))
    adobe_file_filter = f"(LOWER(m.file_ext) NOT IN ({ext_placeholders}) AND m.media_type != 'project')"
    adobe_file_params = [e.lower() for e in ADOBE_EXCLUDE_EXTS]
    adobe_folder_filter = "(LOWER(f.folder_name) NOT LIKE '%adobe%' AND LOWER(f.folder_name) NOT LIKE '%auto-save%' AND LOWER(f.folder_name) NOT LIKE '%autosave%' AND LOWER(f.folder_name) NOT LIKE '%preview files%' AND LOWER(f.folder_name) NOT LIKE '%media cache%' AND LOWER(f.folder_name) NOT LIKE '%peak files%' AND LOWER(f.folder_name) NOT LIKE '%disk cache%')"

    # Case A: Only searching folders
    if target == 'folder' or m_type == 'folder':
        conditions = [adobe_folder_filter]
        params = []
        if archive_id:
            conditions.append("f.archive_id = ?")
            params.append(archive_id)
        if final_only:
            conditions.append("(LOWER(f.relative_path) LIKE 'final%' OR LOWER(f.folder_name) LIKE '%final%')")
        if event_code and event_code.strip() and event_code.strip().upper() != 'ALL':
            ev = event_code.strip().lower()
            conditions.append("LOWER(COALESCE(f.event_code, '')) = ?")
            params.append(ev)
        if clean_query:
            wild = f"%{clean_query.lower()}%"
            conditions.append("(LOWER(f.folder_name) LIKE ? OR LOWER(f.relative_path) LIKE ? OR LOWER(COALESCE(f.event_code, '')) LIKE ? OR LOWER(COALESCE(f.session_name, '')) LIKE ?)")
            params.extend([wild, wild, wild, wild])

        where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
        count_sql = f"SELECT COUNT(*) as total FROM folder_nodes f JOIN scanned_archives a ON a.id = f.archive_id {where_clause}"
        cur.execute(count_sql, params)
        total_count = cur.fetchone()['total']

        if clean_query:
            q_exact = clean_query.lower()
            q_prefix = f"{clean_query.lower()}%"
            order_by = """
                ORDER BY 
                    CASE 
                        WHEN LOWER(f.folder_name) = ? THEN 1
                        WHEN LOWER(f.folder_name) LIKE ? THEN 2
                        WHEN LOWER(COALESCE(f.event_code, '')) = ? THEN 3
                        WHEN LOWER(f.folder_name) LIKE ? THEN 4
                        ELSE 5
                    END ASC,
                    f.id DESC
            """
            order_params = [q_exact, q_prefix, q_exact, f"%{q_exact}%"]
        else:
            order_by = "ORDER BY f.id DESC"
            order_params = []

        select_sql = f"""
            SELECT 
                f.id,
                f.folder_name as file_name,
                f.folder_name as file_stem,
                '' as file_ext,
                'folder' as media_type,
                f.folder_size_bytes as size_bytes,
                0.0 as duration_seconds,
                (COALESCE(f.mp4_count, 0) || ' vids, ' || COALESCE(f.photo_count, 0) || ' photos') as duration_formatted,
                '' as upload_status,
                '' as uploaded_path,
                '' as created_time,
                f.relative_path,
                f.folder_name,
                f.session_name,
                f.session_tag,
                f.event_code,
                f.date_canonical_hijri,
                f.date_canonical_greg,
                a.id as archive_id,
                a.safar_name,
                a.root_path,
                a.city,
                d.volume_label as drive_label,
                d.physical_location as drive_location
            FROM folder_nodes f
            JOIN scanned_archives a ON a.id = f.archive_id
            LEFT JOIN drive_volumes d ON d.id = a.drive_id
            {where_clause}
            {order_by}
            LIMIT ? OFFSET ?
        """
        cur.execute(select_sql, params + order_params + [limit, offset])
        items = [dict(r) for r in cur.fetchall()]
        conn.close()

        for it in items:
            rp = it.get('root_path') or ''
            rel = it.get('relative_path') or ''
            it['full_path'] = os.path.normpath(os.path.join(rp, rel)) if rp else ''
            st, match_p = resolve_item_tracker_status(it, tracker_map)
            it['upload_status'] = st
            if match_p:
                it['uploaded_path'] = match_p

        return {
            'total': total_count,
            'limit': limit,
            'offset': offset,
            'items': items
        }

    # Case B: Searching files only (target == 'file') OR target == 'all' when clean_query is empty
    if target == 'file' or not clean_query:
        conditions = [adobe_file_filter, adobe_folder_filter]
        params = list(adobe_file_params)
        if archive_id:
            conditions.append("m.archive_id = ?")
            params.append(archive_id)
        if final_only:
            conditions.append("(LOWER(f.relative_path) LIKE 'final%' OR LOWER(f.folder_name) LIKE '%final%' OR m.upload_status IN ('uploaded', 'submitted', 'rendered_pending'))")
            conditions.append("(LOWER(f.relative_path) NOT LIKE '%contributor%' AND LOWER(f.folder_name) NOT LIKE 'cam %' AND LOWER(f.folder_name) NOT LIKE 'cam_%')")
        if m_type != 'all':
            conditions.append("m.media_type = ?")
            params.append(m_type)
        if event_code and event_code.strip() and event_code.strip().upper() != 'ALL':
            ev = event_code.strip().lower()
            conditions.append("(LOWER(COALESCE(f.event_code, '')) = ? OR LOWER(m.file_name) LIKE ?)")
            params.extend([ev, f"%{ev}%"])
        if min_duration is not None and min_duration > 0:
            conditions.append("m.duration_seconds >= ?")
            params.append(min_duration)
        if max_duration is not None and max_duration > 0:
            conditions.append("m.duration_seconds <= ?")
            params.append(max_duration)
        if clean_query:
            wild = f"%{clean_query.lower()}%"
            conditions.append("(LOWER(m.file_name) LIKE ? OR LOWER(m.file_stem) LIKE ? OR LOWER(f.folder_name) LIKE ? OR LOWER(COALESCE(f.event_code, '')) LIKE ?)")
            params.extend([wild, wild, wild, wild])

        where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
        count_sql = f"""
            SELECT COUNT(*) as total
            FROM media_items m
            JOIN folder_nodes f ON f.id = m.folder_id
            JOIN scanned_archives a ON a.id = m.archive_id
            {where_clause}
        """
        cur.execute(count_sql, params)
        total_count = cur.fetchone()['total']

        if clean_query:
            q_exact = clean_query.lower()
            q_prefix = f"{clean_query.lower()}%"
            order_by = """
                ORDER BY 
                    CASE 
                        WHEN LOWER(m.file_stem) = ? THEN 1
                        WHEN LOWER(m.file_name) = ? THEN 2
                        WHEN LOWER(m.file_name) LIKE ? THEN 3
                        WHEN LOWER(f.folder_name) = ? THEN 4
                        ELSE 5
                    END ASC,
                    m.id DESC
            """
            order_params = [q_exact, q_exact, q_prefix, q_exact]
        else:
            order_by = "ORDER BY m.id DESC"
            order_params = []

        select_sql = f"""
            SELECT 
                m.id,
                m.file_name,
                m.file_stem,
                m.file_ext,
                m.media_type,
                m.size_bytes,
                m.duration_seconds,
                m.duration_formatted,
                COALESCE(m.upload_status, 'unknown') as upload_status,
                m.uploaded_path,
                m.created_time,
                f.relative_path,
                f.folder_name,
                f.session_name,
                f.session_tag,
                f.event_code,
                f.date_canonical_hijri,
                f.date_canonical_greg,
                a.id as archive_id,
                a.safar_name,
                a.root_path,
                a.city,
                d.volume_label as drive_label,
                d.physical_location as drive_location
            FROM media_items m
            JOIN folder_nodes f ON f.id = m.folder_id
            JOIN scanned_archives a ON a.id = m.archive_id
            LEFT JOIN drive_volumes d ON d.id = a.drive_id
            {where_clause}
            {order_by}
            LIMIT ? OFFSET ?
        """
        cur.execute(select_sql, params + order_params + [limit, offset])
        items = [dict(r) for r in cur.fetchall()]
        conn.close()

        for it in items:
            rp = it.get('root_path') or ''
            rel = it.get('relative_path') or ''
            fn = it.get('file_name') or ''
            it['full_path'] = os.path.normpath(os.path.join(rp, rel, fn)) if rp else ''
            st, match_p = resolve_item_tracker_status(it, tracker_map)
            it['upload_status'] = st
            if match_p:
                it['uploaded_path'] = match_p

        return {
            'total': total_count,
            'limit': limit,
            'offset': offset,
            'items': items
        }

    # Case C: target == 'all' WITH a query
    # Returns matching files UNION matching folders directly with clean relevance
    wild = f"%{clean_query.lower()}%"
    q_exact = clean_query.lower()
    q_prefix = f"{clean_query.lower()}%"

    # Folders query
    f_conds = ["(LOWER(f.folder_name) LIKE ? OR LOWER(f.relative_path) LIKE ? OR LOWER(COALESCE(f.event_code, '')) LIKE ? OR LOWER(COALESCE(f.session_name, '')) LIKE ?)", adobe_folder_filter]
    f_params = [wild, wild, wild, wild]
    if archive_id:
        f_conds.append("f.archive_id = ?")
        f_params.append(archive_id)
    if final_only:
        f_conds.append("(LOWER(f.relative_path) LIKE 'final%' OR LOWER(f.folder_name) LIKE '%final%')")
    if event_code and event_code.strip() and event_code.strip().upper() != 'ALL':
        ev = event_code.strip().lower()
        f_conds.append("LOWER(COALESCE(f.event_code, '')) = ?")
        f_params.append(ev)
    f_where = " WHERE " + " AND ".join(f_conds)

    # Media items query
    m_conds = ["(LOWER(m.file_name) LIKE ? OR LOWER(m.file_stem) LIKE ? OR LOWER(f.folder_name) LIKE ? OR LOWER(COALESCE(f.event_code, '')) LIKE ?)", adobe_file_filter, adobe_folder_filter]
    m_params = [wild, wild, wild, wild] + list(adobe_file_params)
    if archive_id:
        m_conds.append("m.archive_id = ?")
        m_params.append(archive_id)
    if final_only:
        m_conds.append("(LOWER(f.relative_path) LIKE 'final%' OR LOWER(f.folder_name) LIKE '%final%' OR m.upload_status IN ('uploaded', 'submitted', 'rendered_pending'))")
        m_conds.append("(LOWER(f.relative_path) NOT LIKE '%contributor%' AND LOWER(f.folder_name) NOT LIKE 'cam %' AND LOWER(f.folder_name) NOT LIKE 'cam_%')")
    if m_type != 'all':
        m_conds.append("m.media_type = ?")
        m_params.append(m_type)
    if event_code and event_code.strip() and event_code.strip().upper() != 'ALL':
        ev = event_code.strip().lower()
        m_conds.append("(LOWER(COALESCE(f.event_code, '')) = ? OR LOWER(m.file_name) LIKE ?)")
        m_params.extend([ev, f"%{ev}%"])
    if min_duration is not None and min_duration > 0:
        m_conds.append("m.duration_seconds >= ?")
        m_params.append(min_duration)
    if max_duration is not None and max_duration > 0:
        m_conds.append("m.duration_seconds <= ?")
        m_params.append(max_duration)
    m_where = " WHERE " + " AND ".join(m_conds)

    # Count total
    cur.execute(f"SELECT COUNT(*) as c FROM folder_nodes f JOIN scanned_archives a ON a.id = f.archive_id {f_where}", f_params)
    count_folders = cur.fetchone()['c']
    cur.execute(f"SELECT COUNT(*) as c FROM media_items m JOIN folder_nodes f ON f.id = m.folder_id JOIN scanned_archives a ON a.id = m.archive_id {m_where}", m_params)
    count_files = cur.fetchone()['c']
    total_count = count_folders + count_files

    combined_sql = f"""
        SELECT * FROM (
            SELECT 
                f.id,
                f.folder_name as file_name,
                f.folder_name as file_stem,
                '' as file_ext,
                'folder' as media_type,
                f.folder_size_bytes as size_bytes,
                0.0 as duration_seconds,
                (COALESCE(f.mp4_count, 0) || ' vids, ' || COALESCE(f.photo_count, 0) || ' photos') as duration_formatted,
                '' as upload_status,
                '' as uploaded_path,
                '' as created_time,
                f.relative_path,
                f.folder_name,
                f.session_name,
                f.session_tag,
                f.event_code,
                f.date_canonical_hijri,
                f.date_canonical_greg,
                a.id as archive_id,
                a.safar_name,
                a.root_path,
                a.city,
                d.volume_label as drive_label,
                d.physical_location as drive_location,
                CASE 
                    WHEN LOWER(f.folder_name) = ? THEN 1
                    WHEN LOWER(f.folder_name) LIKE ? THEN 2
                    WHEN LOWER(COALESCE(f.event_code, '')) = ? THEN 3
                    ELSE 4
                END as relevance_rank,
                1 as item_type_order
            FROM folder_nodes f
            JOIN scanned_archives a ON a.id = f.archive_id
            LEFT JOIN drive_volumes d ON d.id = a.drive_id
            {f_where}

            UNION ALL

            SELECT 
                m.id,
                m.file_name,
                m.file_stem,
                m.file_ext,
                m.media_type,
                m.size_bytes,
                m.duration_seconds,
                m.duration_formatted,
                COALESCE(m.upload_status, 'unknown') as upload_status,
                m.uploaded_path,
                m.created_time,
                f.relative_path,
                f.folder_name,
                f.session_name,
                f.session_tag,
                f.event_code,
                f.date_canonical_hijri,
                f.date_canonical_greg,
                a.id as archive_id,
                a.safar_name,
                a.root_path,
                a.city,
                d.volume_label as drive_label,
                d.physical_location as drive_location,
                CASE 
                    WHEN LOWER(m.file_stem) = ? THEN 1
                    WHEN LOWER(m.file_name) = ? THEN 2
                    WHEN LOWER(m.file_name) LIKE ? THEN 3
                    WHEN LOWER(f.folder_name) = ? THEN 4
                    ELSE 5
                END as relevance_rank,
                2 as item_type_order
            FROM media_items m
            JOIN folder_nodes f ON f.id = m.folder_id
            JOIN scanned_archives a ON a.id = m.archive_id
            LEFT JOIN drive_volumes d ON d.id = a.drive_id
            {m_where}
        )
        ORDER BY relevance_rank ASC, item_type_order ASC, id DESC
        LIMIT ? OFFSET ?
    """
    f_rank_params = [q_exact, q_prefix, q_exact]
    m_rank_params = [q_exact, q_exact, q_prefix, q_exact]
    full_params = f_rank_params + f_params + m_rank_params + m_params + [limit, offset]

    cur.execute(combined_sql, full_params)
    items = [dict(r) for r in cur.fetchall()]
    conn.close()

    for it in items:
        rp = it.get('root_path') or ''
        rel = it.get('relative_path') or ''
        if it.get('media_type') == 'folder':
            it['full_path'] = os.path.normpath(os.path.join(rp, rel)) if rp else ''
        else:
            fn = it.get('file_name') or ''
            it['full_path'] = os.path.normpath(os.path.join(rp, rel, fn)) if rp else ''
        st, match_p = resolve_item_tracker_status(it, tracker_map)
        it['upload_status'] = st
        if match_p:
            it['uploaded_path'] = match_p

    return {
        'total': total_count,
        'limit': limit,
        'offset': offset,
        'items': items
    }

def detect_sequence_gaps(archive_id: int, db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Scans media filenames per folder to detect breaks in camera numbering
    (e.g., C0001.MP4, C0002.MP4, C0004.MP4 -> flags C0003 as missing).
    """
    conn = get_connection(db_path)
    cur = conn.cursor()

    cur.execute("""
        SELECT m.id, m.folder_id, m.file_name, f.relative_path
        FROM media_items m
        JOIN folder_nodes f ON f.id = m.folder_id
        WHERE m.archive_id = ? AND m.media_type = 'video'
        ORDER BY m.folder_id, m.file_name
    """, (archive_id,))
    rows = cur.fetchall()
    conn.close()

    folders: Dict[int, List[Dict[str, Any]]] = {}
    for r in rows:
        fid = r['folder_id']
        folders.setdefault(fid, []).append(dict(r))

    gaps = []
    # Regex to capture camera prefixes and trailing sequence numbers, e.g. C0012, DSC_0042, MVI_1020
    seq_re = re.compile(r'^([A-Za-z_-]+)(\d{3,6})(?:\.[a-zA-Z0-9]+)?$')

    for fid, file_list in folders.items():
        grouped_by_prefix: Dict[str, List[Tuple[int, str, str]]] = {}
        for f in file_list:
            fname = f['file_name']
            m = seq_re.match(fname)
            if m:
                prefix = m.group(1)
                raw_digits = m.group(2)
                num = int(raw_digits)
                digit_len = len(raw_digits)
                grouped_by_prefix.setdefault(prefix, []).append((num, digit_len, fname, f['relative_path']))

        for prefix, seqs in grouped_by_prefix.items():
            seqs.sort(key=lambda x: x[0])
            for i in range(len(seqs) - 1):
                curr_num, digit_len, curr_name, rel_path = seqs[i]
                next_num, _, next_name, _ = seqs[i + 1]
                diff = next_num - curr_num
                if 1 < diff <= 5:  # Realistic camera card gap
                    for missing in range(curr_num + 1, next_num):
                        num_str = str(missing).zfill(digit_len)
                        gaps.append({
                            'folder': rel_path,
                            'missing_filename': f"{prefix}{num_str}.MP4",
                            'after': curr_name,
                            'before': next_name,
                            'gap_count': diff - 1
                        })

    return gaps

def delete_safar(archive_id: int, db_path: Optional[str] = None) -> bool:
    """Deletes an entire Safar snapshot from catalog (cascade deletes folders, files, and FTS)."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM scanned_archives WHERE id = ?", (archive_id,))
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0

def rename_safar(
    archive_id_or_name: Any,
    new_name: Optional[str] = None,
    new_city: Optional[str] = None,
    new_year: Optional[int] = None,
    new_serial: Optional[str] = None,
    new_drive_label: Optional[str] = None,
    new_drive_letter: Optional[str] = None,
    new_root_path: Optional[str] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Renames a Safar or reassigns its physical drive (label / letter / root path) in archive_catalog.db.
    Updates scanned_archives table (safar_name, city, safar_year, safar_serial, root_path, drive_id)
    and synchronizes FTS5 index.
    """
    conn = get_connection(db_path)
    cur = conn.cursor()

    # Find the target archive
    if isinstance(archive_id_or_name, int) or (isinstance(archive_id_or_name, str) and str(archive_id_or_name).strip().isdigit()):
        target_id = int(archive_id_or_name)
        cur.execute("SELECT id, safar_name, city, safar_year, safar_serial, root_path, drive_id FROM scanned_archives WHERE id = ?", (target_id,))
    else:
        target_str = str(archive_id_or_name).strip()
        cur.execute("SELECT id, safar_name, city, safar_year, safar_serial, root_path, drive_id FROM scanned_archives WHERE LOWER(safar_name) = LOWER(?)", (target_str,))

    row = cur.fetchone()
    if not row:
        conn.close()
        return {'success': False, 'error': f"Safar '{archive_id_or_name}' not found in Archive Catalog"}

    archive_id = row['id']
    old_name = row['safar_name']
    old_path = row['root_path'] or ''
    old_drive_id = row['drive_id']

    # 1. Resolve Safar Name & Components
    clean_name = (new_name or '').strip()
    if not clean_name:
        clean_name = old_name

    parsed_year = new_year
    parsed_serial = new_serial
    parsed_city = new_city

    if clean_name and clean_name != old_name:
        m = re.search(r'(\d{4})[-_](\d{2})?\s*([A-Za-z\s]+)?', clean_name)
        if m:
            if parsed_year is None and m.group(1):
                try: parsed_year = int(m.group(1))
                except: pass
            if parsed_serial is None and m.group(2):
                parsed_serial = m.group(2)
            if parsed_city is None and m.group(3):
                c = m.group(3).strip()
                if c: parsed_city = c

    final_city = parsed_city if parsed_city is not None else row['city']
    final_year = parsed_year if parsed_year is not None else row['safar_year']
    final_serial = parsed_serial if parsed_serial is not None else row['safar_serial']

    # 2. Resolve Drive Letter & Root Path
    final_root_path = old_path
    if new_root_path and new_root_path.strip():
        final_root_path = os.path.normpath(new_root_path.strip())
    elif new_drive_letter and new_drive_letter.strip():
        clean_letter = new_drive_letter.strip().rstrip(':').upper()
        if clean_letter and len(clean_letter) == 1 and clean_letter.isalpha():
            if re.match(r'^[A-Za-z]:', final_root_path):
                final_root_path = re.sub(r'^[A-Za-z]:', f"{clean_letter}:", final_root_path)
            else:
                final_root_path = f"{clean_letter}:\\{final_root_path.lstrip(r'\\/')}"
            final_root_path = os.path.normpath(final_root_path)

    # 3. Resolve Drive Volume Label (ID)
    final_drive_id = old_drive_id
    final_drive_label = None
    if new_drive_label is not None and new_drive_label.strip():
        clean_label = new_drive_label.strip()
        cur.execute("SELECT id, volume_label FROM drive_volumes WHERE LOWER(volume_label) = LOWER(?)", (clean_label,))
        d_row = cur.fetchone()
        if d_row:
            final_drive_id = d_row['id']
            final_drive_label = d_row['volume_label']
        else:
            cur.execute("""
                INSERT INTO drive_volumes (volume_label, last_seen_date)
                VALUES (?, datetime('now'))
            """, (clean_label,))
            final_drive_id = cur.lastrowid
            final_drive_label = clean_label
    elif final_drive_id:
        cur.execute("SELECT volume_label FROM drive_volumes WHERE id = ?", (final_drive_id,))
        d_row = cur.fetchone()
        if d_row:
            final_drive_label = d_row['volume_label']

    # 4. Update scanned_archives
    cur.execute("""
        UPDATE scanned_archives
        SET safar_name = ?,
            city = ?,
            safar_year = ?,
            safar_serial = ?,
            root_path = ?,
            drive_id = ?
        WHERE id = ?
    """, (clean_name, final_city, final_year, final_serial, final_root_path, final_drive_id, archive_id))

    # Also update media_items_fts if it exists
    if clean_name != old_name:
        try:
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='media_items_fts'")
            if cur.fetchone():
                cur.execute("""
                    UPDATE media_items_fts
                    SET safar_name = ?
                    WHERE rowid IN (SELECT id FROM media_items WHERE archive_id = ?)
                """, (clean_name, archive_id))
        except Exception:
            pass

    # Cascade update media_items paths if drive letter changed (Issue 8)
    old_prefix = (old_path[:2] if len(old_path) >= 2 and old_path[1] == ':' else '').upper()
    new_prefix = (final_root_path[:2] if len(final_root_path) >= 2 and final_root_path[1] == ':' else '').upper()
    if old_prefix and new_prefix and old_prefix != new_prefix:
        try:
            cur.execute("""
                UPDATE media_items
                SET uploaded_path = ? || SUBSTR(uploaded_path, 3)
                WHERE archive_id = ? AND (uploaded_path LIKE ? OR uploaded_path LIKE ?)
            """, (new_prefix, archive_id, f"{old_prefix}%", f"{old_prefix.lower()}%"))
        except Exception:
            pass

    conn.commit()
    conn.close()

    return {
        'success': True,
        'archive_id': archive_id,
        'old_name': old_name,
        'new_name': clean_name,
        'city': final_city,
        'year': final_year,
        'serial': final_serial,
        'root_path': final_root_path,
        'drive_id': final_drive_id,
        'drive_label': final_drive_label
    }

def delete_media_item(item_id: int, db_path: Optional[str] = None) -> bool:
    """Deletes a single media item record from the catalog (triggers clean up FTS index)."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM media_items WHERE id = ?", (item_id,))
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0

def update_media_upload_status(item_id: int, status: str, db_path: Optional[str] = None) -> bool:
    """Manually updates the upload status ('uploaded', 'submitted', 'rendered_pending', 'not_uploaded') of a media item in SQLite."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("UPDATE media_items SET upload_status = ? WHERE id = ?", (status, item_id))
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0

def delete_folder_node(folder_id: int, db_path: Optional[str] = None) -> bool:
    """Deletes a folder node and its cascading child media items."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("DELETE FROM folder_nodes WHERE id = ?", (folder_id,))
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0

def list_drives(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns all tracked physical drives."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("""
        SELECT d.*, COUNT(a.id) as archive_count, COALESCE(SUM(a.total_size_bytes), 0) as total_stored_bytes
        FROM drive_volumes d
        LEFT JOIN scanned_archives a ON a.drive_id = d.id
        GROUP BY d.id
        ORDER BY d.volume_label
    """)
    drives = [dict(r) for r in cur.fetchall()]
    conn.close()
    return drives

def add_or_update_drive(
    label: str,
    location: str = '',
    notes: str = '',
    serial: str = '',
    db_path: Optional[str] = None
) -> int:
    """Inserts or updates a drive volume record and returns drive ID."""
    conn = get_connection(db_path)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO drive_volumes (volume_label, physical_location, notes, serial_number, last_seen_date)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(volume_label) DO UPDATE SET
            physical_location = excluded.physical_location,
            notes = excluded.notes,
            serial_number = COALESCE(excluded.serial_number, serial_number),
            last_seen_date = datetime('now')
    """, (label.strip(), location.strip(), notes.strip(), serial.strip()))
    conn.commit()
    drive_id = cur.lastrowid
    if not drive_id:
        cur.execute("SELECT id FROM drive_volumes WHERE volume_label = ?", (label.strip(),))
        drive_id = cur.fetchone()['id']
    conn.close()
    return drive_id

def optimize_database(db_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Performs complete database maintenance and organization:
    - Verifies and builds all composite/covering indexes
    - Cleans out broken virtual tables and triggers
    - Generates query-planner statistics via ANALYZE
    - Defragments storage and eliminates freelist gaps via VACUUM
    - Flushes and truncates WAL journal file
    """
    path = db_path or get_default_db_path()
    if not os.path.exists(path):
        return {'success': False, 'error': f"Database file not found at: {path}"}

    before_size = os.path.getsize(path)

    # 1. Update schema & create missing indexes
    init_db(path)

    # 2. Analyze query distribution statistics
    conn = get_connection(path)
    cur = conn.cursor()
    cur.execute("ANALYZE;")
    conn.commit()

    # Freelist & page counts before vacuum
    cur.execute("PRAGMA page_count;")
    pages_before = cur.fetchone()[0]
    cur.execute("PRAGMA freelist_count;")
    freelist_before = cur.fetchone()[0]

    # Defragment database pages and reclaim freelist space
    cur.execute("VACUUM;")
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE);")

    cur.execute("PRAGMA page_count;")
    pages_after = cur.fetchone()[0]
    cur.execute("PRAGMA freelist_count;")
    freelist_after = cur.fetchone()[0]

    conn.close()

    after_size = os.path.getsize(path) if os.path.exists(path) else 0

    return {
        'success': True,
        'db_path': path,
        'before_size_bytes': before_size,
        'after_size_bytes': after_size,
        'freed_bytes': max(0, before_size - after_size),
        'pages_before': pages_before,
        'pages_after': pages_after,
        'freelist_before': freelist_before,
        'freelist_after': freelist_after
    }


# -------------------------------------------------------------------
# Natural Language Vault Assistant Query Engine
# -------------------------------------------------------------------

OFFICIAL_EVENTS_LIST = [
    ('AQ', 'Aqiqa'),
    ('BM', 'Bethak Majlis'),
    ('BQ', 'Bethak Qadam'),
    ('BZ', 'Bethak Ziyafat'),
    ('FMB', 'FMB'),
    ('H', 'Haddiyat'),
    ('ID', 'Idaraat'),
    ('IF', 'Iftettah'),
    ('IFS', 'Iftettah Sharaf'),
    ('IST', 'Isteqbal'),
    ('KGS', 'Kg Sharaf'),
    ('M', 'Majlis'),
    ('MF', 'Mafsuhiyat'),
    ('MISBAH', 'Misbah'),
    ('MKB', 'Mokib'),
    ('MO', 'Madrasa'),
    ('MQ', 'Misaq'),
    ('MUL', 'Mulaqaat'),
    ('MYN', 'Miyana'),
    ('MZ', 'Majmui Ziyafat'),
    ('N', 'Nikah'),
    ('NAMAZ', 'Namaz'),
    ('ONLINE', 'Online'),
    ('Q', 'Qadam'),
    ('QMZ', 'Qadam Majlis Ziyafat'),
    ('SH', 'Sharaf'),
    ('SQ', 'Shifa Qadam'),
    ('TJR', 'Tijarat'),
    ('TQ', 'Talaqqi'),
    ('TQN', 'Tahneeq'),
    ('WAAZ', 'Waaz'),
    ('WD', 'Wada'),
    ('Z', 'Ziyafat'),
    ('ZO', 'Zafaf Olda')
]
OFFICIAL_EVENTS_DICT = dict(OFFICIAL_EVENTS_LIST)

EVENT_KEYWORD_MAP = {
    'qadam': 'Q',
    'majlis': 'M',
    'nikah': 'N',
    'nikaah': 'N',
    'ziyafat': 'Z',
    'ziyafat olda': 'ZO',
    'bethak majlis': 'BM',
    'bethak qadam': 'BQ',
    'bethak ziyafat': 'BZ',
    'aqiqa': 'AQ',
    'fmb': 'FMB',
    'haddiyat': 'H',
    'idaraat': 'ID',
    'iftettah': 'IF',
    'sharaf': 'SH',
    'shifa qadam': 'SQ',
    'waaz': 'WAAZ',
    'wada': 'WD',
    'mokib': 'MKB',
    'madrasa': 'MO',
    'misaq': 'MQ',
    'mulaqaat': 'MUL',
    'miyana': 'MYN',
    'majmui ziyafat': 'MZ',
    'namaz': 'NAMAZ',
    'misbah': 'MISBAH',
    'tijarat': 'TJR',
    'talaqqi': 'TQ',
    'tahneeq': 'TQN',
    'zafaf': 'ZO'
}

def query_vault_chat(
    query_text: str,
    archive_id: Optional[int] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Interprets natural language queries (e.g. 'how many Qadam were there in 1448-10-18_01M')
    and returns conversational summary, aggregated metrics, and matching media items.
    """
    if not query_text or not query_text.strip():
        return {'success': False, 'error': 'Empty query string'}

    q_clean = query_text.strip()
    q_lower = q_clean.lower()

    # 1. Detect Event Code
    detected_event = None
    # Check multi-word keys first
    for kw in sorted(EVENT_KEYWORD_MAP.keys(), key=lambda x: -len(x)):
        pattern = r'\b' + re.escape(kw) + r'\b'
        if re.search(pattern, q_lower):
            detected_event = EVENT_KEYWORD_MAP[kw]
            break

    # If not found by keyword, check if user specified exact code like " Q " or "_Q_"
    if not detected_event:
        for code, _name in OFFICIAL_EVENTS_LIST:
            pattern = r'\b' + re.escape(code.lower()) + r'\b'
            if re.search(pattern, q_lower):
                detected_event = code
                break

    # 2. Detect Date or Session Pattern (e.g. 1448-10-18_01M, 1448-10-18, 01M)
    date_session_match = re.search(r'(\d{4}[-_\.]\d{1,2}[-_\.]\d{1,2}(?:[_\s]\d{2}[A-Za-z]+)?)', q_clean)
    detected_date_session = date_session_match.group(1) if date_session_match else None

    detected_session = None
    if not detected_date_session:
        session_match = re.search(r'\b(\d{2}[A-Za-z]+)\b', q_clean)
        if session_match:
            detected_session = session_match.group(1).upper()
    elif '_' in detected_date_session:
        detected_session = detected_date_session.split('_')[-1].upper()

    # 3. Detect Status Filter (e.g. "not uploaded", "pending upload", "uploaded")
    status_filter = None
    if 'not uploaded' in q_lower or 'unuploaded' in q_lower or 'pending' in q_lower or 'missing upload' in q_lower:
        status_filter = 'not_uploaded'
    elif 'uploaded' in q_lower:
        status_filter = 'uploaded'

    # 4. Construct SQL Query
    conn = get_connection(db_path)
    cur = conn.cursor()

    sql = """
        SELECT 
            m.id,
            m.file_name,
            m.size_bytes,
            m.duration_seconds,
            m.duration_formatted,
            COALESCE(m.upload_status, 'unknown') as upload_status,
            f.relative_path,
            f.folder_name,
            f.session_name,
            f.session_tag,
            f.event_code,
            COALESCE(f.date_canonical_hijri, f.date_canonical_greg, '') as date_val,
            a.id as archive_id,
            a.safar_name,
            a.city,
            d.volume_label as drive_label
        FROM media_items m
        JOIN folder_nodes f ON f.id = m.folder_id
        JOIN scanned_archives a ON a.id = m.archive_id
        LEFT JOIN drive_volumes d ON d.id = a.drive_id
        WHERE m.media_type = 'video'
    """
    params: List[Any] = []

    if archive_id and archive_id > 0:
        sql += " AND m.archive_id = ?"
        params.append(archive_id)

    if detected_event:
        sql += " AND (f.event_code = ? OR m.file_name LIKE ? OR m.file_name LIKE ? OR m.file_name LIKE ?)"
        params.extend([detected_event, f"%_{detected_event}_%", f"%{detected_event}_%", f"%_{detected_event}.%"])

    if detected_date_session:
        clean_ds = detected_date_session.replace('_', ' ')
        sql += " AND (f.date_canonical_hijri LIKE ? OR f.date_canonical_greg LIKE ? OR f.relative_path LIKE ? OR f.folder_name LIKE ?)"
        ds_param = f"%{detected_date_session}%"
        ds_clean_param = f"%{clean_ds}%"
        params.extend([ds_param, ds_param, ds_param, ds_clean_param])
    elif detected_session:
        sql += " AND (f.session_tag = ? OR f.relative_path LIKE ? OR f.folder_name LIKE ?)"
        params.extend([detected_session, f"%{detected_session}%", f"%{detected_session}%"])

    if status_filter == 'not_uploaded':
        sql += " AND (m.upload_status IS NULL OR LOWER(m.upload_status) != 'uploaded')"
    elif status_filter == 'uploaded':
        sql += " AND LOWER(m.upload_status) = 'uploaded'"

    sql += " ORDER BY f.date_canonical_hijri ASC, f.session_tag ASC, m.file_name ASC"

    cur.execute(sql, params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    total_count = len(rows)
    total_sec = sum((r.get('duration_seconds') or 0.0) for r in rows)
    total_dur_str = format_duration(total_sec)
    total_bytes = sum((r.get('size_bytes') or 0) for r in rows)
    total_mb = round(total_bytes / (1024 * 1024), 2)
    total_gb = round(total_mb / 1024, 2)
    uploaded_count = sum(1 for r in rows if str(r.get('upload_status') or '').lower() == 'uploaded')

    # 5. Formulate Human-Friendly Conversational Response
    event_label = f"{detected_event} ({EVENT_KEYWORD_MAP.get(detected_event.lower(), detected_event)})" if detected_event else "video"
    scope_desc = ""
    if detected_date_session:
        scope_desc = f"in {detected_date_session}"
    elif detected_session:
        scope_desc = f"in session {detected_session}"
    elif archive_id:
        scope_desc = "in the selected Safar"
    else:
        scope_desc = "across all indexed archives"

    if total_count == 0:
        answer = f"No {event_label} clips were found {scope_desc} matching your criteria."
    else:
        size_str = f"{total_gb} GB" if total_gb >= 1.0 else f"{total_mb} MB"
        answer = (
            f"Found **{total_count} {event_label}** clips {scope_desc}. "
            f"• Total Duration: **{total_dur_str}** "
            f"• Total Size: **{size_str}** "
            f"• Uploaded: **{uploaded_count} of {total_count}** ({round((uploaded_count / max(total_count, 1)) * 100)}%)."
        )

    # Format items for table display and query excel generation
    formatted_items = []
    for r in rows:
        formatted_items.append({
            'id': r['id'],
            'date': r['date_val'] or '',
            'folder': r['relative_path'] or '',
            'file': r['file_name'] or '',
            'event': r['event_code'] or detected_event or '',
            'duration': r['duration_formatted'] or '',
            'size_mb': round((r['size_bytes'] or 0) / (1024 * 1024), 2),
            'status': str(r['upload_status'] or 'READY').upper(),
            'archive_name': r['safar_name'] or '',
            'drive_label': r.get('drive_label') or ''
        })

    return {
        'success': True,
        'query': query_text,
        'answer': answer,
        'count': total_count,
        'total_duration': total_dur_str,
        'total_size_mb': total_mb,
        'total_size_gb': total_gb,
        'uploaded_count': uploaded_count,
        'detected_event': detected_event,
        'detected_scope': detected_date_session or detected_session or '',
        'items': formatted_items
    }


def main():
    """CLI runner for IPC invocations."""
    import argparse
    parser = argparse.ArgumentParser(description="Archive Catalog Database CLI")
    parser.add_argument('--action', required=True, choices=[
        'init', 'list_safars', 'summary', 'search', 'gaps', 'delete', 'delete_item',
        'list_drives', 'save_drive', 'list_folders', 'list_dates', 'safar_days_breakdown', 'optimize_db',
        'set_upload_status', 'sync_tracker', 'rename_safar', 'update_safar_drive', 'chat_query'
    ])
    parser.add_argument('--db', help="Path to database")
    parser.add_argument('--archive_id', type=int)
    parser.add_argument('--safar_name', default='', help="Safar name or identifier")
    parser.add_argument('--new_name', default='', help="New Safar name")
    parser.add_argument('--city', default='', help="New Safar city")
    parser.add_argument('--year', type=int, default=None, help="New Safar Hijri year")
    parser.add_argument('--serial', default='', help="New Safar serial")
    parser.add_argument('--new_drive_label', default='', help="New or existing drive volume label")
    parser.add_argument('--new_drive_letter', default='', help="New drive letter e.g. D or E:")
    parser.add_argument('--new_root_path', default='', help="New root folder path on disk")
    parser.add_argument('--item_id', type=int)
    parser.add_argument('--upload_status', default='')
    parser.add_argument('--query', default='')
    parser.add_argument('--media_type', default='all')
    parser.add_argument('--event_code', default='')
    parser.add_argument('--final_only', action='store_true', default=False, help="Filter strictly for final videos")
    parser.add_argument('--search_target', default='all', choices=['all', 'file', 'folder'], help="Filter search by file name or folder path")
    parser.add_argument('--min_duration', type=float, default=0.0)
    parser.add_argument('--max_duration', type=float, default=0.0)
    parser.add_argument('--limit', type=int, default=100)
    parser.add_argument('--offset', type=int, default=0)
    parser.add_argument('--drive_label', default='')
    parser.add_argument('--drive_location', default='')
    parser.add_argument('--drive_notes', default='')

    args = parser.parse_args()

    try:
        if args.action == 'init':
            init_db(args.db)
            print(json.dumps({'success': True, 'db': args.db or get_default_db_path()}))
        elif args.action == 'list_safars':
            safars = list_safars(args.db)
            print(json.dumps({'success': True, 'safars': safars}))
        elif args.action == 'summary':
            if not args.archive_id:
                print(json.dumps({'success': False, 'error': 'Missing --archive_id'}))
                return
            summary = get_safar_summary(args.archive_id, args.db)
            print(json.dumps({'success': True, 'summary': summary}))
        elif args.action == 'search':
            res = search_media(
                query=args.query,
                archive_id=args.archive_id,
                media_type=args.media_type,
                event_code=args.event_code,
                final_only=args.final_only,
                search_target=args.search_target,
                min_duration=args.min_duration,
                max_duration=args.max_duration,
                limit=args.limit,
                offset=args.offset,
                db_path=args.db
            )
            print(json.dumps({'success': True, 'result': res}))
        elif args.action == 'gaps':
            if not args.archive_id:
                print(json.dumps({'success': False, 'error': 'Missing --archive_id'}))
                return
            gaps = detect_sequence_gaps(args.archive_id, args.db)
            print(json.dumps({'success': True, 'gaps': gaps}))
        elif args.action == 'delete':
            if not args.archive_id:
                print(json.dumps({'success': False, 'error': 'Missing --archive_id'}))
                return
            ok = delete_safar(args.archive_id, args.db)
            print(json.dumps({'success': ok}))
        elif args.action == 'delete_item':
            if not args.item_id:
                print(json.dumps({'success': False, 'error': 'Missing --item_id'}))
                return
            if getattr(args, 'media_type', None) == 'folder':
                ok = delete_folder_node(args.item_id, args.db)
            else:
                ok = delete_media_item(args.item_id, args.db)
            print(json.dumps({'success': ok}))
        elif args.action == 'list_drives':
            drives = list_drives(args.db)
            print(json.dumps({'success': True, 'drives': drives}))
        elif args.action == 'save_drive':
            if not args.drive_label:
                print(json.dumps({'success': False, 'error': 'Missing --drive_label'}))
                return
            did = add_or_update_drive(args.drive_label, args.drive_location, args.drive_notes, db_path=args.db)
            print(json.dumps({'success': True, 'drive_id': did}))
        elif args.action == 'list_folders':
            if not args.archive_id:
                print(json.dumps({'success': False, 'error': 'Missing --archive_id'}))
                return
            folders = list_archive_folders(args.archive_id, args.db)
            print(json.dumps({'success': True, 'folders': folders}))
        elif args.action == 'list_dates':
            if not args.archive_id:
                print(json.dumps({'success': False, 'error': 'Missing --archive_id'}))
                return
            dates = list_archive_dates(args.archive_id, args.db)
            print(json.dumps({'success': True, 'dates': dates}))
        elif args.action == 'safar_days_breakdown':
            if not args.archive_id:
                print(json.dumps({'success': False, 'error': 'Missing --archive_id'}))
                return
            breakdown = get_safar_days_breakdown(args.archive_id, args.db)
            print(json.dumps(breakdown))
        elif args.action == 'optimize_db':
            res = optimize_database(args.db)
            print(json.dumps(res))
        elif args.action == 'set_upload_status':
            if not args.item_id or not args.upload_status:
                print(json.dumps({'success': False, 'error': 'Missing --item_id or --upload_status'}))
                return
            ok = update_media_upload_status(args.item_id, args.upload_status, args.db)
            print(json.dumps({'success': ok, 'item_id': args.item_id, 'upload_status': args.upload_status}))
        elif args.action == 'sync_tracker':
            res = sync_tracker_statuses(args.archive_id, args.db)
            print(json.dumps(res))
        elif args.action == 'chat_query':
            if not args.query:
                print(json.dumps({'success': False, 'error': 'Missing --query'}))
                return
            res = query_vault_chat(args.query, archive_id=args.archive_id, db_path=args.db)
            print(json.dumps(res))
        elif args.action in ('rename_safar', 'update_safar_drive'):
            target = args.archive_id if args.archive_id else args.safar_name
            if not target:
                print(json.dumps({'success': False, 'error': 'Missing --archive_id or --safar_name'}))
                return
            res = rename_safar(
                archive_id_or_name=target,
                new_name=args.new_name or None,
                new_city=args.city or None,
                new_year=args.year,
                new_serial=args.serial or None,
                new_drive_label=args.new_drive_label or None,
                new_drive_letter=args.new_drive_letter or None,
                new_root_path=args.new_root_path or None,
                db_path=args.db
            )
            print(json.dumps(res))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
