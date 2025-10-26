---
layout: page
title: Development Documentation
---

# Development Documentation

This document contains internal implementation details, refactoring notes, and development history for contributors and maintainers.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Implementation Details](#implementation-details)
- [Testing](#testing)
- [Recent Updates](#recent-updates)
- [Contributing](#contributing)

---

## Development Setup

### Prerequisites

- Python 3.10 or higher
- Node.js 18+ (for advanced viewer)
- uv package manager (recommended)

### Python Library Setup

```bash
# Clone repository
git clone https://github.com/yourusername/mytrace.git
cd mytrace

# Install dependencies
uv sync

# Install with examples
uv sync --extra examples

# Run in development mode
uv run aitrace --reload --log-level debug
```

### Advanced Viewer Setup

```bash
cd aitrace_viewer

# Install dependencies
yarn install

# Development mode
yarn dev

# Build for production
yarn build

# Preview production build
yarn preview
```

---

## Project Structure

```
mytrace/
├── aitrace/                 # Python tracing library
│   ├── __init__.py          # Package exports
│   ├── __main__.py          # Entry point
│   ├── buffer.py            # BufferedLogger with multiple targets
│   ├── config.py            # Configuration system
│   ├── decorators.py        # @auto_span decorator
│   ├── logging_config.py    # structlog configuration
│   ├── server.py            # FastAPI + SQLite backend
│   ├── tracing.py           # OpenTelemetry setup
│   └── static/              # Simple web UI
│       ├── index.html
│       ├── style.css
│       └── script.js
├── aitrace_viewer/          # Advanced web viewer
│   ├── src/
│   │   ├── App.tsx          # Main application
│   │   ├── components/      # React components
│   │   │   ├── JsonTree.tsx
│   │   │   ├── NodeRow.tsx
│   │   │   ├── TimestampSettings.tsx
│   │   │   └── TreeView.tsx
│   │   ├── lenses/          # Lens configuration
│   │   │   └── lensConfig.ts
│   │   ├── logic/           # Business logic
│   │   │   └── buildSpanTree.ts
│   │   └── utils/           # Utilities
│   │       └── timestampFormat.ts
│   ├── public/
│   │   └── samples/         # Sample JSONL files
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── test/                    # Example scripts and tests
│   ├── common.py            # Shared test utilities
│   ├── 01_initial.py        # Complex e-commerce test
│   ├── 02_simple.py         # Simple chatbot example
│   ├── 03_router.py         # Router pattern
│   ├── 04_buffered_simple.py # BufferedLogger examples
│   └── 05_target_modes.py   # Output target modes demo
├── docs/                    # Documentation
│   ├── quickstart.md
│   ├── configuration.md
│   ├── deployment.md
│   ├── viewer.md
│   ├── development.md       # This file
│   ├── app/                 # Built viewer application
│   └── archive/             # Historical documentation
├── README.md                # Main documentation
├── AGENTS.md                # Architecture reference
├── CHANGELOG.md             # Version history
├── pyproject.toml           # Python dependencies
└── uv.lock                  # Dependency lock file
```

---

## Implementation Details

### BufferedLogger Refactoring

**Version:** 0.2.0  
**Date:** 2025-10-19

#### Problem Statement

Early versions had custom buffering code repeated in every test file, leading to:

- Code duplication (40+ lines per file)
- Inconsistent configuration
- Hard to maintain
- Error-prone setup

#### Solution

Created `BufferedLogger` class as a reusable component:

```python
from aitrace import BufferedLogger

# Simple initialization
buffered = BufferedLogger(target="http://localhost:8000/api/ingest")
log = buffered.logger

# Auto-flush pattern
with buffered.trace_context(tracer, "operation"):
    log.info("doing work")
# Automatically flushes on exit
```

#### Benefits

- **Reduced code**: 44 lines → 3 lines in test files
- **Reusability**: Single well-tested implementation
- **Flexibility**: Multiple output targets (HTTP, file, stdout)
- **Better DX**: Simpler setup for new users

### Output Target Modes

**Version:** 0.2.0  
**Date:** 2025-10-19

#### Feature

Support for multiple output targets via `target` parameter or `LOG_TRG` environment variable:

| Target     | Format       | Example                              | Use Case       |
| ---------- | ------------ | ------------------------------------ | -------------- |
| **HTTP**   | `http://...` | `http://localhost:8000/api/ingest`   | Send to server |
| **File**   | Path         | `~/logs/app/<YYYYMMDD_HHMMSS>.jsonl` | Archival       |
| **Stdout** | `-`          | `-`                                  | Container logs |

#### Implementation

```python
def _parse_target(self, target: str | None) -> tuple[str, str | None]:
    """Parse target string and determine type"""
    if target.startswith(("http://", "https://")):
        return ("http", target)
    elif target == "-":
        return ("stdout", None)
    else:
        # File path with expansion
        expanded = os.path.expanduser(target)
        expanded = expanded.replace("<YYYYMMDD_HHMMSS>", self.init_timestamp)
        return ("file", expanded)
```

#### Features

- **Tilde expansion**: `~/path` → `/Users/username/path`
- **Timestamp substitution**: `<YYYYMMDD_HHMMSS>` → `20251024_103014`
- **Automatic directory creation**: Parent dirs created if missing
- **JSONL format**: One JSON object per line
- **Append mode**: Safe for multiple runs

### Configuration System

**Version:** Unreleased  
**Date:** 2025-10-19

#### Design

Layered configuration with priority:

1. Command line arguments (highest)
2. Environment variables (AITRACE\_\*)
3. Config file (~/.config/aitrace/config.yaml or config.toml)
4. Defaults (lowest)

#### Implementation

Uses `configargparse` for multi-source configuration:

```python
import configargparse

parser = configargparse.ArgumentParser(
    default_config_files=[
        "~/.config/aitrace/config.yaml",
        "~/.config/aitrace/config.toml"
    ]
)
parser.add_argument("--port", env_var="AITRACE_PORT", default=8000)
parser.add_argument("--host", env_var="AITRACE_HOST", default="0.0.0.0")
# ... more options
```

#### Benefits

- **Flexible**: Multiple configuration sources
- **Predictable**: Clear priority order
- **DX**: Environment-based configuration for different deployments
- **Backward compatible**: Existing code still works

### Graceful Error Handling

**Version:** Unreleased  
**Date:** 2025-10-24

#### Problem

Connection failures to trace server caused crashes and unhelpful error messages.

#### Solution

Automatic fallback to HTML export when server is unreachable:

```python
def _flush_http(self):
    try:
        response = requests.post(self.target_url, json=logs)
        return response.json()
    except requests.exceptions.ConnectionError as e:
        # Fallback to HTML export
        html_path = self._export_to_html_fallback(logs)
        print(f"⚠️  Cannot connect to server")
        print(f"✓  Trace saved to: {html_path}")
        return {"ingested": len(logs), "fallback": html_path}
```

#### HTML Export Features

- Beautiful, responsive design
- Syntax-highlighted JSON
- Color-coded log levels
- Self-contained (no external dependencies)
- Saved to `~/tmp/temp-trace/<YYYYMMDD_HHMMSS>.html`

### Advanced Serialization

**Version:** Unreleased  
**Date:** 2025-10-24

#### Problem

Python objects like UUID, datetime, dataclasses caused `TypeError: Object of type X is not JSON serializable`.

#### Solution

Custom JSON serializer with support for:

```python
def _json_serializer(obj):
    """Handle non-JSON-serializable types"""
    if isinstance(obj, uuid.UUID):
        return str(obj)
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, timedelta):
        return obj.total_seconds()
    elif isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, Enum):
        return obj.value
    elif isinstance(obj, (set, frozenset)):
        return list(obj)
    elif hasattr(obj, "__dataclass_fields__"):
        return dataclasses.asdict(obj)
    elif hasattr(obj, "__dict__"):
        d = {"__type__": type(obj).__name__}
        d.update(obj.__dict__)
        return d
    else:
        return str(obj)
```

#### Benefits

- **Automatic handling**: No manual conversion needed
- **Type preservation**: `__type__` field for custom objects
- **Comprehensive**: Handles all common Python types
- **LangChain compatible**: Works with LangChain callbacks (UUID, metadata)

### Viewer Rendering Updates

**Version:** Unreleased  
**Date:** 2025-10-24

#### Smart Value Detection

Automatically detects "simple" vs "complex" values:

```typescript
function isSimpleValue(value: any): boolean {
  const type = typeof value;
  if (value === null || value === undefined) return true;
  if (type === "number" || type === "boolean") return true;
  if (type === "string" && value.length <= 80) return true;
  return false;
}
```

#### Compact Chip Rendering

Simple values rendered as compact chips:

```css
.field-chip {
  display: inline-flex;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border: 1px solid #ced4da;
  background-color: #f8f9fa;
}
```

Result:

```
[Message Count: 1] [Model: ChatOpenAI] [Run ID: f3577ee7...]
```

#### Expandable Trees

Complex values rendered as expandable JSON trees with:

- Chevron icon positioned in front
- Context menu (right-click) for Copy/Download
- Smart expansion depth
- Automatic JSON string parsing

---

## Testing

### Test Infrastructure

**Location:** `test/`

#### Shared Utilities (`common.py`)

```python
class InspectHandler(BaseCallbackHandler):
    """LangChain callback handler for logging"""
    def on_llm_start(self, serialized, prompts, **kwargs):
        log.info("llm_start", prompts=prompts, ...)

def init_llm():
    """Initialize LLM with llmlite or direct Anthropic"""
    # Supports both llmlite proxy and direct API

def setup_tracing_and_logging(service_name, target=None):
    """Setup tracer and buffered logger"""
    tracer = setup_tracing(service_name)
    buffered = BufferedLogger(target=target)
    return tracer, buffered
```

#### Test Scripts

| Script                  | Description             | Features                                      |
| ----------------------- | ----------------------- | --------------------------------------------- |
| `01_initial.py`         | Complex e-commerce test | Nested spans, error handling, random failures |
| `02_simple.py`          | Simple chatbot          | Basic LangGraph integration                   |
| `03_router.py`          | Router pattern          | Multiple agents, conditional logic            |
| `04_buffered_simple.py` | BufferedLogger examples | Manual flush, auto-flush patterns             |
| `05_target_modes.py`    | Output target modes     | HTTP, file, stdout demos                      |

### Running Tests

```bash
# Start server first
uv run aitrace

# Run individual tests
uv run python test/02_simple.py
uv run python test/03_router.py

# With custom target
export LOG_TRG="~/logs/test/<YYYYMMDD_HHMMSS>.jsonl"
uv run python test/04_buffered_simple.py

# File-based (no server needed)
export LOG_TRG="~/logs/test.jsonl"
uv run python test/02_simple.py
```

### Test Coverage

- ✅ Span creation and nesting
- ✅ Log entry with context
- ✅ Trace ID propagation
- ✅ Error logging with exceptions
- ✅ Tree reconstruction
- ✅ UI rendering
- ✅ LangChain/LangGraph integration
- ✅ Multiple output targets
- ✅ Fallback HTML generation
- ✅ Advanced serialization (UUID, datetime, dataclasses)

---

## Recent Updates

### October 24, 2025

**Features:**

- Universal `LOG_TRG` support across all test examples
- Graceful error handling with HTML fallback
- HTML trace export with embedded styling
- Automatic fallback to file output when server unreachable

**Files Modified:**

- `aitrace/buffer.py` - Added HTML template and fallback logic
- `test/common.py` - Updated to respect LOG_TRG
- `test/01_initial.py`, `test/04_buffered_simple.py` - Removed error handling (now in buffer.py)
- `test/README.md` - Updated with LOG_TRG documentation

**Benefits:**

- No server required for testing
- Resilient to network issues
- Better developer experience
- Automatic trace preservation

### October 19, 2025

**Features:**

- Configuration system with YAML/TOML support
- Multiple output target modes (HTTP, file, stdout)
- BufferedLogger refactoring
- Advanced JSON serialization

**Files Modified:**

- `aitrace/config.py` - New configuration system
- `aitrace/buffer.py` - Added target modes, JSON serializer
- `test/common.py` - Extracted shared code
- `docs/configuration.md` - New documentation

**Breaking Changes:**

- `api_url` parameter removed (use `target` instead)
- `send_logs()` function removed (use `BufferedLogger.flush()`)

### October 18, 2025 (Initial Release)

**Features:**

- OpenTelemetry integration without exporters
- structlog with automatic trace ID injection
- @auto_span decorator
- SQLite storage with tree reconstruction
- FastAPI backend
- Simple web UI
- Advanced web viewer (Preact + Vite)

---

## Contributing

### Code Style

- **Python**: Follow PEP 8, use type hints
- **TypeScript**: Follow project ESLint config
- **Commits**: Conventional commits format

### Adding Features

1. Create feature branch: `git checkout -b feature/my-feature`
2. Implement changes with tests
3. Update documentation
4. Submit pull request

### Adding Test Examples

1. Create new file in `test/`: `test/0X_feature.py`
2. Use `common.py` utilities
3. Document in `test/README.md`
4. Add to main README examples section

### Adding Lenses

1. Edit `aitrace_viewer/src/lenses/lensConfig.ts`
2. Add lens configuration
3. Test with sample data
4. Document in lens system guide

### Documentation

- Update CHANGELOG.md for all changes (follow Keep a Changelog format)
- Update AGENTS.md for architectural decisions
- Update relevant docs in `docs/` folder
- Keep README.md brief with links to detailed docs

---

## Build and Release

### Python Package

```bash
# Build package
uv build

# Install locally
uv pip install -e .

# Publish to PyPI
uv publish
```

### Advanced Viewer

```bash
cd aitrace_viewer

# Build
yarn build

# Output goes to docs/app/

# Deploy to GitHub Pages
git add docs/app
git commit -m "Update viewer build"
git push
```

### Version Bumping

1. Update version in `pyproject.toml`
2. Update CHANGELOG.md
3. Create git tag: `git tag v0.X.0`
4. Push tag: `git push --tags`

---

## Debugging

### Server Issues

```bash
# Enable debug logging
aitrace --log-level debug --access-log

# Check database
sqlite3 ~/.config/aitrace/logs.db "SELECT COUNT(*) FROM logs;"

# Reset database
rm ~/.config/aitrace/logs.db
aitrace
```

### Viewer Issues

```bash
# Advanced viewer development
cd aitrace_viewer
yarn dev

# Check browser console for errors
# Open DevTools → Console

# Rebuild from scratch
yarn clean
yarn install
yarn build
```

### Test Issues

```bash
# Check if server is running
curl http://localhost:8000/api/traces

# Test with file output instead
export LOG_TRG="~/test.jsonl"
uv run python test/02_simple.py

# Check environment
uv run python -c "import aitrace; print(aitrace.__file__)"
```

---

## Performance Profiling

### Python Server

```bash
# Profile with py-spy
pip install py-spy
py-spy record -o profile.svg -- aitrace

# Memory profiling
pip install memory_profiler
python -m memory_profiler aitrace/server.py
```

### Database Queries

```sql
-- Explain query plan
EXPLAIN QUERY PLAN SELECT * FROM logs WHERE trace_id = 'abc';

-- Analyze database
ANALYZE;

-- Check index usage
PRAGMA index_list('logs');
PRAGMA index_info('idx_logs_trace');
```

### Viewer Performance

```javascript
// Browser DevTools → Performance
// Record trace tree rendering
// Look for long tasks and optimize
```

---

## See Also

- [README.md](../README.md) - Main documentation
- [AGENTS.md](../AGENTS.md) - Architecture reference
- [CHANGELOG.md](../CHANGELOG.md) - Version history
- [Quick Start Guide](quickstart.md)
- [Configuration Guide](configuration.md)
- [Deployment Guide](deployment.md)
- [Viewer Documentation](viewer.md)
- [Trace Record Format](trace_record_format.md) - Log format specification
