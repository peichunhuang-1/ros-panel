import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { getWebviewContent } from './webview/template';

export class Ros2UiPanel {
  static currentPanel: Ros2UiPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;

    if (Ros2UiPanel.currentPanel) {
      Ros2UiPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'ros2UiGenerator',
      'ROS2 UI Generator',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'out'),
        ],
      },
    );

    Ros2UiPanel.currentPanel = new Ros2UiPanel(panel, context);
  }

  private constructor(panel: vscode.WebviewPanel, private context: vscode.ExtensionContext) {
    this.panel = panel;
    this.panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Push config update when settings change
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ros2UiGenerator')) {
        this.sendConfig();
      }
    }, null, this.disposables);
  }

  private sendConfig() {
    const config = vscode.workspace.getConfiguration('ros2UiGenerator');
    this.panel.webview.postMessage({
      type: 'config',
      serverUrl: config.get<string>('serverUrl', 'http://localhost:3000'),
      model: config.get<string>('claudeModel', 'claude-sonnet-4-6'),
      hasApiKey: !!config.get<string>('claudeApiKey', ''),
    });
  }

  private async handleMessage(msg: { command: string; [key: string]: unknown }) {
    switch (msg.command) {
      case 'ready':
        this.sendConfig();
        break;

      case 'listSchemas': {
        const config = vscode.workspace.getConfiguration('ros2UiGenerator');
        const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');
        try {
          const data = await fetchJson(`${serverUrl}/schemas/list`);
          this.panel.webview.postMessage({ type: 'schemaList', data });
        } catch (e) {
          this.panel.webview.postMessage({ type: 'error', message: `Cannot reach server: ${(e as Error).message}` });
        }
        break;
      }

      case 'getSchema': {
        const config = vscode.workspace.getConfiguration('ros2UiGenerator');
        const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');
        const { schemaType, pkg, name } = msg as { command: string; schemaType: string; pkg: string; name: string };
        try {
          const data = await fetchJson(`${serverUrl}/schemas/get?type=${schemaType}&pkg=${encodeURIComponent(pkg)}&name=${encodeURIComponent(name)}`);
          this.panel.webview.postMessage({ type: 'schema', data, schemaType, pkg, name });
        } catch (e) {
          this.panel.webview.postMessage({ type: 'error', message: `Schema fetch failed: ${(e as Error).message}` });
        }
        break;
      }

      case 'generateUi': {
        await this.generateUi(msg as unknown as GenerateUiRequest);
        break;
      }

      case 'saveFile': {
        await this.saveFile(msg as { command: string; content: string; defaultName: string });
        break;
      }
    }
  }

  private async generateUi(req: GenerateUiRequest) {
    const config = vscode.workspace.getConfiguration('ros2UiGenerator');
    const apiKey = config.get<string>('claudeApiKey', '');
    const model  = config.get<string>('claudeModel', 'claude-sonnet-4-6');

    if (!apiKey) {
      this.panel.webview.postMessage({
        type: 'chatResponse',
        role: 'assistant',
        content: 'No API key configured. Set `ros2UiGenerator.claudeApiKey` in VS Code settings.',
      });
      return;
    }

    const systemPrompt = buildSystemPrompt();
    const userContent  = buildUserPrompt(req);

    this.panel.webview.postMessage({ type: 'chatResponseStart' });

    try {
      await streamClaude({ apiKey, model, systemPrompt, userContent }, (chunk) => {
        this.panel.webview.postMessage({ type: 'chatChunk', chunk });
      });
      this.panel.webview.postMessage({ type: 'chatResponseEnd' });
    } catch (e) {
      this.panel.webview.postMessage({ type: 'chatResponseEnd', error: (e as Error).message });
    }
  }

  private async saveFile(msg: { command: string; content: string; defaultName: string }) {
    const uri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(msg.defaultName),
      filters: { 'HTML files': ['html'], 'All files': ['*'] },
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(msg.content, 'utf-8'));
      vscode.window.showInformationMessage(`Saved to ${uri.fsPath}`);
    }
  }

  dispose() {
    Ros2UiPanel.currentPanel = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}

// ---------------------------------------------------------------------------
// Claude streaming
// ---------------------------------------------------------------------------

interface StreamOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userContent: string;
}

function streamClaude(opts: StreamOptions, onChunk: (text: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: opts.model,
      max_tokens: 8192,
      stream: true,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userContent }],
    });

    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let buf = '';
        res.on('data', (chunk: Buffer) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;
            try {
              const event = JSON.parse(raw);
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                onChunk(event.delta.text);
              }
            } catch { /* ignore parse errors */ }
          }
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Claude API returned ${res.statusCode}`));
          } else {
            resolve();
          }
        });
        res.on('error', reject);
      },
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

interface GenerateUiRequest {
  command: string;
  schema: unknown;
  schemaType: string;
  pkg: string;
  name: string;
  mode: 'input' | 'output';
  width: string;
  height: string;
  theme: string;
  userMessage: string;
  history: Array<{ role: string; content: string }>;
}

function buildSystemPrompt(): string {
  return `You are an expert web developer specializing in ROS2 tooling UIs.
Your task is to generate self-contained HTML files (with embedded CSS and JavaScript) that serve as custom UI panels for ROS2 message types.

When the user provides a JSON schema for a ROS2 msg/srv/action and configuration options, output a complete, runnable HTML file.

Guidelines:
- Output a single HTML file with all CSS and JS embedded (no external dependencies unless CDN links to common libs like tailwind or alpine.js).
- For INPUT mode: render form fields for each schema property so the user can fill in values and see the resulting JSON.
- For OUTPUT mode: render a display panel that accepts a JSON payload via a postMessage or a global \`updateData(json)\` function and displays it nicely.
- For services (with request/response), show both sides appropriately.
- For actions (goal/result/feedback), use tabs or sections.
- Use clean, modern styling. Respect the width/height hints provided (use them as the container size via CSS).
- The HTML should work standalone in a browser iframe or WebView.
- When generating an input form, include a "Copy JSON" button that puts the current form values as JSON into the clipboard.
- When the user asks for modifications or improvements, output the updated full HTML.
- Wrap the final HTML in a fenced code block labeled \`\`\`html ... \`\`\`.`;
}

function buildUserPrompt(req: GenerateUiRequest): string {
  const lines: string[] = [];

  if (req.history.length === 0) {
    lines.push(`Generate a ${req.mode.toUpperCase()} UI panel for the following ROS2 ${req.schemaType}:`);
    lines.push(`Package: ${req.pkg}`);
    lines.push(`Name: ${req.name}`);
    lines.push(`Schema (JSON):\n\`\`\`json\n${JSON.stringify(req.schema, null, 2)}\n\`\`\``);
    lines.push(`\nConfiguration:`);
    lines.push(`- Mode: ${req.mode} (${req.mode === 'input' ? 'user fills in values' : 'display incoming data'})`);
    lines.push(`- Width: ${req.width}`);
    lines.push(`- Height: ${req.height}`);
    lines.push(`- Theme: ${req.theme}`);
  }

  if (req.userMessage) {
    lines.push(req.userMessage);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}
