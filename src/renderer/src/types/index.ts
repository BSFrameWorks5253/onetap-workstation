import prLogo from "../assets/pr_logo.png";

// ── Shared TypeScript types for the renderer ─────────────────

export type PageKey =
  | "dashboard"
  | "adder"
  | "converter"
  | "cameratransfer"
  | "drivesync"
  | "folder"
  | "stats"
  | "notes"
  | "cloud"
  | "gdrive"
  | "settings"
  | "utilities"
  | "prproj"
  | "videotransfer"
  | "pvseparator"
  | "cleaner"
  | "excelmerger"
  | "tracker"
  | "archivevault"
  | "admin";

export type ThemeName = "glass" | "beige" | "light" | "forest";
export type AnimPreset = "calm" | "balanced" | "cinematic";
export type ButtonVariant = "primary" | "ghost" | "danger" | "success";

export interface PageMeta {
  key: PageKey;
  label: string;
  icon: string;
  accent: string;
  accentHv: string;
  accentSoft: string;
  subtitle: string;
}

export const PAGE_META: Record<PageKey, PageMeta> = {
  dashboard: {
    key: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    accent: "var(--accent-dashboard)",
    accentHv: "var(--accent-dashboard-hv)",
    accentSoft: "var(--accent-dashboard-soft)",
    subtitle: "Command Center — Overview of your tools and recent activity",
  },
  adder: {
    key: "adder",
    label: "Title Adder",
    icon: "adder",
    accent: "var(--accent-adder)",
    accentHv: "var(--accent-adder-hv)",
    accentSoft: "var(--accent-adder-soft)",
    subtitle: "Batch-process videos with intro/outro & smart audio branding",
  },
  converter: {
    key: "converter",
    label: "PNG → JPG",
    icon: "converter",
    accent: "var(--accent-converter)",
    accentHv: "var(--accent-converter-hv)",
    accentSoft: "var(--accent-converter-soft)",
    subtitle: "Convert PNG screenshots to JPEG and rename by video filename",
  },
  drivesync: {
    key: "drivesync",
    label: "Drive Sync",
    icon: "drivesync",
    accent: "var(--accent-drivesync)",
    accentHv: "var(--accent-drivesync-hv)",
    accentSoft: "var(--accent-drivesync-soft)",
    subtitle:
      "Copy folder trees between drives with fast multi-thread transfer",
  },
  folder: {
    key: "folder",
    label: "Folder Maker",
    icon: "folder",
    accent: "var(--accent-folder)",
    accentHv: "var(--accent-folder-hv)",
    accentSoft: "var(--accent-folder-soft)",
    subtitle: "Design and build nested folder structures visually",
  },
  stats: {
    key: "stats",
    label: "Stats",
    icon: "stats",
    accent: "var(--accent-stats)",
    accentHv: "var(--accent-stats-hv)",
    accentSoft: "var(--accent-stats-soft)",
    subtitle: "Render Statistics — Track video counts by prefix and date",
  },
  notes: {
    key: "notes",
    label: "Sticky Hub",
    icon: "notes",
    accent: "var(--accent-notes)",
    accentHv: "var(--accent-notes-hv)",
    accentSoft: "var(--accent-notes-soft)",
    subtitle:
      "Workspace Sticky Hub — Jot down color-coded reminders, track checklists, and quick-launch cloud scripts & directories",
  },
  cloud: {
    key: "cloud",
    label: "Cloud Portal",
    icon: "cloud",
    accent: "var(--accent-cloud)",
    accentHv: "var(--accent-cloud-hv)",
    accentSoft: "var(--accent-cloud-soft)",
    subtitle: "Sharaf Media Cloud Portal — Online media repository and live production operations",
  },
  gdrive: {
    key: "gdrive",
    label: "Sharaf Media",
    icon: "gdrive",
    accent: "#06B6D4",
    accentHv: "#0891B2",
    accentSoft: "rgba(6, 182, 212, 0.12)",
    subtitle: "Sharaf Media Portal — Online media repository and live production operations",
  },
  settings: {
    key: "settings",
    label: "Settings",
    icon: "settings",
    accent: "var(--accent-settings)",
    accentHv: "var(--accent-settings-hv)",
    accentSoft: "var(--accent-settings-soft)",
    subtitle: "Configure every aspect of the app — changes saved automatically",
  },
  utilities: {
    key: "utilities",
    label: "Workspace Utilities",
    icon: "utilities",
    accent: "var(--accent-settings)",
    accentHv: "var(--accent-settings-hv)",
    accentSoft: "var(--accent-settings-soft)",
    subtitle: "Launch and manage custom workspace tools & offline utilities",
  },
  cameratransfer: {
    key: "cameratransfer",
    label: "Camera Transfer",
    icon: "cameratransfer",
    accent: "var(--accent-cameratransfer)",
    accentHv: "var(--accent-cameratransfer-hv)",
    accentSoft: "var(--accent-cameratransfer-soft)",
    subtitle: "Sort and copy videos from SD card to camera person folders with Hijri naming",
  },
  prproj: {
    key: "prproj",
    label: "Prj 2026 file maker",
    icon: prLogo,
    accent: "#9999FF",
    accentHv: "#7A7AFF",
    accentSoft: "rgba(153, 153, 255, 0.12)",
    subtitle: "Batch generate Adobe Premiere Pro 2026 (.prproj) project files in subfolders",
  },
  videotransfer: {
    key: "videotransfer",
    label: "Match Video Transfer",
    icon: "videotransfer",
    accent: "#8B5CF6",
    accentHv: "#7C3AED",
    accentSoft: "rgba(139, 92, 246, 0.12)",
    subtitle: "Match videos (001 Q01.mp4) with photo folders (001 Q01) in date directories and transfer",
  },
  cleaner: {
    key: "cleaner",
    label: "Workspace Cleaner",
    icon: "cleaner",
    accent: "var(--accent-settings)",
    accentHv: "var(--accent-settings-hv)",
    accentSoft: "var(--accent-settings-soft)",
    subtitle: "Disk space cleanup, temporary cache purger & toolbelt",
  },
  pvseparator: {
    key: "pvseparator",
    label: "PV Separator",
    icon: "pvseparator",
    accent: "#06B6D4",
    accentHv: "#0891B2",
    accentSoft: "rgba(6, 182, 212, 0.12)",
    subtitle: "Ultra-Fast Photo Data Separator & Extractor",
  },
  excelmerger: {
    key: "excelmerger",
    label: "Inventory Merger",
    icon: "excelmerger",
    accent: "#10B981",
    accentHv: "#059669",
    accentSoft: "rgba(16, 185, 129, 0.12)",
    subtitle: "Merge Morning & Evening Inventory Reports (.xlsx) into a unified joint report",
  },
  tracker: {
    key: "tracker",
    label: "Task Tracker",
    icon: "tracker",
    accent: "#38BDF8",
    accentHv: "#0284C7",
    accentSoft: "rgba(56, 189, 248, 0.12)",
    subtitle: "Autonomous Safar & Date Production Lifecycle Tracker (100% Automated)",
  },
  archivevault: {
    key: "archivevault",
    label: "Data Search",
    icon: "archivevault",
    accent: "#06B6D4",
    accentHv: "#0891B2",
    accentSoft: "rgba(6, 182, 212, 0.12)",
    subtitle: "Search clips, Safars, and reconcile Excel across offline hard drives (Zero Storage)",
  },
  admin: {
    key: "admin",
    label: "Admin Command Center",
    icon: "admin",
    accent: "#EAB308",
    accentHv: "#CA8A04",
    accentSoft: "rgba(234, 179, 8, 0.15)",
    subtitle: "Owner Command Center — Broadcast Studio, Client Directory & Webhooks",
  },
};

export const NAV_ORDER: PageKey[] = [
  "dashboard",
  "adder",
  "converter",
  "prproj",
  "gdrive",
  "cloud",
  "notes",
  "stats",
  "cameratransfer",
  "videotransfer",
  "drivesync",
  "tracker",
  "archivevault",
];

// ── Tracker Specific Types ────────────────────────────────────
export type TaskStatus =
  | 'editing_pending'
  | 'editing'
  | 'review'
  | 'upload_pending'
  | 'uploaded'
  | 'submitted';

export interface TrackerTaskItem {
  id?: number;
  safarName: string;
  dateFolder: string;
  status: TaskStatus;
  firstSeenAt?: number;
  prprojModifiedAt?: number;
  prprojPath?: string;
  renderedAt?: number;
  renderDuration?: number;
  renderVideoCount?: number;
  renderSizeBytes?: number;
  uploadedAt?: number;
  submittedAt?: number;
  workingPath?: string;
  finalPath?: string;
  uploadPath?: string;
  deletePath?: string;
  currentDrive?: string;
  notes?: string;
  metadata?: Record<string, any>;
  updatedAt?: number;
  isAvailable?: boolean;
  isDriveConnected?: boolean;
  manualStatus?: 'uploaded' | 'submitted' | null;
  isManual?: boolean;
}

export interface SafarGroupItem {
  id?: number;
  safarName: string;
  safarYear?: number;
  safarSerial?: string;
  city?: string;
  totalDays: number;
  completedDays: number;
  isSafarDone: boolean;
  currentPath?: string;
  currentDrive?: string;
  isAvailable?: boolean;
  isDriveConnected?: boolean;
  isPathExists?: boolean;
  manualStatus?: 'uploaded' | 'submitted' | null;
  isManual?: boolean;
  tasks: TrackerTaskItem[];
}

export interface DriveWorkspaceConfig {
  id: string;
  driveRoot: string; // e.g. "D:\"
  enabled: boolean;
  inProcessPath: string; // e.g. "D:\IN PROCESS"
  toUploadPath: string; // e.g. "D:\UPLOADED DATA" or "D:\TO UPLOAD"
  toDeletePath: string; // e.g. "D:\TO DELETE"
  label?: string;
  status?: {
    inProcessExists: boolean;
    toUploadExists: boolean;
    toDeleteExists: boolean;
    safarCount?: number;
  };
}

export interface DriveSpaceInfo {
  path: string;
  freeGB: number;
  totalGB: number;
  usedPercent: number;
  isOnline: boolean;
  isLowSpace: boolean;
  isCritical: boolean;
}

export interface DriveAutoDetectResult {
  driveRoot: string;
  inProcessPath: string;
  inProcessExists: boolean;
  toUploadPath: string;
  toUploadExists: boolean;
  toDeletePath: string;
  toDeleteExists: boolean;
  safarCount: number;
}


export interface TrackerAuditLog {
  id: number;
  taskId?: number;
  safarName: string;
  dateFolder: string;
  fromStatus: string;
  toStatus: string;
  description: string;
  timestamp: number;
}

export type MediaFileType = 'video' | 'project' | 'audio' | 'image' | 'folder' | 'other';
export type MediaCategory = 'final_render' | 'working_project' | 'raw_footage' | 'folder' | 'to_upload' | 'to_delete';

export interface MediaResourceItem {
  id: number;
  taskId?: number;
  safarName: string;
  dateFolder?: string;
  fileName: string;
  filePath: string;
  parentDir: string;
  fileType: MediaFileType;
  category: MediaCategory;
  driveRoot: string;
  driveLabel?: string;
  fileSize: number;
  duration?: number;
  mtime: number;
  updatedAt?: number;
  isAvailable?: boolean;
  isDriveConnected?: boolean;
}


// ── IPC API types (window.api) ────────────────────────────────
export interface ProgressEvent {
  jobId: string;
  percent: number;
  status: string;
}
export interface LogEvent {
  jobId: string;
  message: string;
  level?: "info" | "warn" | "error" | "success";
}
export interface DoneEvent {
  jobId: string;
  success: boolean;
  done?: number;
  total?: number;
}

export interface FolderNode {
  id: string;
  name: string;
  level: number;
  children: FolderNode[];
}

export interface Preset {
  name: string;
  structure: Omit<FolderNode, "id">[];
}

// ── Virtual Archive Vault & Excel Reconciler Types ────────────
export interface ScannedArchive {
  id: number;
  drive_id?: number;
  safar_name: string;
  safar_folder: string;
  safar_year?: number;
  safar_serial?: string;
  city?: string;
  root_path: string;
  total_files: number;
  total_mp4_count: number;
  total_photo_count: number;
  total_size_bytes: number;
  total_duration_seconds: number;
  duration_formatted?: string;
  scan_timestamp: string;
  drive_label?: string;
  drive_location?: string;
}

export interface MediaItem {
  id: number;
  archive_id: number;
  file_name: string;
  file_stem: string;
  file_ext: string;
  media_type: 'video' | 'photo' | 'audio' | 'project' | 'folder' | 'other';
  size_bytes: number;
  duration_seconds: number;
  duration_formatted?: string;
  created_time?: string;
  relative_path: string;
  session_name?: string;
  session_tag?: string;
  event_code?: string;
  date_canonical_hijri?: string;
  date_canonical_greg?: string;
  safar_name?: string;
  city?: string;
  root_path?: string;
  full_path?: string;
  drive_label?: string;
  drive_location?: string;
  upload_status?: 'uploaded' | 'submitted' | 'rendered_pending' | 'not_uploaded' | 'unknown' | 'dvd_local' | 'review' | 'editing';
  uploaded_path?: string;
}

export interface DriveVolume {
  id: number;
  volume_label: string;
  serial_number?: string;
  physical_location?: string;
  notes?: string;
  last_seen_date?: string;
  archive_count?: number;
  total_stored_bytes?: number;
}

export interface AuditRecord {
  row_index: number;
  raw_date: string;
  raw_folder: string;
  raw_file: string;
  match_status: 'EXACT' | 'SESSION_SHIFT' | 'DAY_SHIFT' | 'FOLDER_SHIFT' | 'MISSING';
  confidence: number;
  explanation: string;
  matched_item?: {
    media_id: number;
    file_name: string;
    folder_path: string;
    size_bytes: number;
    duration_formatted?: string;
  };
}

export interface AuditFolderSummary {
  folder_name: string;
  matched_archive_path: string;
  date_val: string;
  excel_file_count: number;
  archive_file_count: number;
  matched_files: number;
  missing_files: number;
  difference: number;
  status: 'BALANCED' | 'COUNT_MISMATCH' | 'MISSING_IN_ARCHIVE' | 'EXTRA_IN_ARCHIVE';
}

export interface AuditSummary {
  total_excel_rows: number;
  total_archive_files?: number;
  total_excel_folders?: number;
  total_archive_folders?: number;
  balanced_folder_count?: number;
  mismatched_folder_count?: number;
  missing_folder_count?: number;
  extra_folder_count?: number;
  matched_exact_count: number;
  matched_shifted_count: number;
  missing_count: number;
  accuracy_rate: number;
}

declare global {
  interface Window {
    api: any
  }
}


