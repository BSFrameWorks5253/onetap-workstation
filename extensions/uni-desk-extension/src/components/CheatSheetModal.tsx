import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface CheatSheetModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'CTRL + SPACE', desc: 'Toggle Uni_Desk Command Palette' },
  { key: '↑ / ↓', desc: 'Navigate search results' },
  { key: 'ENTER', desc: 'Apply selected item / execute action' },
  { key: 'CTRL + ENTER', desc: 'Apply effect/transition to all selected clips' },
  { key: 'SHIFT + ENTER', desc: 'Open Settings preferences' },
  { key: 'ALT + ENTER', desc: 'Toggle Item Details Preview Panel' },
  { key: 'TAB', desc: 'Autocomplete input with highlighted result' },
  { key: 'ESC', desc: 'Close command palette' },
];

export const CheatSheetModal: React.FC<CheatSheetModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel bg-slate-950/90 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-modal-pop">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Keyboard Cheat Sheet</h2>
              <p className="text-xs text-gray-400">Zero-click keyboard workflow controls</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-2xl"
            >
              <span className="text-xs text-gray-300 font-medium">{s.desc}</span>
              <kbd className="px-2.5 py-1 text-[11px] font-mono font-bold text-amber-400 bg-black/60 border border-white/15 rounded-xl shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/25 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
