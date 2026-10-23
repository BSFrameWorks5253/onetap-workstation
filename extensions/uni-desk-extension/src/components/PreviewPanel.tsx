import React from 'react';
import { SearchResultItem } from '../types';
import * as Icons from 'lucide-react';

interface PreviewPanelProps {
  item: SearchResultItem | null;
  onClose: () => void;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ item, onClose }) => {
  if (!item) return null;

  const IconComponent = (Icons as any)[item.icon] || Icons.Sparkles;

  return (
    <div className="w-80 border-l border-white/10 bg-black/40 backdrop-blur-xl p-5 flex flex-col justify-between h-full">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-400 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Item Details
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3.5 bg-white/5 p-3 rounded-2xl border border-white/10">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-md shadow-indigo-500/20">
            <IconComponent className="w-5 h-5" />
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold text-sm text-white leading-tight truncate">{item.name}</h3>
            <span className="text-xs text-indigo-300 font-mono mt-0.5 font-medium">{item.category}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-gray-300">Description</span>
          <p className="text-xs text-gray-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
            {item.description}
          </p>
        </div>

        {item.subcategory && (
          <div className="flex justify-between items-center text-xs p-2.5 bg-white/5 rounded-xl border border-white/5">
            <span className="text-gray-400 font-medium">Subcategory</span>
            <span className="font-mono text-gray-200 font-semibold">{item.subcategory}</span>
          </div>
        )}

        {item.plugin && (
          <div className="flex justify-between items-center text-xs p-2.5 bg-purple-950/20 border border-purple-500/20 rounded-xl">
            <span className="text-purple-300 font-medium">Plugin Provider</span>
            <span className="font-mono text-purple-200 font-bold">{item.plugin}</span>
          </div>
        )}

        {item.keywords && item.keywords.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-300">Keywords</span>
            <div className="flex flex-wrap gap-1">
              {item.keywords.map((kw, i) => (
                <span key={i} className="text-[10px] font-mono bg-white/5 text-gray-300 px-2 py-0.5 rounded-lg border border-white/10">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
        <div className="text-[11px] text-gray-400 font-mono space-y-1.5">
          <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
            <span>Apply to selection</span>
            <kbd className="text-white bg-indigo-500/20 border border-indigo-500/40 px-1.5 py-0.5 rounded text-[10px]">Enter</kbd>
          </div>
          <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
            <span>Apply to all clips</span>
            <kbd className="text-white bg-indigo-500/20 border border-indigo-500/40 px-1.5 py-0.5 rounded text-[10px]">Ctrl + Enter</kbd>
          </div>
          <div className="flex justify-between items-center bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
            <span>Toggle Preview</span>
            <kbd className="text-white bg-indigo-500/20 border border-indigo-500/40 px-1.5 py-0.5 rounded text-[10px]">Alt + Enter</kbd>
          </div>
        </div>
      </div>
    </div>
  );
};
