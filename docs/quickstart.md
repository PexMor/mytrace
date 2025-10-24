# 🚀 Quick Start Guide

## Getting Started in 3 Steps

### Terminal 1: Start the server

```bash
uv run aitrace
```

Server starts at `http://localhost:8000`  
Data stored in `~/.config/aitrace/logs.db`

```bash
export LOG_TRG="~/tmp/my-logs/<YYYYMMDD_HHMMSS>.jsonl"
```

### Terminal 2: Install examples and configure environment

```bash
# Install example dependencies
uv sync --extra examples

# Set up environment for examples
cp env.example .env
# Edit .env to add your API keys (ANTHROPIC_API_KEY or LLMLITE_*)
```

### Terminal 3: Run example script

```bash
# Simple chatbot example
uv run python test/02_simple.py

# Or router example with multiple agents
uv run python test/03_router.py
```

### Browser: View traces

Open: http://localhost:8000

---

## Available Commands

### Server Commands

| Command               | Description                      |
| --------------------- | -------------------------------- |
| `uv run aitrace`      | Start server (recommended)       |
| `aitrace`             | Start server (if venv activated) |
| `python -m aitrace`   | Alternative way to start server  |
| `aitrace --port 9000` | Start on custom port             |
| `aitrace --help`      | Show all configuration options   |

### Example Scripts

| Command                                    | Description                 |
| ------------------------------------------ | --------------------------- |
| `uv run python test/02_simple.py`          | Simple LangGraph chatbot    |
| `uv run python test/03_router.py`          | Router with multiple agents |
| `uv run python test/04_buffered_simple.py` | BufferedLogger patterns     |
| `uv run python test/05_target_modes.py`    | Output target modes demo    |

---

## What You'll See

1. **Traces List** - Overview of all execution traces
2. **Collapsible Trees** - Click any trace to see the execution flow
3. **Search** - Filter logs by level, event, or time
4. **Detailed Logs** - Each span shows all its log entries with context

---

## Configuration Options

### Server Configuration

```bash
# Custom port
aitrace --port 9000

# Development mode
aitrace --reload --log-level debug

# Custom database location
aitrace --db-path /tmp/my-traces.db
```

### Environment Variables

All server options can be set via environment variables:

```bash
export AITRACE_PORT=9000
export AITRACE_LOG_LEVEL=debug
aitrace
```

See [docs/configuration.md](docs/configuration.md) for full configuration guide.

---

## Typical Workflow

1. Start server: `uv run aitrace`
2. Run your instrumented app (or example scripts)
3. Browse traces in the web UI at http://localhost:8000
4. Click traces to see execution trees
5. Search/filter to find specific events
6. Debug and analyze your application flow

---

## Need Help?

- **Full docs**: [README.md](README.md)
- **Configuration**: [docs/configuration.md](docs/configuration.md)
- **Example code**: [test/](test/) directory
- **Test utilities**: [test/README.md](test/README.md)
