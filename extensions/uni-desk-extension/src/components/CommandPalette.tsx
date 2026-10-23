import React, { useRef, useEffect } from 'react';
import { SearchResultItem, CategoryType } from '../types';
import { CategoryPills } from './CategoryPills';
import { ItemRow } from './ItemRow';
import { PreviewPanel } from './PreviewPanel';
import { Search, X, Sparkles, Sliders, Zap, Keyboard, FileCode } from 'lucide-react';

interface CommandPaletteProps {
  query: string;
  setQuery: (q: string) => void;
  category: CategoryType;
  setCategory: (cat: CategoryType) => void;
  results: SearchResultItem[];
  selectedIndex: number;
  setSelectedIndex: (idx: number) => void;
  searchLatencyMs: number;
  showPreview: boolean;
  onTogglePreview: () => void;
  onExecuteItem: (item: SearchResultItem, applyToAll?: boolean) => void;
  onToggleFavorite: (itemId: string, e: React.MouseEvent) => void;
  onOpenSettings: () => void;
  onOpenMacroBuilder: () => void;
  onOpenCheatSheet: () => void;
  onLocateXml: () => void;
  onSetIn: () => void;
  onSetOut: () => void;
  onExportToEncoder: () => void;
  onDistributeNikah: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  query,
  setQuery,
  category,
  setCategory,
  results,
  selectedIndex,
  setSelectedIndex,
  searchLatencyMs,
  showPreview,
  onTogglePreview,
  onExecuteItem,
  onToggleFavorite,
  onOpenSettings,
  onOpenMacroBuilder,
  onOpenCheatSheet,
  onLocateXml,
  onSetIn,
  onSetOut,
  onExportToEncoder,
  onDistributeNikah,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll focused item into view instantly
  useEffect(() => {
    if (!listRef.current) return;
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [selectedIndex]);

  const activeItem = results[selectedIndex] || null;

  return (
    <div className="flex items-start justify-center h-full w-full p-2 sm:p-4 pointer-events-none box-border overflow-hidden">
      <div className="w-full h-full max-w-full sm:max-w-[760px] glass-panel rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto transition-all animate-modal-pop relative border border-white/10">
        {/* Top Accent Gradient Line */}
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-pulse" />

        <div className="flex-1 flex min-h-0">
          {/* Main Command Palette Column */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Header Redesign */}
            <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm tracking-wide">Uni Desk</span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono border border-indigo-500/30">v26.9</span>
              </div>
              <button 
                onClick={onLocateXml}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition text-xs text-gray-300"
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Locate XML</span>
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="relative flex items-center px-4 py-3.5 border-b border-white/10 bg-black/25">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 mr-3 flex-shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search effects, transitions, commands, presets, macros (e.g. 'blur', 'lumetri')..."
                className="w-full bg-transparent text-gray-100 placeholder-gray-500 font-sans text-sm focus:outline-none tracking-wide"
              />
              {query ? (
                <button
                  onClick={() => setQuery('')}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-gray-400">
                  <span>⌘K</span>
                </div>
              )}
            </div>

            {/* In/Out Glow Buttons & Export */}
            <div className="flex flex-wrap gap-3 px-4 py-3 border-b border-white/10 bg-black/15">
              <button 
                onClick={onSetIn}
                className="flex-1 min-w-[100px] py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all duration-300 ease-out hover:scale-105 hover:shadow-[0_0_20px_rgba(99,102,241,0.6)] relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <span className="text-lg leading-none">▶</span> Set In
                </span>
                <span className="absolute inset-0 bg-white opacity-0 group-active:animate-ping rounded-lg z-0"></span>
              </button>
              
              <button 
                onClick={onSetOut}
                className="flex-1 min-w-[100px] py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-all duration-300 ease-out hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.6)] relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <span className="text-lg leading-none">■</span> Set Out
                </span>
                <span className="absolute inset-0 bg-white opacity-0 group-active:animate-ping rounded-lg z-0"></span>
              </button>

              <button 
                onClick={onExportToEncoder}
                className="flex-1 min-w-[140px] py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all duration-300 ease-out hover:scale-105 hover:shadow-[0_0_20px_rgba(16,185,129,0.6)] relative overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Export to Encoder
                </span>
                <span className="absolute inset-0 bg-white opacity-0 group-active:animate-ping rounded-lg z-0"></span>
              </button>
            </div>

            {/* Nikah Group Photo Distribution Section */}
            <details className="group border-b border-white/10 bg-black/20">
              <summary className="px-4 py-2.5 text-sm font-semibold text-gray-300 cursor-pointer hover:bg-white/5 transition flex justify-between items-center outline-none">
                <span>Nikah Distribution</span>
                <span className="text-xs opacity-50 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="px-4 py-3 bg-black/40 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"></span>
                  <span>Mango = Group Photo Source</span>
                </div>
                <p className="text-xs text-gray-500 italic">Color target clip Mango (orange), then click Distribute</p>
                <button 
                  onClick={onDistributeNikah}
                  className="w-full py-2 bg-orange-600/80 hover:bg-orange-500 text-white font-medium rounded-lg transition-all text-sm shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_20px_rgba(249,115,22,0.6)]"
                >
                  Distribute Group Photo
                </button>
              </div>
            </details>

            {/* Category Filter Pills */}
            <CategoryPills activeCategory={category} onSelectCategory={setCategory} />

            {/* Search Results List */}
            <div
              ref={listRef}
              className="flex-1 min-h-0 overflow-y-auto py-2 flex flex-col gap-1 scroll-smooth"
            >
              {results.length > 0 ? (
                results.map((item, idx) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isSelected={idx === selectedIndex}
                    query={query}
                    onSelect={() => setSelectedIndex(idx)}
                    onExecute={() => onExecuteItem(item, false)}
                    onToggleFavorite={(e) => onToggleFavorite(item.id, e)}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 mb-3 animate-bounce">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-200">No actions found</h4>
                  <p className="text-xs text-gray-400 max-w-xs mt-1.5 leading-relaxed">
                    Try searching for <span className="text-indigo-400 font-semibold">"blur"</span>, <span className="text-purple-400 font-semibold font-mono">"audio"</span>, or <span className="text-pink-400 font-semibold">"color"</span>
                  </p>
                </div>
              )}
            </div>

            {/* Footer Toolbar & Status Line */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10 bg-black/40 text-[11px] text-gray-400 font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span className="font-semibold">{results.length} items</span>
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">{searchLatencyMs}ms</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onExecuteItem({
                    id: 'cmd_import_media_xml',
                    name: 'Import Media Sequence (XML)',
                    category: 'Commands',
                    subcategory: 'File',
                    description: 'Scan project directory for matching XML sequence file and open in Timeline',
                    icon: 'FileCode',
                    keywords: ['import', 'xml', 'sequence'],
                    actionType: 'import_media_xml',
                    actionPayload: { commandName: 'Import Media Sequence (XML)' }
                  })}
                  title="Scan project directory for matching XML sequence file and open in Timeline"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg text-indigo-300 transition text-[11px] font-medium"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Import XML Seq</span>
                </button>
                <button
                  onClick={onOpenMacroBuilder}
                  title="Create Visual Macro"
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-lg text-purple-300 transition text-[11px] font-medium"
                >
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Macro Builder</span>
                </button>
                <button
                  onClick={onOpenCheatSheet}
                  title="Keyboard Shortcuts"
                  className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-amber-300 transition"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onOpenSettings}
                  title="Uni_Desk Settings"
                  className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 transition"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Optional Details Side Preview Panel */}
          {showPreview && <PreviewPanel item={activeItem} onClose={onTogglePreview} />}
        </div>
      </div>
    </div>
  );
};
