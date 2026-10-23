"""
Safar Folder Inspector - Python Standalone Verification Harness
Matches the exact logic of the Windhawk C++ mod.
"""

import os
import sys
import re
from pathlib import Path

# Ensure UTF-8 output on Windows console
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

OFFICIAL_EVENTS = {
    'AQ': 'Aqiqa',
    'BM': 'Bethak Majlis',
    'BQ': 'Bethak Qadam',
    'BZ': 'Bethak Ziyafat',
    'FMB': 'FMB',
    'H': 'Haddiyat',
    'ID': 'Idaraat',
    'IF': 'Iftettah',
    'IFS': 'Iftettah Sharaf',
    'IST': 'Isteqbal',
    'KGS': 'Kg Sharaf',
    'M': 'Majlis',
    'MF': 'Mafsuhiyat',
    'MISBAH': 'Misbah',
    'MKB': 'Mokib',
    'MO': 'Madrasa',
    'MQ': 'Misaq',
    'MUL': 'Mulaqaat',
    'MYN': 'Miyana',
    'MZ': 'Majmui Ziyafat',
    'N': 'Nikah',
    'NAMAZ': 'Namaz',
    'ONLINE': 'Online',
    'Q': 'Qadam',
    'QMZ': 'Qadam Majlis Ziyafat',
    'SH': 'Sharaf',
    'SQ': 'Shifa Qadam',
    'TJR': 'Tijarat',
    'TQ': 'Talaqqi',
    'TQN': 'Tahneeq',
    'WAAZ': 'Waaz',
    'WD': 'Wada',
    'Z': 'Ziyafat',
    'ZO': 'Zafaf Olda',
}

VIDEO_EXTS = {'.mp4', '.mov', '.mkv', '.avi', '.m4v'}


def format_duration(seconds: float) -> str:
    secs = int(seconds)
    h = secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    if h > 0:
        return f"{h}h {m:02d}m {s:02d}s"
    return f"{m}m {s:02d}s"


def parse_item_folder(name: str):
    # Pattern 1: Standard with separate item index: 1448-03-13 _01M-02-01N-30338708 or 1448-02-29 _01M-01-N-
    # Pattern 2: Merged occurrence without extra hyphen: 1448-03-13 _01M-01AQ-
    pattern = re.compile(r"^(\d{4}-\d{2}-\d{2})\s*_(\d{2}[MEme])[-_](?:(\d{1,3})[-_](.*)|(\d{1,3}[A-Za-z]+.*))$")
    m = pattern.match(name)
    if not m:
        return None

    date_str, session, item_idx_sep, rem_sep, merged_occ = m.groups()
    if merged_occ:
        # e.g. "01AQ-"
        num_m = re.match(r"^(\d+)(.*)$", merged_occ)
        item_idx = num_m.group(1) if num_m else "01"
        remainder = (num_m.group(2) if num_m else merged_occ).upper()
    else:
        item_idx = item_idx_sep
        remainder = (rem_sep or '').upper()

    event_code = None
    # 1. Occurrence pattern like 01N or 02AQ
    occ_m = re.search(r'(\d{1,2})([A-Z]+)', remainder)
    if occ_m and occ_m.group(2) in OFFICIAL_EVENTS:
        event_code = occ_m.group(2)
    else:
        # Search direct code (longest first)
        for code in sorted(OFFICIAL_EVENTS.keys(), key=len, reverse=True):
            if f"-{code}-" in f"-{remainder}-" or f"_{code}_" in f"_{remainder}_":
                event_code = code
                break
        if not event_code:
            for code in sorted(OFFICIAL_EVENTS.keys(), key=len, reverse=True):
                if code in remainder:
                    event_code = code
                    break

    its_m = re.search(r'(\d{8})', remainder)
    its_id = its_m.group(1) if its_m else None

    return {
        'date': date_str,
        'session': session.upper(),
        'item_index': item_idx,
        'event_code': event_code or 'OTHER',
        'event_name': OFFICIAL_EVENTS.get(event_code, 'Other'),
        'its_id': its_id
    }


def inspect_safar(target_dir: str):
    p = Path(target_dir)
    if not p.exists() or not p.is_dir():
        print(f"Error: Directory '{target_dir}' does not exist.")
        return

    print("=" * 65)
    print(f"🏕️ SAFAR & MEDIA INSPECTOR: {p.name}")
    print(f"📁 Path: {p}")
    print("=" * 65)

    subdirs = [d for d in p.iterdir() if d.is_dir()]
    date_sessions = []
    for d in subdirs:
        if re.match(r'^\d{4}-\d{2}-\d{2}\s*_\d{2}[MEme]', d.name):
            date_sessions.append(d)

    event_counts = {}
    total_videos = 0
    total_size = 0

    if date_sessions:
        # Level 1: Safar Root
        print(f"📂 Classification: LEVEL 1 (Safar Root Folder)")
        print(f"📅 Total Days in Safar: {len(date_sessions)} days")
        print("-" * 65)

        for ds in sorted(date_sessions, key=lambda x: x.name):
            ds_items = [it for it in ds.iterdir() if it.is_dir()]
            ds_event_counts = {}
            ds_vids = 0

            for it in ds_items:
                parsed = parse_item_folder(it.name)
                if parsed:
                    c = parsed['event_code']
                    event_counts[c] = event_counts.get(c, 0) + 1
                    ds_event_counts[c] = ds_event_counts.get(c, 0) + 1

                for root, _, files in os.walk(it):
                    for f in files:
                        if Path(f).suffix.lower() in VIDEO_EXTS:
                            total_videos += 1
                            ds_vids += 1
                            total_size += os.path.getsize(os.path.join(root, f))

            breakdown_str = " | ".join(f"{k}: {v}" for k, v in sorted(ds_event_counts.items()))
            print(f"  • {ds.name:22} -> {len(ds_items):2d} items | {ds_vids:2d} clips | [{breakdown_str}]")

    else:
        # Check if Date Session or Item
        parsed_self = parse_item_folder(p.name)
        if parsed_self:
            print(f"📂 Classification: LEVEL 3 (Single Event Item Folder)")
            print(f"  • Event Code: {parsed_self['event_code']} ({parsed_self['event_name']})")
            print(f"  • Date: {parsed_self['date']} | Session: {parsed_self['session']}")
            print(f"  • ITS ID: {parsed_self['its_id'] or 'None'}")
            event_counts[parsed_self['event_code']] = 1
        else:
            print(f"📂 Classification: LEVEL 2 (Date Session Folder)")
            items = [it for it in p.iterdir() if it.is_dir()]
            for it in items:
                parsed = parse_item_folder(it.name)
                if parsed:
                    c = parsed['event_code']
                    event_counts[c] = event_counts.get(c, 0) + 1

                for root, _, files in os.walk(it):
                    for f in files:
                        if Path(f).suffix.lower() in VIDEO_EXTS:
                            total_videos += 1
                            total_size += os.path.getsize(os.path.join(root, f))

    total_events = sum(event_counts.values())
    print("\n" + "=" * 65)
    print(f"🎯 TOTAL EVENTS: {total_events} recorded")
    print(f"🎬 TOTAL VIDEO CLIPS: {total_videos} files ({total_size / (1024*1024*1024):.2f} GB)")
    print("\n📊 OFFICIAL EVENT BREAKDOWN (Zero-counts hidden):")
    for code, count in sorted(event_counts.items(), key=lambda x: x[1], reverse=True):
        full_name = OFFICIAL_EVENTS.get(code, 'Other')
        print(f"   [{code:6}] : {count:3d}  -->  {full_name}")
    print("=" * 65)


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else r"D:\ON_GOING PROJECT\One Tap_V20.6.5\Docs\safars\1448-10-Istefada ilmiyah"
    inspect_safar(target)
