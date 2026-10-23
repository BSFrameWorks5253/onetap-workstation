import { Macro, SearchResultItem } from '../types';

export const DEFAULT_MACROS: Macro[] = [
  {
    id: 'macro_cinematic_look',
    name: 'Cinematic Grade & Vignette',
    description: 'Applies Lumetri Color + Vignette + Sharpen + Adds marker at selection in one click.',
    steps: [
      {
        id: 'step_1',
        type: 'effect',
        title: 'Apply Lumetri Color',
        payload: { effectName: 'Lumetri Color' }
      },
      {
        id: 'step_2',
        type: 'effect',
        title: 'Apply Vignette',
        payload: { effectName: 'Vignette' }
      },
      {
        id: 'step_3',
        type: 'effect',
        title: 'Apply Sharpen',
        payload: { effectName: 'Sharpen' }
      },
      {
        id: 'step_4',
        type: 'marker',
        title: 'Add Grade Marker',
        payload: { markerComment: 'Graded via Uni_Desk Macro' }
      }
    ]
  },
  {
    id: 'macro_clean_dialogue',
    name: 'Vocal Cleanup Stack',
    description: 'Applies DeNoise + Parametric Equalizer + Hard Limiter to audio clip.',
    steps: [
      {
        id: 'step_1',
        type: 'effect',
        title: 'Apply DeNoise',
        payload: { effectName: 'DeNoise' }
      },
      {
        id: 'step_2',
        type: 'effect',
        title: 'Apply Parametric EQ',
        payload: { effectName: 'Parametric Equalizer' }
      },
      {
        id: 'step_3',
        type: 'effect',
        title: 'Apply Hard Limiter',
        payload: { effectName: 'Hard Limiter' }
      }
    ]
  },
  {
    id: 'macro_quick_nest_render',
    name: 'Nest & Render Preview',
    description: 'Nests selected clips and initiates Render In to Out.',
    steps: [
      {
        id: 'step_1',
        type: 'command',
        title: 'Nest Clips',
        payload: { commandId: '1078', commandName: 'Nest' }
      },
      {
        id: 'step_2',
        type: 'command',
        title: 'Render In to Out',
        payload: { commandId: '2206', commandName: 'Render In to Out' }
      }
    ]
  }
];

export const MACRO_SEARCH_ITEMS: SearchResultItem[] = DEFAULT_MACROS.map((m) => ({
  id: `macro_item_${m.id}`,
  name: `⚡ ${m.name}`,
  category: 'Macros',
  description: m.description,
  icon: 'Zap',
  keywords: ['macro', 'workflow', 'automation', 'batch', 'multi', m.name.toLowerCase()],
  actionType: 'macro',
  actionPayload: {
    macroSteps: m.steps
  }
}));
