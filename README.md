# 🔍 AI Trace Viewer

A lightweight, self-contained system for viewing structured logs as collapsible execution trees using OpenTelemetry spans and structlog.

## Features

- 🌳 **Collapsible Trace Trees** - Visualize function call hierarchies with nested spans
- 📊 **Structured Logging** - JSON logs with automatic trace/span ID injection
- 📍 **Source Location Tracking** - Automatic file path and line number capture
- 🔗 **No External Dependencies** - No Zipkin, Jaeger, or other backend required
- 🚀 **Simple Setup** - Just SQLite + FastAPI + Static HTML/JS
- 🎨 **Modern UI** - Clean, responsive web interface with advanced features
- 🔌 **VSCode/Cursor Plugin Ready** - Compatible with IDE plugins for in-editor trace viewing

## Quick Start

```bash
# Install
uv sync

# Start the viewer server
uv run aitrace

# Run example (in another terminal)
uv sync --extra examples
uv run python test/02_simple.py

# View traces at http://localhost:8000
```

For detailed instructions, see the [📖 Quick Start Guide](docs/quickstart.md).

## Basic Usage

```python
from aitrace import setup_tracing, auto_span, BufferedLogger

# Initialize
tracer = setup_tracing("my-service")
buffered = BufferedLogger(target="http://localhost:8000/api/ingest")
log = buffered.logger

# Instrument your code
@auto_span()
def my_function(arg):
    log.info("doing_work", arg=arg)
    return result

# Auto-send logs to viewer
with buffered.trace_context(tracer, "my_operation"):
    my_function("test")
# Logs automatically sent when context exits
```

## Documentation

### User Guides

- [📖 Quick Start Guide](docs/quickstart.md) - Get up and running in 3 steps
- [⚙️ Configuration Guide](docs/configuration.md) - Server and environment setup
- [👁️ Trace Viewer Guide](docs/viewer.md) - Web-based trace visualization
- [🚀 Deployment Guide](docs/deployment.md) - Production deployment options

### Developer Resources

- [🏗️ Architecture & Design Decisions](AGENTS.md) - Technical decisions for developers and AI agents
- [🛠️ Development Guide](docs/development.md) - Setup, testing, and contributing
- [📝 Changelog](CHANGELOG.md) - Version history and breaking changes
- [📋 Trace Record Format](docs/trace_record_format.md) - JSON format specification

### Advanced Topics

- [📍 Source Location Tracking](docs/source_location_tracking.md) - IDE integration details
- [🔌 VSCode Plugin Format](docs/vscode_plugin_format_README.md) - Plugin integration guide

## Architecture Overview

```
┌─────────────┐
│  Your App   │  Uses @auto_span decorator + structlog
└──────┬──────┘
       │
       │ JSON logs (trace_id, span_id, parent_span_id)
       │
       ▼
┌─────────────┐
│   SQLite    │  Stores logs indexed by trace/span
└──────┬──────┘
       │
       │ REST API
       │
       ▼
┌─────────────┐
│  Web UI     │  Browse traces, view collapsible trees
└─────────────┘
```

See [AGENTS.md](AGENTS.md) for comprehensive architectural documentation.

## Project Structure

```
mytrace/
├── aitrace/              # Python tracing library
│   ├── buffer.py         # BufferedLogger for log ingestion
│   ├── server.py         # FastAPI server + SQLite backend
│   └── static/           # Web UI (simple viewer)
├── aitrace_viewer/       # Advanced web viewer (Preact + Vite)
├── test/                 # Example scripts
├── docs/                 # Documentation
│   ├── quickstart.md
│   ├── configuration.md
│   ├── deployment.md
│   ├── viewer.md
│   ├── development.md
│   └── archive/          # Historical documentation
├── README.md             # This file
├── AGENTS.md             # Architecture & technical decisions
└── CHANGELOG.md          # Version history
```

## Examples

```bash
# Simple chatbot
uv run python test/02_simple.py

# Router with multiple agents
uv run python test/03_router.py

# BufferedLogger patterns
uv run python test/04_buffered_simple.py

# Output target modes (HTTP, file, stdout)
uv run python test/05_target_modes.py
```

See [test/README.md](test/README.md) for detailed example documentation.

## Configuration

Quick configuration examples:

```bash
# Custom port
aitrace --port 9000

# Development mode
aitrace --reload --log-level debug

# Custom database
aitrace --db-path /tmp/traces.db

# Using environment variables
export AITRACE_PORT=9000
export AITRACE_LOG_LEVEL=debug
aitrace
```

See [Configuration Guide](docs/configuration.md) for complete reference.

## Requirements

- Python 3.10+
- Modern web browser for UI
- Node.js 18+ (optional, for advanced viewer development)

## Installation Options

### Using uv (recommended)
```bash
uv sync
```

### Using pip
```bash
pip install -e .
```

### With example dependencies
```bash
uv sync --extra examples
```

## Use Cases

**Development & Debugging**
- Trace LangGraph/LangChain execution flows
- Debug nested function calls
- Inspect LLM prompts and responses

**Production Monitoring**
- Lightweight tracing without external services
- Local SQLite storage for moderate volumes
- Export logs to files for archival

**Testing & CI/CD**
- Capture traces as test artifacts
- Generate HTML traces offline
- File-based logging for reproducibility

## License

MIT - See [LICENSE](LICENSE) for details

## Credits

Built on OpenTelemetry, structlog, and FastAPI. Inspired by Jaeger and Zipkin, simplified for local development and small-scale production use.

---

**Need Help?** Check the [Quick Start Guide](docs/quickstart.md) or [AGENTS.md](AGENTS.md) for architecture details.
