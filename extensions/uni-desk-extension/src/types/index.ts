export type CategoryType =
  | 'All'
  | 'Effects'
  | 'Transitions'
  | 'Audio Effects'
  | 'Video Effects'
  | 'Presets'
  | 'Adjustment Layers'
  | 'Sequences'
  | 'Bins'
  | 'Project Items'
  | 'Commands'
  | 'Tools'
  | 'Workspaces'
  | 'Recent Files'
  | 'Favorites'
  | 'Plugins'
  | 'Macros'
  | 'Templates'
  | 'Motion Presets';

export type ActionType =
  | 'effect'
  | 'transition'
  | 'audio_effect'
  | 'command'
  | 'macro'
  | 'motion_preset'
  | 'bin'
  | 'sequence'
  | 'workspace'
  | 'tool'
  | 'preset'
  | 'import_media_xml';

export interface MacroStep {
  id: string;
  type: 'effect' | 'command' | 'motion_preset' | 'marker';
  title: string;
  payload: {
    effectName?: string;
    commandId?: string;
    commandName?: string;
    presetType?: string;
    markerComment?: string;
  };
}

export interface Macro {
  id: string;
  name: string;
  description: string;
  shortcut?: string;
  steps: MacroStep[];
  isCustom?: boolean;
}

export interface SearchResultItem {
  id: string;
  name: string;
  category: CategoryType;
  subcategory?: string;
  description: string;
  icon: string; // Lucide icon identifier or name
  keywords: string[];
  shortcut?: string;
  actionType: ActionType;
  actionPayload: {
    effectName?: string;
    commandId?: string;
    commandName?: string;
    presetId?: string;
    presetType?: string;
    macroSteps?: MacroStep[];
    nodeId?: string;
    transitionName?: string;
  };
  isPinned?: boolean;
  isFavorite?: boolean;
  usageCount?: number;
  lastUsedAt?: number;
  plugin?: string;
}

export interface AppSettings {
  globalShortcut: string;
  theme: 'dark_glass' | 'cyberpunk' | 'obsidian' | 'premiere_native';
  animationSpeed: 'fast' | 'normal' | 'slow' | 'none';
  maxResults: number;
  searchThreshold: number;
  autoCloseOnApply: boolean;
  soundFeedback: boolean;
  enabledCategories: CategoryType[];
}

export interface NotificationPayload {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: string;
}
