import React, { useState } from 'react';
import { Macro, MacroStep } from '../types';
import { StorageService } from '../services/storage';
import { Zap, Plus, Trash2, X, Save } from 'lucide-react';

interface MacroBuilderProps {
  onClose: () => void;
  onMacroSaved: () => void;
}

export const MacroBuilder: React.FC<MacroBuilderProps> = ({ onClose, onMacroSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<MacroStep[]>([
    {
      id: 'step_1',
      type: 'effect',
      title: 'Apply Lumetri Color',
      payload: { effectName: 'Lumetri Color' },
    },
  ]);

  const addStep = () => {
    setSteps([
      ...steps,
      {
        id: `step_${Date.now()}`,
        type: 'effect',
        title: 'New Macro Step',
        payload: { effectName: 'Gaussian Blur' },
      },
    ]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const updateStep = (id: string, updated: Partial<MacroStep>) => {
    setSteps(
      steps.map((s) => (s.id === id ? { ...s, ...updated } : s))
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const newMacro: Macro = {
      id: `macro_${Date.now()}`,
      name: name.trim(),
      description: description.trim() || 'Custom automated workflow macro',
      steps,
      isCustom: true,
    };
    StorageService.saveCustomMacro(newMacro);
    onMacroSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-xl glass-panel bg-slate-950/90 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-modal-pop">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Visual Macro Builder</h2>
              <p className="text-xs text-gray-400">Chain multiple effects and commands into 1-click execution</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Macro Name</label>
            <input
              type="text"
              placeholder="e.g. Color Grade + Sharpen + Render"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-300">Description</label>
            <input
              type="text"
              placeholder="Brief summary of what this macro does"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-bold text-gray-300">Sequential Steps ({steps.length})</span>
            <button
              onClick={addStep}
              className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-xl text-xs font-semibold text-purple-300 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Step</span>
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-center justify-between gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl"
              >
                <span className="text-xs font-mono text-purple-400 font-bold">#{idx + 1}</span>
                <select
                  value={step.type}
                  onChange={(e) =>
                    updateStep(step.id, { type: e.target.value as any })
                  }
                  className="bg-black/60 text-xs text-white border border-white/15 rounded-xl px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="effect">Effect</option>
                  <option value="command">Command</option>
                  <option value="motion_preset">Motion Preset</option>
                  <option value="marker">Timeline Marker</option>
                </select>

                <input
                  type="text"
                  placeholder="Target Effect or Command Name"
                  value={step.payload.effectName || step.payload.commandName || step.title}
                  onChange={(e) =>
                    updateStep(step.id, {
                      title: e.target.value,
                      payload: { ...step.payload, effectName: e.target.value, commandName: e.target.value },
                    })
                  }
                  className="flex-1 bg-black/60 text-xs text-white border border-white/15 rounded-xl px-3 py-1.5 focus:outline-none"
                />

                <button
                  onClick={() => removeStep(step.id)}
                  className="text-gray-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-500/25 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Macro</span>
          </button>
        </div>
      </div>
    </div>
  );
};
