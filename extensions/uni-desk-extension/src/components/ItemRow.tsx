import React from 'react';
import { SearchResultItem } from '../types';
import { HighlightMatch } from './HighlightMatch';
import * as Icons from 'lucide-react';

interface ItemRowProps {
  item: SearchResultItem;
  isSelected: boolean;
  query: string;
  onSelect: () => void;
  onExecute: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

export const ItemRow: React.FC<ItemRowProps> = ({
  item,
  isSelected,
  query,
  onSelect,
  onExecute,
  onToggleFavorite,
}) => {
  const IconComponent = (Icons as any)[item.icon] || Icons.Sparkles;

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'Video Effects':
      case 'Effects':
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
      case 'Audio Effects':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'Transitions':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Commands':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'Macros':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'Motion Presets':
        return 'bg-pink-500/15 text-pink-300 border-pink-500/30';
      default:
        return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
    }
  };

  return (
    <div
      onClick={onExecute}
      onMouseEnter={onSelect}
      className={`group relative flex items-center justify-between px-3.5 py-2.5 mx-2 rounded-xl cursor-pointer transition-all border ${
        isSelected
          ? 'glass-item-active text-white border-indigo-500/40 shadow-md shadow-indigo-500/10'
          : 'border-transparent hover:bg-white/[0.04] text-gray-300'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`p-2 rounded-xl transition-all ${
            isSelected
              ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white scale-105 shadow-md shadow-indigo-500/30'
              : 'bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-white/10'
          }`}
        >
          <IconComponent className="w-4 h-4" />
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs sm:text-sm truncate text-gray-100">
              <HighlightMatch text={item.name} query={query} />
            </span>
            <span
              className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded-full border font-semibold ${getCategoryBadgeClass(
                item.category
              )}`}
            >
              {item.category}
            </span>
            {item.plugin && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-900/40 text-purple-300 border border-purple-700/40">
                {item.plugin}
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400 group-hover:text-gray-300 truncate mt-0.5 transition-colors">
            {item.description}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 ml-3 flex-shrink-0">
        {item.shortcut && (
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-semibold text-gray-300 bg-white/5 border border-white/10 rounded shadow-sm">
            {item.shortcut}
          </kbd>
        )}

        <button
          onClick={onToggleFavorite}
          title={item.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}
          className={`p-1 rounded-lg transition-colors ${
            item.isFavorite
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100'
          }`}
        >
          <Icons.Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
        </button>
      </div>
    </div>
  );
};
