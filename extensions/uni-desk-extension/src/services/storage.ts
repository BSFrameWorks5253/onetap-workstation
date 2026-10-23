import { AppSettings, Macro } from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'unidesk_settings_v1',
  FAVORITES: 'unidesk_favorites_v1',
  PINNED: 'unidesk_pinned_v1',
  RECENTS: 'unidesk_recents_v1',
  USAGE_COUNTS: 'unidesk_usage_counts_v1',
  CUSTOM_MACROS: 'unidesk_custom_macros_v1',
};

export const DEFAULT_SETTINGS: AppSettings = {
  globalShortcut: 'Ctrl+Space',
  theme: 'dark_glass',
  animationSpeed: 'fast',
  maxResults: 25,
  searchThreshold: 0.35,
  autoCloseOnApply: false,
  soundFeedback: false,
  enabledCategories: [
    'All',
    'Effects',
    'Transitions',
    'Audio Effects',
    'Video Effects',
    'Presets',
    'Adjustment Layers',
    'Sequences',
    'Bins',
    'Project Items',
    'Commands',
    'Tools',
    'Workspaces',
    'Recent Files',
    'Favorites',
    'Plugins',
    'Macros',
    'Templates',
    'Motion Presets',
  ],
};

export class StorageService {
  public static getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (e) {}
    return DEFAULT_SETTINGS;
  }

  public static saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {}
  }

  public static getFavorites(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return ['fx_gaussian_blur', 'fx_lumetri_color', 'tr_cross_dissolve', 'cmd_nest', 'cmd_render_in_out'];
  }

  public static toggleFavorite(itemId: string): string[] {
    const favorites = this.getFavorites();
    const exists = favorites.includes(itemId);
    let updated: string[];
    if (exists) {
      updated = favorites.filter((id) => id !== itemId);
    } else {
      updated = [itemId, ...favorites];
    }
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(updated));
    return updated;
  }

  public static getRecents(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECENTS);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
  }

  public static addRecent(itemId: string): string[] {
    const recents = this.getRecents().filter((id) => id !== itemId);
    const updated = [itemId, ...recents].slice(0, 30);
    localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(updated));
    this.incrementUsage(itemId);
    return updated;
  }

  public static getUsageCounts(): Record<string, number> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USAGE_COUNTS);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {};
  }

  public static incrementUsage(itemId: string): void {
    const counts = this.getUsageCounts();
    counts[itemId] = (counts[itemId] || 0) + 1;
    localStorage.setItem(STORAGE_KEYS.USAGE_COUNTS, JSON.stringify(counts));
  }

  public static getCustomMacros(): Macro[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CUSTOM_MACROS);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
  }

  public static saveCustomMacro(macro: Macro): Macro[] {
    const custom = this.getCustomMacros().filter((m) => m.id !== macro.id);
    const updated = [macro, ...custom];
    localStorage.setItem(STORAGE_KEYS.CUSTOM_MACROS, JSON.stringify(updated));
    return updated;
  }

  public static deleteCustomMacro(macroId: string): Macro[] {
    const custom = this.getCustomMacros().filter((m) => m.id !== macroId);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_MACROS, JSON.stringify(custom));
    return custom;
  }

  public static clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
  }
}
