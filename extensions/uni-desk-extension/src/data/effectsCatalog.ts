import { SearchResultItem } from '../types';

export const EFFECTS_CATALOG: SearchResultItem[] = [
  // --- Video Effects ---
  {
    id: 'fx_gaussian_blur',
    name: 'Gaussian Blur',
    category: 'Video Effects',
    subcategory: 'Blur & Sharpen',
    description: 'Smoothly blurs the image and reduces detail.',
    icon: 'Sparkles',
    keywords: ['blur', 'soften', 'gaussian', 'out of focus', 'defocus'],
    actionType: 'effect',
    actionPayload: { effectName: 'Gaussian Blur' }
  },
  {
    id: 'fx_directional_blur',
    name: 'Directional Blur',
    category: 'Video Effects',
    subcategory: 'Blur & Sharpen',
    description: 'Blurs image along a specific angle to mimic motion.',
    icon: 'MoveRight',
    keywords: ['blur', 'directional', 'motion blur', 'speed', 'streak'],
    actionType: 'effect',
    actionPayload: { effectName: 'Directional Blur' }
  },
  {
    id: 'fx_camera_blur',
    name: 'Camera Blur',
    category: 'Video Effects',
    subcategory: 'Blur & Sharpen',
    description: 'Simulates camera lens defocusing with bokeh controls.',
    icon: 'Camera',
    keywords: ['blur', 'camera', 'bokeh', 'lens', 'depth of field'],
    actionType: 'effect',
    actionPayload: { effectName: 'Camera Blur' }
  },
  {
    id: 'fx_lumetri_color',
    name: 'Lumetri Color',
    category: 'Video Effects',
    subcategory: 'Color Correction',
    description: 'Professional grade color grading tool with wheels, curves, and HSL.',
    icon: 'Palette',
    keywords: ['color', 'lumetri', 'grade', 'lut', 'tint', 'contrast', 'exposure', 'hue'],
    shortcut: 'Shift + 1',
    actionType: 'effect',
    actionPayload: { effectName: 'Lumetri Color' }
  },
  {
    id: 'fx_rgb_curves',
    name: 'RGB Curves',
    category: 'Video Effects',
    subcategory: 'Color Correction',
    description: 'Adjust tonal values and individual color channel curves.',
    icon: 'Activity',
    keywords: ['color', 'curves', 'rgb', 'contrast', 'levels'],
    actionType: 'effect',
    actionPayload: { effectName: 'RGB Curves' }
  },
  {
    id: 'fx_ultra_key',
    name: 'Ultra Key',
    category: 'Video Effects',
    subcategory: 'Keying',
    description: 'High performance green screen and chroma key extraction tool.',
    icon: 'ShieldAlert',
    keywords: ['key', 'green screen', 'chroma key', 'alpha', 'transparency', 'ultra'],
    actionType: 'effect',
    actionPayload: { effectName: 'Ultra Key' }
  },
  {
    id: 'fx_transform',
    name: 'Transform',
    category: 'Video Effects',
    subcategory: 'Distort',
    description: 'Advanced position, scale, rotation, skew, and shutter angle motion.',
    icon: 'Maximize2',
    keywords: ['transform', 'scale', 'position', 'zoom', 'skew', 'shutter angle'],
    actionType: 'effect',
    actionPayload: { effectName: 'Transform' }
  },
  {
    id: 'fx_sharpen',
    name: 'Sharpen',
    category: 'Video Effects',
    subcategory: 'Blur & Sharpen',
    description: 'Enhances edge clarity and image crispness.',
    icon: 'Zap',
    keywords: ['sharpen', 'crisp', 'detail', 'edge', 'clarity'],
    actionType: 'effect',
    actionPayload: { effectName: 'Sharpen' }
  },
  {
    id: 'fx_crop',
    name: 'Crop',
    category: 'Video Effects',
    subcategory: 'Transform',
    description: 'Trims top, bottom, left, or right edges of footage.',
    icon: 'Crop',
    keywords: ['crop', 'trim', 'letterbox', 'widescreen', 'bars'],
    actionType: 'effect',
    actionPayload: { effectName: 'Crop' }
  },
  {
    id: 'fx_vignette',
    name: 'Vignette',
    category: 'Video Effects',
    subcategory: 'Stylize',
    description: 'Darkens or lightens the outer edges of the frame.',
    icon: 'Circle',
    keywords: ['vignette', 'darken edges', 'cinematic', 'focus'],
    actionType: 'effect',
    actionPayload: { effectName: 'Vignette' }
  },

  // --- Audio Effects ---
  {
    id: 'fx_audio_gain',
    name: 'Audio Gain',
    category: 'Audio Effects',
    subcategory: 'Amplitude',
    description: 'Adjust overall loudness level or normalize peaks.',
    icon: 'Volume2',
    keywords: ['audio', 'gain', 'volume', 'loudness', 'decibels', 'normalize', 'db'],
    shortcut: 'G',
    actionType: 'audio_effect',
    actionPayload: { effectName: 'Gain', commandId: '1027' }
  },
  {
    id: 'fx_parametric_eq',
    name: 'Parametric Equalizer',
    category: 'Audio Effects',
    subcategory: 'Filter & EQ',
    description: 'Multi-band parametric frequency control for clean voice and music.',
    icon: 'Sliders',
    keywords: ['audio', 'eq', 'equalizer', 'parametric', 'bass', 'treble', 'vocal'],
    actionType: 'audio_effect',
    actionPayload: { effectName: 'Parametric Equalizer' }
  },
  {
    id: 'fx_compressor',
    name: 'Single-band Compressor',
    category: 'Audio Effects',
    subcategory: 'Amplitude',
    description: 'Evens out dynamic range and controls volume spikes.',
    icon: 'BarChart2',
    keywords: ['audio', 'compressor', 'dynamic range', 'leveler', 'voice'],
    actionType: 'audio_effect',
    actionPayload: { effectName: 'Single-band Compressor' }
  },
  {
    id: 'fx_limiter',
    name: 'Hard Limiter',
    category: 'Audio Effects',
    subcategory: 'Amplitude',
    description: 'Prevents audio clipping by enforcing a strict peak ceiling.',
    icon: 'Shield',
    keywords: ['audio', 'limiter', 'clip', 'peak', 'ceiling', 'distortion'],
    actionType: 'audio_effect',
    actionPayload: { effectName: 'Hard Limiter' }
  },
  {
    id: 'fx_denoise',
    name: 'DeNoise',
    category: 'Audio Effects',
    subcategory: 'Noise Reduction',
    description: 'AI powered reduction of background room noise and hum.',
    icon: 'MicOff',
    keywords: ['audio', 'denoise', 'noise reduction', 'hum', 'hiss', 'clean voice'],
    actionType: 'audio_effect',
    actionPayload: { effectName: 'DeNoise' }
  },

  // --- Transitions ---
  {
    id: 'tr_cross_dissolve',
    name: 'Cross Dissolve',
    category: 'Transitions',
    subcategory: 'Dissolve',
    description: 'Standard smooth cross-fade transition between two video clips.',
    icon: 'Layers',
    keywords: ['transition', 'cross dissolve', 'fade', 'dissolve', 'blend'],
    shortcut: 'Ctrl + D',
    actionType: 'transition',
    actionPayload: { transitionName: 'Cross Dissolve' }
  },
  {
    id: 'tr_dip_to_black',
    name: 'Dip to Black',
    category: 'Transitions',
    subcategory: 'Dissolve',
    description: 'Fades the end of clip A to black before fading up clip B.',
    icon: 'Moon',
    keywords: ['transition', 'dip to black', 'black fade', 'scene end'],
    actionType: 'transition',
    actionPayload: { transitionName: 'Dip to Black' }
  },
  {
    id: 'tr_dip_to_white',
    name: 'Dip to White',
    category: 'Transitions',
    subcategory: 'Dissolve',
    description: 'Fades through a bright white flash transition.',
    icon: 'Sun',
    keywords: ['transition', 'dip to white', 'flash', 'bright'],
    actionType: 'transition',
    actionPayload: { transitionName: 'Dip to White' }
  },
  {
    id: 'tr_push',
    name: 'Push Transition',
    category: 'Transitions',
    subcategory: 'Slide',
    description: 'Pushes the current clip off screen with incoming clip.',
    icon: 'ArrowRightCircle',
    keywords: ['transition', 'push', 'slide', 'swipe', 'move'],
    actionType: 'transition',
    actionPayload: { transitionName: 'Push' }
  },
  {
    id: 'tr_constant_power',
    name: 'Constant Power Audio Fade',
    category: 'Transitions',
    subcategory: 'Audio Transitions',
    description: 'Smooth equal power audio crossfade.',
    icon: 'VolumeX',
    keywords: ['audio transition', 'constant power', 'audio fade', 'crossfade'],
    shortcut: 'Ctrl + Shift + D',
    actionType: 'transition',
    actionPayload: { transitionName: 'Constant Power' }
  },

  // --- Third Party Plugins ---
  {
    id: 'pl_borisfx_bcc',
    name: 'Boris FX Continuum',
    category: 'Plugins',
    subcategory: 'Boris FX',
    description: 'Comprehensive suite of 3D objects, lights, particles & blurs.',
    icon: 'Box',
    keywords: ['plugin', 'boris', 'bcc', 'continuum', 'vfx', '3d'],
    plugin: 'Boris FX',
    actionType: 'effect',
    actionPayload: { effectName: 'BCC Lens Blur' }
  },
  {
    id: 'pl_redgiant_universe',
    name: 'Red Giant Universe',
    category: 'Plugins',
    subcategory: 'Red Giant',
    description: 'Glows, retro VHS textures, chromatic aberration, and generators.',
    icon: 'Globe',
    keywords: ['plugin', 'red giant', 'universe', 'vhs', 'glow', 'aberration'],
    plugin: 'Red Giant',
    actionType: 'effect',
    actionPayload: { effectName: 'Uni.Glow' }
  },
  {
    id: 'pl_sapphire_glow',
    name: 'Sapphire Glow (S_Glow)',
    category: 'Plugins',
    subcategory: 'Sapphire',
    description: 'Industry standard photorealistic optical lens glow.',
    icon: 'SunMedium',
    keywords: ['plugin', 'sapphire', 's_glow', 'genarts', 'glow', 'lens'],
    plugin: 'Sapphire',
    actionType: 'effect',
    actionPayload: { effectName: 'S_Glow' }
  },
  {
    id: 'pl_filmconvert',
    name: 'FilmConvert Nitrate',
    category: 'Plugins',
    subcategory: 'FilmConvert',
    description: 'Authentic 35mm / 16mm film stock emulation and grain.',
    icon: 'Film',
    keywords: ['plugin', 'filmconvert', 'nitrate', 'grain', '35mm', 'emulation'],
    plugin: 'FilmConvert',
    actionType: 'effect',
    actionPayload: { effectName: 'FilmConvert Nitrate' }
  }
];
