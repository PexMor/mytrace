# 🔍 AI Trace Viewer

A lightweight, self-contained system for viewing structured logs as collapsible execution trees using OpenTelemetry spans and structlog.

## Features

- 🌳 **Collapsible Trace Trees** - Visualize function call hierarchies with nested spans
- 📊 **Structured Logging** - JSON logs with automatic trace/span ID injection
- 🔗 **No External Dependencies** - No Zipkin, Jaeger, or other backend required
- 🚀 **Simple Setup** - Just SQLite + FastAPI + Static HTML/JS
- 🎨 **Modern UI** - Clean, responsive web interface
- 🔍 **Search & Filter** - Find logs by level, event, timestamp

## Quick Start

```bash
# 1. Install
uv sync

# 2. Start the viewer server
uv run aitrace

# 3. Run example (in another terminal)
uv sync --extra examples
uv run python test/02_simple.py

# 4. View traces at http://localhost:8000
```

See [📖 Quick Start Guide](docs/quickstart.md) for detailed instructions.

## Installation

```bash
# Install with uv (recommended)
uv sync

# Install with example dependencies (for test scripts)
uv sync --extra examples
```

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

### Getting Started

- [📖 Quick Start Guide](docs/quickstart.md) - Get up and running in 3 steps
- [⚙️ Configuration Guide](docs/configuration.md) - Server and environment setup
- [🏗️ Architecture & Design](AGENTS.md) - Technical decisions for developers and AI agents

### Advanced Topics

- [🚀 Deployment Guide](docs/deployment.md) - GitHub Pages deployment
- [👁️ Trace Viewer](docs/viewer.md) - Web-based trace visualization
- [🛠️ Development Notes](docs/development.md) - Internal implementation details

### Reference

- [📝 Changelog](CHANGELOG.md) - Version history and changes

## Project Structure

```
mytrace/
├── aitrace/              # Python tracing library
│   ├── buffer.py         # BufferedLogger for log ingestion
│   ├── server.py         # FastAPI server + SQLite backend
│   └── static/           # Web UI (simple viewer)
├── aitrace_viewer/       # Advanced web viewer (Preact + Vite)
│   └── src/              # TypeScript source
├── test/                 # Example scripts
├── docs/                 # Documentation
│   ├── quickstart.md     # Quick start guide
│   ├── configuration.md  # Configuration reference
│   ├── deployment.md     # Deployment guide
│   ├── viewer.md         # Trace viewer documentation
│   ├── development.md    # Development notes
│   ├── app/              # Built viewer application
│   └── archive/          # Historical documentation
├── README.md             # This file
├── AGENTS.md             # Architecture & technical decisions
└── CHANGELOG.md          # Version history
```

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

## Configuration

Quick examples:

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

## Examples

```bash
# Simple chatbot
uv run python test/02_simple.py

# Router with multiple agents
uv run python test/03_router.py

# BufferedLogger patterns
uv run python test/04_buffered_simple.py

# Output target modes
uv run python test/05_target_modes.py
```

See [test/README.md](test/README.md) for detailed example documentation.

## API Endpoints

- `POST /api/ingest` - Ingest log records
- `GET /api/traces` - List all traces with metadata
- `GET /api/trace/{id}` - Get detailed trace with tree structure
- `GET /api/search` - Search logs with filters

## Requirements

- Python 3.10+
- Modern web browser for UI

## License

MIT - See [LICENSE](LICENSE) for details

## Credits

Built on OpenTelemetry, structlog, and FastAPI concepts. Inspired by Jaeger and Zipkin, simplified for local development and small-scale production use.

---

**Need Help?** Check the [Quick Start Guide](docs/quickstart.md) or [AGENTS.md](AGENTS.md) for architecture details.
