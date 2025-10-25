# Changelog

All notable changes to the "trace-viewer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-25

### Added

- Initial release of Trace Viewer extension
- Load NDJSON and JSON trace files from aitrace
- Visual gutter icons for trace markers (info/warning/error)
- Hover tooltips with trace preview
- Overview ruler marks for quick navigation
- Interactive CodeLens above traced lines
- Detailed webview panels with formatted JSON
- File watching for automatic trace reload
- Workspace root detection (matches aitrace Python logic)
- Commands for loading, toggling, and clearing traces
- Configuration for trace file path and auto-reload
- Support for Python source files (.py)
- Relative path resolution from workspace root
- Debounced file watching to handle rapid writes
- Maximum trace limit for performance (configurable)

### Features

- **Trace Loading**: Load from file picker or configure auto-watch path
- **Visual Decorations**: Gutter icons, hover tooltips, overview ruler
- **CodeLens Integration**: Clickable "🔍 Trace: ..." markers above code
- **Webview Details**: Full trace information in split view panel
- **Live Watching**: Auto-reload when trace file changes
- **Path Resolution**: Automatic workspace root detection and path mapping

### Configuration Options

- `traceMarkers.traceFile` - Path to trace file to watch
- `traceMarkers.autoReload` - Enable/disable auto-reload
- `traceMarkers.maxTraces` - Maximum number of traces to load

### Supported Formats

- NDJSON (newline-delimited JSON): `{...}\n{...}\n`
- JSON array: `[{...}, {...}]`
- Mixed (skips invalid lines gracefully)

### Integration

- Works seamlessly with aitrace Python library
- Reads output from `BufferedLogger` with file target
- Matches aitrace's workspace root detection logic
- Supports all aitrace log fields (file, line, function, trace_id, etc.)

## [Unreleased]

### Planned

- Filter traces by trace_id
- Search traces by event name or fields
- Timeline view of trace execution
- Span tree visualization for nested calls
- Export filtered traces to file
- Multi-file trace navigation
- Trace comparison between runs
- Integration with Python debugger

---

## Release Notes

### 0.1.0 - Initial Release

First public release of the Trace Viewer extension! This extension brings aitrace's powerful Python logging directly into your VSCode editor.

**Key Features:**

- See exactly which lines of code were executed
- Click on trace markers to view detailed log information
- Watch trace files for live updates as your app runs
- Beautiful gutter icons and hover tooltips
- Split-view trace details panel

**Getting Started:**

1. Install the extension
2. Run your Python app with aitrace
3. Load the trace file in VSCode
4. See your traces come to life!

See [README.md](README.md) for full documentation.
