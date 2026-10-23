import { MacroStep } from '../types';
import { ExtendScriptBridge, ExtendScriptResult } from './extendScriptBridge';

export class MacroEngineService {
  /**
   * Run a multi-step macro sequentially
   */
  public static async executeMacro(
    steps: MacroStep[],
    onProgress?: (currentStep: number, total: number, stepTitle: string) => void
  ): Promise<ExtendScriptResult> {
    const total = steps.length;
    let completedCount = 0;

    for (let i = 0; i < total; i++) {
      const step = steps[i];
      if (onProgress) {
        onProgress(i + 1, total, step.title);
      }

      try {
        let res: ExtendScriptResult;
        switch (step.type) {
          case 'effect':
            if (step.payload.effectName) {
              res = await ExtendScriptBridge.applyEffect(step.payload.effectName, false);
            }
            break;

          case 'command':
            res = await ExtendScriptBridge.executeCommand(step.payload.commandId, step.payload.commandName);
            break;

          case 'motion_preset':
            if (step.payload.presetType) {
              res = await ExtendScriptBridge.applyMotionPreset(step.payload.presetType);
            }
            break;

          case 'marker':
            res = await ExtendScriptBridge.evalScript('UNIDESK.addMarkerAtPlayhead()');
            break;

          default:
            break;
        }
        completedCount++;
      } catch (err) {
        console.error(`Macro step ${step.title} failed:`, err);
      }

      // Small async delay between steps to prevent GUI freeze
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    return {
      success: completedCount > 0,
      message: `Macro finished: Executed ${completedCount}/${total} step(s).`,
      count: completedCount,
    };
  }
}
