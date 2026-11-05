import { ipcMain } from 'electron';
import {
  getBridgeNodeStatus,
  runPreflightForExternalKey,
  executeRemoteRenderCommand,
  RemoteRenderCommand
} from '../core/anyshareBridge';

export function registerAnyShareIPC() {
  ipcMain.handle('anyshare:get-status', async () => {
    return getBridgeNodeStatus();
  });

  ipcMain.handle('anyshare:run-preflight', async (_event, externalKey: string) => {
    return runPreflightForExternalKey(externalKey);
  });

  ipcMain.handle('anyshare:execute-command', async (_event, cmd: RemoteRenderCommand) => {
    return executeRemoteRenderCommand(cmd);
  });
}
