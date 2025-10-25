# Trace Viewer - User Guide

Complete guide to using the Trace Viewer VSCode extension with aitrace.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Loading Traces](#loading-traces)
- [Viewing Traces](#viewing-traces)
- [Configuration](#configuration)
- [Commands](#commands)
- [Troubleshooting](#troubleshooting)

---

## Installation

### From VSIX Package

```bash
# Build the extension
cd vsc_ext
npm run package

# Install in VSCode
code --install-extension trace-viewer-0.1.0.vsix
```

### From Source (Development)

```bash
cd vsc_ext
npm install
npm run build
```

Press `F5` to launch Extension Development Host.

---

## Quick Start

### 1. Generate Traces with aitrace

```python
from aitrace import setup_tracing, BufferedLogger

tracer = setup_tracing("my-app")
buffered = BufferedLogger(target="~/traces/app.jsonl")

with tracer.start_as_current_span("main"):
    buffered.logger.info("processing", item_id=42)
    # ... your code ...

buffered.flush()
```

### 2. Load Traces in VSCode

**Option A: Manual Load**
1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run: `Trace: Load trace file (NDJSON/JSON)`
3. Select your trace file (e.g., `~/traces/app.jsonl`)
4. Choose "Yes" when asked to watch the file

**Option B: Auto-Watch Configuration**
1. Open Settings (`Cmd+,` / `Ctrl+,`)
2. Search: `traceMarkers.traceFile`
3. Set absolute path: `/Users/you/traces/app.jsonl`

### 3. View Traces in Your Code

- **Gutter icons** appear on traced lines
- **Hover** over icons to see trace preview
- **Click CodeLens** ("🔍 Trace: ...") to open full details

---

## Loading Traces

### Supported Formats

The extension reads two formats:

**NDJSON (Newline-Delimited JSON)**
```json
{"event": "login", "file": "src/auth.py", "line": 42, "level": "info", "user_id": 123}
{"event": "query", "file": "src/db.py", "line": 89, "level": "info", "query": "SELECT *"}
```

**JSON Array**
```json
[
  {"event": "login", "file": "src/auth.py", "line": 42, "level": "info"},
  {"event": "query", "file": "src/db.py", "line": 89, "level": "info"}
]
```

### Required Fields

Each trace entry must have:
- `file` - Relative path from workspace root (e.g., `"src/auth.py"`)
- `line` - Line number, 1-based (e.g., `42`)

### Optional Fields

- `level` or `severity` - `"info"`, `"warning"`, `"error"` (default: `"info"`)
- `event` or `label` - Display name for trace
- `function` - Function name
- `trace_id` - Groups related traces
- `span_id` - Unique trace identifier
- `timestamp` - ISO format timestamp
- Any other fields become part of the payload

---

## Viewing Traces

### Visual Markers

**Gutter Icons**
- 🔵 Blue circle = info level
- 🟡 Yellow triangle = warning level
- 🔴 Red cross = error level

**Overview Ruler**
- Colored marks on scrollbar
- Click to jump to trace

**Hover Tooltips**
- Hover over gutter icon
- Shows: trace ID, label, timestamp, payload preview

### CodeLens

Appears above each traced line:
```python
def handle_login(user_id, password):
    🔍 Trace: user_login  ← Click to open details
    log.info("user_login", user_id=user_id)
```

### Details Panel

Click CodeLens to open webview with:
- **Metadata**: file, line, function, trace_id, timestamp
- **Full payload**: formatted JSON
- **Split view**: code on left, details on right

---

## Configuration

### Settings

Access via: `Preferences → Settings → Extensions → Trace Viewer`

#### `traceMarkers.traceFile`
- **Type**: `string`
- **Default**: `""` (empty)
- **Description**: Absolute path to trace file to watch

**Example**:
```json
{
  "traceMarkers.traceFile": "/Users/you/project/traces/app.jsonl"
}
```

When set, the extension automatically:
- Loads traces on startup
- Watches file for changes
- Reloads when file is modified

#### `traceMarkers.autoReload`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Auto-reload when trace file changes

Set to `false` to disable file watching.

#### `traceMarkers.maxTraces`
- **Type**: `number`
- **Default**: `10000`
- **Range**: 100 - 100,000
- **Description**: Maximum traces to load (performance limit)

Increase for large trace files, decrease if experiencing slowness.

### Workspace Root Detection

The extension automatically detects your workspace root by looking for:
1. `.git` directory (highest priority)
2. `pyproject.toml`
3. `setup.py`
4. `requirements.txt`

This ensures trace file paths (which are relative) resolve correctly to your source files.

---

## Commands

All commands available via Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`):

### `Trace: Load trace file (NDJSON/JSON)`
- Opens file picker
- Loads NDJSON or JSON array file
- Asks if you want to watch the file

### `Trace: Toggle Decorations`
- Show/hide all trace markers
- Affects gutter icons, hover tooltips, and CodeLens
- Useful for temporarily clearing visual clutter

### `Trace: Set Trace File (watch)`
- Configure file path to watch
- Saves to workspace settings
- Starts watching immediately

### `Trace: Clear All Traces`
- Removes all loaded traces
- Stops file watching
- Clears all decorations

---

## Troubleshooting

### Traces Not Appearing

**Check file path format**
- Paths must be relative to workspace root
- Example: `"test/01_initial.py"` not `"/absolute/path/test/01_initial.py"`

**Verify workspace root**
- Extension detects workspace using `.git`, `pyproject.toml`, etc.
- Check status bar for loaded traces count

**Check line numbers**
- Must be 1-based (line 1 = first line)
- Not 0-based

**Reload traces**
- Run `Trace: Clear All Traces`
- Then `Trace: Load trace file` again

### File Watching Not Working

**Use absolute paths**
- `traceMarkers.traceFile` must be absolute path
- Example: `/Users/you/traces/app.jsonl`
- Not: `~/traces/app.jsonl` (use full path)

**Check auto-reload setting**
- Verify `traceMarkers.autoReload` is `true`

**File permissions**
- Ensure VSCode has read access to trace file
- Check file exists and is readable

**Manual reload workaround**
- Use `Trace: Load trace file` command manually
- Set up keyboard shortcut if needed

### Performance Issues

**Reduce max traces**
```json
{
  "traceMarkers.maxTraces": 5000
}
```

**Filter traces before loading**
- Generate smaller trace files
- Load specific time windows
- Filter by trace_id

**Clear old traces**
- Run `Trace: Clear All Traces`
- Load fresh traces

### Incorrect Line Markers

**Workspace root mismatch**
- Check if aitrace and extension detect same workspace root
- Manually verify paths resolve correctly

**Multiple workspace folders**
- Extension uses first workspace folder
- Ensure trace files reference correct workspace

**Path separators**
- Use forward slashes (`/`) in trace files
- Extension normalizes paths automatically

### Webview Not Opening

**Check trace has valid ID**
- Each trace needs unique `span_id` or `id`
- Verify trace file format

**Reload window**
- `Developer: Reload Window` command
- Restart VSCode if issues persist

---

## Usage Examples

### Basic Logging

```python
# app.py
from aitrace import setup_tracing, setup_logging

tracer = setup_tracing("my-app")
log = setup_logging()

def process_data(item_id):
    log.info("processing", item_id=item_id)  # ← Marker here
    # ... work ...
    log.info("completed", item_id=item_id)   # ← Marker here

with tracer.start_as_current_span("main"):
    process_data(42)
```

### With BufferedLogger and File Output

```python
from aitrace import setup_tracing, BufferedLogger

tracer = setup_tracing("my-app")
buffered = BufferedLogger(target="~/traces/debug.jsonl")

with buffered.trace_context(tracer, "operation"):
    buffered.logger.info("step_1")  # ← Marker
    # ... work ...
    buffered.logger.info("step_2")  # ← Marker

# Traces auto-flushed to file
# Extension auto-reloads if watching ~/traces/debug.jsonl
```

### Live Development Workflow

```bash
# Terminal 1: Run your app with trace output
export LOG_TRG=~/traces/dev.jsonl
python my_app.py

# Terminal 2: Watch trace file
tail -f ~/traces/dev.jsonl

# VSCode: Configure auto-watch
# Settings → traceMarkers.traceFile → /Users/you/traces/dev.jsonl
```

Now as your app runs, trace markers appear in real-time!

---

## Tips & Tricks

### Split View for Code + Traces

1. Click a CodeLens to open details panel
2. It opens in "Beside" column (split view)
3. View code and trace details side-by-side

### Keyboard Shortcuts

Set up custom shortcuts for frequent commands:

```json
// keybindings.json
[
  {
    "key": "cmd+shift+t",
    "command": "traceMarkers.loadTrace"
  },
  {
    "key": "cmd+shift+d",
    "command": "traceMarkers.toggleDecorations"
  }
]
```

### Filter by Severity

Currently all traces are shown. To see only errors:
1. Generate filtered trace file with only error logs
2. Load that file in extension

### Multiple Trace Files

To switch between different trace files:
1. Use `Trace: Clear All Traces`
2. Load new file with `Trace: Load trace file`

Or change `traceMarkers.traceFile` setting.

---

## Integration with aitrace

### Path Compatibility

aitrace generates relative paths:
```json
{"file": "test/01_initial.py", ...}
```

Extension resolves to absolute:
```
/Users/you/project/test/01_initial.py
```

Both use same workspace root detection, ensuring paths always match!

### All Fields Preserved

Extension displays all fields from aitrace logs:
- Standard fields: file, line, level, trace_id, span_id
- Custom fields: user_id, session_id, etc.
- Full payload visible in details panel

### Recommended Setup

```python
# For development: file output with auto-watch
buffered = BufferedLogger(target="~/traces/dev.jsonl")

# For production: HTTP server
buffered = BufferedLogger(target="http://localhost:8000/api/ingest")
```

Development traces can be viewed live in VSCode!

---

## See Also

- [Development Guide](development.md) - Setup and build instructions
- [AGENTS.md](../AGENTS.md) - Architecture and design decisions
- [CHANGELOG.md](../CHANGELOG.md) - Version history
- [aitrace Documentation](../../README.md) - Python library docs

