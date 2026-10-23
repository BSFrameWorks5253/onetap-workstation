#!/usr/bin/env python3
"""
====================================================================
CREATE ADOBE PREMIERE PRO PROJECTS & SEQUENCES (create_premiere_projects.py)
Creates .prproj / Premiere XML project files with all videos placed
end-to-end on Video Track 1 (V1) and Audio Track 1 (A1).
====================================================================
"""

import os
import sys
import shutil
import argparse
import json
import subprocess
import gzip
from xml.etree import ElementTree as ET

VIDEO_EXTS = {
    '.mp4', '.mov', '.avi', '.mkv', '.mts', '.m2ts', '.mxf', '.wmv',
    '.flv', '.webm', '.m4v', '.mpg', '.mpeg', '.3gp', '.mod', '.tod', '.vob', '.divx',
    '.braw', '.crm', '.r3d', '.ari', '.arx', '.cine', '.ts', '.tp', '.m2t',
    '.dv', '.dif', '.hevc', '.h264', '.h265', '.264', '.265', '.f4v',
    '.asf', '.ogv', '.mp4v', '.insv', '.lrf', '.lrv', '.dat',
    '.m2v', '.m4p', '.nev', '.qt', '.rm', '.rmvb', '.vro', '.wtv', '.dvr-ms', '.ogm', '.mpe', '.mpv', '.m2p', '.3g2', '.avchd'
}
OUTPUT_FOLDER_NAMES = {
    'export', 'exports', 'renders', 'temp', 'scratch',
    'proxy', 'proxies', 'pxd', 'thumb', 'thumbs', 'thumbnail', 'thumbnails',
    'preview', 'previews', 'cache', '.git', '.trash', '$recycle.bin', 'system volume information'
}
SYSTEM_IGNORE_FOLDERS = {
    '.git', '.trash', '$recycle.bin', 'system volume information',
    'adobe premiere pro auto-save', 'thumb', 'thumbs', 'thumbnail', 'thumbnails',
    'preview', 'previews', 'proxy', 'proxies', 'pxd', 'cache'
}


def find_ffprobe():
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
        if os.path.isabs(c) and os.path.exists(c):
            return c
        elif shutil.which(c):
            return c
    return 'ffprobe'


def get_video_info(file_path):
    """Executes ffprobe to get video duration, width, height, fps, and audio channel count."""
    fallback_res = {"width": 1920, "height": 1080, "duration": 10.0, "fps": 30.0, "audioChannels": 2, "isValid": True}
    try:
        if not file_path or not os.path.exists(file_path):
            return fallback_res

        base_name = os.path.basename(file_path)
        if base_name.startswith('.') or base_name.startswith('~$'):
            return {"width": 1920, "height": 1080, "duration": 0, "fps": 30.0, "audioChannels": 2, "isValid": False}

        if os.path.getsize(file_path) <= 0:
            return {"width": 1920, "height": 1080, "duration": 0, "fps": 30.0, "audioChannels": 2, "isValid": False}

        ffprobe_bin = find_ffprobe()
        cmd = [
            ffprobe_bin, '-v', 'error',
            '-show_entries', 'stream=width,height,duration,r_frame_rate,avg_frame_rate,channels,codec_type:format=duration',
            '-of', 'json', file_path
        ]
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, windows_hide=True, timeout=15).decode('utf-8')
        data = json.loads(out)
        streams = data.get('streams', [])
        stream = next((s for s in streams if s.get('codec_type') == 'video'), None)
        astream = next((s for s in streams if s.get('codec_type') == 'audio'), {})
        fmt = data.get('format', {})

        w = int(stream.get('width') or 1920) if stream else 1920
        h = int(stream.get('height') or 1080) if stream else 1080
        channels = int(astream.get('channels') or 2)

        dur_raw = (stream.get('duration') if stream else None) or fmt.get('duration')
        try:
            dur_sec = float(dur_raw)
            if dur_sec <= 0:
                dur_sec = 10.0
        except (TypeError, ValueError):
            dur_sec = 10.0

        fps_str = (stream.get('r_frame_rate') or stream.get('avg_frame_rate') or '30/1') if stream else '30/1'
        if '/' in fps_str and fps_str != '0/0':
            num, den = fps_str.split('/')
            fps = float(num) / float(den) if float(den) > 0 else 30.0
        else:
            try:
                fps = float(fps_str)
            except ValueError:
                fps = 30.0

        return {"width": w, "height": h, "duration": max(dur_sec, 0.1), "fps": round(fps, 2), "audioChannels": channels, "isValid": True}
    except Exception:
        return fallback_res


import re


def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]


# 34 Official Events from Event List.xlsx with unique colors & Premiere marker indices
EVENT_DEFINITIONS = {
    'AQ':     {"name": "Aqiqa",                "red": 0,   "green": 210, "blue": 255, "colorIndex": 7, "colorName": "Cyan"},
    'BM':     {"name": "Bethak Majlis",        "red": 20,  "green": 184, "blue": 166, "colorIndex": 7, "colorName": "Teal"},
    'BQ':     {"name": "Bethak Qadam",         "red": 244, "green": 63,  "blue": 94,  "colorIndex": 1, "colorName": "Coral"},
    'BZ':     {"name": "Bethak Ziyafat",       "red": 168, "green": 85,  "blue": 247, "colorIndex": 2, "colorName": "Lavender"},
    'FMB':    {"name": "FMB",                  "red": 34,  "green": 197, "blue": 94,  "colorIndex": 0, "colorName": "Green"},
    'H':      {"name": "Haddiyat",             "red": 245, "green": 158, "blue": 11,  "colorIndex": 4, "colorName": "Amber"},
    'ID':     {"name": "Idaraat",              "red": 37,  "green": 99,  "blue": 235, "colorIndex": 6, "colorName": "Royal Blue"},
    'IF':     {"name": "Iftettah",             "red": 132, "green": 204, "blue": 22,  "colorIndex": 0, "colorName": "Lime"},
    'IFS':    {"name": "Iftettah Sharaf",      "red": 16,  "green": 185, "blue": 129, "colorIndex": 0, "colorName": "Emerald"},
    'IST':    {"name": "Isteqbal",             "red": 99,  "green": 102, "blue": 241, "colorIndex": 6, "colorName": "Indigo"},
    'KGS':    {"name": "Kg Sharaf",            "red": 236, "green": 72,  "blue": 153, "colorIndex": 1, "colorName": "Rose"},
    'M':      {"name": "Majlis",               "red": 52,  "green": 199, "blue": 89,  "colorIndex": 0, "colorName": "Green"},
    'MF':     {"name": "Mafsuhiyat",           "red": 180, "green": 83,  "blue": 9,   "colorIndex": 3, "colorName": "Bronze"},
    'MISBAH': {"name": "Misbah",               "red": 6,   "green": 182, "blue": 212, "colorIndex": 7, "colorName": "Cyan"},
    'MKB':    {"name": "Mokib",                "red": 30,  "green": 58,  "blue": 138, "colorIndex": 6, "colorName": "Navy"},
    'MO':     {"name": "Madrasa",              "red": 56,  "green": 189, "blue": 248, "colorIndex": 6, "colorName": "Light Blue"},
    'MQ':     {"name": "Misaq",                "red": 124, "green": 58,  "blue": 237, "colorIndex": 2, "colorName": "Violet"},
    'MUL':    {"name": "Mulaqaat",             "red": 234, "green": 88,  "blue": 12,  "colorIndex": 3, "colorName": "Orange-Red"},
    'MYN':    {"name": "Miyana",               "red": 217, "green": 70,  "blue": 239, "colorIndex": 2, "colorName": "Magenta"},
    'MZ':     {"name": "Majmui Ziyafat",       "red": 175, "green": 82,  "blue": 222, "colorIndex": 2, "colorName": "Purple"},
    'N':      {"name": "Nikah",                "red": 255, "green": 214, "blue": 10,  "colorIndex": 4, "colorName": "Bright Yellow"},
    'NAMAZ':  {"name": "Namaz",                "red": 234, "green": 179, "blue": 8,   "colorIndex": 4, "colorName": "Gold"},
    'ONLINE': {"name": "Online",               "red": 14,  "green": 165, "blue": 233, "colorIndex": 6, "colorName": "Sky Blue"},
    'Q':      {"name": "Qadam",                "red": 255, "green": 59,  "blue": 48,  "colorIndex": 1, "colorName": "Vivid Red"},
    'QMZ':    {"name": "Qadam Majlis Ziyafat", "red": 192, "green": 38,  "blue": 211, "colorIndex": 2, "colorName": "Fuchsia"},
    'SH':     {"name": "Sharaf",               "red": 251, "green": 146, "blue": 60,  "colorIndex": 3, "colorName": "Peach"},
    'SQ':     {"name": "Shifa Qadam",          "red": 185, "green": 28,  "blue": 28,  "colorIndex": 1, "colorName": "Dark Red"},
    'TJR':    {"name": "Tijarat",              "red": 101, "green": 163, "blue": 13,  "colorIndex": 0, "colorName": "Olive"},
    'TQ':     {"name": "Talaqqi",              "red": 13,  "green": 148, "blue": 136, "colorIndex": 7, "colorName": "Turquoise"},
    'TQN':    {"name": "Tahneeq",              "red": 125, "green": 211, "blue": 252, "colorIndex": 7, "colorName": "Ice Blue"},
    'WAAZ':   {"name": "Waaz",                 "red": 255, "green": 149, "blue": 0,   "colorIndex": 3, "colorName": "Warm Orange"},
    'WD':     {"name": "Wada",                 "red": 71,  "green": 85,  "blue": 105, "colorIndex": 5, "colorName": "Slate"},
    'Z':      {"name": "Ziyafat",              "red": 0,   "green": 122, "blue": 255, "colorIndex": 6, "colorName": "Royal Blue"},
    'ZO':     {"name": "Zafaf Olda",           "red": 244, "green": 114, "blue": 182, "colorIndex": 2, "colorName": "Orchid"}
}


def get_prefix_category(folder_or_file_name):
    if not folder_or_file_name:
        return 'OTHER'
    trimmed = str(folder_or_file_name).strip()
    if not trimmed:
        return 'OTHER'
    upper = trimmed.upper()

    # Match sequence item folder pattern e.g. "-02-01AQ-", "-07-04ZO-", "-18-01N-"
    m = re.search(r'-\d{1,3}[a-zA-Z]?-(\d{1,3})?([A-Za-z]+)(?:-\d+)?', trimmed)
    if m and m.group(2):
        code_cand = m.group(2).upper()
        if code_cand in EVENT_DEFINITIONS:
            return code_cand

    # Check explicit word aliases
    if 'NAMAZ' in upper: return 'NAMAZ'
    if 'NIKAAH' in upper or 'NIKAH' in upper: return 'N'
    if 'WAAZ' in upper: return 'WAAZ'
    if 'BETHAK MAJLIS' in upper or 'BM' in upper: return 'BM'
    if 'BETHAK QADAM' in upper or 'BQ' in upper: return 'BQ'
    if 'BETHAK ZIYAFAT' in upper or 'BZ' in upper: return 'BZ'
    if 'BETHAK' in upper or 'AQIQA' in upper: return 'AQ'
    if 'QMZ' in upper: return 'QMZ'
    if 'ZIYARAT' in upper or 'ZIARAT' in upper: return 'Z'
    if 'MAJLIS' in upper: return 'M'
    if 'QADAM' in upper: return 'Q'
    if 'IDAARA' in upper or 'IDARA' in upper: return 'ID'
    if 'FMB' in upper: return 'FMB'
    if 'HADDIYAT' in upper or 'HADIYAH' in upper: return 'H'
    if 'IFTE' in upper or 'IFTETTAH' in upper: return 'IF'
    if 'ISTEQBAL' in upper: return 'IST'
    if 'SHARAFF' in upper or 'SHARAF' in upper: return 'SH'
    if 'TIJARAT' in upper: return 'TJR'
    if 'TALAQQI' in upper: return 'TQ'
    if 'TAHNEEQ' in upper: return 'TQN'
    if 'WADA' in upper: return 'WD'

    # Match against official event codes ordered by length descending
    sorted_codes = sorted(EVENT_DEFINITIONS.keys(), key=len, reverse=True)
    for code in sorted_codes:
        regex = r'(?:^|[\s\-_0-9])(' + code + r')(?:[\s\-_0-9]|$)'
        if re.search(regex, upper, re.IGNORECASE):
            return code

    return 'OTHER'


def get_marker_color_for_folder(folder_name_or_category):
    DEFAULT_COLOR = {"red": 255, "green": 255, "blue": 255, "name": "White", "colorIndex": 5}
    if not folder_name_or_category:
        return DEFAULT_COLOR

    try:
        cat = get_prefix_category(folder_name_or_category)
        if cat in EVENT_DEFINITIONS:
            d = EVENT_DEFINITIONS[cat]
            return {
                "red": d["red"],
                "green": d["green"],
                "blue": d["blue"],
                "name": d["colorName"],
                "colorIndex": d["colorIndex"]
            }
        return DEFAULT_COLOR
    except Exception:
        return DEFAULT_COLOR


def parse_folder_marker_info(relative_folders):
    """
    Parses relative folder hierarchy (e.g. ['04-Mumbai-QMZ', '01-Z', 'Mulla Murtaza...'])
    Level 1: Event Folder (04-Mumbai-QMZ)
    Level 2: Camera Folder / Marker Name (01-Z)
    Level 3: Cameraman Folder / Marker Description (Mulla Murtaza...)
    """
    if not relative_folders:
        return {
            "eventFolderName": "",
            "descriptionFolderName": "",
            "markerName": "",
            "markerDescription": "",
            "eventCategory": "OTHER",
            "markerColor": get_marker_color_for_folder("OTHER")
        }

    clean_folders = [f for f in relative_folders if f and f.lower() not in OUTPUT_FOLDER_NAMES]

    if not clean_folders:
        return {
            "eventFolderName": "",
            "descriptionFolderName": "",
            "markerName": "",
            "markerDescription": "",
            "eventCategory": "OTHER",
            "markerColor": get_marker_color_for_folder("OTHER")
        }

    event_folder = clean_folders[0]
    camera_folder = clean_folders[1] if len(clean_folders) >= 2 else ""
    cameraman_folder = clean_folders[2] if len(clean_folders) >= 3 else ""

    marker_folder = camera_folder if camera_folder else event_folder
    marker_name = marker_folder
    marker_description = ""

    if cameraman_folder:
        marker_description = re.sub(r'^PC[\-_]?\d*[\s\-_]*', '', cameraman_folder, flags=re.IGNORECASE).strip()

    if camera_folder:
        combined_match = re.match(r'^(\d+[\s_\-]*[A-Za-z]+)[\s_\-]+(.+)$', camera_folder)
        if combined_match:
            marker_name = combined_match.group(1).strip()
            if not marker_description:
                marker_description = re.sub(r'^[\-_]', '', combined_match.group(2)).strip()

    event_category = get_prefix_category(marker_name)
    if event_category == 'OTHER':
        event_category = get_prefix_category(event_folder)

    marker_color = get_marker_color_for_folder(event_category if event_category != 'OTHER' else marker_name)

    return {
        "eventFolderName": event_folder,
        "descriptionFolderName": cameraman_folder or camera_folder,
        "markerName": marker_name,
        "markerDescription": marker_description,
        "eventCategory": event_category,
        "markerColor": marker_color
    }


def discover_subfolder_videos_with_folders(subfolder_path):
    """
    Discovers video files ordered folder-by-folder, returning dict items:
    [{"path": filepath, "folder": folder_name, "markerName": mName, "markerDescription": mDesc}]
    """
    video_entries = []
    if not os.path.exists(subfolder_path):
        return []

    def collect(current_dir):
        try:
            entries = sorted(os.listdir(current_dir), key=natural_sort_key)
            rel_p = os.path.relpath(current_dir, subfolder_path)
            rel_folders = [f for f in rel_p.split(os.sep) if f and f != '.']
            marker_info = parse_folder_marker_info(rel_folders)

            for entry in entries:
                clean_name = entry.strip()
                if clean_name.startswith('.') or clean_name.startswith('~$'):
                    continue
                full_p = os.path.join(current_dir, entry)
                try:
                    if os.path.isfile(full_p):
                        ext = os.path.splitext(clean_name)[1].lower().strip()
                        if ext in VIDEO_EXTS:
                            try:
                                f_size = os.path.getsize(full_p)
                            except Exception:
                                f_size = 1
                            if f_size > 0:
                                video_entries.append({
                                    "path": full_p,
                                    "folder": marker_info["eventFolderName"] or os.path.basename(subfolder_path),
                                    "markerName": marker_info["markerName"] or os.path.basename(subfolder_path),
                                    "markerDescription": marker_info["markerDescription"],
                                    "eventCategory": marker_info["eventCategory"]
                                })
                except Exception:
                    pass

            for entry in entries:
                clean_name = entry.strip()
                if clean_name.startswith('.') or clean_name.startswith('~$'):
                    continue
                full_p = os.path.join(current_dir, entry)
                try:
                    if os.path.isdir(full_p) and clean_name.lower() not in SYSTEM_IGNORE_FOLDERS:
                        collect(full_p)
                except Exception:
                    pass
        except Exception:
            pass

    collect(subfolder_path)

    seen = set()
    result = []
    for item in video_entries:
        norm_p = os.path.normpath(item["path"]).lower()
        if norm_p not in seen:
            seen.add(norm_p)
            result.append(item)
    return result


def discover_subfolder_videos(subfolder_path):
    """
    Discovers video files ordered folder-by-folder (Folder 1 first, Folder 2 second),
    and direct root videos if no subfolders exist.
    """
    return [v["path"] for v in discover_subfolder_videos_with_folders(subfolder_path)]


import urllib.parse


def path_to_path_url(file_path):
    abs_p = os.path.abspath(file_path).replace('\\', '/')
    parts = abs_p.split('/')
    encoded_parts = [
        p.upper() if i == 0 and len(p) == 2 and p[1] == ':' else urllib.parse.quote(p)
        for i, p in enumerate(parts)
    ]
    return f"file://localhost/{'/'.join(encoded_parts)}"


def infer_folder_marker_info_from_path(file_path):
    parts = file_path.replace('\\', '/').split('/')
    parts.pop()
    rel_folders = parts[1:]
    info = parse_folder_marker_info(rel_folders)
    return {
        "folder": info["eventFolderName"] or (parts[-1] if parts else ""),
        "markerName": info["markerName"] or (parts[-1] if parts else ""),
        "markerDescription": info["markerDescription"],
        "eventCategory": info["eventCategory"]
    }


def build_xmeml_xml(sequence_name, video_inputs):
    """
    Generates a standardized Premiere Pro FCPXML Interchange (xmeml version 4)
    sequence with sequence-level timeline markers for folder starts and prefix-assigned colors.
    """
    raw_entries = []
    raw_infos = []
    for item in video_inputs:
        entry_dict = item if isinstance(item, dict) else infer_folder_marker_info_from_path(item)
        if "path" not in entry_dict and isinstance(item, str):
            entry_dict["path"] = item
        info = get_video_info(entry_dict["path"])
        raw_entries.append(entry_dict)
        raw_infos.append(info)

    valid_infos = [info for info in raw_infos if info.get("isValid") and info.get("duration", 0) > 0]
    primary_info = valid_infos[0] if valid_infos else {"width": 1920, "height": 1080, "duration": 10.0, "fps": 30.0, "audioChannels": 2, "isValid": True}

    entries = []
    video_infos = []
    for idx, entry_dict in enumerate(raw_entries):
        info = raw_infos[idx]
        if not info or not info.get("isValid") or info.get("duration", 0) <= 0:
            info = {
                "width": info.get("width") if (info and info.get("width", 0) > 0) else primary_info["width"],
                "height": info.get("height") if (info and info.get("height", 0) > 0) else primary_info["height"],
                "duration": 10.0,
                "fps": primary_info["fps"],
                "audioChannels": info.get("audioChannels", 2) if info else 2,
                "isValid": True
            }
        entries.append(entry_dict)
        video_infos.append(info)

    seq_width = primary_info["width"]
    seq_height = primary_info["height"]

    def parse_tb_ntsc(raw_fps):
        if abs(raw_fps - 23.976) < 0.1 or abs(raw_fps - 23.98) < 0.1:
            return 24, 'TRUE'
        elif abs(raw_fps - 24) < 0.1:
            return 24, 'FALSE'
        elif abs(raw_fps - 25) < 0.1:
            return 25, 'FALSE'
        elif abs(raw_fps - 29.97) < 0.1:
            return 30, 'TRUE'
        elif abs(raw_fps - 30) < 0.1:
            return 30, 'FALSE'
        elif abs(raw_fps - 50) < 0.1:
            return 50, 'FALSE'
        elif abs(raw_fps - 59.94) < 0.1:
            return 60, 'TRUE'
        elif abs(raw_fps - 60) < 0.1:
            return 60, 'FALSE'
        else:
            return max(int(round(raw_fps)), 1), 'FALSE'

    seq_tb, seq_ntsc = parse_tb_ntsc(primary_info["fps"])

    xmeml = ET.Element('xmeml', version='4')
    sequence = ET.SubElement(xmeml, 'sequence', id='sequence-1')
    ET.SubElement(sequence, 'name').text = sequence_name
    ET.SubElement(sequence, 'duration').text = '0'

    rate = ET.SubElement(sequence, 'rate')
    ET.SubElement(rate, 'timebase').text = str(seq_tb)
    ET.SubElement(rate, 'ntsc').text = seq_ntsc

    tc = ET.SubElement(sequence, 'timecode')
    tc_rate = ET.SubElement(tc, 'rate')
    ET.SubElement(tc_rate, 'timebase').text = str(seq_tb)
    ET.SubElement(tc_rate, 'ntsc').text = seq_ntsc
    ET.SubElement(tc, 'string').text = '00:00:00:00'
    ET.SubElement(tc, 'frame').text = '0'
    ET.SubElement(tc, 'displayformat').text = 'NDF'

    media = ET.SubElement(sequence, 'media')
    video = ET.SubElement(media, 'video')

    fmt = ET.SubElement(video, 'format')
    sc = ET.SubElement(fmt, 'samplecharacteristics')
    ET.SubElement(sc, 'width').text = str(seq_width)
    ET.SubElement(sc, 'height').text = str(seq_height)
    ET.SubElement(sc, 'pixelaspectratio').text = 'square'

    v_tracks = [ET.SubElement(video, 'track') for _ in range(7)]
    v_track = v_tracks[0]

    audio = ET.SubElement(media, 'audio')
    ET.SubElement(audio, 'numOutputChannels').text = '2'
    afmt = ET.SubElement(audio, 'format')
    asc = ET.SubElement(afmt, 'samplecharacteristics')
    ET.SubElement(asc, 'depth').text = '16'
    ET.SubElement(asc, 'samplerate').text = '48000'

    a_tracks = [ET.SubElement(audio, 'track') for _ in range(7)]
    a_track = a_tracks[0]

    current_frame = 0
    current_marker_key = ''
    audio_clip_count = 0

    for idx, entry in enumerate(entries):
        vid_path = entry["path"]
        folder_name = entry.get("folder", "")
        marker_name = entry.get("markerName") or (re.sub(r'^\d+[\s\-_]*', '', folder_name).strip() if folder_name else "") or folder_name
        marker_desc = entry.get("markerDescription") or ""
        marker_key = f"{marker_name}||{marker_desc}"
        info = video_infos[idx]
        tb, ntsc_str = parse_tb_ntsc(info['fps'])
        source_clip_frames = max(1, int(round(info['duration'] * tb)))
        seq_clip_frames = max(1, int(round(info['duration'] * seq_tb)))
        clip_name = os.path.basename(vid_path)
        file_id = f"file-{idx + 1}"
        master_id = f"masterclip-{idx + 1}"
        v_clip_id = f"vclip-{idx + 1}"
        a_clip_id = f"aclip-{idx + 1}"

        start_frame = current_frame
        end_frame = current_frame + seq_clip_frames

        # Sequence timeline marker for every new folder/group start
        if marker_name and marker_key != current_marker_key:
            current_marker_key = marker_key
            cat = entry.get("eventCategory") or get_prefix_category(folder_name)
            color = get_marker_color_for_folder(cat if cat != 'OTHER' else folder_name)
            marker = ET.Element('marker')
            ET.SubElement(marker, 'name').text = marker_name
            ET.SubElement(marker, 'comment').text = marker_desc
            ET.SubElement(marker, 'in').text = str(start_frame)
            ET.SubElement(marker, 'out').text = str(start_frame)
            c_idx = color.get("colorIndex", 5) if isinstance(color, dict) else 5
            std_colors = ['Green', 'Red', 'Purple', 'Orange', 'Yellow', 'White', 'Blue', 'Cyan']
            c_name = std_colors[c_idx] if (0 <= c_idx < len(std_colors)) else 'White'
            ET.SubElement(marker, 'color').text = c_name

            media_idx = list(sequence).index(media)
            sequence.insert(media_idx, marker)

        def add_file_elem(parent):
            f_elem = ET.SubElement(parent, 'file', id=file_id)
            ET.SubElement(f_elem, 'name').text = clip_name
            ET.SubElement(f_elem, 'pathurl').text = path_to_path_url(vid_path)
            vf_rate = ET.SubElement(f_elem, 'rate')
            ET.SubElement(vf_rate, 'timebase').text = str(tb)
            ET.SubElement(vf_rate, 'ntsc').text = ntsc_str
            ET.SubElement(f_elem, 'duration').text = str(source_clip_frames)

            f_tc = ET.SubElement(f_elem, 'timecode')
            f_tc_rate = ET.SubElement(f_tc, 'rate')
            ET.SubElement(f_tc_rate, 'timebase').text = str(tb)
            ET.SubElement(f_tc_rate, 'ntsc').text = ntsc_str
            ET.SubElement(f_tc, 'string').text = '00:00:00:00'
            ET.SubElement(f_tc, 'frame').text = '0'
            ET.SubElement(f_tc, 'displayformat').text = 'NDF'

            f_media = ET.SubElement(f_elem, 'media')
            f_video = ET.SubElement(f_media, 'video')
            f_sc = ET.SubElement(f_video, 'samplecharacteristics')
            ET.SubElement(f_sc, 'width').text = str(info['width'])
            ET.SubElement(f_sc, 'height').text = str(info['height'])
            ET.SubElement(f_sc, 'pixelaspectratio').text = 'square'

            f_audio = ET.SubElement(f_media, 'audio')
            ET.SubElement(f_audio, 'channelcount').text = str(info.get('audioChannels', 2))
            f_asc = ET.SubElement(f_audio, 'samplecharacteristics')
            ET.SubElement(f_asc, 'depth').text = '16'
            ET.SubElement(f_asc, 'samplerate').text = '48000'

        has_audio = info.get('audioChannels', 0) > 0
        if has_audio:
            audio_clip_count += 1

        def add_links(parent):
            if not has_audio:
                return
            l1 = ET.SubElement(parent, 'link')
            ET.SubElement(l1, 'linkclipref').text = v_clip_id
            ET.SubElement(l1, 'mediatype').text = 'video'
            ET.SubElement(l1, 'trackindex').text = '1'
            ET.SubElement(l1, 'clipindex').text = str(idx + 1)

            l2 = ET.SubElement(parent, 'link')
            ET.SubElement(l2, 'linkclipref').text = a_clip_id
            ET.SubElement(l2, 'mediatype').text = 'audio'
            ET.SubElement(l2, 'trackindex').text = '1'
            ET.SubElement(l2, 'clipindex').text = str(audio_clip_count)

        # Video Clip Item (full file element)
        v_clip = ET.SubElement(v_track, 'clipitem', id=v_clip_id)
        ET.SubElement(v_clip, 'masterclipid').text = master_id
        ET.SubElement(v_clip, 'name').text = clip_name
        ET.SubElement(v_clip, 'enabled').text = 'TRUE'
        ET.SubElement(v_clip, 'duration').text = str(source_clip_frames)
        v_rate = ET.SubElement(v_clip, 'rate')
        ET.SubElement(v_rate, 'timebase').text = str(seq_tb)
        ET.SubElement(v_rate, 'ntsc').text = seq_ntsc
        ET.SubElement(v_clip, 'start').text = str(start_frame)
        ET.SubElement(v_clip, 'end').text = str(end_frame)
        ET.SubElement(v_clip, 'in').text = '0'
        ET.SubElement(v_clip, 'out').text = str(source_clip_frames)

        add_file_elem(v_clip)

        v_st = ET.SubElement(v_clip, 'sourcetrack')
        ET.SubElement(v_st, 'mediatype').text = 'video'
        ET.SubElement(v_st, 'trackindex').text = '1'

        add_links(v_clip)

        # Audio Clip Item (only if video file contains audio streams)
        if has_audio:
            a_clip = ET.SubElement(a_track, 'clipitem', id=a_clip_id)
            ET.SubElement(a_clip, 'masterclipid').text = master_id
            ET.SubElement(a_clip, 'name').text = clip_name
            ET.SubElement(a_clip, 'enabled').text = 'TRUE'
            ET.SubElement(a_clip, 'duration').text = str(source_clip_frames)
            a_rate = ET.SubElement(a_clip, 'rate')
            ET.SubElement(a_rate, 'timebase').text = str(seq_tb)
            ET.SubElement(a_rate, 'ntsc').text = seq_ntsc
            ET.SubElement(a_clip, 'start').text = str(start_frame)
            ET.SubElement(a_clip, 'end').text = str(end_frame)
            ET.SubElement(a_clip, 'in').text = '0'
            ET.SubElement(a_clip, 'out').text = str(source_clip_frames)

            ET.SubElement(a_clip, 'file', id=file_id)

            a_st = ET.SubElement(a_clip, 'sourcetrack')
            ET.SubElement(a_st, 'mediatype').text = 'audio'
            ET.SubElement(a_st, 'trackindex').text = '1'

            add_links(a_clip)

        current_frame = end_frame

    sequence.find('duration').text = str(current_frame)
    return ET.tostring(xmeml, encoding='utf-8', xml_declaration=True)


def find_template(template_path=None, titles_folder=None):
    if template_path and os.path.exists(template_path):
        return template_path
    if titles_folder and os.path.exists(titles_folder):
        for candidate in ["Template.prproj", "template.prproj", "Premiere_Template.prproj"]:
            p = os.path.join(titles_folder, candidate)
            if os.path.exists(p):
                return p
        for f in os.listdir(titles_folder):
            if f.lower().endswith(".prproj"):
                return os.path.join(titles_folder, f)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    resources_template = os.path.abspath(
        os.path.join(script_dir, "..", "..", "..", "resources", "templates", "template.prproj")
    )
    if os.path.exists(resources_template):
        return resources_template
    return None


def create_premiere_projects(target_folder, template_path=None, titles_folder=None, recursive=False):
    if not os.path.exists(target_folder):
        return {"success": False, "error": f"Target folder does not exist: {target_folder}", "created": [], "skipped": []}

    template_file = find_template(template_path, titles_folder)
    created = []
    skipped = []

    subfolders = []
    # If target_folder itself contains videos or cameraman folders, check if single folder mode applies
    root_vids = discover_subfolder_videos_with_folders(target_folder)
    
    if recursive:
        for root, dirs, _ in os.walk(target_folder):
            for d in dirs:
                if d.lower() not in OUTPUT_FOLDER_NAMES:
                    subfolders.append(os.path.join(root, d))
    else:
        for entry in os.listdir(target_folder):
            full_p = os.path.join(target_folder, entry)
            if os.path.isdir(full_p) and entry.lower() not in OUTPUT_FOLDER_NAMES:
                # Check if this subfolder has sub-subfolders with videos
                subfolders.append(full_p)

    direct_root_videos = [v for v in root_vids if os.path.dirname(v["path"]) == os.path.abspath(target_folder)]
    if direct_root_videos and target_folder not in subfolders:
        subfolders.insert(0, target_folder)
    elif not subfolders and root_vids:
        subfolders = [target_folder]

    for sub in subfolders:
        folder_name = os.path.basename(sub)
        prproj_name = f"{folder_name}.prproj"
        prproj_path = os.path.join(sub, prproj_name)
        xml_name = f"{folder_name}.xml"
        xml_path = os.path.join(sub, xml_name)

        videos = discover_subfolder_videos_with_folders(sub)
        xml_bytes = build_xmeml_xml(folder_name, videos)

        try:
            # 1. Write Premiere Interchange XML (.xml)
            with open(xml_path, 'wb') as f:
                f.write(xml_bytes)
            try:
                import tempfile
                trk_p = os.path.join(tempfile.gettempdir(), '.onetap_recent_xml.txt')
                trk_p2 = os.path.join(tempfile.gettempdir(), 'recent_xml.txt')
                entry = f"{folder_name}={xml_path}"
                existing = ""
                if os.path.exists(trk_p):
                    try:
                        with open(trk_p, 'r', encoding='utf-8') as ef:
                            existing = ef.read()
                    except Exception:
                        pass
                lines = [l.strip() for l in existing.splitlines() if l.strip() and not l.startswith(entry) and l.strip() != xml_path]
                new_content = "\n".join([xml_path, entry] + lines[:50])
                with open(trk_p, 'w', encoding='utf-8') as tf:
                    tf.write(new_content)
                with open(trk_p2, 'w', encoding='utf-8') as tf2:
                    tf2.write(new_content)
            except Exception:
                pass

            # 2. Write valid Premiere Pro Project (.prproj) gzip stream
            prproj_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<PremiereData Version="3">
	<Project ObjectRef="1"/>
	<Project id="1" ClassID="9fd8536f-e3c3-4d76-8809-e855734e5a9c" Version="38">
		<Node Version="1">
			<Properties Version="1">
				<ProjectName>{folder_name}</ProjectName>
				<ProjectID>00000000-0000-0000-0000-000000000001</ProjectID>
			</Properties>
		</Node>
		<RootProjectItem ObjectRef="2"/>
	</Project>
	<RootProjectGroup id="2" ClassID="0132ec5b-e407-4e00-9a0d-3e6f98efeb6d" Version="1">
		<Node Version="1">
			<Properties Version="1">
				<Name>Root</Name>
			</Properties>
		</Node>
		<Items Version="1">
			<Item Index="0" ObjectRef="3"/>
		</Items>
	</RootProjectGroup>
	<Sequence id="3" ClassID="18d84411-9a74-4b53-b39f-16a75f10b50e" Version="7">
		<Node Version="1">
			<Properties Version="1">
				<Name>{folder_name} Sequence</Name>
			</Properties>
		</Node>
		<Media ObjectRef="4"/>
	</Sequence>
	<Media id="4" ClassID="587dfa4e-d007-4ef8-a400-bdfeb00d8bc3" Version="27">
		<VideoTrackGroup ObjectRef="5"/>
		<AudioTrackGroup ObjectRef="6"/>
	</Media>
	<VideoTrackGroup id="5" ClassID="0ba20fe6-5ef1-4043-9828-ea0808bfa0d2" Version="4">
		<Tracks Version="1">
			<Track Index="0" ObjectRef="7"/>
		</Tracks>
	</VideoTrackGroup>
	<VideoTrack id="7" ClassID="a437ae5d-ad4c-41b2-bf89-53fcb749d05e" Version="4">
		<ClipItems Version="1"/>
	</VideoTrack>
	<AudioTrackGroup id="6" ClassID="47e7d9eb-fffa-42f5-93ae-c98f0e53a290" Version="4">
		<Tracks Version="1">
			<Track Index="0" ObjectRef="8"/>
		</Tracks>
	</AudioTrackGroup>
	<AudioTrack id="8" ClassID="1eb6ff82-bf72-4632-a50d-c014798695d6" Version="4">
		<ClipItems Version="1"/>
	</AudioTrack>
</PremiereData>"""

            if template_file and os.path.exists(template_file):
                try:
                    with open(template_file, 'rb') as tf:
                        t_bytes = tf.read()
                    if t_bytes.startswith(b'\x1f\x8b'):
                        t_str = gzip.decompress(t_bytes).decode('utf-8', errors='ignore')
                    else:
                        t_str = t_bytes.decode('utf-8', errors='ignore')
                    if '<PremiereData' in t_str or '<ProjectName>' in t_str:
                        if '<ProjectName>' in t_str:
                            import re
                            t_str = re.sub(r'<ProjectName>.*?</ProjectName>', f'<ProjectName>{folder_name}</ProjectName>', t_str)
                        prproj_xml = t_str
                except Exception:
                    pass

            with gzip.open(prproj_path, 'wb') as f:
                f.write(prproj_xml.encode('utf-8'))

            created.append(prproj_path)
            print(f"[OK] Created Premiere project ({len(videos)} clips placed on V1/A1): {prproj_path}")
        except Exception as e:
            if template_file and os.path.exists(template_file):
                try:
                    shutil.copyfile(template_file, prproj_path)
                    created.append(prproj_path)
                except Exception:
                    pass
            print(f"[ERROR] Failed to generate project for {prproj_path}: {e}")

    return {
        "success": True,
        "templateUsed": template_file or "Sequence XML Generator",
        "targetFolder": target_folder,
        "createdCount": len(created),
        "skippedCount": len(skipped),
        "created": created,
        "skipped": skipped
    }


def main():
    parser = argparse.ArgumentParser(description="Create Adobe Premiere Pro (.prproj) project files in subfolders.")
    parser.add_argument("--folder", "-f", required=True, help="Target parent directory containing subfolders.")
    parser.add_argument("--template", "-t", help="Path to custom .prproj template file.")
    parser.add_argument("--titles-folder", help="Path to Final Titles folder to search for template.")
    parser.add_argument("--recursive", "-r", action="store_true", help="Process nested subfolders recursively.")
    parser.add_argument("--json", action="store_true", help="Output result as JSON.")

    args = parser.parse_args()

    result = create_premiere_projects(
        target_folder=args.folder,
        template_path=args.template,
        titles_folder=args.titles_folder,
        recursive=args.recursive
    )

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"\n--- Summary ---")
        print(f"Created: {result['createdCount']} .prproj file(s)")
        print(f"Skipped: {result['skippedCount']} (already existed)")

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
