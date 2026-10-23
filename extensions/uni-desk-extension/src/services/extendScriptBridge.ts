import { NotificationPayload } from '../types';

declare global {
  interface Window {
    CSInterface: any;
    __adobe_cep__: any;
  }
}

export interface ExtendScriptResult {
  success: boolean;
  message?: string;
  code?: string;
  count?: number;
  data?: any;
  plugins?: string[];
}

export class ExtendScriptBridge {
  private static csInterface: any = null;

  public static getCSInterface(): any {
    if (!this.csInterface) {
      if (typeof window !== 'undefined' && window.CSInterface) {
        this.csInterface = new window.CSInterface();
      } else {
        // Fallback mock object
        this.csInterface = {
          evalScript: (script: string, callback: (res: string) => void) => {
            console.log('[Dev ExtendScript Mock Call]:', script);
            setTimeout(() => {
              if (script.includes('applyEffect')) {
                callback(JSON.stringify({ success: true, message: 'Applied effect in Dev Mode.', count: 1 }));
              } else if (script.includes('executeCommand')) {
                callback(JSON.stringify({ success: true, message: 'Command executed in Dev Mode.' }));
              } else {
                callback(JSON.stringify({ success: true, message: 'Executed ExtendScript mock.' }));
              }
            }, 30);
          },
        };
      }
    }
    return this.csInterface;
  }

  /**
   * Evaluate raw JSX script string and return Promise<ExtendScriptResult>
   */
  public static evalScript(scriptString: string): Promise<ExtendScriptResult> {
    return new Promise((resolve) => {
      const cs = this.getCSInterface();
      cs.evalScript(scriptString, (resultStr: string) => {
        try {
          const parsed = JSON.parse(resultStr);
          resolve(parsed);
        } catch (e) {
          resolve({
            success: true,
            message: resultStr || 'Executed ExtendScript callback.',
          });
        }
      });
    });
  }

  /**
   * Apply video or audio effect
   */
  public static async applyEffect(effectName: string, applyToAll: boolean = false): Promise<ExtendScriptResult> {
    const escaped = effectName.replace(/'/g, "\\'");
    const jsxCall = `UNIDESK.applyEffect('${escaped}', ${applyToAll ? 'true' : 'false'})`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Apply transition
   */
  public static async applyTransition(transitionName: string, durationFrames: number = 30): Promise<ExtendScriptResult> {
    const escaped = transitionName.replace(/'/g, "\\'");
    const jsxCall = `UNIDESK.applyTransition('${escaped}', ${durationFrames})`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Execute Premiere Command
   */
  public static async executeCommand(commandId?: string, commandName?: string): Promise<ExtendScriptResult> {
    const cid = commandId ? `'${commandId}'` : 'null';
    const cname = commandName ? `'${commandName.replace(/'/g, "\\'")}'` : 'null';
    const jsxCall = `UNIDESK.executeCommand(${cid}, ${cname})`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Apply Motion Preset
   */
  public static async applyMotionPreset(presetType: string): Promise<ExtendScriptResult> {
    const jsxCall = `UNIDESK.applyMotionPreset('${presetType}')`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Scan project items and bins
   */
  public static async scanProjectAssets(): Promise<any[]> {
    const jsxCall = `UNIDESK.scanProjectAssets()`;
    const res = await this.evalScript(jsxCall);
    if (res && Array.isArray(res)) return res;
    return [];
  }

  /**
   * Detect installed third-party plugins
   */
  public static async detectPlugins(): Promise<string[]> {
    const jsxCall = `UNIDESK.detectPlugins()`;
    const res = await this.evalScript(jsxCall);
    if (res && res.plugins) return res.plugins;
    return [];
  }

  /**
   * Import matching XML sequence and open in Timeline
   */
  public static async importMediaXml(): Promise<ExtendScriptResult> {
    const jsxCall = `UNIDESK.importMediaXml()`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Set In Point with fullscreen feedback
   */
  public static async setInPoint(): Promise<ExtendScriptResult> {
    const jsxCall = `UNIDESK.setInPoint()`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Set Out Point with fullscreen feedback
   */
  public static async setOutPoint(): Promise<ExtendScriptResult> {
    const jsxCall = `UNIDESK.setOutPoint()`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Export to Adobe Media Encoder
   */
  public static async exportToEncoder(): Promise<ExtendScriptResult> {
    const jsxCall = `UNIDESK.exportToEncoder()`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Open project folder in Windows Explorer at XML file location
   */
  public static async locateXmlFile(): Promise<ExtendScriptResult> {
    const jsxCall = `UNIDESK.locateXmlFile()`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Distribute Nikah Group Photo clip to all N marker clips
   */
  public static async distributeNikahGroupPhoto(): Promise<ExtendScriptResult> {
    const jsxCall = `UNIDESK.distributeNikahGroupPhoto()`;
    return await this.evalScript(jsxCall);
  }

  /**
   * Scan active sequence for GROUP_PHOTO_N markers and N-prefix markers
   * Returns raw pipe-delimited string for parsing
   */
  public static async groupPhotoInserterScan(): Promise<ExtendScriptResult> {
    const jsxCall = `$.runScript.groupPhotoInserterScan()`;
    const res = await this.evalScript(jsxCall);
    // Wrap raw string in a result object
    return { success: (typeof res === 'string' ? (res as string) : res.message || '').indexOf('SUCCESS') === 0, message: typeof res === 'string' ? res as string : res.message, data: res };
  }

  /**
   * Preview (dry-run) the planned group photo insertions
   * @param assignmentsStr e.g. "1,1,15;2,16,20"
   */
  public static async groupPhotoInserterPreview(assignmentsStr: string): Promise<ExtendScriptResult> {
    const escaped = assignmentsStr.replace(/'/g, "\\'");
    const jsxCall = `$.runScript.groupPhotoInserterPreview('${escaped}')`;
    const res = await this.evalScript(jsxCall);
    return { success: (typeof res === 'string' ? (res as string) : res.message || '').indexOf('SUCCESS') === 0, message: typeof res === 'string' ? res as string : res.message, data: res };
  }

  /**
   * Execute group photo insertions with ripple editing
   * @param assignmentsStr e.g. "1,1,15;2,16,20"
   */
  public static async groupPhotoInserterExecute(assignmentsStr: string): Promise<ExtendScriptResult> {
    const escaped = assignmentsStr.replace(/'/g, "\\'");
    const jsxCall = `$.runScript.groupPhotoInserterExecute('${escaped}')`;
    const res = await this.evalScript(jsxCall);
    return { success: (typeof res === 'string' ? (res as string) : res.message || '').indexOf('SUCCESS') === 0, message: typeof res === 'string' ? res as string : res.message, data: res };
  }
}
