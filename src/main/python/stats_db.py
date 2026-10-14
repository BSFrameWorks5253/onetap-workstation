#!/usr/bin/env python3
"""
============================================================
STATS DATABASE MANAGER (src/main/python/stats_db.py)

Free, embedded SQLite database backend for One Tap / Uni Desk.
Stores video rendering and processing statistics with full
support for Safars, Serial numbers, and dynamic Event Codes.
============================================================
"""

import sys
import os
import json
import sqlite3
import argparse

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
                    return os.path.join(target_folder, 'stats.db')
        except Exception:
            pass

    os.makedirs(locator_dir, exist_ok=True)
    return os.path.join(locator_dir, 'stats.db')

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
    CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        date INTEGER NOT NULL,
        folder TEXT,
        duration REAL DEFAULT 0,
        safar TEXT DEFAULT 'Unassigned',
        safar_year INTEGER,
        safar_serial TEXT,
        city TEXT DEFAULT 'Unassigned',
        hijri_year INTEGER,
        hijri_month INTEGER,
        hijri_day INTEGER,
        session TEXT,
        file_path TEXT,
        is_reedit INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stats_safar ON stats(safar);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stats_serial ON stats(safar_serial);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stats_prefix ON stats(prefix);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stats_date ON stats(date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_stats_hijri_year ON stats(hijri_year);")
    try:
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_unique_entry ON stats(name, prefix, date, is_reedit);")
    except Exception:
        try:
            cursor.execute("""
                DELETE FROM stats
                WHERE id NOT IN (
                    SELECT MAX(id)
                    FROM stats
                    GROUP BY name, prefix, date, is_reedit
                );
            """)
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_stats_unique_entry ON stats(name, prefix, date, is_reedit);")
        except Exception:
            pass
    conn.commit()

def insert_records(conn, records):
    if not records:
        return 0
    cursor = conn.cursor()
    rows = []
    for r in records:
        rows.append((
            r.get('prefix', ''),
            r.get('name', ''),
            int(r.get('date', 0)),
            r.get('folder', ''),
            float(r.get('duration', 0) or 0),
            r.get('safar') or 'Unassigned',
            r.get('safarYear') or r.get('safar_year'),
            r.get('safarSerial') or r.get('safar_serial'),
            r.get('city') or 'Unassigned',
            r.get('hijriYear') or r.get('hijri_year'),
            r.get('hijriMonth') or r.get('hijri_month'),
            r.get('hijriDay') or r.get('hijri_day'),
            r.get('session') or '',
            r.get('filePath') or r.get('file_path') or '',
            1 if r.get('isReedit') else 0
        ))

    upsert_sql = """
        INSERT INTO stats (
            prefix, name, date, folder, duration, safar, safar_year,
            safar_serial, city, hijri_year, hijri_month, hijri_day,
            session, file_path, is_reedit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name, prefix, date, is_reedit) DO UPDATE SET
            folder = excluded.folder,
            duration = excluded.duration,
            safar = excluded.safar,
            safar_year = excluded.safar_year,
            safar_serial = excluded.safar_serial,
            city = excluded.city,
            hijri_year = excluded.hijri_year,
            hijri_month = excluded.hijri_month,
            hijri_day = excluded.hijri_day,
            session = excluded.session,
            file_path = excluded.file_path
    """
    cursor.executemany(upsert_sql, rows)
    conn.commit()
    return len(rows)

def get_all_records(conn):
    cursor = conn.cursor()
    cursor.execute("""
        SELECT prefix, name, date, folder, duration, safar, safar_year,
               safar_serial, city, hijri_year, hijri_month, hijri_day,
               session, file_path, is_reedit
        FROM stats
        ORDER BY date DESC
    """)
    rows = cursor.fetchall()
    records = []
    for row in rows:
        records.append({
            'prefix': row[0],
            'name': row[1],
            'date': row[2],
            'folder': row[3],
            'duration': row[4],
            'safar': row[5],
            'safarYear': row[6],
            'safarSerial': row[7],
            'city': row[8],
            'hijriYear': row[9],
            'hijriMonth': row[10],
            'hijriDay': row[11],
            'session': row[12],
            'filePath': row[13],
            'isReedit': bool(row[14])
        })
    return records

def reassign_safar(conn, from_safar, to_safar):
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE stats
        SET safar = ?, city = ?, safar_serial = NULL, safar_year = NULL
        WHERE safar = ? OR (safar IS NULL AND city = ?)
    """, (to_safar, to_safar, from_safar, from_safar))
    updated = cursor.rowcount
    conn.commit()
    return updated

def rename_safar(conn, from_safar, to_safar, new_serial=None, new_year=None, new_city=None):
    cursor = conn.cursor()
    query = "UPDATE stats SET safar = ?"
    params = [to_safar]
    if new_serial is not None and str(new_serial).strip():
        query += ", safar_serial = ?"
        params.append(str(new_serial).strip())
    if new_year is not None:
        try:
            query += ", safar_year = ?"
            params.append(int(new_year))
        except (ValueError, TypeError):
            pass
    if new_city is not None and str(new_city).strip():
        query += ", city = ?"
        params.append(str(new_city).strip())
    query += " WHERE safar = ? OR (safar IS NULL AND city = ?)"
    params.append(from_safar)
    params.append(from_safar)
    cursor.execute(query, params)
    updated = cursor.rowcount
    conn.commit()
    return updated

def delete_safar(conn, safar):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM stats WHERE safar = ? OR (safar IS NULL AND city = ?)", (safar, safar))
    deleted = cursor.rowcount
    conn.commit()
    return deleted

def delete_folder(conn, folder):
    cursor = conn.cursor()
    cursor.execute("DELETE FROM stats WHERE folder = ?", (folder,))
    deleted = cursor.rowcount
    conn.commit()
    return deleted

def main():
    parser = argparse.ArgumentParser(description="One Tap Stats SQLite Backend")
    parser.add_argument('--db', help="Path to sqlite db file")
    parser.add_argument('--init', action='store_true', help="Initialize database")
    parser.add_argument('--get-all', action='store_true', help="Retrieve all stats as JSON")
    parser.add_argument('--insert-batch', action='store_true', help="Insert batch from stdin or file")
    parser.add_argument('--data', help="JSON string or file containing records")
    parser.add_argument('--reassign-safar', action='store_true', help="Reassign Safar to another (e.g. Unassigned)")
    parser.add_argument('--rename-safar', action='store_true', help="Rename Safar block metadata")
    parser.add_argument('--delete-safar', action='store_true', help="Delete Safar and its records completely")
    parser.add_argument('--delete-folder', action='store_true', help="Delete Folder and its records completely")
    parser.add_argument('--from-safar', help="Current safar name")
    parser.add_argument('--from-folder', help="Current folder name")
    parser.add_argument('--to-safar', default="Unassigned", help="New safar name")
    parser.add_argument('--new-serial', help="New serial number")
    parser.add_argument('--new-year', type=int, help="New year")
    parser.add_argument('--new-city', help="New city")

    args = parser.parse_args()
    db_file = get_db_path(args.db)

    try:
        conn = get_connection(db_file)
        init_db(conn)

        if args.init:
            print(json.dumps({'success': True, 'db': db_file}))
            return

        if args.delete_safar and args.from_safar:
            count = delete_safar(conn, args.from_safar)
            print(json.dumps({'success': True, 'deleted': count, 'safar': args.from_safar}))
            return

        if args.delete_folder and args.from_folder:
            count = delete_folder(conn, args.from_folder)
            print(json.dumps({'success': True, 'deleted': count, 'folder': args.from_folder}))
            return

        if args.rename_safar and args.from_safar and args.to_safar:
            count = rename_safar(conn, args.from_safar, args.to_safar, args.new_serial, args.new_year, args.new_city)
            print(json.dumps({'success': True, 'updated': count, 'safar': args.to_safar}))
            return

        if args.reassign_safar and args.from_safar:
            count = reassign_safar(conn, args.from_safar, args.to_safar)
            print(json.dumps({'success': True, 'updated': count, 'safar': args.to_safar}))
            return

        if args.insert_batch:
            data_str = ''
            if args.data:
                if os.path.isfile(args.data):
                    with open(args.data, 'r', encoding='utf-8') as f:
                        data_str = f.read()
                else:
                    data_str = args.data
            else:
                data_str = sys.stdin.read()

            records = json.loads(data_str) if data_str.strip() else []
            count = insert_records(conn, records)
            print(json.dumps({'success': True, 'count': count}))
            return

        if args.get_all:
            records = get_all_records(conn)
            print(json.dumps({'success': True, 'records': records}))
            return

        # Default fallback
        print(json.dumps({'success': True, 'db': db_file}))

    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)
    finally:
        if 'conn' in locals() and conn:
            conn.close()

if __name__ == '__main__':
    main()
