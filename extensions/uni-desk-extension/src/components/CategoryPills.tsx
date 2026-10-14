import React from 'react';
import { CategoryType } from '../types';
import { Sparkles, Layers, Volume2, Palette, Command, Zap, Star, Clock, Video } from 'lucide-react';

interface CategoryPillsProps {
  activeCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
}

const CATEGORIES: { label: CategoryType; icon: any }[] = [
  { label: 'All', icon: Sparkles },
  { label: 'Favorites', icon: Star },
  { label: 'Video Effects', icon: Video },
  { label: 'Audio Effects', icon: Volume2 },
  { label: 'Transitions', icon: Layers },
  { label: 'Commands', icon: Command },
  { label: 'Motion Presets', icon: Palette },
  { label: 'Macros', icon: Zap },
  { label: 'Recent Files', icon: Clock },
];

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/10 overflow-x-auto no-scrollbar scroll-smooth bg-black/15">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.label;
        return (
          <button
            key={cat.label}
            onClick={() => onSelectCategory(cat.label)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              isActive
                ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/40 scale-[1.02]'
                : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-gray-200 hover:border-white/15'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};
