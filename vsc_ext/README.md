# Trace Viewer - VSCode Extension

View [aitrace](../README.md) Python log traces directly in your source code with interactive markers and detailed panels.

## Features

- 📍 **Visual markers** with gutter icons and hover tooltips
- 🔍 **Interactive CodeLens** - click to view full trace details
- 📊 **Webview panels** with formatted JSON and metadata
- 🔄 **Live file watching** for real-time trace updates
- 🎯 **Automatic path resolution** from workspace root

## Quick Start

### 1. Install

```bash
cd vsc_ext
npm install
npm run build
```

### 2. Generate Traces

```python
from aitrace import setup_tracing, BufferedLogger

tracer = setup_tracing("my-app")
buffered = BufferedLogger(target="~/traces/app.jsonl")

with tracer.start_as_current_span("main"):
    buffered.logger.info("processing", item_id=42)

buffered.flush()
```

### 3. Load in VSCode

- Command Palette → `Trace: Load trace file`
- Or configure: `traceMarkers.traceFile` setting

See gutter icons appear on traced lines! Click CodeLens markers to view details.

## Documentation

- **[User Guide](docs/user-guide.md)** - Installation, configuration, and usage
- **[Development Guide](docs/development.md)** - Setup, building, and contributing
- **[AGENTS.md](AGENTS.md)** - Architecture and technical decisions
- **[CHANGELOG.md](CHANGELOG.md)** - Version history

## Configuration

Set in VSCode Settings (`Preferences → Settings → Extensions → Trace Viewer`):

- `traceMarkers.traceFile` - Path to trace file to watch
- `traceMarkers.autoReload` - Auto-reload on file changes (default: `true`)
- `traceMarkers.maxTraces` - Maximum traces to load (default: `10000`)

## Commands

- `Trace: Load trace file` - Load NDJSON or JSON trace file
- `Trace: Toggle Decorations` - Show/hide trace markers
- `Trace: Set Trace File (watch)` - Configure file to auto-watch
- `Trace: Clear All Traces` - Remove all traces

## Requirements

- VSCode 1.92.0+
- Node.js 16+
- aitrace Python library for generating traces

## Integration

Works seamlessly with [aitrace](../README.md):
- Same path format (relative from workspace root)
- Same workspace detection logic
- NDJSON output directly compatible

## License

MIT - See [LICENSE](../LICENSE)

## Links

- [aitrace Project](../README.md)
- [Report Issues](https://github.com/yourusername/mytrace/issues)
- [VSCode Extension API](https://code.visualstudio.com/api)
