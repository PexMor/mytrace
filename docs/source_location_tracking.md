# Source Location Tracking

## Overview

AI Trace Viewer now automatically tracks the source file location (file path and line number) for every log entry. This enables powerful IDE integration features like:

- **Gutter marks** showing which lines have trace data
- **Clickable CodeLens** to view trace details
- **Jump to code** from trace viewer
- **VSCode/Cursor plugin** integration

## How It Works

When you call `setup_logging()`, a special processor is added that:

1. **Captures the call site** - Uses Python's `inspect.stack()` to find where the log was called
2. **Converts to relative path** - Makes paths relative to your workspace root (detected automatically)
3. **Adds to log record** - Injects `file`, `line`, and `function` fields into every log entry

## Example Log Entry

```json
{
  "timestamp": "2025-10-25T10:30:15.123456Z",
  "event": "user_login",
  "level": "info",
  "file": "src/auth/login.py",
  "line": 42,
  "function": "handle_login",
  "trace_id": "abc123...",
  "span_id": "def456...",
  "user_id": 12345
}
```

## Workspace Root Detection

The system automatically detects your project root by looking for common markers (in priority order):

1. `.git` directory
2. `pyproject.toml`
3. `setup.py`
4. `requirements.txt`

If none are found, it uses the current working directory.

### Manual Override

You can manually set the workspace root if automatic detection doesn't work:

```python
from aitrace import logging_config

# Set workspace root explicitly
logging_config.set_workspace_root("/path/to/my/project")

# Check current workspace root
root = logging_config.get_workspace_root()
print(f"Workspace root: {root}")
```

## VSCode/Cursor Plugin Integration

The generated trace files are compatible with the VSCode/Cursor plugin described in the specification.

### Expected Format

The plugin expects NDJSON (newline-delimited JSON) files with these fields:

```typescript
{
  id: string;        // trace_id or span_id
  file: string;      // relative path from workspace root
  line: number;      // 1-based line number
  severity?: "info" | "warn" | "error";
  label?: string;    // event or custom label
  payload?: any;     // full log record
}
```

### Mapping from AI Trace

AI Trace logs map to the plugin format as:

| AI Trace Field | Plugin Field | Notes             |
| -------------- | ------------ | ----------------- |
| `span_id`      | `id`         | Unique identifier |
| `file`         | `file`       | Relative path ✓   |
| `line`         | `line`       | Line number ✓     |
| `level`        | `severity`   | info/warn/error   |
| `event`        | `label`      | Event name        |
| (entire log)   | `payload`    | Full log record   |

### Export for Plugin

To export traces in a format the plugin can consume:

```python
from aitrace import BufferedLogger

# Option 1: Write to NDJSON file
buffered = BufferedLogger(target="~/traces/my_app.jsonl")
# ... your code with logging ...
buffered.flush()

# Option 2: Transform existing logs
import json

# Read from SQLite or existing logs
logs = get_all_logs()  # your fetch method

# Write in plugin format
with open("trace_for_plugin.ndjson", "w") as f:
    for log in logs:
        plugin_record = {
            "id": log["span_id"],
            "file": log["file"],  # already relative!
            "line": log["line"],
            "severity": log["level"],
            "label": log.get("event", "log"),
            "payload": log,
        }
        f.write(json.dumps(plugin_record) + "\n")
```

## Portability

### Why Relative Paths?

Relative paths make traces portable across:

- **Different machines** - No need to adjust absolute paths
- **Team environments** - Everyone can use the same trace files
- **CI/CD pipelines** - Works regardless of checkout location
- **Docker containers** - Paths remain valid inside containers

### Absolute Path Resolution (Plugin Side)

The VSCode/Cursor plugin will need to:

1. **Read the trace file** (NDJSON format)
2. **Detect workspace root** (same logic: look for .git, pyproject.toml, etc.)
3. **Resolve absolute paths** by combining:
   ```
   absolute_path = workspace_root / relative_path
   ```

Example plugin code:

```typescript
// Detect workspace root in VSCode
const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

// Load trace record
const traceRecord = JSON.parse(line);

// Resolve to absolute path
const absolutePath = path.join(workspaceRoot, traceRecord.file);

// Open file at line
vscode.workspace.openTextDocument(absolutePath).then((doc) => {
  vscode.window.showTextDocument(doc, {
    selection: new vscode.Range(
      traceRecord.line - 1,
      0,
      traceRecord.line - 1,
      0
    ),
  });
});
```

## Testing

Run the test script to verify source location tracking:

```bash
uv run python test_source_location.py
```

Expected output includes:

- Detected workspace root
- JSON logs with `file`, `line`, and `function` fields
- All file paths are relative to workspace root

## Performance Considerations

### Stack Inspection Cost

Source location tracking uses `inspect.stack()` which has a small performance cost:

- **Typical overhead**: ~10-50 microseconds per log call
- **Impact**: Negligible for most applications
- **When to disable**: Only in extreme high-frequency logging scenarios

### Workspace Root Caching

The workspace root is detected once and cached, so subsequent lookups are instant.

## Limitations

### Virtual Environments

If your code is inside a virtual environment (e.g., `.venv`), the paths may include the venv directory. This is usually fine, but you can adjust by setting the workspace root manually.

### Symbolic Links

Paths are resolved (following symlinks) before making them relative. This ensures consistency but may show unexpected paths if you use symlinks creatively.

### Third-Party Libraries

Logs from third-party libraries will show paths to their installation location, not your workspace. The system filters out internal logging framework calls but doesn't filter library code.

## Integration Examples

### FastAPI Application

```python
from fastapi import FastAPI
from aitrace import setup_tracing, setup_logging, auto_span

app = FastAPI()
tracer = setup_tracing("my-api")
log = setup_logging()

@app.get("/users/{user_id}")
@auto_span()
async def get_user(user_id: int):
    log.info("fetching_user", user_id=user_id)
    # file: api/routes/users.py, line: 12

    user = await db.fetch_user(user_id)

    log.info("user_fetched", user_id=user_id, found=user is not None)
    # file: api/routes/users.py, line: 16

    return user
```

### Command-Line Tool

```python
import argparse
from aitrace import setup_tracing, setup_logging, BufferedLogger

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--trace", help="Save trace to file")
    args = parser.parse_args()

    # Setup tracing
    tracer = setup_tracing("cli-tool")

    # Use BufferedLogger to save traces
    if args.trace:
        buffered = BufferedLogger(target=args.trace)
        log = buffered.logger

        with tracer.start_as_current_span("main"):
            # Your code here
            log.info("processing_start")
            # ... work ...
            log.info("processing_complete")

        buffered.flush()
    else:
        log = setup_logging()
        # ... regular logging ...

if __name__ == "__main__":
    main()
```

### Background Job

```python
from aitrace import setup_tracing, setup_logging, auto_span

tracer = setup_tracing("background-worker")
log = setup_logging()

@auto_span()
def process_job(job_id: str):
    log.info("job_start", job_id=job_id)
    # file: workers/processor.py, line: 10

    try:
        result = do_work(job_id)
        log.info("job_success", job_id=job_id, result=result)
        # file: workers/processor.py, line: 14
    except Exception as e:
        log.error("job_failed", job_id=job_id, error=str(e))
        # file: workers/processor.py, line: 17
        raise
```

## Future Enhancements

Potential improvements for the plugin integration:

1. **Automatic trace export** - CLI command to export logs in plugin format
2. **Source maps support** - Handle transpiled/compiled code
3. **Multi-project support** - Handle monorepos with multiple workspace roots
4. **Smart path resolution** - Better handling of venv, docker, etc.
5. **Column tracking** - Add column number for precise location

## See Also

- [README.md](../README.md) - Main documentation
- [VSCode Plugin Format](vscode/plugin_format.md) - VSCode plugin integration
- [Configuration Guide](configuration.md) - Server configuration
- [Test Examples](../test/README.md) - Example scripts
