import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, _extensionUri: vscode.Uri): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<title>ROS2 UI Generator</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, system-ui);
    font-size: var(--vscode-font-size, 13px);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    height: 100vh;
    display: flex;
    overflow: hidden;
  }

  /* ---------- LEFT PANEL ---------- */
  #left {
    width: 260px;
    min-width: 200px;
    border-right: 1px solid var(--vscode-panel-border, #333);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  #left-header {
    padding: 8px 10px;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--vscode-sideBarSectionHeader-background, #252526);
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  #search {
    width: 100%;
    padding: 5px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 3px;
    font-size: 12px;
    margin: 6px 8px;
    width: calc(100% - 16px);
  }
  #search:focus { outline: 1px solid var(--vscode-focusBorder); }

  .type-section { margin-bottom: 4px; }
  .type-header {
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    user-select: none;
  }
  .type-header:hover { background: var(--vscode-list-hoverBackground); }
  .arrow { transition: transform 0.15s; display: inline-block; }
  .collapsed .arrow { transform: rotate(-90deg); }
  .schema-list { list-style: none; overflow: hidden; }
  .schema-item {
    padding: 3px 10px 3px 22px;
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .schema-item:hover { background: var(--vscode-list-hoverBackground); }
  .schema-item.active { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
  .schema-badge {
    font-size: 9px;
    padding: 1px 4px;
    border-radius: 3px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .badge-msg    { background: #1a472a; color: #6fbf73; }
  .badge-srv    { background: #1a3a5c; color: #6baed6; }
  .badge-action { background: #4a1a3a; color: #d682b0; }
  #schema-scroll { overflow-y: auto; flex: 1; }

  /* ---------- MAIN AREA ---------- */
  #main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ---------- CONFIG BAR ---------- */
  #config-bar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--vscode-panel-border, #333);
    background: var(--vscode-editorGroupHeader-tabsBackground, #252526);
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  #config-bar label { font-size: 11px; color: var(--vscode-descriptionForeground); }
  #config-bar select, #config-bar input[type=text] {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 3px;
    padding: 3px 6px;
    font-size: 12px;
  }
  #config-bar select:focus, #config-bar input:focus { outline: 1px solid var(--vscode-focusBorder); }
  .config-group { display: flex; align-items: center; gap: 4px; }
  #selected-schema-label {
    font-weight: 600;
    font-size: 12px;
    flex: 1;
    min-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-foreground);
  }

  /* ---------- CHAT AREA ---------- */
  #chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  #messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .msg {
    max-width: 85%;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg.user {
    align-self: flex-end;
    background: var(--vscode-button-background, #0078d4);
    color: var(--vscode-button-foreground, #fff);
  }
  .msg.assistant {
    align-self: flex-start;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-panel-border, #333);
  }
  .msg.system-msg {
    align-self: center;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
    background: none;
    padding: 2px 0;
  }

  /* Code blocks inside assistant messages */
  .msg .code-block-wrapper {
    margin: 8px 0;
    border: 1px solid var(--vscode-panel-border, #444);
    border-radius: 4px;
    overflow: hidden;
  }
  .code-block-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 8px;
    background: var(--vscode-tab-activeBackground, #1e1e1e);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
  }
  .code-block-header button {
    font-size: 11px;
    padding: 2px 8px;
    cursor: pointer;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 3px;
    background: var(--vscode-button-secondaryBackground, #3c3c3c);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }
  .code-block-header button:hover { background: var(--vscode-button-secondaryHoverBackground, #555); }
  pre.code-block {
    margin: 0;
    padding: 10px 12px;
    overflow-x: auto;
    background: var(--vscode-textCodeBlock-background, #1e1e1e);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    max-height: 300px;
    overflow-y: auto;
  }

  /* ---------- INPUT ROW ---------- */
  #input-row {
    padding: 10px 12px;
    border-top: 1px solid var(--vscode-panel-border, #333);
    background: var(--vscode-editorWidget-background, #252526);
    display: flex;
    gap: 8px;
    align-items: flex-end;
  }
  #user-input {
    flex: 1;
    min-height: 36px;
    max-height: 120px;
    padding: 8px 10px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #3c3c3c);
    border-radius: 4px;
    font-size: 13px;
    font-family: inherit;
    resize: none;
    line-height: 1.4;
  }
  #user-input:focus { outline: 1px solid var(--vscode-focusBorder); }
  #send-btn {
    padding: 8px 14px;
    background: var(--vscode-button-background, #0078d4);
    color: var(--vscode-button-foreground, #fff);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    height: 36px;
    white-space: nowrap;
  }
  #send-btn:hover { background: var(--vscode-button-hoverBackground); }
  #send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ---------- EMPTY STATE ---------- */
  #empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--vscode-descriptionForeground);
    font-size: 13px;
    padding: 20px;
    text-align: center;
  }
  #empty-state .big { font-size: 40px; }

  /* ---------- PREVIEW PANE ---------- */
  #preview-toggle {
    cursor: pointer;
    padding: 4px 10px;
    font-size: 11px;
    background: var(--vscode-button-secondaryBackground, #3c3c3c);
    border: none;
    color: var(--vscode-button-secondaryForeground);
    border-radius: 3px;
  }
  #preview-pane {
    border-top: 1px solid var(--vscode-panel-border, #333);
    height: 320px;
    display: none;
    flex-direction: column;
  }
  #preview-pane.visible { display: flex; }
  #preview-header {
    padding: 4px 10px;
    font-size: 11px;
    background: var(--vscode-editorGroupHeader-tabsBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  #preview-frame {
    flex: 1;
    border: none;
    background: #fff;
  }

  .spinner {
    display: inline-block;
    width: 12px; height: 12px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    vertical-align: middle;
    margin-right: 4px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<!-- LEFT: schema browser -->
<div id="left">
  <div id="left-header">
    <span>📦 ROS2 Schemas</span>
    <button id="refresh-btn" style="margin-left:auto;background:none;border:none;cursor:pointer;color:inherit;font-size:14px;" title="Refresh schema list">↻</button>
  </div>
  <input id="search" type="text" placeholder="Search schemas…" />
  <div id="schema-scroll">
    <div id="schema-tree">
      <div style="padding:12px;color:var(--vscode-descriptionForeground);font-size:12px;">Loading schemas…</div>
    </div>
  </div>
</div>

<!-- RIGHT: config + chat -->
<div id="main">
  <div id="config-bar">
    <span id="selected-schema-label">← Select a schema</span>
    <div class="config-group">
      <label>Mode</label>
      <select id="mode-select">
        <option value="input">Input (form)</option>
        <option value="output">Output (display)</option>
      </select>
    </div>
    <div class="config-group">
      <label>W</label>
      <input type="text" id="width-input" value="600px" style="width:70px" />
    </div>
    <div class="config-group">
      <label>H</label>
      <input type="text" id="height-input" value="400px" style="width:70px" />
    </div>
    <div class="config-group">
      <label>Theme</label>
      <select id="theme-select">
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="auto">Auto</option>
      </select>
    </div>
    <button id="preview-toggle">Preview ▾</button>
  </div>

  <div id="chat-area">
    <div id="messages">
      <div id="empty-state">
        <div class="big">🤖</div>
        <div><strong>ROS2 UI Generator</strong></div>
        <div>Select a message, service, or action from the left panel,<br>then click <em>Generate UI</em> or type a message to start.</div>
      </div>
    </div>

    <div id="preview-pane">
      <div id="preview-header">
        <span>Live Preview</span>
        <div style="display:flex;gap:6px">
          <button onclick="savePreview()" style="font-size:11px;padding:2px 8px;cursor:pointer;border:1px solid var(--vscode-button-border,transparent);border-radius:3px;background:var(--vscode-button-secondaryBackground,#3c3c3c);color:var(--vscode-button-secondaryForeground)">Save HTML…</button>
        </div>
      </div>
      <iframe id="preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>
    </div>

    <div id="input-row">
      <textarea id="user-input" rows="1" placeholder="Describe what you want, or click Generate UI to start…"></textarea>
      <button id="send-btn" onclick="sendMessage()">Generate UI ✨</button>
    </div>
  </div>
</div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();

// ---------- State ----------
let selectedSchema = null;  // { type, pkg, name, schema }
let chatHistory = [];
let isStreaming = false;
let lastHtml = null;
let serverUrl = 'http://localhost:3000';
let currentConfig = {};

// ---------- Init ----------
window.addEventListener('message', handleExtensionMessage);
document.getElementById('refresh-btn').addEventListener('click', fetchSchemas);
document.getElementById('search').addEventListener('input', filterSchemas);
document.getElementById('preview-toggle').addEventListener('click', togglePreview);
document.getElementById('user-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
autoGrow(document.getElementById('user-input'));

vscode.postMessage({ command: 'ready' });

// ---------- Extension message handler ----------
function handleExtensionMessage(event) {
  const msg = event.data;
  switch (msg.type) {
    case 'config':
      serverUrl = msg.serverUrl;
      currentConfig = msg;
      fetchSchemas();
      break;
    case 'schemaList':
      renderSchemaTree(msg.data);
      break;
    case 'schema':
      selectedSchema = { type: msg.schemaType, pkg: msg.pkg, name: msg.name, schema: msg.data };
      document.getElementById('selected-schema-label').textContent = \`\${msg.pkg}/\${msg.name} (\${msg.schemaType})\`;
      appendSystemMessage(\`Schema loaded: \${msg.pkg}/\${msg.name} (\${msg.schemaType}). Click "Generate UI ✨" or describe your requirements.\`);
      break;
    case 'error':
      appendSystemMessage('⚠ ' + msg.message);
      break;
    case 'chatResponseStart':
      isStreaming = true;
      setStreamingState(true);
      startAssistantMessage();
      break;
    case 'chatChunk':
      appendChunk(msg.chunk);
      break;
    case 'chatResponseEnd':
      isStreaming = false;
      setStreamingState(false);
      finalizeAssistantMessage(msg.error);
      break;
  }
}

// ---------- Schema tree ----------
let rawSchemas = { msg: [], srv: [], action: [] };

function fetchSchemas() {
  document.getElementById('schema-tree').innerHTML = '<div style="padding:12px;color:var(--vscode-descriptionForeground);font-size:12px;">Loading…</div>';
  vscode.postMessage({ command: 'listSchemas' });
}

function renderSchemaTree(data) {
  rawSchemas = data;
  applyFilter(document.getElementById('search').value.toLowerCase());
}

function filterSchemas() {
  applyFilter(document.getElementById('search').value.toLowerCase());
}

function applyFilter(q) {
  const tree = document.getElementById('schema-tree');
  tree.innerHTML = '';
  const types = [
    { key: 'msg',    label: 'Messages',  badge: 'msg'    },
    { key: 'srv',    label: 'Services',  badge: 'srv'    },
    { key: 'action', label: 'Actions',   badge: 'action' },
  ];
  for (const { key, label, badge } of types) {
    const items = (rawSchemas[key] || []).filter(
      ({ pkg, name }) => !q || (pkg + '/' + name).includes(q)
    );
    const section = document.createElement('div');
    section.className = 'type-section';
    const header = document.createElement('div');
    header.className = 'type-header';
    header.innerHTML = \`<span class="arrow">▾</span> \${label} <span style="color:var(--vscode-descriptionForeground);margin-left:auto">\${items.length}</span>\`;
    header.addEventListener('click', () => {
      section.classList.toggle('collapsed');
      ul.style.display = section.classList.contains('collapsed') ? 'none' : '';
    });
    const ul = document.createElement('ul');
    ul.className = 'schema-list';
    for (const { pkg, name } of items) {
      const li = document.createElement('li');
      li.className = 'schema-item';
      li.dataset.type = key;
      li.dataset.pkg  = pkg;
      li.dataset.name = name;
      li.innerHTML = \`<span class="schema-badge badge-\${badge}">\${badge}</span> <span>\${pkg}/<strong>\${name}</strong></span>\`;
      li.addEventListener('click', () => selectSchema(key, pkg, name, li));
      ul.appendChild(li);
    }
    section.appendChild(header);
    section.appendChild(ul);
    tree.appendChild(section);
  }
  if (!rawSchemas.msg?.length && !rawSchemas.srv?.length && !rawSchemas.action?.length && !q) {
    tree.innerHTML = '<div style="padding:12px;color:var(--vscode-descriptionForeground);font-size:12px;">No schemas found.<br>Make sure the backend server is running and AMENT_PREFIX_PATH is set.</div>';
  }
}

function selectSchema(type, pkg, name, el) {
  document.querySelectorAll('.schema-item.active').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  vscode.postMessage({ command: 'getSchema', schemaType: type, pkg, name });
}

// ---------- Chat UI ----------
let currentAssistantEl = null;
let accumulatedText = '';

function appendSystemMessage(text) {
  const messages = document.getElementById('messages');
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.remove();
  const div = document.createElement('div');
  div.className = 'msg system-msg';
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function appendUserMessage(text) {
  const messages = document.getElementById('messages');
  const emptyState = document.getElementById('empty-state');
  if (emptyState) emptyState.remove();
  const div = document.createElement('div');
  div.className = 'msg user';
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function startAssistantMessage() {
  accumulatedText = '';
  const messages = document.getElementById('messages');
  currentAssistantEl = document.createElement('div');
  currentAssistantEl.className = 'msg assistant';
  currentAssistantEl.innerHTML = '<span class="spinner"></span>';
  messages.appendChild(currentAssistantEl);
  messages.scrollTop = messages.scrollHeight;
}

function appendChunk(chunk) {
  accumulatedText += chunk;
  if (currentAssistantEl) {
    currentAssistantEl.innerHTML = renderMarkdown(accumulatedText);
    const messages = document.getElementById('messages');
    messages.scrollTop = messages.scrollHeight;
  }
}

function finalizeAssistantMessage(error) {
  if (currentAssistantEl) {
    if (error) {
      currentAssistantEl.innerHTML += \`<br><span style="color:var(--vscode-errorForeground)">Error: \${error}</span>\`;
    } else {
      currentAssistantEl.innerHTML = renderMarkdown(accumulatedText);
      // Extract HTML and update preview
      const html = extractFirstHtml(accumulatedText);
      if (html) {
        lastHtml = html;
        updatePreview(html);
      }
    }
    chatHistory.push({ role: 'assistant', content: accumulatedText });
    currentAssistantEl = null;
    accumulatedText = '';
  }
}

// Very simple markdown renderer for code blocks
function renderMarkdown(text) {
  // Replace fenced code blocks
  return text.replace(/\`\`\`(\\w*)\\n?([\\s\\S]*?)\`\`\`/g, (_, lang, code) => {
    const escaped = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const isHtml = lang === 'html';
    const id = 'cb' + Math.random().toString(36).slice(2);
    return \`<div class="code-block-wrapper">
      <div class="code-block-header">
        <span>\${lang || 'code'}</span>
        <div style="display:flex;gap:4px">
          \${isHtml ? \`<button onclick="previewHtml('\${id}')">Preview</button>\` : ''}
          <button onclick="copyCode('\${id}')">Copy</button>
          \${isHtml ? \`<button onclick="saveHtml('\${id}')">Save…</button>\` : ''}
        </div>
      </div>
      <pre class="code-block" id="\${id}">\${escaped}</pre>
    </div>\`;
  })
  // inline code
  .replace(/\`([^\`]+)\`/g, '<code style="background:var(--vscode-textCodeBlock-background);padding:1px 4px;border-radius:3px">$1</code>')
  // bold
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // newlines
  .replace(/\\n/g, '<br>');
}

function extractFirstHtml(text) {
  const m = text.match(/\`\`\`html\\n?([\\s\\S]*?)\`\`\`/);
  return m ? m[1] : null;
}

window.copyCode = function(id) {
  const pre = document.getElementById(id);
  if (pre) navigator.clipboard.writeText(pre.textContent);
};

window.previewHtml = function(id) {
  const pre = document.getElementById(id);
  if (pre) { lastHtml = pre.textContent; updatePreview(lastHtml); showPreview(); }
};

window.saveHtml = function(id) {
  const pre = document.getElementById(id);
  if (pre) {
    vscode.postMessage({ command: 'saveFile', content: pre.textContent,
      defaultName: (selectedSchema ? \`\${selectedSchema.pkg}_\${selectedSchema.name}_ui.html\` : 'ros2_ui.html') });
  }
};

window.savePreview = function() {
  if (lastHtml) {
    vscode.postMessage({ command: 'saveFile', content: lastHtml,
      defaultName: (selectedSchema ? \`\${selectedSchema.pkg}_\${selectedSchema.name}_ui.html\` : 'ros2_ui.html') });
  }
};

// ---------- Preview ----------
function updatePreview(html) {
  const frame = document.getElementById('preview-frame');
  frame.srcdoc = html;
}

function showPreview() {
  document.getElementById('preview-pane').classList.add('visible');
  document.getElementById('preview-toggle').textContent = 'Preview ▴';
}

function togglePreview() {
  const pane = document.getElementById('preview-pane');
  const btn  = document.getElementById('preview-toggle');
  if (pane.classList.toggle('visible')) {
    btn.textContent = 'Preview ▴';
  } else {
    btn.textContent = 'Preview ▾';
  }
}

// ---------- Send message ----------
function sendMessage() {
  if (isStreaming) return;
  const input = document.getElementById('user-input');
  const text = input.value.trim();

  const isFirstMessage = chatHistory.length === 0;
  if (!selectedSchema && isFirstMessage) {
    appendSystemMessage('Please select a schema from the left panel first.');
    return;
  }

  const userMsg = text || (isFirstMessage ? 'Generate a UI panel for this schema.' : '');
  if (!userMsg) return;

  input.value = '';
  input.style.height = 'auto';
  appendUserMessage(userMsg);
  chatHistory.push({ role: 'user', content: userMsg });

  vscode.postMessage({
    command: 'generateUi',
    schema: selectedSchema?.schema,
    schemaType: selectedSchema?.type,
    pkg: selectedSchema?.pkg,
    name: selectedSchema?.name,
    mode: document.getElementById('mode-select').value,
    width: document.getElementById('width-input').value,
    height: document.getElementById('height-input').value,
    theme: document.getElementById('theme-select').value,
    userMessage: userMsg,
    history: chatHistory.slice(0, -1),
  });
}

function setStreamingState(on) {
  document.getElementById('send-btn').disabled = on;
  document.getElementById('send-btn').textContent = on ? '…' : 'Generate UI ✨';
}

function autoGrow(el) {
  el.addEventListener('input', () => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  });
}
</script>
</body>
</html>`;
}

function getNonce() {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
