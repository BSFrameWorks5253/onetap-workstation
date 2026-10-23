import { SearchResultItem } from '../types';

export const MOTION_PRESETS: SearchResultItem[] = [
  {
    id: 'mp_zoom_in',
    name: 'Dynamic Zoom In (120%)',
    category: 'Motion Presets',
    subcategory: 'Scale Animations',
    description: 'Smooth scale punch from 100% to 120% for emphasizing dialogue or cuts.',
    icon: 'ZoomIn',
    keywords: ['zoom in', 'punch in', 'scale', 'motion', 'emphasis', 'crop zoom'],
    actionType: 'motion_preset',
    actionPayload: { presetType: 'zoom_in' }
  },
  {
    id: 'mp_zoom_out',
    name: 'Smooth Zoom Out (80%)',
    category: 'Motion Presets',
    subcategory: 'Scale Animations',
    description: 'Gradual pull back scale animation.',
    icon: 'ZoomOut',
    keywords: ['zoom out', 'scale down', 'pull back', 'motion'],
    actionType: 'motion_preset',
    actionPayload: { presetType: 'zoom_out' }
  },
  {
    id: 'mp_push_left',
    name: 'Whip Push Left',
    category: 'Motion Presets',
    subcategory: 'Position Animations',
    description: 'Fast horizontal position whip transition to the left.',
    icon: 'ArrowLeft',
    keywords: ['push', 'whip', 'slide left', 'pan', 'motion'],
    actionType: 'motion_preset',
    actionPayload: { presetType: 'push_left' }
  },
  {
    id: 'mp_parallax_slide',
    name: 'Parallax Depth Slide',
    category: 'Motion Presets',
    subcategory: '3D Motion',
    description: 'Simulates multi-plane depth motion for graphics and B-roll.',
    icon: 'Layers',
    keywords: ['parallax', 'depth', '3d', 'slide', 'b-roll', 'motion'],
    actionType: 'motion_preset',
    actionPayload: { presetType: 'parallax_slide' }
  },
  {
    id: 'mp_bounce_in',
    name: 'Elastic Bounce In',
    category: 'Motion Presets',
    subcategory: 'Pop Animations',
    description: 'Playful elastic scale spring animation for logos, text, or elements.',
    icon: 'Sparkle',
    keywords: ['bounce', 'elastic', 'spring', 'pop in', 'text motion'],
    actionType: 'motion_preset',
    actionPayload: { presetType: 'bounce_in' }
  }
];
