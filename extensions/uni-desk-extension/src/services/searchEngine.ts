import Fuse, { IFuseOptions } from 'fuse.js';
import { SearchResultItem, CategoryType } from '../types';
import { EFFECTS_CATALOG } from '../data/effectsCatalog';
import { COMMANDS_CATALOG } from '../data/commandsCatalog';
import { MOTION_PRESETS } from '../data/motionPresets';
import { MACRO_SEARCH_ITEMS } from '../data/defaultMacros';
import { StorageService } from './storage';

export class SearchEngineService {
  private fuse: Fuse<SearchResultItem> | null = null;
  private catalog: SearchResultItem[] = [];

  constructor() {
    this.rebuildIndex();
  }

  public rebuildIndex(extraItems: SearchResultItem[] = []): void {
    const customMacros = StorageService.getCustomMacros().map((m) => ({
      id: `custom_macro_${m.id}`,
      name: `⚡ ${m.name}`,
      category: 'Macros' as CategoryType,
      description: m.description,
      icon: 'Zap',
      keywords: ['macro', 'custom', m.name.toLowerCase()],
      actionType: 'macro' as const,
      actionPayload: { macroSteps: m.steps },
    }));

    const favorites = StorageService.getFavorites();
    const usageCounts = StorageService.getUsageCounts();

    this.catalog = [
      ...EFFECTS_CATALOG,
      ...COMMANDS_CATALOG,
      ...MOTION_PRESETS,
      ...MACRO_SEARCH_ITEMS,
      ...customMacros,
      ...extraItems,
    ].map((item) => ({
      ...item,
      isFavorite: favorites.includes(item.id),
      usageCount: usageCounts[item.id] || 0,
    }));

    const options: IFuseOptions<SearchResultItem> = {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'keywords', weight: 0.3 },
        { name: 'category', weight: 0.15 },
        { name: 'description', weight: 0.15 },
        { name: 'plugin', weight: 0.1 },
      ],
      threshold: 0.35,
      distance: 100,
      minMatchCharLength: 1,
      includeMatches: true,
      shouldSort: true,
    };

    this.fuse = new Fuse(this.catalog, options);
  }

  /**
   * Search items with category filter and frequency ranking (<30ms execution time)
   */
  public search(
    query: string,
    activeCategory: CategoryType = 'All',
    maxResults: number = 25
  ): SearchResultItem[] {
    const trimmed = query.trim().toLowerCase();

    // 1. Initial Category Filtering
    let dataset = [...this.catalog];

    if (activeCategory === 'Favorites') {
      dataset = dataset.filter((item) => item.isFavorite);
    } else if (activeCategory === 'Recent Files') {
      const recents = StorageService.getRecents();
      dataset = dataset
        .filter((item) => recents.includes(item.id))
        .sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));
    } else if (activeCategory !== 'All') {
      dataset = dataset.filter((item) => {
        if (activeCategory === 'Effects') {
          return item.category === 'Video Effects' || item.category === 'Audio Effects' || item.category === 'Effects';
        }
        return item.category === activeCategory;
      });
    }

    // 2. Empty query -> return Pinned + Favorites + High usage items
    if (!trimmed) {
      return dataset
        .sort((a, b) => {
          if (a.isFavorite && !b.isFavorite) return -1;
          if (!a.isFavorite && b.isFavorite) return 1;
          return (b.usageCount || 0) - (a.usageCount || 0);
        })
        .slice(0, maxResults);
    }

    // 3. Fuzzy search execution
    if (!this.fuse) this.rebuildIndex();
    
    // Create temporary Fuse instance if dataset is filtered by category
    const fuseInstance = activeCategory === 'All' ? this.fuse! : new Fuse(dataset, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'keywords', weight: 0.3 },
        { name: 'category', weight: 0.15 },
        { name: 'description', weight: 0.15 },
      ],
      threshold: 0.35,
    });

    const fuseResults = fuseInstance.search(trimmed);

    // 4. Boost favorites and smart ranking
    const items = fuseResults.map((res) => {
      let boost = res.score || 0;
      if (res.item.isFavorite) boost -= 0.1; // Lower score is better in Fuse
      if (res.item.usageCount) boost -= Math.min(res.item.usageCount * 0.02, 0.15);
      return { item: res.item, score: boost };
    });

    items.sort((a, b) => a.score - b.score);

    return items.map((x) => x.item).slice(0, maxResults);
  }
}

export const searchEngine = new SearchEngineService();
