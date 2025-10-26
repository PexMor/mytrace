import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as fssync from 'fs';
import * as path from 'path';

type TraceItem = {
  id: string;
  file: string;    // relative path from workspace root
  line: number;    // 1-based
  column?: number; // 1-based
  function?: string;
  severity?: 'info' | 'warning' | 'warn' | 'error' | 'debug';
  label?: string;  // event name
  payload?: any;   // full log record
  trace_id?: string;
  span_id?: string;
  parent_span_id?: string;
  timestamp?: string;
  isProvisional?: boolean;  // true for provisional .start events
};

let traces: TraceItem[] = [];
let enabled = true;
let watcher: fssync.FSWatcher | null = null;
let watchedPath = '';
let workspaceRoot: string | null = null;

export function activate(context: vscode.ExtensionContext) {
  const infoDeco = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    gutterIconPath: vscode.Uri.joinPath(context.extensionUri, 'media', 'info.svg'),
    gutterIconSize: 'contain',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground')
  });
  const warnDeco = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    gutterIconPath: vscode.Uri.joinPath(context.extensionUri, 'media', 'warn.svg'),
    gutterIconSize: 'contain',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.warningForeground')
  });
  const errorDeco = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    gutterIconPath: vscode.Uri.joinPath(context.extensionUri, 'media', 'error.svg'),
    gutterIconSize: 'contain',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.errorForeground')
  });

  function normalize(pth: string) {
    return path.normalize(pth).replace(/\\/g, '/');
  }

  function sameFile(a: string, b: string) {
    return normalize(a) === normalize(b);
  }

  function detectWorkspaceRoot(): string | null {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return null;
    }

    // Start from first workspace folder
    let current = workspaceFolders[0].uri.fsPath;
    
    // Markers in priority order (matches aitrace Python logic)
    const markers = ['.git', 'pyproject.toml', 'setup.py', 'requirements.txt'];
    
    // Walk up directory tree
    while (current !== path.dirname(current)) {
      for (const marker of markers) {
        const markerPath = path.join(current, marker);
        if (fssync.existsSync(markerPath)) {
          return current;
        }
      }
      current = path.dirname(current);
    }
    
    // Fallback to workspace folder
    return workspaceFolders[0].uri.fsPath;
  }

  function resolveTracePath(relativePath: string): string {
    if (!workspaceRoot) {
      workspaceRoot = detectWorkspaceRoot();
    }
    if (!workspaceRoot) {
      return relativePath;
    }
    return path.join(workspaceRoot, relativePath);
  }

  function applyDecorations(editor?: vscode.TextEditor) {
    const ed = editor ?? vscode.window.activeTextEditor;
    if (!ed) return;

    const file = normalize(ed.document.fileName);
    if (!enabled) {
      ed.setDecorations(infoDeco, []);
      ed.setDecorations(warnDeco, []);
      ed.setDecorations(errorDeco, []);
      return;
    }

    const infos: vscode.DecorationOptions[] = [];
    const warns: vscode.DecorationOptions[] = [];
    const errors: vscode.DecorationOptions[] = [];

    for (const t of traces) {
      const tracePath = normalize(resolveTracePath(t.file));
      if (!sameFile(tracePath, file)) continue;
      
      const lineIdx = Math.max(0, (t.line ?? 1) - 1);
      const range = new vscode.Range(lineIdx, 0, lineIdx, 0);
      const hover = new vscode.MarkdownString();
      hover.appendMarkdown(`**Trace ${t.id}**`);
      if (t.label) hover.appendMarkdown(` — ${t.label}`);
      if (t.timestamp) hover.appendMarkdown(`  \n_${t.timestamp}_`);
      if (t.function) hover.appendMarkdown(`  \n\`${t.function}()\``);
      hover.appendMarkdown('\n\n');
      
      // Show preview of payload
      const payloadPreview = t.payload ? JSON.stringify(t.payload, null, 2) : '{}';
      hover.appendCodeblock(payloadPreview.substring(0, 200) + (payloadPreview.length > 200 ? '...' : ''), 'json');
      hover.isTrusted = true;
      
      const opt: vscode.DecorationOptions = { range, hoverMessage: hover };
      
      const severity = t.severity || 'info';
      if (severity === 'error') {
        errors.push(opt);
      } else if (severity === 'warning' || severity === 'warn') {
        warns.push(opt);
      } else {
        infos.push(opt);
      }
    }

    ed.setDecorations(infoDeco, infos);
    ed.setDecorations(warnDeco, warns);
    ed.setDecorations(errorDeco, errors);
  }

  function refreshAllEditors() {
    vscode.window.visibleTextEditors.forEach(applyDecorations);
  }

  class TraceCodeLensProvider implements vscode.CodeLensProvider {
    private emitter = new vscode.EventEmitter<void>();
    onDidChangeCodeLenses = this.emitter.event;
    
    provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
      if (!enabled) return [];
      const file = normalize(document.fileName);
      const lenses: vscode.CodeLens[] = [];
      
      for (const t of traces) {
        const tracePath = normalize(resolveTracePath(t.file));
        if (!sameFile(tracePath, file)) continue;
        
        const lineIdx = Math.max(0, (t.line ?? 1) - 1);
        const range = new vscode.Range(lineIdx, 0, lineIdx, 0);
        lenses.push(new vscode.CodeLens(range, {
          title: `🔍 Trace: ${t.label || t.id}`,
          command: 'traceMarkers.openDetails',
          arguments: [t.id]
        }));
      }
      
      return lenses;
    }
    
    refresh() { this.emitter.fire(); }
  }
  
  const lensProvider = new TraceCodeLensProvider();

  async function loadTraceFromFile(filePath: string) {
    const text = await fs.readFile(filePath, 'utf8');
    const config = vscode.workspace.getConfiguration('traceMarkers');
    const maxTraces = config.get<number>('maxTraces', 10000);
    
    // Support both JSON array and NDJSON formats
    let parsed: any[] = [];
    const trimmed = text.trim();
    
    if (trimmed.startsWith('[')) {
      // JSON array format
      parsed = JSON.parse(trimmed);
    } else {
      // NDJSON format (one JSON per line)
      const lines = trimmed.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          parsed.push(JSON.parse(line));
        } catch (e) {
          // Skip invalid lines
          console.warn('Skipping invalid JSON line:', line.substring(0, 50));
        }
      }
    }
    
    // Limit number of traces
    if (parsed.length > maxTraces) {
      vscode.window.showWarningMessage(
        `Loaded only first ${maxTraces} of ${parsed.length} traces (configured limit)`
      );
      parsed = parsed.slice(0, maxTraces);
    }
    
    // Convert to TraceItem format
    // Support new format with __tracer_meta__ and old format with top-level fields
    traces = parsed.map((item: any) => {
      const meta = item.__tracer_meta__ || {};
      
      // Filter out provisional .start events if .end exists
      const event = meta.event || item.event || '';
      const isProvisional = meta.provisional || item.provisional;
      
      return {
        id: meta.span_id || item.span_id || item.id || String(Math.random()),
        file: meta.file || item.file || '',
        line: meta.line || item.line || 1,
        column: item.column,
        function: meta.function || item.function,
        severity: meta.level || item.level || item.severity || 'info',
        label: event || item.label,
        payload: item,
        trace_id: meta.trace_id || item.trace_id,
        span_id: meta.span_id || item.span_id,
        parent_span_id: meta.parent_span_id || item.parent_span_id,
        timestamp: meta.timestamp || item.timestamp || item.ts,
        isProvisional: isProvisional  // Track if this is a provisional entry
      };
    });
    
    // Filter out provisional .start entries if corresponding .end exists
    const spanIds = new Set<string>();
    const provisionalSpanIds = new Set<string>();
    
    // First pass: identify spans with .end events and provisional .start events
    for (const t of traces) {
      if (t.label && t.label.endsWith('.end')) {
        spanIds.add(t.span_id || '');
      }
      if (t.label && t.label.endsWith('.start') && t.isProvisional) {
        provisionalSpanIds.add(t.span_id || '');
      }
    }
    
    // Second pass: filter out provisional .start entries where .end exists
    traces = traces.filter(t => {
      if (t.label && t.label.endsWith('.start') && t.isProvisional) {
        return !spanIds.has(t.span_id || '');
      }
      return true;
    });
    
    refreshAllEditors();
    lensProvider.refresh();
    vscode.window.setStatusBarMessage(`✓ Loaded ${traces.length} traces`, 3000);
  }

  function startWatcher(filePath: string) {
    if (watcher) {
      watcher.close();
    }
    
    watchedPath = filePath;
    let debounceTimer: NodeJS.Timeout | null = null;
    
    watcher = fssync.watch(filePath, { persistent: true }, async (eventType) => {
      if (eventType === 'change') {
        // Debounce to handle multiple rapid writes
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(async () => {
          try {
            await loadTraceFromFile(filePath);
          } catch (e) {
            // Ignore errors during partial writes
            console.warn('Error reloading trace file:', e);
          }
        }, 250);
      }
    });
  }

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'python', scheme: 'file' },
      lensProvider
    ),

    vscode.commands.registerCommand('traceMarkers.loadTrace', async () => {
      const pick = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: {
          'JSON/NDJSON': ['json', 'jsonl', 'ndjson', 'log'],
          'All Files': ['*']
        },
        title: 'Select trace file to load'
      });
      
      if (!pick || pick.length === 0) return;
      
      try {
        await loadTraceFromFile(pick[0].fsPath);
        
        // Ask if user wants to watch this file
        const watch = await vscode.window.showQuickPick(
          ['Yes', 'No'],
          { placeHolder: 'Watch this file for changes?' }
        );
        
        if (watch === 'Yes') {
          startWatcher(pick[0].fsPath);
          vscode.window.showInformationMessage(`Watching ${path.basename(pick[0].fsPath)} for changes`);
        }
      } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to load trace: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand('traceMarkers.toggleDecorations', () => {
      enabled = !enabled;
      refreshAllEditors();
      lensProvider.refresh();
      vscode.window.showInformationMessage(
        `Trace decorations ${enabled ? 'enabled' : 'disabled'}`
      );
    }),

    vscode.commands.registerCommand('traceMarkers.openDetails', (traceId?: string) => {
      const trace = traces.find(t => t.id === traceId);
      if (!trace) return;
      
      const panel = vscode.window.createWebviewPanel(
        'traceDetails',
        `Trace: ${trace.label || trace.id}`,
        vscode.ViewColumn.Beside,
        { enableScripts: true }
      );
      
      const payload = JSON.stringify(trace.payload || {}, null, 2);
      const escapeHtml = (s: string) =>
        s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c as keyof typeof map] || c));
      const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
      
      panel.webview.html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Trace ${escapeHtml(trace.id)}</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .header {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .metadata {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 20px;
      font-size: 13px;
      margin-top: 15px;
    }
    .label {
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
    }
    .value {
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      color: var(--vscode-editor-foreground);
    }
    .payload {
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 15px;
      overflow-x: auto;
      margin-top: 20px;
    }
    pre {
      margin: 0;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${escapeHtml(trace.label || 'Trace Details')}</div>
    <div class="metadata">
      <span class="label">Trace ID:</span>
      <span class="value">${escapeHtml(trace.id)}</span>
      
      <span class="label">File:</span>
      <span class="value">${escapeHtml(trace.file)}</span>
      
      <span class="label">Line:</span>
      <span class="value">${trace.line}</span>
      
      ${trace.function ? `
      <span class="label">Function:</span>
      <span class="value">${escapeHtml(trace.function)}()</span>
      ` : ''}
      
      ${trace.timestamp ? `
      <span class="label">Timestamp:</span>
      <span class="value">${escapeHtml(trace.timestamp)}</span>
      ` : ''}
      
      ${trace.trace_id ? `
      <span class="label">Trace ID:</span>
      <span class="value">${escapeHtml(trace.trace_id)}</span>
      ` : ''}
      
      ${trace.parent_span_id ? `
      <span class="label">Parent Span:</span>
      <span class="value">${escapeHtml(trace.parent_span_id)}</span>
      ` : ''}
    </div>
  </div>
  
  <div class="section-title">Full Payload</div>
  <div class="payload">
    <pre>${escapeHtml(payload)}</pre>
  </div>
</body>
</html>`;
    }),

    vscode.commands.registerCommand('traceMarkers.setTraceFile', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter absolute path to trace file to watch',
        placeHolder: '/absolute/path/to/trace.jsonl',
        value: watchedPath
      });
      
      if (!input) return;
      
      try {
        await loadTraceFromFile(input);
        startWatcher(input);
        await vscode.workspace.getConfiguration().update(
          'traceMarkers.traceFile',
          input,
          vscode.ConfigurationTarget.Workspace
        );
        vscode.window.showInformationMessage(`Watching ${path.basename(input)}`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Failed to set trace file: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand('traceMarkers.clearTraces', () => {
      traces = [];
      refreshAllEditors();
      lensProvider.refresh();
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      watchedPath = '';
      vscode.window.showInformationMessage('All traces cleared');
    }),

    vscode.window.onDidChangeActiveTextEditor(() => refreshAllEditors()),
    vscode.workspace.onDidChangeTextDocument(() => refreshAllEditors())
  );

  // Auto-load from config if present
  const config = vscode.workspace.getConfiguration('traceMarkers');
  const configFile = config.get<string>('traceFile');
  const autoReload = config.get<boolean>('autoReload', true);
  
  if (configFile && autoReload) {
    loadTraceFromFile(configFile)
      .then(() => startWatcher(configFile))
      .catch(() => {
        // Silently fail on startup
      });
  }
}

export function deactivate() {
  if (watcher) {
    watcher.close();
  }
}

