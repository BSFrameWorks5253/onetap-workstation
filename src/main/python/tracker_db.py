#!/usr/bin/env python3
"""
============================================================
AUTONOMOUS TASK & PRODUCTION TRACKER DB (tracker_db.py)

Free, embedded SQLite database backend for Uni Desk (One Tap).
Stores Safar and Date-level task lifecycles, render/upload timestamps,
and media resource indexes across multiple SSDs and drives.
============================================================
"""

import sys
import os
import json
import sqlite3
import argparse
import time

def get_db_path(custom_path=None):
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

def get_connection(db_file):
    """Opens connection with WAL mode, 32MB cache, 128MB mmap, and in-memory temp tables."""
    conn = sqlite3.connect(db_file, timeout=30.0)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA busy_timeout = 10000;")
    conn.execute("PRAGMA cache_size = -32000;")
    conn.execute("PRAGMA mmap_size = 134217728;")
    conn.execute("PRAGMA temp_store = MEMORY;")
    return conn

def init_db(conn):
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS safars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        safar_name TEXT UNIQUE NOT NULL,
        safar_year INTEGER,
        safar_serial TEXT,
        city TEXT DEFAULT 'Unassigned',
        total_days INTEGER DEFAULT 0,
        completed_days INTEGER DEFAULT 0,
        is_safar_done INTEGER DEFAULT 0,
        current_path TEXT,
        current_drive TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tracker_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        safar_id INTEGER,
        safar_name TEXT NOT NULL,
        date_folder TEXT NOT NULL,
        status TEXT NOT NULL,
        first_seen_at INTEGER,
        prproj_modified_at INTEGER,
        prproj_path TEXT,
        rendered_at INTEGER,
        render_duration REAL DEFAULT 0,
        render_video_count INTEGER DEFAULT 0,
        render_size_bytes INTEGER DEFAULT 0,
        uploaded_at INTEGER,
        submitted_at INTEGER,
        working_path TEXT,
        final_path TEXT,
        upload_path TEXT,
        delete_path TEXT,
        current_drive TEXT,
        notes TEXT,
        metadata_json TEXT,
        updated_at INTEGER,
        UNIQUE(safar_name, date_folder)
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tracker_media_resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        safar_name TEXT NOT NULL,
        date_folder TEXT,
        file_type TEXT,
        category TEXT DEFAULT 'raw_footage',
        file_name TEXT NOT NULL,
        file_path TEXT UNIQUE,
        parent_dir TEXT,
        drive_root TEXT,
        drive_label TEXT,
        file_size INTEGER DEFAULT 0,
        duration REAL DEFAULT 0,
        mtime INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at INTEGER
    );
    """)

    # Safe migration for existing installations
    cursor.execute("PRAGMA table_info(tracker_media_resources);")
    existing_media_cols = {row[1] for row in cursor.fetchall()}
    cols_to_add = [
        ("category", "TEXT DEFAULT 'raw_footage'"),
        ("parent_dir", "TEXT"),
        ("drive_root", "TEXT"),
        ("drive_label", "TEXT"),
        ("updated_at", "INTEGER")
    ]
    for col_name, col_def in cols_to_add:
        if col_name not in existing_media_cols:
            try:
                cursor.execute(f"ALTER TABLE tracker_media_resources ADD COLUMN {col_name} {col_def};")
            except Exception:
                pass

    # Safe migration for manual_status in tracker_tasks & safars
    cursor.execute("PRAGMA table_info(tracker_tasks);")
    existing_task_cols = {row[1] for row in cursor.fetchall()}
    if "manual_status" not in existing_task_cols:
        try:
            cursor.execute("ALTER TABLE tracker_tasks ADD COLUMN manual_status TEXT DEFAULT NULL;")
        except Exception:
            pass

    cursor.execute("PRAGMA table_info(safars);")
    existing_safar_cols = {row[1] for row in cursor.fetchall()}
    if "manual_status" not in existing_safar_cols:
        try:
            cursor.execute("ALTER TABLE safars ADD COLUMN manual_status TEXT DEFAULT NULL;")
        except Exception:
            pass

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tracker_history_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        safar_name TEXT NOT NULL,
        date_folder TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        event_description TEXT,
        timestamp INTEGER NOT NULL
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_safar ON tracker_tasks(safar_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_date ON tracker_tasks(date_folder);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_status ON tracker_tasks(status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_task_drive ON tracker_tasks(current_drive);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_safars_name ON safars(safar_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_media_task ON tracker_media_resources(safar_name, date_folder);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_media_filename ON tracker_media_resources(file_name);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_media_type ON tracker_media_resources(file_type);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_media_category ON tracker_media_resources(category);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_media_drive ON tracker_media_resources(drive_root);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_media_filepath ON tracker_media_resources(file_path);")
    conn.commit()

STATUS_RANK = {
    'editing_pending': 1,
    'editing': 2,
    'review': 3,
    'upload_pending': 4,
    'uploaded': 5,
    'submitted': 6
}

def upsert_tasks(conn, tasks):
    now_ms = int(time.time() * 1000)
    cursor = conn.cursor()
    updated_count = 0

    for t in tasks:
        safar_name = t.get('safarName') or t.get('safar_name') or 'Unassigned'
        date_folder = t.get('dateFolder') or t.get('date_folder') or ''
        status = t.get('status', 'editing_pending')
        prproj_mod = t.get('prprojModifiedAt') or t.get('prproj_modified_at') or 0
        prproj_path = t.get('prprojPath') or t.get('prproj_path') or ''
        rendered_at = t.get('renderedAt') or t.get('rendered_at')
        render_dur = float(t.get('renderDuration', 0) or 0)
        render_count = int(t.get('renderVideoCount', 0) or 0)
        render_size = int(t.get('renderSizeBytes', 0) or 0)
        uploaded_at = t.get('uploadedAt') or t.get('uploaded_at')
        submitted_at = t.get('submittedAt') or t.get('submitted_at')
        working_path = t.get('workingPath') or t.get('working_path') or ''
        final_path = t.get('finalPath') or t.get('final_path') or ''
        upload_path = t.get('uploadPath') or t.get('upload_path') or ''
        delete_path = t.get('deletePath') or t.get('delete_path') or ''
        current_drive = t.get('currentDrive') or t.get('current_drive') or ''
        notes = t.get('notes') or ''
        metadata_json = json.dumps(t.get('metadata') or {})

        # Check existing
        cursor.execute("""
            SELECT id, status, rendered_at, uploaded_at, submitted_at, first_seen_at, manual_status
            FROM tracker_tasks
            WHERE safar_name = ? AND date_folder = ?
        """, (safar_name, date_folder))
        row = cursor.fetchone()

        if row:
            task_id, old_status, ex_rendered, ex_uploaded, ex_submitted, ex_first, ex_manual = row
            # Preserve existing timestamps if new ones are not provided
            final_rendered = rendered_at or ex_rendered
            final_uploaded = uploaded_at or ex_uploaded
            final_submitted = submitted_at or ex_submitted
            final_first = ex_first or now_ms

            # If task was manually set by user, preserve the manual status!
            if ex_manual:
                final_status = ex_manual
            else:
                # Do not downgrade status if task was already advanced (e.g. submitted, uploaded, review, editing)
                # and new scan reported editing_pending due to missing/moved folders on hard drive
                final_status = status
                old_rank = STATUS_RANK.get(old_status, 0)
                new_rank = STATUS_RANK.get(status, 0)
                if old_rank > new_rank and new_rank <= 1:
                    final_status = old_status

            # If status transitioned to uploaded now and had no uploaded_at, set it
            if final_status == 'uploaded' and not final_uploaded:
                final_uploaded = now_ms
            if final_status == 'submitted' and not final_submitted:
                final_submitted = now_ms
            if final_status in ('upload_pending', 'uploaded', 'submitted') and not final_rendered:
                final_rendered = now_ms

            cursor.execute("""
                UPDATE tracker_tasks SET
                    status = ?,
                    prproj_modified_at = COALESCE(?, prproj_modified_at),
                    prproj_path = COALESCE(?, prproj_path),
                    rendered_at = ?,
                    render_duration = CASE WHEN ? > 0 THEN ? ELSE render_duration END,
                    render_video_count = CASE WHEN ? > 0 THEN ? ELSE render_video_count END,
                    render_size_bytes = CASE WHEN ? > 0 THEN ? ELSE render_size_bytes END,
                    uploaded_at = ?,
                    submitted_at = ?,
                    working_path = COALESCE(?, working_path),
                    final_path = COALESCE(?, final_path),
                    upload_path = COALESCE(?, upload_path),
                    delete_path = COALESCE(?, delete_path),
                    current_drive = COALESCE(?, current_drive),
                    notes = COALESCE(?, notes),
                    metadata_json = ?,
                    updated_at = ?
                WHERE id = ?
            """, (
                final_status, prproj_mod, prproj_path, final_rendered,
                render_dur, render_dur, render_count, render_count, render_size, render_size,
                final_uploaded, final_submitted, working_path, final_path,
                upload_path, delete_path, current_drive, notes, metadata_json, now_ms, task_id
            ))

            # Record history log if status changed
            if old_status != final_status:
                cursor.execute("""
                    INSERT INTO tracker_history_logs (
                        task_id, safar_name, date_folder, from_status, to_status, event_description, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (task_id, safar_name, date_folder, old_status, final_status, f"Status automatically changed from {old_status} to {final_status}", now_ms))

        else:
            final_first = now_ms
            final_rendered = rendered_at
            if status in ('upload_pending', 'uploaded', 'submitted') and not final_rendered:
                final_rendered = now_ms
            final_uploaded = uploaded_at
            if status == 'uploaded' and not final_uploaded:
                final_uploaded = now_ms
            final_submitted = submitted_at
            if status == 'submitted' and not final_submitted:
                final_submitted = now_ms

            cursor.execute("""
                INSERT INTO tracker_tasks (
                    safar_name, date_folder, status, first_seen_at,
                    prproj_modified_at, prproj_path, rendered_at, render_duration,
                    render_video_count, render_size_bytes, uploaded_at, submitted_at,
                    working_path, final_path, upload_path, delete_path, current_drive,
                    notes, metadata_json, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                safar_name, date_folder, status, final_first,
                prproj_mod, prproj_path, final_rendered, render_dur,
                render_count, render_size, final_uploaded, final_submitted,
                working_path, final_path, upload_path, delete_path, current_drive,
                notes, metadata_json, now_ms
            ))
            new_id = cursor.lastrowid
            cursor.execute("""
                INSERT INTO tracker_history_logs (
                    task_id, safar_name, date_folder, from_status, to_status, event_description, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (new_id, safar_name, date_folder, '', status, f"Discovered task with status {status}", now_ms))

        updated_count += 1

    conn.commit()
    return updated_count

def upsert_safars(conn, safars_data):
    cursor = conn.cursor()
    for s in safars_data:
        name = s.get('safarName') or s.get('safar_name')
        if not name:
            continue
        year = s.get('safarYear') or s.get('safar_year')
        serial = s.get('safarSerial') or s.get('safar_serial')
        city = s.get('city') or 'Unassigned'
        total = int(s.get('totalDays', 0) or 0)
        completed = int(s.get('completedDays', 0) or 0)
        is_done = 1 if (s.get('isSafarDone') or s.get('is_safar_done')) else 0
        path_val = s.get('currentPath') or s.get('current_path') or ''
        drive = s.get('currentDrive') or s.get('current_drive') or ''

        cursor.execute("""
            INSERT INTO safars (
                safar_name, safar_year, safar_serial, city, total_days,
                completed_days, is_safar_done, current_path, current_drive, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(safar_name) DO UPDATE SET
                safar_year = COALESCE(excluded.safar_year, safars.safar_year),
                safar_serial = COALESCE(excluded.safar_serial, safars.safar_serial),
                city = CASE WHEN excluded.city IS NOT NULL AND excluded.city != 'Unassigned' THEN excluded.city ELSE safars.city END,
                total_days = MAX(excluded.total_days, safars.total_days),
                completed_days = MAX(excluded.completed_days, safars.completed_days),
                is_safar_done = MAX(excluded.is_safar_done, safars.is_safar_done),
                current_path = CASE WHEN excluded.current_path != '' THEN excluded.current_path ELSE safars.current_path END,
                current_drive = CASE WHEN excluded.current_drive != '' THEN excluded.current_drive ELSE safars.current_drive END,
                updated_at = CURRENT_TIMESTAMP
        """, (name, year, serial, city, total, completed, is_done, path_val, drive))

    conn.commit()

def set_manual_status(conn, payload):
    """
    Manually sets status of Safars or individual Tasks to 'uploaded', 'submitted', or 'auto'.
    Payload format:
    {
        "safarNames": ["1447_02_Safar_Name"],
        "taskKeys": [{"safarName": "...", "dateFolder": "..."}],
        "status": "uploaded" | "submitted" | "auto"
    }
    """
    now_ms = int(time.time() * 1000)
    cursor = conn.cursor()
    target_status = payload.get('status', 'auto')
    safar_names = payload.get('safarNames') or payload.get('safar_names') or []
    task_keys = payload.get('taskKeys') or payload.get('task_keys') or []

    is_auto = (target_status == 'auto' or not target_status)
    manual_val = None if is_auto else target_status
    updated_tasks = 0

    # 1. Update tasks by Safar names
    for s_name in safar_names:
        if is_auto:
            # Clear manual override on tasks and reset status according to file paths
            cursor.execute("""
                UPDATE tracker_tasks
                SET manual_status = NULL,
                    status = CASE
                        WHEN delete_path IS NOT NULL AND delete_path != '' THEN 'submitted'
                        WHEN upload_path IS NOT NULL AND upload_path != '' THEN 'uploaded'
                        WHEN final_path IS NOT NULL AND final_path != '' THEN 'upload_pending'
                        WHEN prproj_path IS NOT NULL AND prproj_path != '' THEN 'editing'
                        ELSE 'editing_pending'
                    END,
                    updated_at = ?
                WHERE safar_name = ?
            """, (now_ms, s_name))
            updated_tasks += cursor.rowcount

            # Re-compute safar completed days
            cursor.execute("""
                SELECT COUNT(*),
                       SUM(CASE WHEN status IN ('uploaded', 'submitted') THEN 1 ELSE 0 END)
                FROM tracker_tasks
                WHERE safar_name = ?
            """, (s_name,))
            s_row = cursor.fetchone()
            tot = (s_row[0] or 0) if s_row else 0
            comp = (s_row[1] or 0) if s_row else 0
            is_done = 1 if (tot > 0 and comp >= tot) else 0

            cursor.execute("""
                UPDATE safars
                SET manual_status = NULL,
                    total_days = ?,
                    completed_days = ?,
                    is_safar_done = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE safar_name = ?
            """, (tot, comp, is_done, s_name))

            cursor.execute("""
                INSERT INTO tracker_history_logs (
                    task_id, safar_name, date_folder, from_status, to_status, event_description, timestamp
                ) VALUES (NULL, ?, '', 'manual', 'auto', 'Reset Safar deliverables to Auto file tracking', ?)
            """, (s_name, now_ms))
        else:
            # Setting to 'uploaded' or 'submitted'
            ts_uploaded_clause = f", uploaded_at = COALESCE(uploaded_at, {now_ms})" if target_status in ('uploaded', 'submitted') else ""
            ts_submitted_clause = f", submitted_at = COALESCE(submitted_at, {now_ms})" if target_status == 'submitted' else ""

            cursor.execute(f"""
                UPDATE tracker_tasks
                SET manual_status = ?,
                    status = ?,
                    updated_at = ?
                    {ts_uploaded_clause}
                    {ts_submitted_clause}
                WHERE safar_name = ?
            """, (manual_val, target_status, now_ms, s_name))
            updated_tasks += cursor.rowcount

            # Update safars table
            cursor.execute("SELECT COUNT(*) FROM tracker_tasks WHERE safar_name = ?", (s_name,))
            t_cnt_row = cursor.fetchone()
            tot = (t_cnt_row[0] or 0) if t_cnt_row else 0

            cursor.execute("""
                UPDATE safars
                SET manual_status = ?,
                    total_days = CASE WHEN total_days > 0 THEN total_days ELSE ? END,
                    completed_days = CASE WHEN total_days > 0 THEN total_days ELSE ? END,
                    is_safar_done = 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE safar_name = ?
            """, (manual_val, tot, tot, s_name))

            event_desc = f"Manually marked Safar as {target_status.replace('_', ' ').title()}"
            cursor.execute("""
                INSERT INTO tracker_history_logs (
                    task_id, safar_name, date_folder, from_status, to_status, event_description, timestamp
                ) VALUES (NULL, ?, '', 'auto', ?, ?, ?)
            """, (s_name, target_status, event_desc, now_ms))

    # 2. Update specific individual task keys
    for tk in task_keys:
        s_name = tk.get('safarName') or tk.get('safar_name')
        d_folder = tk.get('dateFolder') or tk.get('date_folder')
        if not s_name or not d_folder:
            continue

        if is_auto:
            cursor.execute("""
                UPDATE tracker_tasks
                SET manual_status = NULL,
                    status = CASE
                        WHEN delete_path IS NOT NULL AND delete_path != '' THEN 'submitted'
                        WHEN upload_path IS NOT NULL AND upload_path != '' THEN 'uploaded'
                        WHEN final_path IS NOT NULL AND final_path != '' THEN 'upload_pending'
                        WHEN prproj_path IS NOT NULL AND prproj_path != '' THEN 'editing'
                        ELSE 'editing_pending'
                    END,
                    updated_at = ?
                WHERE safar_name = ? AND date_folder = ?
            """, (now_ms, s_name, d_folder))
            updated_tasks += cursor.rowcount

            cursor.execute("""
                INSERT INTO tracker_history_logs (
                    task_id, safar_name, date_folder, from_status, to_status, event_description, timestamp
                ) VALUES (NULL, ?, ?, 'manual', 'auto', 'Reset date task to Auto file tracking', ?)
            """, (s_name, d_folder, now_ms))
        else:
            ts_uploaded_clause = f", uploaded_at = COALESCE(uploaded_at, {now_ms})" if target_status in ('uploaded', 'submitted') else ""
            ts_submitted_clause = f", submitted_at = COALESCE(submitted_at, {now_ms})" if target_status == 'submitted' else ""

            cursor.execute(f"""
                UPDATE tracker_tasks
                SET manual_status = ?,
                    status = ?,
                    updated_at = ?
                    {ts_uploaded_clause}
                    {ts_submitted_clause}
                WHERE safar_name = ? AND date_folder = ?
            """, (manual_val, target_status, now_ms, s_name, d_folder))
            updated_tasks += cursor.rowcount

            event_desc = f"Manually marked date deliverable as {target_status.replace('_', ' ').title()}"
            cursor.execute("""
                INSERT INTO tracker_history_logs (
                    task_id, safar_name, date_folder, from_status, to_status, event_description, timestamp
                ) VALUES (NULL, ?, ?, 'auto', ?, ?, ?)
            """, (s_name, d_folder, target_status, event_desc, now_ms))

        # Re-evaluate parent safar metrics
        cursor.execute("""
            SELECT COUNT(*),
                   SUM(CASE WHEN status IN ('uploaded', 'submitted') THEN 1 ELSE 0 END)
            FROM tracker_tasks
            WHERE safar_name = ?
        """, (s_name,))
        s_row = cursor.fetchone()
        if s_row:
            tot = s_row[0] or 0
            comp = s_row[1] or 0
            is_done = 1 if (tot > 0 and comp >= tot) else 0
            cursor.execute("""
                UPDATE safars
                SET total_days = ?,
                    completed_days = ?,
                    is_safar_done = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE safar_name = ?
            """, (tot, comp, is_done, s_name))

    conn.commit()
    return {
        'success': True,
        'status': target_status,
        'updatedTasks': updated_tasks,
        'safarNames': safar_names
    }

def get_all_data(conn):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            id, safar_name, date_folder, status, first_seen_at,
            prproj_modified_at, prproj_path, rendered_at, render_duration,
            render_video_count, render_size_bytes, uploaded_at, submitted_at,
            working_path, final_path, upload_path, delete_path, current_drive,
            notes, metadata_json, updated_at, manual_status
        FROM tracker_tasks
        ORDER BY safar_name ASC, date_folder ASC
    """)
    rows = cursor.fetchall()
    tasks = []
    for r in rows:
        meta = {}
        if r[19]:
            try: meta = json.loads(r[19])
            except: pass
        tasks.append({
            'id': r[0],
            'safarName': r[1],
            'dateFolder': r[2],
            'status': r[3],
            'firstSeenAt': r[4],
            'prprojModifiedAt': r[5],
            'prprojPath': r[6],
            'renderedAt': r[7],
            'renderDuration': r[8],
            'renderVideoCount': r[9],
            'renderSizeBytes': r[10],
            'uploadedAt': r[11],
            'submittedAt': r[12],
            'workingPath': r[13],
            'finalPath': r[14],
            'uploadPath': r[15],
            'deletePath': r[16],
            'currentDrive': r[17],
            'notes': r[18],
            'metadata': meta,
            'updatedAt': r[20],
            'manualStatus': r[21] if len(r) > 21 else None,
            'isManual': bool(r[21]) if len(r) > 21 else False
        })

    cursor.execute("""
        SELECT
            id, safar_name, safar_year, safar_serial, city,
            total_days, completed_days, is_safar_done, current_path, current_drive, manual_status
        FROM safars
        ORDER BY safar_name ASC
    """)
    safar_rows = cursor.fetchall()
    safars = []
    for sr in safar_rows:
        safars.append({
            'id': sr[0],
            'safarName': sr[1],
            'safarYear': sr[2],
            'safarSerial': sr[3],
            'city': sr[4],
            'totalDays': sr[5],
            'completedDays': sr[6],
            'isSafarDone': bool(sr[7]),
            'currentPath': sr[8],
            'currentDrive': sr[9],
            'manualStatus': sr[10] if len(sr) > 10 else None,
            'isManual': bool(sr[10]) if len(sr) > 10 else False
        })

    return {'safars': safars, 'tasks': tasks}

def get_history_logs(conn, safar_name=None, date_folder=None):
    cursor = conn.cursor()
    query = "SELECT id, task_id, safar_name, date_folder, from_status, to_status, event_description, timestamp FROM tracker_history_logs"
    params = []
    if safar_name and date_folder:
        query += " WHERE safar_name = ? AND date_folder = ?"
        params = [safar_name, date_folder]
    elif safar_name:
        query += " WHERE safar_name = ?"
        params = [safar_name]
    query += " ORDER BY timestamp DESC LIMIT 100"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    logs = []
    for r in rows:
        logs.append({
            'id': r[0],
            'taskId': r[1],
            'safarName': r[2],
            'dateFolder': r[3],
            'fromStatus': r[4],
            'toStatus': r[5],
            'description': r[6],
            'timestamp': r[7]
        })
    return logs

def upsert_resources(conn, resources):
    """
    Batch inserts or updates media resources in the tracker_media_resources table.
    Ensures ghost asset preservation across drive connections and disconnections.
    """
    cursor = conn.cursor()
    now_ms = int(time.time() * 1000)
    count = 0

    for r in resources:
        task_id = r.get('taskId') or r.get('task_id')
        safar_name = r.get('safarName') or r.get('safar_name') or 'Unassigned'
        date_folder = r.get('dateFolder') or r.get('date_folder') or ''
        file_type = r.get('fileType') or r.get('file_type') or 'video'
        category = r.get('category') or 'raw_footage'
        file_name = r.get('fileName') or r.get('file_name') or ''
        file_path = r.get('filePath') or r.get('file_path') or ''
        parent_dir = r.get('parentDir') or r.get('parent_dir') or os.path.dirname(file_path)
        drive_root = r.get('driveRoot') or r.get('drive_root') or ''
        drive_label = r.get('driveLabel') or r.get('drive_label') or ''
        file_size = int(r.get('fileSize', 0) or r.get('file_size', 0) or 0)
        duration = float(r.get('duration', 0) or 0)
        mtime = int(r.get('mtime', 0) or 0)

        if not file_path or not file_name:
            continue

        cursor.execute("""
            INSERT INTO tracker_media_resources (
                task_id, safar_name, date_folder, file_type, category,
                file_name, file_path, parent_dir, drive_root, drive_label,
                file_size, duration, mtime, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(file_path) DO UPDATE SET
                task_id = COALESCE(excluded.task_id, tracker_media_resources.task_id),
                safar_name = excluded.safar_name,
                date_folder = excluded.date_folder,
                file_type = excluded.file_type,
                category = excluded.category,
                file_name = excluded.file_name,
                parent_dir = excluded.parent_dir,
                drive_root = excluded.drive_root,
                drive_label = CASE WHEN excluded.drive_label != '' THEN excluded.drive_label ELSE tracker_media_resources.drive_label END,
                file_size = excluded.file_size,
                duration = excluded.duration,
                mtime = excluded.mtime,
                updated_at = excluded.updated_at
        """, (
            task_id, safar_name, date_folder, file_type, category,
            file_name, file_path, parent_dir, drive_root, drive_label,
            file_size, duration, mtime, now_ms
        ))
        count += 1

    conn.commit()
    return count

def search_resources(conn, query=None, file_type=None, category=None, drive_root=None, limit=200):
    """
    Sub-millisecond search across cataloged files, folders, and projects.
    Matches file names, safar names, date folders, and directory paths.
    """
    cursor = conn.cursor()
    sql = """
        SELECT
            id, task_id, safar_name, date_folder, file_type, category,
            file_name, file_path, parent_dir, drive_root, drive_label,
            file_size, duration, mtime, updated_at
        FROM tracker_media_resources
        WHERE 1=1
    """
    params = []
    if query:
        q_clean = query.strip()
        sql += " AND (file_name LIKE ? OR safar_name LIKE ? OR date_folder LIKE ? OR file_path LIKE ?)"
        q_wild = f"%{q_clean}%"
        params.extend([q_wild, q_wild, q_wild, q_wild])

    if file_type and file_type != 'all':
        sql += " AND file_type = ?"
        params.append(file_type)

    if category and category != 'all':
        sql += " AND category = ?"
        params.append(category)

    if drive_root and drive_root != 'all':
        sql += " AND drive_root LIKE ?"
        params.append(f"{drive_root.rstrip(':/\\')}%")

    sql += """
        ORDER BY
            CASE
                WHEN category = 'final_render' THEN 1
                WHEN file_type = 'project' THEN 2
                WHEN file_type = 'video' THEN 3
                WHEN file_type = 'folder' THEN 4
                ELSE 5
            END,
            mtime DESC
        LIMIT ?
    """
    params.append(int(limit or 200))

    cursor.execute(sql, params)
    rows = cursor.fetchall()
    results = []
    for r in rows:
        results.append({
            'id': r[0],
            'taskId': r[1],
            'safarName': r[2],
            'dateFolder': r[3],
            'fileType': r[4],
            'category': r[5],
            'fileName': r[6],
            'filePath': r[7],
            'parentDir': r[8],
            'driveRoot': r[9],
            'driveLabel': r[10] or '',
            'fileSize': r[11],
            'duration': r[12],
            'mtime': r[13],
            'updatedAt': r[14]
        })
    return results

def get_resource_stats(conn):
    """
    Calculates summary metrics of indexed assets across all drives.
    """
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*), COALESCE(SUM(file_size), 0) FROM tracker_media_resources")
    row = cursor.fetchone()
    total_count = row[0] or 0
    total_bytes = row[1] or 0

    cursor.execute("SELECT file_type, COUNT(*) FROM tracker_media_resources GROUP BY file_type")
    type_counts = dict(cursor.fetchall())

    cursor.execute("SELECT category, COUNT(*) FROM tracker_media_resources GROUP BY category")
    category_counts = dict(cursor.fetchall())

    cursor.execute("SELECT drive_root, COUNT(*), COALESCE(SUM(file_size), 0) FROM tracker_media_resources GROUP BY drive_root")
    drive_rows = cursor.fetchall()
    drives = []
    for dr in drive_rows:
        if dr[0]:
            drives.append({'drive': dr[0], 'count': dr[1], 'bytes': dr[2]})

    return {
        'totalCount': total_count,
        'totalBytes': total_bytes,
        'types': type_counts,
        'categories': category_counts,
        'drives': drives
    }

def rename_safar(conn, old_name, new_name, new_city=None, new_year=None, new_serial=None):
    """
    Renames a Safar across safars, tracker_tasks, and tracker_media_resources in tracker.db.
    """
    old_clean = (old_name or '').strip()
    new_clean = (new_name or '').strip()
    if not old_clean or not new_clean:
        return {'success': False, 'error': 'Both old and new safar names are required'}

    cursor = conn.cursor()

    # 1. Update safars table
    cursor.execute("SELECT id, city, safar_year, safar_serial FROM safars WHERE LOWER(safar_name) = LOWER(?)", (old_clean,))
    s_row = cursor.fetchone()
    if s_row:
        s_id = s_row[0]
        final_city = new_city if new_city is not None else s_row[1]
        final_year = new_year if new_year is not None else s_row[2]
        final_serial = new_serial if new_serial is not None else s_row[3]
        cursor.execute("""
            UPDATE safars
            SET safar_name = ?,
                city = ?,
                safar_year = ?,
                safar_serial = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (new_clean, final_city, final_year, final_serial, s_id))
    else:
        # Create safar record with new name if it was unassigned
        cursor.execute("""
            INSERT OR IGNORE INTO safars (safar_name, city, safar_year, safar_serial)
            VALUES (?, ?, ?, ?)
        """, (new_clean, new_city or 'Unassigned', new_year, new_serial))

    # 2. Update tracker_tasks
    cursor.execute("""
        UPDATE tracker_tasks
        SET safar_name = ?,
            updated_at = ?
        WHERE LOWER(safar_name) = LOWER(?)
    """, (new_clean, int(time.time() * 1000), old_clean))
    tasks_updated = cursor.rowcount

    # 3. Update tracker_media_resources
    cursor.execute("""
        UPDATE tracker_media_resources
        SET safar_name = ?,
            updated_at = ?
        WHERE LOWER(safar_name) = LOWER(?)
    """, (new_clean, int(time.time() * 1000), old_clean))
    resources_updated = cursor.rowcount

    conn.commit()
    return {
        'success': True,
        'oldName': old_clean,
        'newName': new_clean,
        'tasksUpdated': tasks_updated,
        'resourcesUpdated': resources_updated
    }

def update_safar_path(conn, safar_name: str, old_path: str, new_path: str, new_drive: str = None) -> dict:
    """Updates safar path across safars, tasks, and media resources tables."""
    safar_clean = (safar_name or '').strip()
    if not safar_clean:
        return {'success': False, 'error': 'safar_name is required'}

    cursor = conn.cursor()

    # 1. Update safars table
    cursor.execute("""
        UPDATE safars
        SET current_path = ?,
            current_drive = COALESCE(?, current_drive),
            updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(safar_name) = LOWER(?)
    """, (new_path, new_drive, safar_clean))

    # 2. Update tracker_tasks paths
    cursor.execute("SELECT id, working_path, final_path, upload_path, delete_path FROM tracker_tasks WHERE LOWER(safar_name) = LOWER(?)", (safar_clean,))
    tasks = cursor.fetchall()
    for tid, wp, fp, up, dp in tasks:
        new_wp = wp.replace(old_path, new_path) if wp and old_path in wp else wp
        new_fp = fp.replace(old_path, new_path) if fp and old_path in fp else fp
        cursor.execute("""
            UPDATE tracker_tasks
            SET working_path = ?,
                final_path = ?,
                current_drive = COALESCE(?, current_drive),
                updated_at = ?
            WHERE id = ?
        """, (new_wp, new_fp, new_drive, int(time.time() * 1000), tid))

    # 3. Update tracker_media_resources paths
    cursor.execute("SELECT id, file_path, parent_dir FROM tracker_media_resources WHERE LOWER(safar_name) = LOWER(?)", (safar_clean,))
    res = cursor.fetchall()
    for rid, fpath, pdir in res:
        new_fpath = fpath.replace(old_path, new_path) if fpath and old_path in fpath else fpath
        new_pdir = pdir.replace(old_path, new_path) if pdir and old_path in pdir else pdir
        cursor.execute("""
            UPDATE tracker_media_resources
            SET file_path = ?,
                parent_dir = ?,
                drive_root = COALESCE(?, drive_root),
                updated_at = ?
            WHERE id = ?
        """, (new_fpath, new_pdir, new_drive, int(time.time() * 1000), rid))

    conn.commit()
    return {'success': True, 'safar_name': safar_clean, 'new_path': new_path}

def main():
    parser = argparse.ArgumentParser(description="Autonomous Task & Production Tracker SQLite Backend")
    parser.add_argument('--db', help="Path to sqlite db file")
    parser.add_argument('--init', action='store_true', help="Initialize tracker database")
    parser.add_argument('--get-all', action='store_true', help="Retrieve all tracker safars and tasks")
    parser.add_argument('--get-history', action='store_true', help="Retrieve audit history logs")
    parser.add_argument('--safar', help="Filter by safar name")
    parser.add_argument('--date', help="Filter by date folder name")
    parser.add_argument('--set-manual-status', action='store_true', help="Manually mark safars or tasks as uploaded, submitted, or auto")
    parser.add_argument('--upsert-batch', action='store_true', help="Upsert tasks and safars batch from stdin or file")
    parser.add_argument('--data', help="JSON string or file containing tasks and safars")

    # Safar renaming support
    parser.add_argument('--rename-safar', action='store_true', help="Rename safar across safars, tasks, and resources")
    parser.add_argument('--old-safar', help="Old safar name")
    parser.add_argument('--new-safar', help="New safar name")
    parser.add_argument('--city', help="New city name")
    parser.add_argument('--year', type=int, help="New Hijri year")
    parser.add_argument('--serial', help="New serial number")

    # Safar path update support
    parser.add_argument('--update-safar-path', action='store_true', help="Update safar and related task/resource paths after moving directory")
    parser.add_argument('--old-path', help="Old directory path")
    parser.add_argument('--new-path', help="New directory path")
    parser.add_argument('--new-drive', help="New drive letter (e.g. D:)")

    # Ghost Vault Resource Indexing & Search Arguments
    parser.add_argument('--upsert-resources', action='store_true', help="Upsert media resources into Ghost Vault")
    parser.add_argument('--search-resources', action='store_true', help="Search Ghost Vault media resources")
    parser.add_argument('--resource-stats', action='store_true', help="Get Ghost Vault summary statistics")
    parser.add_argument('--query', help="Search query string")
    parser.add_argument('--file-type', help="Filter by file type: video, project, audio, folder, other")
    parser.add_argument('--category', help="Filter by category: final_render, working_project, raw_footage, folder")
    parser.add_argument('--drive-root', help="Filter by drive root e.g. D: or E:")
    parser.add_argument('--limit', type=int, default=200, help="Max results to return")

    args = parser.parse_args()
    db_file = get_db_path(args.db)

    try:
        conn = get_connection(db_file)
        init_db(conn)

        if args.init:
            print(json.dumps({'success': True, 'db': db_file}))
            return

        if args.get_history:
            logs = get_history_logs(conn, args.safar, args.date)
            print(json.dumps({'success': True, 'logs': logs}))
            return

        if args.get_all:
            data = get_all_data(conn)
            print(json.dumps({'success': True, 'data': data, 'db': db_file}))
            return

        if args.search_resources:
            results = search_resources(
                conn,
                query=args.query,
                file_type=args.file_type,
                category=args.category,
                drive_root=args.drive_root,
                limit=args.limit
            )
            print(json.dumps({'success': True, 'results': results, 'count': len(results), 'db': db_file}))
            return

        if args.resource_stats:
            stats = get_resource_stats(conn)
            print(json.dumps({'success': True, 'stats': stats, 'db': db_file}))
            return

        if args.upsert_resources:
            data_str = ''
            if args.data:
                if os.path.isfile(args.data):
                    with open(args.data, 'r', encoding='utf-8') as f:
                        data_str = f.read()
                else:
                    data_str = args.data
            else:
                data_str = sys.stdin.read()

            payload = json.loads(data_str) if data_str.strip() else []
            resources_list = payload if isinstance(payload, list) else payload.get('resources', [])
            count = upsert_resources(conn, resources_list)
            print(json.dumps({'success': True, 'resourcesUpserted': count, 'db': db_file}))
            return

        if args.set_manual_status:
            data_str = ''
            if args.data:
                if os.path.isfile(args.data):
                    with open(args.data, 'r', encoding='utf-8') as f:
                        data_str = f.read()
                else:
                    data_str = args.data
            else:
                data_str = sys.stdin.read()

            payload = json.loads(data_str) if data_str.strip() else {}
            res = set_manual_status(conn, payload)
            print(json.dumps(res))
            return

        if args.rename_safar:
            old_name = args.old_safar or args.safar
            new_name = args.new_safar
            if not old_name or not new_name:
                print(json.dumps({'success': False, 'error': 'Missing --old-safar or --new-safar'}))
                return
            res = rename_safar(
                conn,
                old_name=old_name,
                new_name=new_name,
                new_city=args.city,
                new_year=args.year,
                new_serial=args.serial
            )
            print(json.dumps(res))
            return

        if args.update_safar_path:
            payload = {}
            if args.data:
                try:
                    payload = json.loads(args.data) if not os.path.isfile(args.data) else json.load(open(args.data, 'r', encoding='utf-8'))
                except Exception:
                    pass
            elif not sys.stdin.isatty():
                try:
                    stdin_txt = sys.stdin.read().strip()
                    if stdin_txt:
                        payload = json.loads(stdin_txt)
                except Exception:
                    pass

            s_name = args.safar or payload.get('safar_name')
            o_path = args.old_path or payload.get('old_path')
            n_path = args.new_path or payload.get('new_path')
            n_drive = args.new_drive or payload.get('new_drive')

            if not s_name or not n_path:
                print(json.dumps({'success': False, 'error': 'Missing safar name or new path'}))
                return

            res = update_safar_path(conn, s_name, o_path or '', n_path, n_drive)
            print(json.dumps(res))
            return

        if args.upsert_batch:
            data_str = ''
            if args.data:
                if os.path.isfile(args.data):
                    with open(args.data, 'r', encoding='utf-8') as f:
                        data_str = f.read()
                else:
                    data_str = args.data
            else:
                data_str = sys.stdin.read()

            payload = json.loads(data_str) if data_str.strip() else {}
            tasks = payload.get('tasks', [])
            safars_list = payload.get('safars', [])
            resources_list = payload.get('resources', [])

            t_count = upsert_tasks(conn, tasks) if tasks else 0
            if safars_list:
                upsert_safars(conn, safars_list)
            r_count = upsert_resources(conn, resources_list) if resources_list else 0

            print(json.dumps({'success': True, 'tasksUpdated': t_count, 'resourcesUpdated': r_count, 'db': db_file}))
            return

        print(json.dumps({'success': True, 'db': db_file}))

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == '__main__':
    main()
