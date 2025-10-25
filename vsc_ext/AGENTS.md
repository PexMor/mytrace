# VSCode Trace Viewer Extension - Architecture & Design

**Project:** aitrace VSCode Extension  
**Version:** 0.1.0  
**Date:** 2025-10-25

---

## Overview

The VSCode Trace Viewer extension integrates with aitrace's Python logging system to display trace markers directly in source code. It provides visual indicators, interactive CodeLens, and detailed trace information panels for debugging and understanding code execution flows.

## Purpose

Enable developers to:

- **Visualize execution traces** directly in their code editor
- **Click on trace markers** to view detailed log information
- **Navigate between code and traces** seamlessly
- **Debug complex applications** by seeing which lines were executed and with what data

## Architecture

### High-Level Flow

```
aitrace Python App → NDJSON Log File → VSCode Extension → Visual Markers
                                              ↓
                                         Webview Details
```

### Components

1. **Trace Loader** - Reads and parses NDJSON trace files
2. **Workspace Mapper** - Maps relative paths to absolute workspace paths
3. **Decoration Manager** - Applies gutter icons and hover tooltips
4. **CodeLens Provider** - Shows clickable trace markers above code lines
5. **Webview Generator** - Creates detailed trace information panels
6. **File Watcher** - Monitors trace files for live updates

---

## Integration with aitrace

### Trace Format

The extension consumes aitrace's NDJSON output format:

```json
{
  "event": "user_login",
  "file": "src/auth/handler.py",
  "line": 42,
  "function": "handle_login",
  "level": "info",
  "trace_id": "abc123...",
  "span_id": "def456...",
  "parent_span_id": "ghi789...",
  "timestamp": "2025-10-25T12:00:00.123456Z",
  "user_id": 12345
}
```

### Field Mapping

| aitrace Field | Extension Usage                       |
| ------------- | ------------------------------------- |
| `file`        | Relative path → resolved to absolute  |
| `line`        | 1-based line number for decoration    |
| `function`    | Shown in hover and details            |
| `level`       | Maps to severity (info/warning/error) |
| `trace_id`    | Groups related traces                 |
| `span_id`     | Unique trace identifier               |
| `event`       | Used as label in CodeLens             |
| `timestamp`   | Shown in details panel                |
| (all fields)  | Full payload in webview               |

### Workspace Root Detection

Mirrors aitrace's Python logic to ensure paths resolve correctly:

1. Search for markers in priority order:

   - `.git` directory (highest priority)
   - `pyproject.toml`
   - `setup.py`
   - `requirements.txt`

2. Walk up directory tree from workspace folder

3. Cache result for performance

4. Fall back to workspace root if no markers found

---

## Core Features

### 1. Trace Loading

**Input Formats Supported:**

- NDJSON (newline-delimited JSON): `{...}\n{...}\n`
- JSON array: `[{...}, {...}]`

**Loading Strategies:**

- Manual: Command palette → "Trace: Load trace file"
- Automatic: Configure `traceMarkers.traceFile` setting
- Live watching: File system watch for auto-reload

**Error Handling:**

- Graceful handling of malformed JSON
- Skip invalid lines in NDJSON
- Show user-friendly error messages
- Continue with valid traces even if some fail

### 2. Visual Decorations

**Gutter Icons:**

- 🔵 Blue circle for `info` level
- 🟡 Yellow triangle for `warning` level
- 🔴 Red octagon for `error` level

**Hover Tooltips:**

````
[Trace Icon]  **Trace abc123**
              user_login
              _2025-10-25 12:00:00_

              ```json
              {
                "user_id": 12345,
                "username": "alice"
              }
              ```
````

**Overview Ruler:**

- Colored marks on scrollbar for quick navigation
- Matches gutter icon colors
- Shows at-a-glance where traces exist in file

### 3. CodeLens Integration

**Display:**

```python
def handle_login(user_id, password):
    🔍 Trace: user_login  ← Clickable CodeLens
    log.info("user_login", user_id=user_id)
```

**Behavior:**

- Appears above traced lines
- Shows trace label (event name)
- Clickable → opens webview details
- Updates dynamically when traces change
- Hidden when decorations toggled off

### 4. Webview Details Panel

**Layout:**

```
┌─────────────────────────────────────────┐
│ Trace: user_login                       │
│ span_id: def456                         │
├─────────────────────────────────────────┤
│ File: src/auth/handler.py               │
│ Line: 42                                │
│ Function: handle_login                  │
│ Timestamp: 2025-10-25T12:00:00.123456Z  │
│                                         │
│ Trace ID: abc123...                     │
│ Parent Span: ghi789...                  │
├─────────────────────────────────────────┤
│ Payload:                                │
│                                         │
│ {                                       │
│   "user_id": 12345,                     │
│   "username": "alice",                  │
│   "session_id": "xyz789"                │
│ }                                       │
│                                         │
│ [Copy JSON] [Jump to Code]              │
└─────────────────────────────────────────┘
```

**Features:**

- Syntax-highlighted JSON
- Metadata header with key fields
- Action buttons (copy, jump to code)
- Opens in beside column for split view

### 5. File Watching

**Watch Strategy:**

- Use Node.js `fs.watch()` for efficiency
- Debounce reload (250ms) to handle rapid writes
- Show status bar progress during reload
- Handle file deletion gracefully

**Update Flow:**

```
File Change → Debounce → Read File → Parse → Update Traces
                                              ↓
                                    Refresh Decorations
                                              ↓
                                    Refresh CodeLens
                                              ↓
                                    Update Active Webviews
```

---

## Commands

| Command                          | Title                         | Description                                       |
| -------------------------------- | ----------------------------- | ------------------------------------------------- |
| `traceMarkers.loadTrace`         | Trace: Load trace file        | Open file picker to load NDJSON/JSON              |
| `traceMarkers.toggleDecorations` | Trace: Toggle Decorations     | Show/hide all trace markers                       |
| `traceMarkers.openDetails`       | Trace: Open Details           | Open trace details (internal, called by CodeLens) |
| `traceMarkers.setTraceFile`      | Trace: Set Trace File (watch) | Configure file to watch for auto-reload           |
| `traceMarkers.clearTraces`       | Trace: Clear All Traces       | Remove all loaded traces                          |

---

## Configuration

### Settings

**`traceMarkers.traceFile`**

- Type: `string`
- Default: `""`
- Description: Absolute path to NDJSON trace file to watch
- Example: `/Users/user/project/traces/app.jsonl`

**`traceMarkers.autoReload`** (future)

- Type: `boolean`
- Default: `true`
- Description: Automatically reload trace file when it changes

**`traceMarkers.maxTraces`** (future)

- Type: `number`
- Default: `10000`
- Description: Maximum number of traces to load (performance)

---

## Path Resolution

### Problem

aitrace logs contain relative paths:

```
"file": "test/01_initial.py"
```

VSCode needs absolute paths:

```
"/Users/user/project/test/01_initial.py"
```

### Solution

1. **Detect workspace root** using same logic as aitrace
2. **Resolve relative paths:**
   ```typescript
   const absolutePath = path.join(workspaceRoot, trace.file);
   ```
3. **Normalize for cross-platform:**
   ```typescript
   const normalized = path.normalize(absolutePath).replace(/\\/g, "/");
   ```
4. **Cache workspace root** for performance

### Edge Cases

- Multiple workspace folders → use first matching
- Trace file outside workspace → show warning
- Symlinks → follow and resolve
- Missing files → show decoration but disable jump

---

## Performance Considerations

### Memory Management

- **Large trace files** (>10K traces)

  - Index traces by file for O(1) lookup
  - Lazy-load payload details
  - Limit decorations per file (top N)

- **Frequent updates**
  - Debounce file watch events (250ms)
  - Incremental updates (diff old vs new)
  - Cancel in-flight operations

### Optimization Strategies

1. **Index Structure:**

   ```typescript
   const tracesByFile = new Map<string, TraceItem[]>();
   ```

2. **Decoration Batching:**

   - Update all visible editors in one pass
   - Use `setDecorations()` once per editor

3. **CodeLens Caching:**
   - Only refresh on trace change
   - Use EventEmitter for efficient updates

---

## Error Handling

### Trace Loading Errors

```typescript
try {
  const traces = await loadTraceFromFile(filePath);
} catch (error) {
  vscode.window.showErrorMessage(
    `Failed to load trace: ${error.message}`,
    "Retry",
    "Cancel"
  );
}
```

### File Watching Errors

- File deleted → stop watching, show notification
- Permission denied → show error, offer file picker
- Parse errors → skip invalid lines, show warning with count

### Path Resolution Errors

- Workspace not found → prompt to select workspace
- File not in workspace → show relative path as-is
- Ambiguous paths → prefer first match, log warning

---

## Development Workflow

### Setup

```bash
cd vsc_ext
npm install
npm run watch  # Start TypeScript compiler in watch mode
```

### Testing

1. Press `F5` in VSCode to launch Extension Development Host
2. Load sample trace file: `test/test_source_location.py` output
3. Verify decorations appear on traced lines
4. Click CodeLens to open details panel

### Debugging

- Use VSCode debugger (F5)
- Set breakpoints in `src/extension.ts`
- View console output in Debug Console
- Check Extension Host logs

### Packaging

```bash
npm run package  # Creates .vsix file
```

---

## Future Enhancements

### Phase 1 (Current)

- ✅ Load trace files
- ✅ Show decorations
- ✅ CodeLens integration
- ✅ Webview details
- ✅ File watching

### Phase 2 (Planned)

- [ ] Filter traces by trace_id
- [ ] Search traces by event/field
- [ ] Timeline view of execution
- [ ] Span tree visualization
- [ ] Export filtered traces

### Phase 3 (Future)

- [ ] Live streaming via WebSocket
- [ ] Trace comparison (diff two runs)
- [ ] Performance metrics overlay
- [ ] Integration with Python debugger
- [ ] AI-powered trace analysis

---

## Dependencies

### Runtime

- VSCode Engine: `^1.92.0`
- Node.js built-ins: `fs`, `path`

### Development

- `typescript`: `^5.4.0`
- `@types/vscode`: `^1.92.0`
- `@vscode/vsce`: `^2.22.0` (for packaging)

### No External Dependencies

- Extension uses only VSCode API and Node.js built-ins
- No npm packages needed at runtime
- Minimal bundle size

---

## Security Considerations

### File System Access

- Only read trace files (no writes)
- Respect workspace boundaries
- Validate file paths before opening

### Content Security Policy

- Webview uses strict CSP
- No remote content loading
- Inline scripts allowed (required for functionality)

### User Data

- Trace data stays local
- No telemetry or tracking
- No network requests

---

## Compatibility

### VSCode Versions

- Minimum: `1.92.0`
- Tested: `1.92.x`, `1.93.x`
- Compatible: All recent versions

### Operating Systems

- ✅ macOS
- ✅ Linux
- ✅ Windows

### Python Versions

- Works with any Python version (reads logs only)
- aitrace requires Python 3.10+

---

## References

- [aitrace Documentation](../README.md)
- [VSCode Extension API](https://code.visualstudio.com/api)
- [Source Location Tracking](../docs/source_location_tracking.md)
- [Test Examples](../test/README.md)

---

**Last Updated:** 2025-10-25  
**Status:** Design Complete, Ready for Implementation
