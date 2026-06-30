import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export class ServerManager {
  private process: cp.ChildProcess | undefined;
  private outputChannel: vscode.OutputChannel;

  constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('ROS2 UI Generator Server');
    context.subscriptions.push(this.outputChannel);
  }

  async start(): Promise<void> {
    const config = vscode.workspace.getConfiguration('ros2UiGenerator');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');

    if (await this.isReachable(serverUrl)) {
      vscode.window.showInformationMessage(`ROS2 server already running at ${serverUrl}`);
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      vscode.window.showErrorMessage('Open a workspace folder before starting the server.');
      return;
    }

    // Look for ros-panel or a package with a bin/server.js
    const candidates = [
      path.join(workspaceFolders[0].uri.fsPath, 'bin', 'server.js'),
      path.join(workspaceFolders[0].uri.fsPath, 'node_modules', 'ros-panel', 'bin', 'server.js'),
      path.join(this.context.extensionPath, '..', 'bin', 'server.js'),
    ];

    const serverScript = candidates.find((p) => {
      try { require('fs').accessSync(p); return true; } catch { return false; }
    });

    if (!serverScript) {
      vscode.window.showErrorMessage(
        'Cannot find ros-panel server script. Install ros-panel and ensure bin/server.js exists.',
      );
      return;
    }

    this.outputChannel.show();
    this.outputChannel.appendLine(`Starting server: node ${serverScript}`);

    this.process = cp.spawn('node', [serverScript], {
      cwd: workspaceFolders[0].uri.fsPath,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (d) => this.outputChannel.append(d.toString()));
    this.process.stderr?.on('data', (d) => this.outputChannel.append(d.toString()));
    this.process.on('exit', (code) => {
      this.outputChannel.appendLine(`Server exited with code ${code}`);
      this.process = undefined;
    });

    // Wait up to 5s for server to become ready
    for (let i = 0; i < 10; i++) {
      await delay(500);
      if (await this.isReachable(serverUrl)) {
        vscode.window.showInformationMessage(`ROS2 server started at ${serverUrl}`);
        return;
      }
    }
    vscode.window.showWarningMessage('Server started but not yet reachable. Check the output channel.');
  }

  stop(): void {
    this.process?.kill();
    this.process = undefined;
  }

  private isReachable(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const mod = url.startsWith('https') ? https : http;
      const req = mod.get(`${url}/nodes`, { timeout: 1500 }, (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
