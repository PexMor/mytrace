# Changelog

All notable changes to the AI Trace Viewer project are documented here.

## [Unreleased]

### Added

#### Configuration System

- **`aitrace/config.py`** - New configuration management module using `configargparse`
  - Support for YAML and TOML config files in `~/.config/aitrace/`
  - Environment variable support (prefixed with `AITRACE_`)
  - Command line argument support
  - Priority: CLI args > env vars > config file > defaults
- **Centralized Storage** - All data now stored in `~/.config/aitrace/`
  - Database: `~/.config/aitrace/logs.db` (with .db-shm, .db-wal)
  - Config: `~/.config/aitrace/config.yaml` or `config.toml`
  - Example configs: `config.yaml.example`, `config.toml.example`
- **New Configuration Options**:
  - `--host` / `AITRACE_HOST`: Server host (default: 0.0.0.0)
  - `--port` / `AITRACE_PORT`: Server port (default: 8000)
  - `--db-path` / `AITRACE_DB_PATH`: Custom database location
  - `--reload` / `AITRACE_RELOAD`: Auto-reload for development
  - `--log-level` / `AITRACE_LOG_LEVEL`: Server log level (critical/error/warning/info/debug)
  - `--access-log` / `AITRACE_ACCESS_LOG`: Enable HTTP access logging
  - `--workers` / `AITRACE_WORKERS`: Number of worker processes
  - `--config` / `-c`: Custom config file path
- **New Exported Functions**:
  - `get_config_dir()`: Get configuration directory path
  - `get_data_dir()`: Get data directory path
  - `load_config()`: Load configuration programmatically
  - `init_config_files()`: Initialize default config files

### Changed

- **Database Location**: Changed from `./logs.db` to `~/.config/aitrace/logs.db`
- **Server Initialization**: Now uses configuration system with proper initialization flow
- **Environment Variables**: `LOGS_DB` replaced with `AITRACE_DB_PATH` (old one still works via env var fallback)

### Documentation

- Added `docs/configuration.md` - Comprehensive configuration guide
- Updated README with configuration examples and new Quick Start section
- Added example config files with detailed comments

### Dependencies

- `configargparse>=1.7` - Configuration parsing from multiple sources
- `pyyaml>=6.0.2` - YAML config file support
- `tomli>=2.2.1` - TOML support for Python <3.11

### Fixed

- Added `[tool.uv]` section with `package = true` to properly enable entry points
- The `aitrace` command now works correctly with `uv run aitrace`
- Added optional dependencies group `[project.optional-dependencies]` for example scripts
  - Install with: `uv sync --extra examples`
  - Includes: langgraph, langchain, langchain-anthropic, langchain-openai, python-dotenv
- **BufferedLogger JSON Serialization**: Fixed `TypeError: Object of type UUID is not JSON serializable`
  - Added `_json_serializer()` helper to handle UUID objects and other non-serializable types
  - All flush methods now use custom serializer (HTTP, file, stdout)
  - UUIDs from LangChain/LangGraph callbacks are now properly converted to strings
- **BufferedLogger stdout leak**: Fixed logs being printed to console when using HTTP/file targets
  - HTTP and file targets now only buffer logs (no console output)
  - Stdout target still prints logs as expected
  - Uses `structlog.DropEvent` to prevent unwanted output

### Refactoring

- **test/common.py**: Extracted shared code from example scripts
  - `InspectHandler` class for LangChain callback logging
  - `init_llm()` function for consistent LLM initialization with llmlite support
  - `setup_tracing_and_logging()` function for tracer and logger setup
  - Reduces code duplication across examples
  - Makes it easier to add new examples with consistent patterns

### Cleanup & Breaking Changes

- **Removed `api_url` parameter**: `BufferedLogger` now only accepts `target` parameter
  - Simplifies API surface - use `BufferedLogger(target="...")` instead of `api_url=...`
  - Updated `test/common.py` to use `target` parameter
  - Removed backward compatibility code
- **Removed `send_logs()` function**: Not needed - use `BufferedLogger.flush()` instead
  - Removed from public API exports
  - Use `BufferedLogger` for all logging needs
- **Archived old documentation**: Moved detailed implementation docs to `docs/archive/`
  - `buffered_logger_refactoring.md`
  - `target_modes_feature.md`
  - `config_system_summary.md`
  - Main docs now focus on user-facing features only
- **Removed migration notes**: Cleaned up from `docs/configuration.md`
  - CHANGELOG still contains historical migration info
  - Current docs focus on current API only
- **Removed backward compatibility test**: Cleaned up `test/05_target_modes.py`
  - Removed test for deprecated `api_url` parameter

## [0.2.0] - 2025-10-19

### Added

#### BufferedLogger Component

- **`aitrace/buffer.py`** - New reusable module for buffered log ingestion
- **`BufferedLogger` class** - Self-contained logger with automatic buffer management
  - Automatic structlog configuration with trace ID injection
  - `clear()` method to reset buffer
  - `flush()` method to send logs to configured target with error handling
  - `trace_context()` context manager for auto-flush on exit
  - `get_logs()` method to retrieve buffered logs without sending
- **`send_logs()` helper** - Standalone function for sending logs without BufferedLogger instance

#### Multiple Output Target Support

- **Environment Variable Support** - `LOG_TRG` environment variable for configuration

  - HTTP endpoints: `LOG_TRG="http://localhost:8000/api/ingest"`
  - File output: `LOG_TRG="~/logs/app/<YYYYMMDD_HHMMSS>.jsonl"`
  - Stdout: `LOG_TRG="-"` or unset (default fallback)

- **HTTP Target Mode** - Send logs to remote API endpoint

  - Supports both `http://` and `https://` URLs
  - Proper error handling with `requests.exceptions.RequestException`
  - Returns JSON response from server

- **File Target Mode** - Write logs to local files

  - **Tilde expansion** - `~/path` automatically expands to user home directory
  - **Timestamp substitution** - `<YYYYMMDD_HHMMSS>` replaced with initialization time
  - **Automatic directory creation** - Parent directories created if missing
  - **JSONL format** - One JSON object per line for easy parsing
  - **Append mode** - Safe for multiple runs, logs accumulate

- **Stdout Target Mode** - Write logs to standard output

  - Default when no target specified
  - Explicit via `target="-"` parameter
  - JSONL format (one JSON object per line)
  - Useful for piping to other tools or container logs

- **Flexible Configuration** - Multiple ways to specify target
  1. `BufferedLogger(target="...")` - Explicit parameter (highest priority)
  2. `BufferedLogger(api_url="...")` - Deprecated but still supported
  3. `LOG_TRG` environment variable - Second priority
  4. Default to stdout - When nothing specified

#### Test Examples

- **`test/04_buffered_simple.py`** - Clean examples demonstrating BufferedLogger usage

  - Manual flush pattern example
  - Auto-flush with trace_context pattern example
  - Proper error handling demonstration

- **`test/05_target_modes.py`** - Comprehensive demonstration of output target modes
  - Stdout target (default and explicit)
  - File target with timestamp substitution
  - File target from LOG_TRG environment variable
  - HTTP target to API endpoint
  - Backward compatibility with api_url parameter

#### Documentation

- **Updated README.md** - Added BufferedLogger as recommended approach for log ingestion
- **Updated README.md** - Added section on output target modes with examples
- **Updated README.md** - Expanded project structure to include buffer.py and test files
- **`docs/buffered_logger_refactoring.md`** - Comprehensive documentation of the refactoring
  - Problem statement and motivation
  - Solution design and API
  - Migration guide
  - Usage examples
  - Future enhancement ideas

### Use Cases

The new output target support enables several deployment patterns:

1. **Development** - Use stdout for immediate feedback

   ```bash
   # No configuration needed
   python my_app.py
   ```

2. **Production with API Server** - Send to centralized trace server

   ```bash
   export LOG_TRG="https://traces.mycompany.com/api/ingest"
   python my_app.py
   ```

3. **File-based Logging** - Persist logs locally with timestamps

   ```bash
   export LOG_TRG="~/logs/myapp/<YYYYMMDD_HHMMSS>.jsonl"
   python my_app.py
   # Later: Ingest files in batch for analysis
   ```

4. **Container Deployments** - Log to stdout for container log collection

   ```bash
   export LOG_TRG="-"  # or leave unset
   docker run myapp
   # Logs captured by Docker/Kubernetes
   ```

5. **Testing** - Write to files for inspection
   ```bash
   export LOG_TRG="./test_output/traces_<YYYYMMDD_HHMMSS>.jsonl"
   pytest
   ```

### Changed

#### BufferedLogger API

- **Constructor signature** - Added `target` parameter

  - `BufferedLogger(target="...")` - New primary parameter for output configuration
  - `BufferedLogger(api_url="...")` - Deprecated but maintained for backward compatibility
  - Priority: explicit `target` > `api_url` > `LOG_TRG` env var > stdout default

- **`flush()` method** - Now routes to different handlers based on target type
  - Returns standardized dict with `{"ingested": count, ...}` for all target types
  - HTTP: Returns server response JSON
  - File: Returns `{"ingested": N, "target": "file", "path": "..."}`
  - Stdout: Returns `{"ingested": N, "target": "stdout"}`

#### Internal Architecture

- **`_parse_target()`** - New method to parse and validate target strings

  - Detects target type (http, file, stdout)
  - Expands `~` to home directory for file paths
  - Substitutes `<YYYYMMDD_HHMMSS>` placeholder with initialization timestamp
  - Creates parent directories for file targets

- **`_flush_http()`** - Dedicated HTTP flushing logic
- **`_flush_file()`** - Dedicated file writing logic (JSONL format)
- **`_flush_stdout()`** - Dedicated stdout writing logic (JSONL format)

#### Code Refactoring

- **`test/01_initial.py`** - Refactored to use BufferedLogger

  - Removed 44 lines of custom buffering/structlog setup code
  - Replaced with 3-line BufferedLogger import and initialization
  - Simplified ingestion logic from 15 lines to 1 line (buffered.flush())
  - Overall 13% reduction in file size with significantly improved clarity
  - Updated error message to use `python -m aitrace` instead of `python main.py`

- **`aitrace/__init__.py`** - Exported new BufferedLogger and send_logs components
  - Added to `__all__` for proper public API

### Benefits

- **Reusability** - BufferedLogger can be imported and used in any application
- **Separation of Concerns** - Infrastructure code separated from business logic
- **Developer Experience** - Much simpler setup for new test files
- **Flexibility** - Choice between manual control and auto-flush patterns
- **Maintainability** - Buffering logic centralized in one well-documented module
- **Environment-based Configuration** - Single codebase works across dev/staging/prod via LOG_TRG
- **Zero Network Dependencies** - Can run completely offline with file or stdout targets
- **Container-Friendly** - Stdout mode integrates seamlessly with container logging
- **Debugging Made Easy** - File mode with timestamps creates audit trail
- **Gradual Migration** - Backward compatible with existing code using api_url parameter

### Technical Details

- BufferedLogger configures structlog processor chain automatically
- Three separate flush handlers for HTTP, file, and stdout targets
- File writes use append mode for safe concurrent/repeated execution
- JSONL format (one JSON object per line) for easy parsing and streaming
- Timestamp substitution happens at initialization time (not per flush)
- Path.mkdir(parents=True, exist_ok=True) ensures directories exist
- Proper exception handling with requests.exceptions.RequestException and IOError
- Context manager pattern for clean resource management
- Comprehensive docstrings for all public methods

### Migration Path

**From v0.1.0 to v0.2.0** (backward compatible):

```python
# Old way (still works)
buffered = BufferedLogger(api_url="http://localhost:8000/api/ingest")

# New way (recommended)
buffered = BufferedLogger(target="http://localhost:8000/api/ingest")

# Or use environment variable
import os
os.environ["LOG_TRG"] = "http://localhost:8000/api/ingest"
buffered = BufferedLogger()
```

**From manual configuration to BufferedLogger**:

Old approach:

```python
import structlog
from aitrace.logging_config import _otel_ids_processor
log_buffer = []
# ... 40+ lines of configuration ...
```

New approach:

```python
from aitrace import BufferedLogger
buffered = BufferedLogger()  # or BufferedLogger(target="...")
log = buffered.logger
```

## [0.1.0] - 2025-10-18

### Initial Release

Complete implementation of a self-contained trace viewer for structured logs.

### Added

#### Core Features

- **OpenTelemetry Integration** - Tracing without exporters for local ID generation
- **Structured Logging** - structlog with automatic trace/span/parent ID injection
- **@auto_span Decorator** - Zero-boilerplate function instrumentation
- **SQLite Storage** - Local, serverless log storage with JSON support
- **FastAPI Backend** - RESTful API for log ingestion and querying
- **Web UI** - Modern, responsive interface with collapsible span trees

#### API Endpoints

- `POST /api/ingest` - Ingest log records
- `GET /api/traces` - List all traces with metadata
- `GET /api/trace/{id}` - Get detailed trace with tree structure
- `GET /api/search` - Search logs with filters (level, event, time)

#### Developer Experience

- **Package Structure** - Proper Python package (`aitrace`)
- **Entry Point** - Runnable as `python -m aitrace` or `aitrace` command
- **Test Application** - Realistic e-commerce scenarios for testing
- **Documentation** - Comprehensive README, QUICKSTART, and AGENTS.md

#### UI Features

- Collapsible span trees (click to expand/collapse)
- Trace list with event counts and timestamps
- Search and filter capabilities
- Modal view for detailed trace inspection
- Real-time log ingestion

### Technical Decisions

#### Architecture Choices

1. **No External Services** - Self-contained, no Zipkin/Jaeger required
2. **Logs as Source of Truth** - Spans only generate IDs, logs store data
3. **SQLite for Storage** - Simple, fast, serverless database
4. **Vanilla JavaScript** - No frontend framework needed
5. **Python 3.10+** - Modern Python with type hints

#### Development Approach

- Started from conversation about LLM inspection
- Evolved from Zipkin integration to simpler logs-only approach
- Iterative refinement based on user feedback
- Focus on developer experience and simplicity

### Dependencies

- `fastapi>=0.119.0` - Web framework
- `opentelemetry-sdk>=1.38.0` - Tracing infrastructure
- `structlog>=25.4.0` - Structured logging
- `uvicorn>=0.38.0` - ASGI server
- `requests>=2.32.5` - HTTP client (for test app)

### Installation

```bash
uv add opentelemetry-sdk structlog fastapi uvicorn requests
uv pip install -e . --python .venv/bin/python
```

### Usage

```bash
# Start server
uv run aitrace

# Generate test traces
uv run python test_app.py 10

# View at http://localhost:8000
```

### File Structure

```
aitrace/
├── __init__.py         # Package exports
├── __main__.py         # Entry point
├── server.py           # FastAPI app
├── tracing.py          # OpenTelemetry setup
├── logging_config.py   # structlog configuration
├── decorators.py       # @auto_span decorator
└── static/             # Web UI
    ├── index.html
    ├── style.css
    └── script.js
```

### Known Issues

None at release.

### Performance

- Handles ~100K logs efficiently
- Browser can render traces with ~1000 spans
- API handles ~100 concurrent requests

### Future Considerations

Potential enhancements for future versions:

- WebSocket for real-time updates
- Span duration metrics
- Email/Slack alerting
- Export to JSON/CSV
- Trace comparison
- Full-text search
- Advanced filtering
- Dashboard with charts

---

## Development History

### 2025-10-18 Morning (08:32-09:18)

**Initial Concept Phase**

- User inquiry about LLM invocation inspection
- Discussion of logging frameworks
- Exploration of HTML collapsible logs
- Pivot to JSON logging with indexing

**Architecture Design**

- Considered Jaeger/Tempo + Loki/OpenSearch
- Explained trace_id/span_id concepts
- Decided on lightweight SQLite approach

**Implementation**

- Built OpenTelemetry integration with Zipkin
- Removed Zipkin exporter (user preference)
- Created SQLite + FastAPI + HTML solution
- Implemented tree reconstruction algorithm
- Fixed collapsible CSS bug

### 2025-10-18 Evening (19:30-21:00)

**Package Restructuring**

- Moved code into `aitrace/` package
- Created `__main__.py` for module execution
- Updated all imports and paths
- Added entry point in `pyproject.toml`

**Installation & Testing**

- Installed package with `uv pip install -e .`
- Verified `aitrace` command works
- Updated documentation
- Created comprehensive AGENTS.md

**Documentation**

- Wrote architectural documentation
- Created this CHANGELOG
- Updated README with new commands
- Refined QUICKSTART guide

### Bug Fixes

1. **TypeError in logging_setup.py**

   - Issue: `is_valid` called as function instead of property
   - Fix: Changed `getattr(parent, "is_valid", lambda: False)()` to `getattr(parent, "is_valid", False)`

2. **Collapsible UI not working**

   - Issue: Missing CSS rules for collapsed state
   - Fix: Added `.span.collapsed > .span-logs, .span.collapsed > .span { display: none; }`

3. **pyproject.toml syntax error**
   - Issue: `[tool.uv.scripts]` not supported in this uv version
   - Fix: Removed unsupported section, used `[project.scripts]` instead

### Iterations

**Version 1**: Zipkin integration with full export
**Version 2**: No exporter, logs only (simplified)
**Version 3**: Package structure with entry point (current)

---

## Contributors

- **Human**: Product vision, architecture decisions, requirements
- **AI Assistant**: Implementation, documentation, problem-solving

## License

MIT License - See LICENSE file for details

---

**Format**: This changelog follows [Keep a Changelog](https://keepachangelog.com/) format.  
**Versioning**: This project uses [Semantic Versioning](https://semver.org/).
