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
exports.ServerManager = void 0;
const vscode = __importStar(require("vscode"));
const cp = __importStar(require("child_process"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
class ServerManager {
    constructor(context) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('ROS2 UI Generator Server');
        context.subscriptions.push(this.outputChannel);
    }
    async start() {
        const config = vscode.workspace.getConfiguration('ros2UiGenerator');
        const serverUrl = config.get('serverUrl', 'http://localhost:3000');
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
            try {
                require('fs').accessSync(p);
                return true;
            }
            catch {
                return false;
            }
        });
        if (!serverScript) {
            vscode.window.showErrorMessage('Cannot find ros-panel server script. Install ros-panel and ensure bin/server.js exists.');
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
    stop() {
        this.process?.kill();
        this.process = undefined;
    }
    isReachable(url) {
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
exports.ServerManager = ServerManager;
function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
