import React, { useState, useCallback } from 'react';
import { SearchResultItem, AppSettings, NotificationPayload } from './types';
import { useSearch } from './hooks/useSearch';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { MacroBuilder } from './components/MacroBuilder';
import { CheatSheetModal } from './components/CheatSheetModal';
import { NotificationToast } from './components/NotificationToast';
import { StorageService } from './services/storage';
import { ExtendScriptBridge } from './services/extendScriptBridge';
import { MacroEngineService } from './services/macroEngine';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const { query, setQuery, category, setCategory, results, searchLatencyMs, refreshIndex } =
    useSearch(settings.maxResults);

  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showMacroBuilder, setShowMacroBuilder] = useState<boolean>(false);
  const [showCheatSheet, setShowCheatSheet] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  const addNotification = (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    details?: string
  ) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    setNotifications((prev) => [...prev, { id, type, message, details }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4500);
  };

  const handleToggleFavorite = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    StorageService.toggleFavorite(itemId);
    refreshIndex();
  };

  // Execution engine handler
  const handleExecuteItem = useCallback(
    async (item: SearchResultItem, applyToAll: boolean = false) => {
      if (!item) return;

      StorageService.addRecent(item.id);
      refreshIndex();

      switch (item.actionType) {
        case 'effect':
        case 'audio_effect': {
          const effectName = item.actionPayload.effectName || item.name;
          const res = await ExtendScriptBridge.applyEffect(effectName, applyToAll);
          if (res.success) {
            addNotification('success', res.message || `Applied ${effectName}`);
          } else {
            addNotification('warning', res.message || `Could not apply ${effectName}`, res.code);
          }
          break;
        }

        case 'transition': {
          const transitionName = item.actionPayload.transitionName || item.name;
          const res = await ExtendScriptBridge.applyTransition(transitionName);
          if (res.success) {
            addNotification('success', res.message || `Applied transition ${transitionName}`);
          } else {
            addNotification('warning', res.message || `Transition failed`);
          }
          break;
        }

        case 'command': {
          const res = await ExtendScriptBridge.executeCommand(
            item.actionPayload.commandId,
            item.actionPayload.commandName || item.name
          );
          if (res.success) {
            addNotification('success', res.message || `Executed ${item.name}`);
          } else {
            addNotification('warning', res.message || `Command failed`);
          }
          break;
        }

        case 'macro': {
          if (item.actionPayload.macroSteps) {
            addNotification('info', `Running Macro: ${item.name}...`);
            const res = await MacroEngineService.executeMacro(item.actionPayload.macroSteps);
            if (res.success) {
              addNotification('success', `Macro Completed!`, res.message);
            } else {
              addNotification('error', `Macro Execution Failed`);
            }
          }
          break;
        }

        case 'motion_preset': {
          if (item.actionPayload.presetType) {
            const res = await ExtendScriptBridge.applyMotionPreset(item.actionPayload.presetType);
            if (res.success) {
              addNotification('success', `Applied Motion Preset: ${item.name}`);
            }
          }
          break;
        }

        case 'import_media_xml': {
          addNotification('info', 'Scanning directory for matching XML sequence...');
          const res = await ExtendScriptBridge.importMediaXml();
          if (res.success) {
            addNotification('success', res.message || 'Imported XML sequence successfully!');
          } else {
            addNotification('error', res.message || 'Failed to import XML sequence');
          }
          break;
        }

        default:
          addNotification('info', `Executed: ${item.name}`);
          break;
      }
    },
    [refreshIndex]
  );

  // Keyboard navigation shortcuts
  const keyHandlers = {
    onArrowDown: () => {
      if (results.length === 0) return;
      setSelectedIndex((prev) => (prev + 1) % results.length);
    },
    onArrowUp: () => {
      if (results.length === 0) return;
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    },
    onEnter: () => {
      const active = results[selectedIndex];
      if (active) handleExecuteItem(active, false);
    },
    onCtrlEnter: () => {
      const active = results[selectedIndex];
      if (active) handleExecuteItem(active, true);
    },
    onShiftEnter: () => {
      setShowSettings(true);
    },
    onAltEnter: () => {
      setShowPreview((prev) => !prev);
    },
    onTab: () => {
      const active = results[selectedIndex];
      if (active) {
        setQuery(active.name);
      }
    },
    onEscape: () => {
      if (showSettings) setShowSettings(false);
      else if (showMacroBuilder) setShowMacroBuilder(false);
      else if (showCheatSheet) setShowCheatSheet(false);
      else setQuery('');
    },
  };

  useKeyboardNav(keyHandlers, !showSettings && !showMacroBuilder && !showCheatSheet);

  return (
    <div className={`w-full h-full min-h-full overflow-hidden theme-${settings.theme}`}>
      <CommandPalette
        query={query}
        setQuery={setQuery}
        category={category}
        setCategory={setCategory}
        results={results}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
        searchLatencyMs={searchLatencyMs}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((prev) => !prev)}
        onExecuteItem={handleExecuteItem}
        onToggleFavorite={handleToggleFavorite}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMacroBuilder={() => setShowMacroBuilder(true)}
        onOpenCheatSheet={() => setShowCheatSheet(true)}
        onLocateXml={async () => {
          const res = await ExtendScriptBridge.locateXmlFile();
          if (res.success) addNotification('success', res.message || 'Located XML');
          else addNotification('error', res.message || 'Failed to locate XML');
        }}
        onSetIn={async () => {
          const res = await ExtendScriptBridge.setInPoint();
          if (res.success) addNotification('success', res.message || 'In Point Set');
          else addNotification('error', res.message || 'Failed to set In Point');
        }}
        onSetOut={async () => {
          const res = await ExtendScriptBridge.setOutPoint();
          if (res.success) addNotification('success', res.message || 'Out Point Set');
          else addNotification('error', res.message || 'Failed to set Out Point');
        }}
        onExportToEncoder={async () => {
          const res = await ExtendScriptBridge.exportToEncoder();
          if (res.success) addNotification('success', res.message || 'Exported to Encoder');
          else addNotification('error', res.message || 'Failed to export');
        }}
        onDistributeNikah={async () => {
          const res = await ExtendScriptBridge.distributeNikahGroupPhoto();
          if (res.success) addNotification('success', res.message || 'Distributed successfully');
          else addNotification('error', res.message || 'Failed to distribute');
        }}
      />

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => {
            setSettings(updated);
            refreshIndex();
          }}
        />
      )}

      {showMacroBuilder && (
        <MacroBuilder
          onClose={() => setShowMacroBuilder(false)}
          onMacroSaved={() => {
            refreshIndex();
            addNotification('success', 'Custom Macro Saved!');
          }}
        />
      )}

      {showCheatSheet && <CheatSheetModal onClose={() => setShowCheatSheet(false)} />}

      <NotificationToast
        notifications={notifications}
        onDismiss={(id) => setNotifications((prev) => prev.filter((n) => n.id !== id))}
      />
    </div>
  );
};

export default App;
