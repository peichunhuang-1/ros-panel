import * as vscode from 'vscode';
import { Ros2UiPanel } from './panel';
import { ServerManager } from './serverManager';

let serverManager: ServerManager | undefined;

export function activate(context: vscode.ExtensionContext) {
  serverManager = new ServerManager(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('ros2UiGenerator.open', () => {
      Ros2UiPanel.createOrShow(context);
    }),
    vscode.commands.registerCommand('ros2UiGenerator.startServer', async () => {
      await serverManager!.start();
    }),
  );

  const config = vscode.workspace.getConfiguration('ros2UiGenerator');
  if (config.get<boolean>('autoStartServer')) {
    serverManager.start().catch(() => {});
  }
}

export function deactivate() {
  serverManager?.stop();
}
