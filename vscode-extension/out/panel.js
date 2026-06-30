"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ros2UiPanel = void 0;
const vscode = __importStar(require("vscode"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const template_1 = require("./webview/template");
class Ros2UiPanel {
    static createOrShow(context) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
        if (Ros2UiPanel.currentPanel) {
            Ros2UiPanel.currentPanel.panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('ros2UiGenerator', 'ROS2 UI Generator', column, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'out'),
            ],
        });
        Ros2UiPanel.currentPanel = new Ros2UiPanel(panel, context);
    }
    constructor(panel, context) {
        this.context = context;
        this.disposables = [];
        this.panel = panel;
        this.panel.webview.html = (0, template_1.getWebviewContent)(panel.webview, context.extensionUri);
        this.panel.webview.onDidReceiveMessage((msg) => this.handleMessage(msg), null, this.disposables);
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        // Push config update when settings change
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('ros2UiGenerator')) {
                this.sendConfig();
            }
        }, null, this.disposables);
    }
    sendConfig() {
        const config = vscode.workspace.getConfiguration('ros2UiGenerator');
        this.panel.webview.postMessage({
            type: 'config',
            serverUrl: config.get('serverUrl', 'http://localhost:3000'),
            model: config.get('claudeModel', 'claude-sonnet-4-6'),
            hasApiKey: !!config.get('claudeApiKey', ''),
        });
    }
    async handleMessage(msg) {
        switch (msg.command) {
            case 'ready':
                this.sendConfig();
                break;
            case 'listSchemas': {
                const config = vscode.workspace.getConfiguration('ros2UiGenerator');
                const serverUrl = config.get('serverUrl', 'http://localhost:3000');
                try {
                    const data = await fetchJson(`${serverUrl}/schemas/list`);
                    this.panel.webview.postMessage({ type: 'schemaList', data });
                }
                catch (e) {
                    this.panel.webview.postMessage({ type: 'error', message: `Cannot reach server: ${e.message}` });
                }
                break;
            }
            case 'getSchema': {
                const config = vscode.workspace.getConfiguration('ros2UiGenerator');
                const serverUrl = config.get('serverUrl', 'http://localhost:3000');
                const { schemaType, pkg, name } = msg;
                try {
                    const data = await fetchJson(`${serverUrl}/schemas/get?type=${schemaType}&pkg=${encodeURIComponent(pkg)}&name=${encodeURIComponent(name)}`);
                    this.panel.webview.postMessage({ type: 'schema', data, schemaType, pkg, name });
                }
                catch (e) {
                    this.panel.webview.postMessage({ type: 'error', message: `Schema fetch failed: ${e.message}` });
                }
                break;
            }
            case 'generateUi': {
                await this.generateUi(msg);
                break;
            }
            case 'saveFile': {
                await this.saveFile(msg);
                break;
            }
        }
    }
    async generateUi(req) {
        const config = vscode.workspace.getConfiguration('ros2UiGenerator');
        const apiKey = config.get('claudeApiKey', '');
        const model = config.get('claudeModel', 'claude-sonnet-4-6');
        if (!apiKey) {
            this.panel.webview.postMessage({
                type: 'chatResponse',
                role: 'assistant',
                content: 'No API key configured. Set `ros2UiGenerator.claudeApiKey` in VS Code settings.',
            });
            return;
        }
        const systemPrompt = buildSystemPrompt();
        const userContent = buildUserPrompt(req);
        this.panel.webview.postMessage({ type: 'chatResponseStart' });
        try {
            await streamClaude({ apiKey, model, systemPrompt, userContent }, (chunk) => {
                this.panel.webview.postMessage({ type: 'chatChunk', chunk });
            });
            this.panel.webview.postMessage({ type: 'chatResponseEnd' });
        }
        catch (e) {
            this.panel.webview.postMessage({ type: 'chatResponseEnd', error: e.message });
        }
    }
    async saveFile(msg) {
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
exports.Ros2UiPanel = Ros2UiPanel;
function streamClaude(opts, onChunk) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            model: opts.model,
            max_tokens: 8192,
            stream: true,
            system: opts.systemPrompt,
            messages: [{ role: 'user', content: opts.userContent }],
        });
        const req = https.request({
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': opts.apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(body),
            },
        }, (res) => {
            let buf = '';
            res.on('data', (chunk) => {
                buf += chunk.toString();
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    if (!line.startsWith('data: '))
                        continue;
                    const raw = line.slice(6).trim();
                    if (raw === '[DONE]')
                        continue;
                    try {
                        const event = JSON.parse(raw);
                        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                            onChunk(event.delta.text);
                        }
                    }
                    catch { /* ignore parse errors */ }
                }
            });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 400) {
                    reject(new Error(`Claude API returned ${res.statusCode}`));
                }
                else {
                    resolve();
                }
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}
function buildSystemPrompt() {
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
function buildUserPrompt(req) {
    const lines = [];
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
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        mod.get(url, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
    });
}
