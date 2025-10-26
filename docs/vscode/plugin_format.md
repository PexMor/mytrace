# VSCode Plugin Format Example

This directory contains an example trace file in the format expected by the VSCode/Cursor plugin.

## File: `vscode_plugin_format_example.jsonl`

This is a sample NDJSON (newline-delimited JSON) file showing how trace records should be formatted for the plugin.

### Format Specification

Each line contains a JSON object with these fields:

```typescript
{
  id: string;        // Unique identifier (usually span_id)
  file: string;      // Relative path from workspace root
  line: number;      // 1-based line number
  severity?: string; // "info" | "warn" | "error" (optional)
  label?: string;    // Event name or description (optional)
  payload?: any;     // Full log record with all details (optional)
}
```

### Example Record

```json
{
  "id": "f3bb1f86fc5572ac",
  "file": "src/auth/login.py",
  "line": 42,
  "severity": "info",
  "label": "user_login_start",
  "payload": {
    "timestamp": "2025-10-25T12:00:00.123456Z",
    "event": "user_login_start",
    "level": "info",
    "file": "src/auth/login.py",
    "line": 42,
    "function": "handle_login",
    "trace_id": "abc123def456",
    "span_id": "f3bb1f86fc5572ac",
    "user_id": 12345,
    "username": "alice"
  }
}
```

### How AI Trace Generates This

When using `BufferedLogger` or `setup_logging()`, the system automatically generates logs with the required fields:

```python
from aitrace import setup_tracing, BufferedLogger

tracer = setup_tracing("my-app")
buffered = BufferedLogger(target="~/traces/app.jsonl")

with tracer.start_as_current_span("user_login"):
    buffered.logger.info("user_login_start", user_id=12345, username="alice")
    # Auto-generates: file, line, function, trace_id, span_id

buffered.flush()
```

The generated log already has `file` and `line` fields. To convert to plugin format, you can simply map the fields:

```python
import json

# Read AI Trace logs
with open("app.jsonl", "r") as f:
    logs = [json.loads(line) for line in f if line.strip()]

# Convert to plugin format
with open("plugin_traces.jsonl", "w") as f:
    for log in logs:
        plugin_record = {
            "id": log["span_id"],
            "file": log["file"],         # Already relative!
            "line": log["line"],         # Already 1-based!
            "severity": log["level"],
            "label": log.get("event", "log"),
            "payload": log               # Full log record
        }
        f.write(json.dumps(plugin_record) + "\n")
```

### Plugin Implementation Notes

The VSCode/Cursor plugin should:

1. **Load the trace file**

   ```typescript
   const traces = fs
     .readFileSync(traceFile, "utf-8")
     .split("\n")
     .filter((line) => line.trim())
     .map((line) => JSON.parse(line));
   ```

2. **Detect workspace root**

   ```typescript
   const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
   ```

3. **Resolve absolute paths**

   ```typescript
   const absolutePath = path.join(workspaceRoot, trace.file);
   ```

4. **Group by file**

   ```typescript
   const byFile = new Map<string, TraceItem[]>();
   for (const trace of traces) {
     if (!byFile.has(trace.file)) {
       byFile.set(trace.file, []);
     }
     byFile.get(trace.file)!.push(trace);
   }
   ```

5. **Create decorations**

   ```typescript
   const decorator = vscode.window.createTextEditorDecorationType({
     gutterIconPath: iconPath,
     overviewRulerColor: "rgba(255, 200, 0, 0.7)",
   });

   const decorations = traces.map((trace) => ({
     range: new vscode.Range(trace.line - 1, 0, trace.line - 1, 0),
     hoverMessage: `Trace: ${trace.label}`,
   }));

   editor.setDecorations(decorator, decorations);
   ```

6. **Add CodeLens**

   ```typescript
   class TraceCodeLensProvider implements vscode.CodeLensProvider {
     provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
       const file = path.relative(workspaceRoot, document.fileName);
       const tracesForFile = byFile.get(file) || [];

       return tracesForFile.map(
         (trace) =>
           new vscode.CodeLens(
             new vscode.Range(trace.line - 1, 0, trace.line - 1, 0),
             {
               title: `🔍 ${trace.label}`,
               command: "extension.showTraceDetails",
               arguments: [trace.id],
             }
           )
       );
     }
   }
   ```

7. **Show trace details**
   ```typescript
   vscode.commands.registerCommand("extension.showTraceDetails", (traceId) => {
     const trace = traces.find((t) => t.id === traceId);
     if (!trace) return;

     const panel = vscode.window.createWebviewPanel(
       "traceDetails",
       `Trace: ${trace.label}`,
       vscode.ViewColumn.Beside,
       { enableScripts: true }
     );

     panel.webview.html = generateTraceHtml(trace);
   });
   ```

### Example Visualization

When the plugin is active, the code editor would show:

```python
# src/auth/login.py

def handle_login(user_id: int, password: str):
    🔵 log.info("user_login_start", user_id=user_id)    # ← Gutter mark, click to see trace

    # Check credentials
    🔵 log.info("checking_credentials", user_id=user_id)

    user = user_repo.find_user_by_id(user_id)  # ← No mark (child span in different file)

    # Verify password
    🔵 log.info("password_verification", user_id=user_id, password_valid=True)

    # Success
    🔵 log.info("user_login_success", user_id=user_id, session_id="xyz789")
```

Clicking a gutter mark or CodeLens opens a panel showing:

```
┌─────────────────────────────────────────┐
│ Trace: user_login_start                 │
├─────────────────────────────────────────┤
│ File: src/auth/login.py                 │
│ Line: 42                                │
│ Function: handle_login                  │
│                                         │
│ {                                       │
│   "user_id": 12345,                     │
│   "username": "alice",                  │
│   "timestamp": "2025-10-25T12:00:00Z",  │
│   "trace_id": "abc123def456",           │
│   "span_id": "f3bb1f86fc5572ac"         │
│ }                                       │
└─────────────────────────────────────────┘
```

### Testing the Format

You can test the format with this simple script:

```python
import json

# Validate all records in the file
with open('vscode_plugin_format_example.jsonl', 'r') as f:
    for line_num, line in enumerate(f, 1):
        try:
            record = json.loads(line)

            # Check required fields
            assert 'id' in record, f"Line {line_num}: missing 'id'"
            assert 'file' in record, f"Line {line_num}: missing 'file'"
            assert 'line' in record, f"Line {line_num}: missing 'line'"
            assert isinstance(record['line'], int), f"Line {line_num}: 'line' must be integer"

            # Check optional fields
            if 'severity' in record:
                assert record['severity'] in ['info', 'warn', 'error'], \
                    f"Line {line_num}: invalid severity"

            print(f"✓ Line {line_num}: {record['file']}:{record['line']} - {record.get('label', 'N/A')}")

        except json.JSONDecodeError as e:
            print(f"✗ Line {line_num}: Invalid JSON - {e}")
        except AssertionError as e:
            print(f"✗ Line {line_num}: {e}")
```

### See Also

- [Source Location Documentation](../source_location_tracking.md)
- [Trace Record Format](../trace_record_format.md) - Log format specification
- [README.md](../../README.md) - Main documentation
- [VSCode Extension API](https://code.visualstudio.com/api)
- [CodeLens Provider](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#codelens-show-actionable-context-information-within-source-code)
- [Decoration API](https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType)
