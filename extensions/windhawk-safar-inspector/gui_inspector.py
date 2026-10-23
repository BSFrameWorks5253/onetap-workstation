"""
Safar & Media Stats Inspector - Premium Modern Windows GUI
Professional Workstation Edition for UniDesk / BS.Framework
"""

import os
import sys
import re
import json
import tkinter as tk
from tkinter import filedialog, messagebox
from pathlib import Path
import customtkinter as ctk

# Ensure UTF-8 on Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# 34 Official Events from Event List.xlsx with exact hex colors
OFFICIAL_EVENTS = {
    'AQ':     {'name': 'Aqiqa',                'color': '#00D2FF', 'text_dark': True},
    'BM':     {'name': 'Bethak Majlis',        'color': '#14B8A6', 'text_dark': False},
    'BQ':     {'name': 'Bethak Qadam',         'color': '#F43F5E', 'text_dark': False},
    'BZ':     {'name': 'Bethak Ziyafat',       'color': '#A855F7', 'text_dark': False},
    'FMB':    {'name': 'FMB',                  'color': '#22C55E', 'text_dark': False},
    'H':      {'name': 'Haddiyat',             'color': '#F59E0B', 'text_dark': True},
    'ID':     {'name': 'Idaraat',              'color': '#2563EB', 'text_dark': False},
    'IF':     {'name': 'Iftettah',             'color': '#84CC16', 'text_dark': True},
    'IFS':    {'name': 'Iftettah Sharaf',      'color': '#10B981', 'text_dark': False},
    'IST':    {'name': 'Isteqbal',             'color': '#6366F1', 'text_dark': False},
    'KGS':    {'name': 'Kg Sharaf',            'color': '#EC4899', 'text_dark': False},
    'M':      {'name': 'Majlis',               'color': '#34C759', 'text_dark': False},
    'MF':     {'name': 'Mafsuhiyat',           'color': '#B45309', 'text_dark': False},
    'MISBAH': {'name': 'Misbah',               'color': '#06B6D4', 'text_dark': True},
    'MKB':    {'name': 'Mokib',                'color': '#1E3A8A', 'text_dark': False},
    'MO':     {'name': 'Madrasa',              'color': '#38BDF8', 'text_dark': True},
    'MQ':     {'name': 'Misaq',                'color': '#7C3AED', 'text_dark': False},
    'MUL':    {'name': 'Mulaqaat',             'color': '#EA580C', 'text_dark': False},
    'MYN':    {'name': 'Miyana',               'color': '#D946EF', 'text_dark': False},
    'MZ':     {'name': 'Majmui Ziyafat',       'color': '#AF52DE', 'text_dark': False},
    'N':      {'name': 'Nikah',                'color': '#FFD60A', 'text_dark': True},
    'NAMAZ':  {'name': 'Namaz',                'color': '#EAB308', 'text_dark': True},
    'ONLINE': {'name': 'Online',               'color': '#0EA5E9', 'text_dark': False},
    'Q':      {'name': 'Qadam',                'color': '#FF3B30', 'text_dark': False},
    'QMZ':    {'name': 'Qadam Majlis Ziyafat', 'color': '#C026D3', 'text_dark': False},
    'SH':     {'name': 'Sharaf',               'color': '#FB923C', 'text_dark': True},
    'SQ':     {'name': 'Shifa Qadam',          'color': '#B91C1C', 'text_dark': False},
    'TJR':    {'name': 'Tijarat',              'color': '#65A30D', 'text_dark': False},
    'TQ':     {'name': 'Talaqqi',              'color': '#0D9488', 'text_dark': False},
    'TQN':    {'name': 'Tahneeq',              'color': '#7DD3FC', 'text_dark': True},
    'WAAZ':   {'name': 'Waaz',                 'color': '#FF9500', 'text_dark': False},
    'WD':     {'name': 'Wada',                 'color': '#475569', 'text_dark': False},
    'Z':      {'name': 'Ziyafat',              'color': '#007AFF', 'text_dark': False},
    'ZO':     {'name': 'Zafaf Olda',           'color': '#F472B6', 'text_dark': True},
    'OTHER':  {'name': 'Other Event',          'color': '#64748B', 'text_dark': False}
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
    pattern = re.compile(r"^(\d{4}-\d{2}-\d{2})\s*_(\d{2}[MEme])[-_](?:(\d{1,3})[-_](.*)|(\d{1,3}[A-Za-z]+.*))$")
    m = pattern.match(name)
    if not m:
        return None

    date_str, session, item_idx_sep, rem_sep, merged_occ = m.groups()
    if merged_occ:
        num_m = re.match(r"^(\d+)(.*)$", merged_occ)
        item_idx = num_m.group(1) if num_m else "01"
        remainder = (num_m.group(2) if num_m else merged_occ).upper()
    else:
        item_idx = item_idx_sep
        remainder = (rem_sep or '').upper()

    event_code = None
    occ_m = re.search(r'(\d{1,2})([A-Z]+)', remainder)
    if occ_m and occ_m.group(2) in OFFICIAL_EVENTS:
        event_code = occ_m.group(2)
    else:
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

    code = event_code or 'OTHER'
    ev_info = OFFICIAL_EVENTS.get(code, OFFICIAL_EVENTS['OTHER'])

    return {
        'date': date_str,
        'session': session.upper(),
        'session_type': 'Morning' if 'M' in session.upper() else 'Evening',
        'item_index': item_idx,
        'event_code': code,
        'event_name': ev_info['name'],
        'color': ev_info['color'],
        'text_dark': ev_info['text_dark'],
        'its_id': its_id
    }


class ModernSafarInspectorGUI(ctk.CTk):
    def __init__(self, initial_path=None):
        super().__init__()

        self.title("🏕️ Safar & Media Stats Inspector — Workstation Edition")
        self.geometry("1080x760")
        self.minsize(940, 680)

        # Appearance & Modern Theme
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.current_folder = initial_path or r"D:\ON_GOING PROJECT\One Tap_V20.6.5\Docs\safars\1448-10-Istefada ilmiyah"
        self.show_full_names = False
        self.analysis_data = None

        self._build_ui()
        if self.current_folder and os.path.exists(self.current_folder):
            self.analyze_folder(self.current_folder)

    def _build_ui(self):
        # ── TOP BAR / HEADER ──
        self.header_frame = ctk.CTkFrame(self, corner_radius=12, fg_color="#111318", border_width=1, border_color="#262B36")
        self.header_frame.pack(fill="x", padx=16, pady=(16, 10))

        # Title and Path row
        title_box = ctk.CTkFrame(self.header_frame, fg_color="transparent")
        title_box.pack(fill="x", padx=16, pady=12)

        title_lbl = ctk.CTkLabel(
            title_box,
            text="🏕️ Safar Media & Timeline Inspector",
            font=ctk.CTkFont(size=20, weight="bold"),
            text_color="#F8FAFC"
        )
        title_lbl.pack(side="left")

        # Action Buttons on Header
        btn_box = ctk.CTkFrame(title_box, fg_color="transparent")
        btn_box.pack(side="right")

        self.browse_btn = ctk.CTkButton(
            btn_box,
            text="📂 Browse Folder...",
            command=self._on_browse,
            width=130,
            height=34,
            corner_radius=8,
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.browse_btn.pack(side="left", padx=6)

        self.copy_btn = ctk.CTkButton(
            btn_box,
            text="📋 Copy Summary",
            command=self._copy_summary,
            width=130,
            height=34,
            corner_radius=8,
            fg_color="#334155",
            hover_color="#475569",
            font=ctk.CTkFont(size=12, weight="bold")
        )
        self.copy_btn.pack(side="left", padx=6)

        # Path Display Bar
        path_box = ctk.CTkFrame(self.header_frame, fg_color="#181B23", corner_radius=8)
        path_box.pack(fill="x", padx=16, pady=(0, 12))

        path_icon = ctk.CTkLabel(path_box, text="📍", font=ctk.CTkFont(size=14))
        path_icon.pack(side="left", padx=(10, 4))

        self.path_lbl = ctk.CTkLabel(
            path_box,
            text=self.current_folder or "No folder selected",
            font=ctk.CTkFont(family="Consolas", size=12),
            text_color="#94A3B8"
        )
        self.path_lbl.pack(side="left", fill="x", expand=True, padx=4, pady=6)

        # ── KPI METRICS CARDS ROW ──
        self.kpi_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.kpi_frame.pack(fill="x", padx=16, pady=4)
        self.kpi_frame.columnconfigure((0, 1, 2, 3), weight=1, uniform="kpi")

        self.card_days = self._create_kpi_card(self.kpi_frame, 0, "📅 Total Days in Safar", "—", "#8B5CF6")
        self.card_events = self._create_kpi_card(self.kpi_frame, 1, "🎯 Total Events Recorded", "—", "#10B981")
        self.card_timeline = self._create_kpi_card(self.kpi_frame, 2, "🎬 Premiere Pro Timeline", "—", "#F59E0B")
        self.card_media = self._create_kpi_card(self.kpi_frame, 3, "📦 Video Clips & Size", "—", "#06B6D4")

        # ── INTERACTIVE TIMELINE STRIP CANVAS ──
        self.timeline_box = ctk.CTkFrame(self, corner_radius=12, fg_color="#111318", border_width=1, border_color="#262B36")
        self.timeline_box.pack(fill="x", padx=16, pady=8)

        t_header = ctk.CTkFrame(self.timeline_box, fg_color="transparent")
        t_header.pack(fill="x", padx=14, pady=(8, 4))

        t_lbl = ctk.CTkLabel(
            t_header,
            text="🎬 Visual Premiere Pro Timeline Simulation (Color-Coded)",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color="#E2E8F0"
        )
        t_lbl.pack(side="left")

        self.timeline_sub_lbl = ctk.CTkLabel(
            t_header,
            text="Sequence distribution proportional to events",
            font=ctk.CTkFont(size=11),
            text_color="#64748B"
        )
        self.timeline_sub_lbl.pack(side="right")

        self.timeline_canvas = tk.Canvas(self.timeline_box, height=36, bg="#161922", highlightthickness=0)
        self.timeline_canvas.pack(fill="x", padx=14, pady=(0, 10))

        # ── MAIN CONTENT AREA (Split: Events Breakdown & Day/Session List) ──
        self.content_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.content_frame.pack(fill="both", expand=True, padx=16, pady=(4, 16))
        self.content_frame.columnconfigure(0, weight=6)
        self.content_frame.columnconfigure(1, weight=5)
        self.content_frame.rowconfigure(0, weight=1)

        # LEFT PANE: Event Segregation Badges & Counts
        self.events_pane = ctk.CTkFrame(self.content_frame, corner_radius=12, fg_color="#111318", border_width=1, border_color="#262B36")
        self.events_pane.grid(row=0, column=0, sticky="nsew", padx=(0, 8))

        events_head = ctk.CTkFrame(self.events_pane, fg_color="transparent")
        events_head.pack(fill="x", padx=14, pady=10)

        ev_title = ctk.CTkLabel(
            events_head,
            text="📊 Official Event Segregation (Zero Counts Hidden)",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#F8FAFC"
        )
        ev_title.pack(side="left")

        self.toggle_names_btn = ctk.CTkButton(
            events_head,
            text="🔤 Abbreviations",
            command=self._toggle_name_mode,
            width=130,
            height=28,
            corner_radius=6,
            fg_color="#1E293B",
            hover_color="#334155",
            font=ctk.CTkFont(size=11, weight="bold")
        )
        self.toggle_names_btn.pack(side="right")

        self.events_scroll = ctk.CTkScrollableFrame(self.events_pane, fg_color="transparent")
        self.events_scroll.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        # RIGHT PANE: Daily Sessions / Folder Hierarchy
        self.days_pane = ctk.CTkFrame(self.content_frame, corner_radius=12, fg_color="#111318", border_width=1, border_color="#262B36")
        self.days_pane.grid(row=0, column=1, sticky="nsew", padx=(8, 0))

        days_head = ctk.CTkFrame(self.days_pane, fg_color="transparent")
        days_head.pack(fill="x", padx=14, pady=10)

        d_title = ctk.CTkLabel(
            days_head,
            text="📅 Daily Sessions & Timeline Durations",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color="#F8FAFC"
        )
        d_title.pack(side="left")

        self.days_scroll = ctk.CTkScrollableFrame(self.days_pane, fg_color="transparent")
        self.days_scroll.pack(fill="both", expand=True, padx=10, pady=(0, 10))

    def _create_kpi_card(self, parent, col, title, initial_val, accent_color):
        card = ctk.CTkFrame(parent, corner_radius=10, fg_color="#111318", border_width=1, border_color="#262B36")
        card.grid(row=0, column=col, padx=5, sticky="ew")

        # Top Accent Line
        accent = ctk.CTkFrame(card, height=3, corner_radius=2, fg_color=accent_color)
        accent.pack(fill="x", padx=12, pady=(8, 4))

        lbl_title = ctk.CTkLabel(card, text=title, font=ctk.CTkFont(size=11), text_color="#94A3B8")
        lbl_title.pack(anchor="w", padx=12)

        lbl_val = ctk.CTkLabel(card, text=initial_val, font=ctk.CTkFont(size=18, weight="bold"), text_color="#F8FAFC")
        lbl_val.pack(anchor="w", padx=12, pady=(2, 8))
        return lbl_val

    def _on_browse(self):
        folder = filedialog.askdirectory(title="Select Safar Folder to Inspect")
        if folder:
            self.analyze_folder(folder)

    def _toggle_name_mode(self):
        self.show_full_names = not self.show_full_names
        self.toggle_names_btn.configure(
            text="📖 Official Names" if self.show_full_names else "🔤 Abbreviations"
        )
        if self.analysis_data:
            self._render_events_list()

    def analyze_folder(self, folder_path):
        self.current_folder = folder_path
        self.path_lbl.configure(text=folder_path)

        p = Path(folder_path)
        if not p.exists() or not p.is_dir():
            messagebox.showerror("Error", f"Folder does not exist:\n{folder_path}")
            return

        # Find Date Session Subfolders (e.g. 1448-03-13 _01M)
        subdirs = [d for d in p.iterdir() if d.is_dir()]
        date_sessions = [d for d in subdirs if re.match(r'^\d{4}-\d{2}-\d{2}\s*_\d{2}[MEme]', d.name)]

        event_counts = {}
        total_videos = 0
        total_size = 0
        total_duration = 0.0
        session_details = []

        if date_sessions:
            # Level 1: Root Safar
            total_days = len(date_sessions)
            for ds in sorted(date_sessions, key=lambda x: x.name):
                ds_items = [it for it in ds.iterdir() if it.is_dir()]
                ds_events = {}
                ds_vids = 0
                ds_dur = 0.0

                for it in ds_items:
                    parsed = parse_item_folder(it.name)
                    if parsed:
                        c = parsed['event_code']
                        event_counts[c] = event_counts.get(c, 0) + 1
                        ds_events[c] = ds_events.get(c, 0) + 1

                    for root, _, files in os.walk(it):
                        for f in files:
                            if Path(f).suffix.lower() in VIDEO_EXTS:
                                total_videos += 1
                                ds_vids += 1
                                sz = os.path.getsize(os.path.join(root, f))
                                total_size += sz
                                # Estimate ~45s per typical clip if fast scan
                                ds_dur += 45.0
                                total_duration += 45.0

                session_details.append({
                    'name': ds.name,
                    'items_count': len(ds_items),
                    'videos_count': ds_vids,
                    'duration_sec': ds_dur,
                    'events': ds_events
                })
        else:
            # Level 2 or 3
            total_days = 1
            items = [it for it in p.iterdir() if it.is_dir()]
            ds_events = {}
            for it in items:
                parsed = parse_item_folder(it.name)
                if parsed:
                    c = parsed['event_code']
                    event_counts[c] = event_counts.get(c, 0) + 1
                    ds_events[c] = ds_events.get(c, 0) + 1

                for root, _, files in os.walk(it):
                    for f in files:
                        if Path(f).suffix.lower() in VIDEO_EXTS:
                            total_videos += 1
                            total_size += os.path.getsize(os.path.join(root, f))
                            total_duration += 45.0

            session_details.append({
                'name': p.name,
                'items_count': len(items),
                'videos_count': total_videos,
                'duration_sec': total_duration,
                'events': ds_events
            })

        self.analysis_data = {
            'folder_name': p.name,
            'folder_path': folder_path,
            'total_days': total_days,
            'total_events': sum(event_counts.values()),
            'total_videos': total_videos,
            'total_size_gb': total_size / (1024 * 1024 * 1024),
            'total_duration_sec': total_duration,
            'event_counts': event_counts,
            'session_details': session_details
        }

        # Update KPI Cards
        self.card_days.configure(text=f"{total_days} Day{'s' if total_days != 1 else ''}")
        self.card_events.configure(text=f"{self.analysis_data['total_events']} Events")
        self.card_timeline.configure(text=format_duration(total_duration))
        self.card_media.configure(text=f"{total_videos} clips · {self.analysis_data['total_size_gb']:.1f} GB")

        self._render_timeline_canvas()
        self._render_events_list()
        self._render_days_list()

    def _render_timeline_canvas(self):
        self.timeline_canvas.delete("all")
        if not self.analysis_data or not self.analysis_data['event_counts']:
            return

        w = self.timeline_canvas.winfo_width()
        if w <= 1:
            w = 1000
        h = 36

        total_evs = max(self.analysis_data['total_events'], 1)
        x_curr = 0

        # Draw proportional blocks for each event
        for code, count in sorted(self.analysis_data['event_counts'].items(), key=lambda x: x[1], reverse=True):
            if count <= 0:
                continue
            ev_meta = OFFICIAL_EVENTS.get(code, OFFICIAL_EVENTS['OTHER'])
            color = ev_meta['color']
            block_w = (count / total_evs) * w

            self.timeline_canvas.create_rectangle(
                x_curr, 2, x_curr + block_w, h - 2,
                fill=color, outline="#111318", width=1
            )
            # Text label if width permits
            if block_w > 26:
                txt_col = "#000000" if ev_meta['text_dark'] else "#FFFFFF"
                self.timeline_canvas.create_text(
                    x_curr + block_w / 2, h / 2,
                    text=f"{code} ({count})",
                    fill=txt_col,
                    font=("Helvetica", 9, "bold")
                )

            x_curr += block_w

    def _render_events_list(self):
        # Clear previous widgets
        for w in self.events_scroll.winfo_children():
            w.destroy()

        if not self.analysis_data or not self.analysis_data['event_counts']:
            empty_lbl = ctk.CTkLabel(self.events_scroll, text="No events detected in folder.", text_color="#64748B")
            empty_lbl.pack(pady=20)
            return

        total_evs = max(self.analysis_data['total_events'], 1)

        # Render only non-zero counts
        for code, count in sorted(self.analysis_data['event_counts'].items(), key=lambda x: x[1], reverse=True):
            if count <= 0:
                continue  # STRICT: Zero counts are hidden!

            ev_meta = OFFICIAL_EVENTS.get(code, OFFICIAL_EVENTS['OTHER'])
            pct = (count / total_evs) * 100

            row = ctk.CTkFrame(self.events_scroll, corner_radius=8, fg_color="#181B23")
            row.pack(fill="x", pady=4, padx=4)

            # Left Color Badge
            badge = ctk.CTkLabel(
                row,
                text=ev_meta['name'] if self.show_full_names else code,
                fg_color=ev_meta['color'],
                text_color="#000000" if ev_meta['text_dark'] else "#FFFFFF",
                corner_radius=6,
                font=ctk.CTkFont(size=12, weight="bold"),
                width=140 if self.show_full_names else 54,
                height=26
            )
            badge.pack(side="left", padx=8, pady=8)

            # Middle: Full name (if abbr mode) or Abbr (if full mode)
            alt_text = code if self.show_full_names else ev_meta['name']
            lbl_alt = ctk.CTkLabel(row, text=alt_text, font=ctk.CTkFont(size=12), text_color="#CBD5E1")
            lbl_alt.pack(side="left", padx=6)

            # Right: Count & Percentage
            count_box = ctk.CTkFrame(row, fg_color="transparent")
            count_box.pack(side="right", padx=10)

            lbl_count = ctk.CTkLabel(
                count_box,
                text=f"{count} events",
                font=ctk.CTkFont(size=13, weight="bold"),
                text_color="#F8FAFC"
            )
            lbl_count.pack(anchor="e")

            lbl_pct = ctk.CTkLabel(
                count_box,
                text=f"{pct:.1f}% of total",
                font=ctk.CTkFont(size=10),
                text_color="#64748B"
            )
            lbl_pct.pack(anchor="e")

    def _render_days_list(self):
        for w in self.days_scroll.winfo_children():
            w.destroy()

        if not self.analysis_data or not self.analysis_data['session_details']:
            empty_lbl = ctk.CTkLabel(self.days_scroll, text="No daily sessions found.", text_color="#64748B")
            empty_lbl.pack(pady=20)
            return

        for s in self.analysis_data['session_details']:
            card = ctk.CTkFrame(self.days_scroll, corner_radius=8, fg_color="#181B23")
            card.pack(fill="x", pady=4, padx=4)

            top_row = ctk.CTkFrame(card, fg_color="transparent")
            top_row.pack(fill="x", padx=10, pady=(8, 2))

            # Session Name
            s_name_lbl = ctk.CTkLabel(
                top_row,
                text=s['name'],
                font=ctk.CTkFont(size=12, weight="bold"),
                text_color="#38BDF8"
            )
            s_name_lbl.pack(side="left")

            dur_lbl = ctk.CTkLabel(
                top_row,
                text=f"⏱️ {format_duration(s['duration_sec'])}",
                font=ctk.CTkFont(size=11, weight="bold"),
                text_color="#F59E0B"
            )
            dur_lbl.pack(side="right")

            # Bottom Breakdown summary
            bot_row = ctk.CTkFrame(card, fg_color="transparent")
            bot_row.pack(fill="x", padx=10, pady=(0, 8))

            ev_summary_str = " · ".join(f"{k}: {v}" for k, v in sorted(s['events'].items()))
            info_lbl = ctk.CTkLabel(
                bot_row,
                text=f"{s['items_count']} items · {s['videos_count']} clips | {ev_summary_str or 'No events'}",
                font=ctk.CTkFont(size=10),
                text_color="#94A3B8"
            )
            info_lbl.pack(anchor="w")

    def _copy_summary(self):
        if not self.analysis_data:
            messagebox.showinfo("Notice", "Please analyze a folder first.")
            return

        ad = self.analysis_data
        lines = [
            f"🏕️ *{ad['folder_name']}*",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            f"📅 Total Days: {ad['total_days']} days",
            f"🎯 Total Events: {ad['total_events']} events",
            f"🎬 Premiere Pro Timeline: {format_duration(ad['total_duration_sec'])} ({ad['total_videos']} clips)",
            f"📦 Total Media Size: {ad['total_size_gb']:.2f} GB",
            "",
            "*📊 Event Breakdown:*",
        ]
        for code, count in sorted(ad['event_counts'].items(), key=lambda x: x[1], reverse=True):
            if count > 0:
                full_name = OFFICIAL_EVENTS.get(code, {'name': 'Other'})['name']
                lines.append(f"• *{code}* ({full_name}): {count}")

        summary = "\n".join(lines)
        self.clipboard_clear()
        self.clipboard_append(summary)
        self.update()
        messagebox.showinfo("Copied! 🎉", "Safar Executive Summary copied to clipboard!")


def launch_gui(target_folder=None):
    app = ModernSafarInspectorGUI(target_folder)
    app.mainloop()


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else None
    launch_gui(target)
