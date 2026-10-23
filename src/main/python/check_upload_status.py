#!/usr/bin/env python3
"""
============================================================
UPLOAD STATUS AUTOMATION ENGINE (check_upload_status.py)
Part of One Tap Workstation & Data Search

Automatically determines whether cataloged video files are:
1. 'UPLOADED'        -> Present in 'TO UPLOAD' / 'UPLOADED DATA' folder
2. 'SUBMITTED'       -> Present in 'TO DELETE' (confirmed uploaded to AlJamea/central)
3. 'RENDERED_PENDING'-> Rendered MP4 exists in 'Final', but not moved to upload folder
4. 'NOT_UPLOADED'    -> Not present in any upload target or still in raw editing
============================================================
"""

import os
import sys
import json
import sqlite3
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple

from archive_catalog_db import (
    get_default_db_path,
    get_tracker_db_path,
    load_tracker_status_map,
    resolve_item_tracker_status
)

# UTF-8 fix for Windows terminal
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


def find_file_in_dir(filename: str, target_dir: str) -> Optional[str]:
    """
    Recursively or flatly searches for a file in target_dir.
    Returns the absolute path if found, otherwise None.
    """
    if not os.path.exists(target_dir):
        return None

    # 1. Fast direct check
    direct = os.path.join(target_dir, filename)
    if os.path.isfile(direct):
        return direct

    # 2. Walk directory
    norm_fn = filename.lower().strip()
    for root, _, files in os.walk(target_dir):
        for f in files:
            if f.lower().strip() == norm_fn:
                return os.path.join(root, f)

    return None


def determine_video_upload_status(
    video_file_name: str,
    safar_name: str,
    date_folder: Optional[str],
    upload_roots: List[str],
    delete_roots: List[str],
    final_roots: Optional[List[str]] = None,
    relative_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Determines upload status based on folder hierarchy heuristics:
    0. Check if found in 'DVD' folder -> 'dvd_local' (local distribution cut, excluded from upload)
    1. Check if found in any delete_roots ('TO DELETE' folder) -> 'submitted'
    2. Check if found in any upload_roots ('TO UPLOAD' / 'UPLOADED DATA' folder) -> 'uploaded'
    3. Check if found in final_roots ('Final' folder) -> 'rendered_pending'
    4. Otherwise -> 'not_uploaded'
    """
    # 0. Check for DVD folder / local distribution media
    norm_rel = (relative_path or '').lower().replace('/', '\\')
    rel_parts = [p.strip() for p in norm_rel.split('\\') if p.strip()]
    norm_date = (date_folder or '').lower().strip()
    fn_lower = video_file_name.lower().strip()
    if 'dvd' in rel_parts or norm_date == 'dvd' or fn_lower.startswith('dvd_') or '_dvd_' in fn_lower:
        return {
            'status': 'dvd_local',
            'badge': '💿 DVD (Local Only)',
            'description': 'Local distribution cut (not uploaded to server)',
            'matched_path': None,
            'matched_size': 0
        }

    # 1. Check in TO DELETE
    for d_root in delete_roots:
        if not d_root or not os.path.exists(d_root):
            continue
        found = find_file_in_dir(video_file_name, d_root)
        if found:
            size = os.path.getsize(found)
            return {
                'status': 'submitted',
                'badge': '✅ Submitted',
                'description': 'Confirmed uploaded & archived in TO DELETE',
                'matched_path': found,
                'matched_size': size
            }

    # 2. Check in TO UPLOAD / UPLOADED DATA
    for u_root in upload_roots:
        if not u_root or not os.path.exists(u_root):
            continue
        found = find_file_in_dir(video_file_name, u_root)
        if found:
            size = os.path.getsize(found)
            return {
                'status': 'uploaded',
                'badge': '📤 Uploaded',
                'description': 'Ready / uploaded in TO UPLOAD directory',
                'matched_path': found,
                'matched_size': size
            }

    # 3. Check in FINAL (Rendered but pending upload)
    if final_roots:
        for f_root in final_roots:
            if not f_root or not os.path.exists(f_root):
                continue
            found = find_file_in_dir(video_file_name, f_root)
            if found:
                size = os.path.getsize(found)
                return {
                    'status': 'rendered_pending',
                    'badge': '⏳ Rendered (Pending Upload)',
                    'description': 'Rendered MP4 ready in Final folder; not yet in To Upload',
                    'matched_path': found,
                    'matched_size': size
                }

    # 4. Not uploaded
    return {
        'status': 'not_uploaded',
        'badge': '⭕ Not Uploaded',
        'description': 'File not found in any target upload location',
        'matched_path': None,
        'matched_size': 0
    }


def scan_catalog_uploads(
    db_path: str,
    upload_dirs: List[str],
    delete_dirs: List[str],
    archive_id: Optional[int] = None,
    update_db: bool = False
) -> Dict[str, Any]:
    """
    Scans media_items in archive_catalog.db and determines upload status for all videos.
    Optionally stores 'upload_status' in media_items table.
    """
    if not os.path.exists(db_path):
        return {'success': False, 'error': f'Database not found: {db_path}'}

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Ensure upload_status column exists in media_items
    cur.execute("PRAGMA table_info(media_items)")
    columns = [row['name'] for row in cur.fetchall()]
    if 'upload_status' not in columns:
        cur.execute("ALTER TABLE media_items ADD COLUMN upload_status TEXT DEFAULT 'unknown'")
    if 'uploaded_path' not in columns:
        cur.execute("ALTER TABLE media_items ADD COLUMN uploaded_path TEXT")
    conn.commit()

    tracker_map = load_tracker_status_map()

    query = """
        SELECT 
            m.id, 
            m.archive_id,
            m.file_name, 
            m.size_bytes, 
            m.duration_formatted,
            m.upload_status,
            f.relative_path,
            f.folder_name,
            a.safar_name,
            a.root_path
        FROM media_items m
        JOIN folder_nodes f ON f.id = m.folder_id
        JOIN scanned_archives a ON a.id = m.archive_id
        WHERE m.media_type = 'video' OR LOWER(f.relative_path) LIKE 'final%'
    """
    params = []
    if archive_id:
        query += " AND m.archive_id = ?"
        params.append(archive_id)

    cur.execute(query, params)
    rows = cur.fetchall()

    results = []
    stats = {
        'total_videos': len(rows),
        'uploaded_count': 0,
        'submitted_count': 0,
        'rendered_pending_count': 0,
        'not_uploaded_count': 0,
        'dvd_local_count': 0
    }

    updates = []
    for r in rows:
        file_name = r['file_name']
        safar_name = r['safar_name']
        date_folder = r['folder_name']
        root_path = r['root_path'] or ''
        rel_path = r['relative_path'] or ''
        full_path = os.path.normpath(os.path.join(root_path, rel_path, file_name)) if root_path else ''

        # 1. Resolve status from Task Tracker (tracker.db)
        tracker_st, tracker_note = resolve_item_tracker_status({
            'file_name': file_name,
            'relative_path': rel_path,
            'folder_name': date_folder,
            'safar_name': safar_name,
            'full_path': full_path,
            'upload_status': r['upload_status']
        }, tracker_map)

        # 2. Check filesystem upload/delete roots on connected drives
        eval_res = determine_video_upload_status(
            video_file_name=file_name,
            safar_name=safar_name,
            date_folder=date_folder,
            upload_roots=upload_dirs,
            delete_roots=delete_dirs,
            relative_path=rel_path
        )

        final_st = tracker_st
        matched_p = tracker_note or eval_res['matched_path']
        if eval_res['status'] == 'dvd_local' or tracker_st == 'dvd_local':
            final_st = 'dvd_local'
            matched_p = eval_res.get('matched_path') or 'Local DVD Cut'
        elif eval_res['status'] in ('submitted', 'uploaded'):
            final_st = eval_res['status']
            matched_p = eval_res['matched_path']
        elif tracker_st in ('submitted', 'uploaded', 'rendered_pending', 'review', 'editing'):
            final_st = tracker_st
        elif eval_res['status'] == 'rendered_pending':
            final_st = 'rendered_pending'
            matched_p = eval_res['matched_path']

        if final_st == 'dvd_local':
            stats['dvd_local_count'] += 1
            badge = '💿 DVD (Local Only)'
        elif final_st == 'uploaded':
            stats['uploaded_count'] += 1
            badge = '📤 Uploaded'
        elif final_st == 'submitted':
            stats['submitted_count'] += 1
            badge = '✅ Submitted'
        elif final_st == 'rendered_pending':
            stats['rendered_pending_count'] += 1
            badge = '⏳ Rendered (Pending Upload)'
        else:
            stats['not_uploaded_count'] += 1
            badge = '⭕ Not Uploaded'

        item_result = {
            'id': r['id'],
            'file_name': file_name,
            'safar_name': safar_name,
            'relative_path': rel_path,
            'size_bytes': r['size_bytes'],
            'duration': r['duration_formatted'],
            'status': final_st,
            'badge': badge,
            'matched_path': matched_p
        }
        results.append(item_result)

        if update_db:
            updates.append((final_st, matched_p, r['id']))

    if update_db and updates:
        cur.executemany(
            "UPDATE media_items SET upload_status = ?, uploaded_path = ? WHERE id = ?",
            updates
        )
        conn.commit()

    conn.close()

    return {
        'success': True,
        'stats': stats,
        'results': results
    }


def auto_detect_upload_and_delete_dirs() -> Tuple[List[str], List[str]]:
    """
    Automatically scans all available Windows drive letters (C:\\ through Z:\\)
    for standard workstation folders ('TO UPLOAD', 'UPLOADED DATA', 'TO DELETE').
    """
    upload_dirs = []
    delete_dirs = []
    import string
    for letter in string.ascii_uppercase:
        drive_root = f"{letter}:\\"
        if not os.path.exists(drive_root):
            continue
        try:
            for item in os.listdir(drive_root):
                full_path = os.path.join(drive_root, item)
                if not os.path.isdir(full_path):
                    continue
                lower = item.lower().strip()
                if lower in ('to upload', 'to_upload', 'uploaded data', 'uploaded_data', 'uploaded', 'upload'):
                    upload_dirs.append(full_path)
                elif lower in ('to delete', 'to_delete', 'delete', 'submitted'):
                    delete_dirs.append(full_path)
        except (PermissionError, OSError):
            continue
    return upload_dirs, delete_dirs


def export_uploads_to_json(data: Dict[str, Any], json_path: Optional[str] = None) -> str:
    """
    Exports upload determination results and full video list to a clean JSON file.
    Default destination: One Tap AppData directory.
    """
    if not json_path:
        appdata = os.environ.get('APPDATA') or os.path.expanduser('~')
        locator_dir = os.path.join(appdata, 'One Tap')
        os.makedirs(locator_dir, exist_ok=True)
        json_path = os.path.join(locator_dir, 'video_uploads.json')

    payload = {
        'exported_at': datetime.now().isoformat(),
        'stats': data.get('stats', {}),
        'results': data.get('results', [])
    }
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return json_path


def main():
    parser = argparse.ArgumentParser(description="One Tap Workstation: Video Upload Determination & JSON Migration")
    parser.add_argument('--db-path', help="Path to archive_catalog.db", required=False)
    parser.add_argument('--file-name', help="Single video file name to test")
    parser.add_argument('--upload-dirs', nargs='*', default=[], help="Custom directories for TO UPLOAD")
    parser.add_argument('--delete-dirs', nargs='*', default=[], help="Custom directories for TO DELETE")
    parser.add_argument('--archive-id', type=int, help="Optional archive/safar ID to restrict scan")
    parser.add_argument('--update-db', action='store_true', default=True, help="Persist detected upload status into SQLite")
    parser.add_argument('--json-out', help="Path to write JSON output file")
    parser.add_argument('--json', action='store_true', help="Output pure JSON to stdout")

    args = parser.parse_args()

    # Auto-detect upload & delete directories if none provided
    upload_dirs = args.upload_dirs
    delete_dirs = args.delete_dirs
    if not upload_dirs and not delete_dirs:
        auto_up, auto_del = auto_detect_upload_and_delete_dirs()
        upload_dirs = auto_up
        delete_dirs = auto_del

    # Single file evaluation
    if args.file_name:
        res = determine_video_upload_status(
            video_file_name=args.file_name,
            safar_name='',
            date_folder=None,
            upload_roots=upload_dirs,
            delete_roots=delete_dirs
        )
        if args.json:
            print(json.dumps(res, indent=2))
        else:
            print(f"File: {args.file_name}")
            print(f"Status: {res['badge']}")
            print(f"Details: {res['description']}")
            if res['matched_path']:
                print(f"Matched Path: {res['matched_path']}")
        return

    # Bulk scan & JSON migration
    db_path = args.db_path or get_default_db_path()

    if db_path and os.path.exists(db_path):
        data = scan_catalog_uploads(
            db_path=db_path,
            upload_dirs=upload_dirs,
            delete_dirs=delete_dirs,
            archive_id=args.archive_id,
            update_db=args.update_db
        )
        # Migrate to JSON automatically
        exported_file = export_uploads_to_json(data, args.json_out)
        data['json_file'] = exported_file

        if args.json:
            print(json.dumps(data, indent=2))
        else:
            print(f"============================================================")
            print(f"One Tap: Automated Video Upload Determination & JSON Sync")
            print(f"============================================================")
            print(f"Scanned Upload Folders: {', '.join(upload_dirs) or 'None found'}")
            print(f"Scanned Delete Folders: {', '.join(delete_dirs) or 'None found'}")
            print(f"Total Videos: {data['stats']['total_videos']}")
            print(f"  📤 Uploaded:     {data['stats']['uploaded_count']}")
            print(f"  ✅ Submitted:    {data['stats']['submitted_count']}")
            print(f"  ⭕ Not Uploaded: {data['stats']['not_uploaded_count']}")
            print(f"JSON Export: {exported_file}")
            print(f"============================================================")
        return

    # If no DB found, still report detected folders
    print(json.dumps({
        'success': False,
        'error': 'No archive_catalog.db found. Please specify --db-path.',
        'detected_upload_dirs': upload_dirs,
        'detected_delete_dirs': delete_dirs
    }))


if __name__ == '__main__':
    main()
