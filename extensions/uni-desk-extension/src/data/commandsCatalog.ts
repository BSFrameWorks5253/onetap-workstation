import { SearchResultItem } from '../types';

export const COMMANDS_CATALOG: SearchResultItem[] = [
  // --- Premiere Commands ---
  {
    id: 'cmd_undo',
    name: 'Undo Action',
    category: 'Commands',
    subcategory: 'Edit',
    description: 'Revert the last performed editing action.',
    icon: 'Undo2',
    keywords: ['undo', 'revert', 'back', 'step back'],
    shortcut: 'Ctrl + Z',
    actionType: 'command',
    actionPayload: { commandId: '16', commandName: 'Undo' }
  },
  {
    id: 'cmd_redo',
    name: 'Redo Action',
    category: 'Commands',
    subcategory: 'Edit',
    description: 'Reapply the previously undone action.',
    icon: 'Redo2',
    keywords: ['redo', 'reapply', 'forward'],
    shortcut: 'Ctrl + Shift + Z',
    actionType: 'command',
    actionPayload: { commandId: '17', commandName: 'Redo' }
  },
  {
    id: 'cmd_ripple_delete',
    name: 'Ripple Delete',
    category: 'Commands',
    subcategory: 'Edit',
    description: 'Deletes selected clip and closes the gap on the timeline automatically.',
    icon: 'Scissors',
    keywords: ['ripple delete', 'delete', 'close gap', 'cut gap', 'trim'],
    shortcut: 'Shift + Delete',
    actionType: 'command',
    actionPayload: { commandId: '1035', commandName: 'Ripple Delete' }
  },
  {
    id: 'cmd_nest',
    name: 'Nest Selected Clips',
    category: 'Commands',
    subcategory: 'Timeline',
    description: 'Combines selected clips into a nested sequence.',
    icon: 'FolderPlus',
    keywords: ['nest', 'group clips', 'subsequence', 'container', 'nesting'],
    actionType: 'command',
    actionPayload: { commandId: '1078', commandName: 'Nest' }
  },
  {
    id: 'cmd_render_in_out',
    name: 'Render In to Out',
    category: 'Commands',
    subcategory: 'Sequence',
    description: 'Renders video preview files for active timeline In to Out range.',
    icon: 'PlayCircle',
    keywords: ['render', 'preview', 'in to out', 'render preview', 'green bar'],
    shortcut: 'Enter',
    actionType: 'command',
    actionPayload: { commandId: '2206', commandName: 'Render In to Out' }
  },
  {
    id: 'cmd_export_media',
    name: 'Export Media',
    category: 'Commands',
    subcategory: 'File',
    description: 'Open the Media Export Settings modal to render final output.',
    icon: 'Download',
    keywords: ['export', 'render', 'mp4', 'media', 'encode', 'queue'],
    shortcut: 'Ctrl + M',
    actionType: 'command',
    actionPayload: { commandId: '5', commandName: 'Export Media' }
  },
  {
    id: 'cmd_import',
    name: 'Import File / Assets',
    category: 'Commands',
    subcategory: 'File',
    description: 'Import media files into the active project bin.',
    icon: 'FilePlus',
    keywords: ['import', 'add media', 'browse', 'file'],
    shortcut: 'Ctrl + I',
    actionType: 'command',
    actionPayload: { commandId: '3', commandName: 'Import' }
  },
  {
    id: 'cmd_import_media_xml',
    name: 'Import Media Sequence (XML)',
    category: 'Commands',
    subcategory: 'File',
    description: 'Scan project folder for matching XML sequence file, import it and open in timeline.',
    icon: 'FileCode',
    keywords: ['import', 'xml', 'sequence', 'media', 'onetap', 'timeline', 'pproj', 'safar'],
    actionType: 'import_media_xml',
    actionPayload: { commandName: 'Import Media Sequence (XML)' }
  },
  {
    id: 'cmd_save',
    name: 'Save Project',
    category: 'Commands',
    subcategory: 'File',
    description: 'Save current project state to disk.',
    icon: 'Save',
    keywords: ['save', 'project', 'write', 'store'],
    shortcut: 'Ctrl + S',
    actionType: 'command',
    actionPayload: { commandId: '1', commandName: 'Save Project' }
  },
  {
    id: 'cmd_add_marker',
    name: 'Add Timeline Marker',
    category: 'Commands',
    subcategory: 'Marker',
    description: 'Insert a new marker at current playhead position.',
    icon: 'Bookmark',
    keywords: ['marker', 'flag', 'annotation', 'note', 'timestamp'],
    shortcut: 'M',
    actionType: 'command',
    actionPayload: { commandId: '1050', commandName: 'Add Marker' }
  },
  {
    id: 'cmd_create_sequence',
    name: 'New Sequence from Clip',
    category: 'Commands',
    subcategory: 'Sequence',
    description: 'Create a new sequence matching selected clip settings.',
    icon: 'Film',
    keywords: ['new sequence', 'create sequence', 'timeline', 'match clip'],
    actionType: 'command',
    actionPayload: { commandId: '1102', commandName: 'Create Sequence' }
  },

  // --- Tools ---
  {
    id: 'tool_selection',
    name: 'Selection Tool (V)',
    category: 'Tools',
    description: 'Standard cursor tool to select, move, and trim items.',
    icon: 'MousePointer',
    keywords: ['tool', 'selection', 'select', 'pointer', 'v'],
    shortcut: 'V',
    actionType: 'tool',
    actionPayload: { commandId: '2001', commandName: 'Selection Tool' }
  },
  {
    id: 'tool_razor',
    name: 'Razor Tool (C)',
    category: 'Tools',
    description: 'Cut clips at specific points on the timeline.',
    icon: 'Scissors',
    keywords: ['tool', 'razor', 'cut', 'blade', 'split', 'c'],
    shortcut: 'C',
    actionType: 'tool',
    actionPayload: { commandId: '2002', commandName: 'Razor Tool' }
  },
  {
    id: 'tool_track_select',
    name: 'Track Select Forward Tool (A)',
    category: 'Tools',
    description: 'Select all clips forward on tracks.',
    icon: 'ChevronsRight',
    keywords: ['tool', 'track select', 'forward', 'a'],
    shortcut: 'A',
    actionType: 'tool',
    actionPayload: { commandId: '2003', commandName: 'Track Select Forward' }
  },
  {
    id: 'tool_pen',
    name: 'Pen Tool (P)',
    category: 'Tools',
    description: 'Create masks and add opacity or audio keyframes.',
    icon: 'PenTool',
    keywords: ['tool', 'pen', 'draw mask', 'bezier', 'keyframe', 'p'],
    shortcut: 'P',
    actionType: 'tool',
    actionPayload: { commandId: '2004', commandName: 'Pen Tool' }
  },

  // --- Workspaces ---
  {
    id: 'ws_editing',
    name: 'Editing Workspace',
    category: 'Workspaces',
    description: 'Standard layout for timeline trimming and primary editing.',
    icon: 'Layout',
    keywords: ['workspace', 'editing', 'layout', 'panels'],
    actionType: 'workspace',
    actionPayload: { commandName: 'Editing' }
  },
  {
    id: 'ws_color',
    name: 'Color Workspace',
    category: 'Workspaces',
    description: 'Optimized layout with Lumetri Color panel and Scopes.',
    icon: 'Palette',
    keywords: ['workspace', 'color', 'lumetri', 'scopes', 'grading'],
    actionType: 'workspace',
    actionPayload: { commandName: 'Color' }
  },
  {
    id: 'ws_audio',
    name: 'Audio Workspace',
    category: 'Workspaces',
    description: 'Layout tailored for Essential Sound and Audio Track Mixer.',
    icon: 'Headphones',
    keywords: ['workspace', 'audio', 'sound', 'mixer'],
    actionType: 'workspace',
    actionPayload: { commandName: 'Audio' }
  },
  {
    id: 'ws_captions',
    name: 'Captions & Graphics Workspace',
    category: 'Workspaces',
    description: 'Designed for MOGRTs, subtitles, titles, and text editing.',
    icon: 'Type',
    keywords: ['workspace', 'captions', 'graphics', 'titles', 'mogrt', 'subtitles'],
    actionType: 'workspace',
    actionPayload: { commandName: 'Captions & Graphics' }
  }
];
