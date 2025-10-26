# VSCode/Cursor Plugin Integration

This directory contains documentation for integrating AI Trace Viewer with VSCode and Cursor IDEs.

## Documentation

- [**plugin_format.md**](plugin_format.md) - Comprehensive guide to the plugin format specification
  - Format specification for trace records
  - Plugin implementation notes
  - Examples and code snippets
  - Integration guide

- [**format_example.jsonl**](format_example.jsonl) - Sample trace file in the expected format
  - NDJSON format example
  - Shows all required and optional fields
  - Can be used for testing plugin implementations

## Overview

AI Trace Viewer automatically tracks source locations (file paths and line numbers) for every log entry. This enables powerful IDE integration features:

- **Gutter marks** showing which lines have trace data
- **Clickable CodeLens** to view trace details
- **Jump to code** from trace viewer
- **In-editor trace visualization**

## Quick Start

### For VSCode Plugin Developers

1. Read [plugin_format.md](plugin_format.md) for the complete specification
2. Study [format_example.jsonl](format_example.jsonl) for sample data
3. Implement the plugin using the VSCode Extension API

### For Application Developers

AI Trace Viewer automatically generates traces compatible with the plugin format:

```python
from aitrace import setup_tracing, BufferedLogger

tracer = setup_tracing("my-app")
buffered = BufferedLogger(target="~/traces/app.jsonl")

with tracer.start_as_current_span("operation"):
    buffered.logger.info("doing_work", user_id=123)

buffered.flush()
```

The generated `app.jsonl` file is ready to use with the VSCode plugin.

## Format Specification

Each line in the trace file contains a JSON object:

```json
{
  "id": "f3bb1f86fc5572ac",
  "file": "src/auth/login.py",
  "line": 42,
  "severity": "info",
  "label": "user_login_start",
  "payload": { /* full log record */ }
}
```

See [plugin_format.md](plugin_format.md) for complete details.

## Related Documentation

- [Source Location Tracking](../source_location_tracking.md) - How AI Trace tracks source locations
- [Trace Record Format](../trace_record_format.md) - Internal trace record format
- [Configuration Guide](../configuration.md) - Server configuration
- [README.md](../../README.md) - Main project documentation

## External Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [CodeLens Provider](https://code.visualstudio.com/api/language-extensions/programmatic-language-features#codelens-show-actionable-context-information-within-source-code)
- [Decoration API](https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType)

---

**Last Updated:** 2025-10-26

