import React, { useState } from 'react';
import { AppSettings } from '../types';
import { StorageService } from '../services/storage';
import { Settings, RefreshCw, X, Save } from 'lucide-react';

interface SettingsModalProps {
  settings: AppSettings;
  onClose: () => void;
  onSave: (updated: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings: initialSettings,
  onClose,
  onSave,
}) => {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [rebuildStatus, setRebuildStatus] = useState<string | null>(null);

  const handleSave = () => {
    StorageService.saveSettings(settings);
    onSave(settings);
    onClose();
  };

  const handleRebuildCache = () => {
    onSave(settings);
    setRebuildStatus('Index cache rebuilt successfully!');
    setTimeout(() => setRebuildStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-lg glass-panel bg-slate-950/90 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-modal-pop">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Uni_Desk Preferences</h2>
              <p className="text-xs text-gray-400">Customize search behavior, hotkeys, and appearance</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 max-h-96 overflow-y-auto pr-1">
          {/* Global Shortcut */}
          <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl">
            <div>
              <span className="text-xs font-semibold text-white block">Global Palette Shortcut</span>
              <span className="text-[11px] text-gray-400">Trigger command palette from anywhere in Premiere</span>
            </div>
            <input
              type="text"
              value={settings.globalShortcut}
              onChange={(e) => setSettings({ ...settings, globalShortcut: e.target.value })}
              className="bg-black/60 border border-white/15 text-xs font-mono text-center text-amber-400 rounded-xl px-3 py-1.5 w-28 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Theme Selection */}
          <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl">
            <div>
              <span className="text-xs font-semibold text-white block">Aesthetic Theme</span>
              <span className="text-[11px] text-gray-400">Choose custom palette styling</span>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => setSettings({ ...settings, theme: e.target.value as any })}
              className="bg-black/60 border border-white/15 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="dark_glass">Dark Glassmorphism</option>
              <option value="cyberpunk">Cyberpunk Neon</option>
              <option value="obsidian">Obsidian Black</option>
              <option value="premiere_native">Premiere Native</option>
            </select>
          </div>

          {/* Maximum Results */}
          <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl">
            <div>
              <span className="text-xs font-semibold text-white block">Maximum Search Results</span>
              <span className="text-[11px] text-gray-400">Number of items displayed per search</span>
            </div>
            <input
              type="number"
              min={5}
              max={100}
              value={settings.maxResults}
              onChange={(e) => setSettings({ ...settings, maxResults: parseInt(e.target.value, 10) || 25 })}
              className="bg-black/60 border border-white/15 text-xs text-center text-white rounded-xl px-3 py-1.5 w-20 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Animation Speed */}
          <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-2xl">
            <div>
              <span className="text-xs font-semibold text-white block">Motion Animation Speed</span>
              <span className="text-[11px] text-gray-400">Framer Motion scale and fade duration</span>
            </div>
            <select
              value={settings.animationSpeed}
              onChange={(e) => setSettings({ ...settings, animationSpeed: e.target.value as any })}
              className="bg-black/60 border border-white/15 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="fast">Ultra Fast (&lt;100ms)</option>
              <option value="normal">Normal (150ms)</option>
              <option value="slow">Smooth (250ms)</option>
              <option value="none">Disabled (0ms)</option>
            </select>
          </div>

          {/* Rebuild Cache Button */}
          <div className="flex items-center justify-between p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl">
            <div>
              <span className="text-xs font-semibold text-indigo-200 block">Rebuild Effect Index</span>
              <span className="text-[11px] text-indigo-300/80">Re-index installed effects & 3rd-party plugins</span>
              {rebuildStatus && (
                <span className="text-[11px] text-emerald-400 block mt-1 font-medium animate-in fade-in">
                  ✓ {rebuildStatus}
                </span>
              )}
            </div>
            <button
              onClick={handleRebuildCache}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 rounded-xl text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reindex</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/30 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Preferences</span>
          </button>
        </div>
      </div>
    </div>
  );
};
