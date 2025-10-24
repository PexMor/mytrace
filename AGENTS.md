# AI Trace Viewer - Architecture & Technical Decisions

> **Purpose:** This document contains all architectural, technical, and design decisions for the AI Trace Viewer project. It serves as a reference for both humans and AI agents working on the codebase.

**Last Updated:** 2025-10-24

---

## Table of Contents

- [Project Origin](#project-origin)
- [Core Philosophy](#core-philosophy)
- [System Architecture](#system-architecture)
- [Technical Stack](#technical-stack)
- [Design Decisions & Trade-offs](#design-decisions--trade-offs)
- [Component Details](#component-details)
- [Data Flow](#data-flow)
- [Extension Points](#extension-points)
- [Performance Considerations](#performance-considerations)
- [Development Approach](#development-approach)

---

## Project Origin

**Created:** 2025-10-18

### Genesis

The project originated from a technical discussion about inspecting LLM invocations in LangGraph/LangChain. The conversation evolved from exploring logging frameworks to designing a complete distributed tracing system for Python applications.

**Key Insight:**

> "Logging json sounds the way to go. Thus then I might need some indexing tool for that that I can use with that and simple api server to let me serve that, in principle log might be a tree by principle of code execution"

This led to adopting OpenTelemetry's trace/span model without requiring external services like Zipkin or Jaeger.

### Development Timeline

1. **Initial Exploration** - User asked about LLM invocation inspection
2. **Architecture Discussion** - AI proposed OpenTelemetry + Loki/Jaeger, also offered lightweight SQLite alternative
3. **Implementation** - User chose simplified approach: logs only, no Zipkin
4. **Final Implementation** - Complete SQLite + FastAPI + HTML solution with collapsible UI

---

## Core Philosophy

### Logs as Execution Trees

Traditional logging treats log entries as independent events. AI Trace Viewer treats them as **nodes in an execution tree**, where each function call is a span with parent-child relationships.

**Benefits:**

- Visualize execution flow naturally
- Understand nested operations
- Debug complex call hierarchies
- Track context through distributed operations

### Simplicity Over Features

**Guiding Principles:**

1. Self-contained system (no external dependencies)
2. Logs are the source of truth (not spans)
3. SQLite for local, serverless storage
4. Vanilla JavaScript UI (no framework complexity)
5. Modern Python features (3.10+)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│ Python Application                                      │
│                                                         │
│  @auto_span() decorator                                 │
│    ↓                                                    │
│  OpenTelemetry (trace_id, span_id generation)           │
│    ↓                                                    │
│  structlog (automatic ID injection)                     │
│    ↓                                                    │
│  BufferedLogger (collect + route)                       │
└─────────────────────────────────────────────────────────┘
                          ↓
          ┌───────────────┼───────────────┐
          ↓               ↓               ↓
      ┌────────┐     ┌────────┐     ┌────────┐
      │  HTTP  │     │  File  │     │ Stdout │
      │ Server │     │ .jsonl │     │   -    │
      └────┬───┘     └────────┘     └────────┘
           │
           ↓
    ┌──────────────┐
    │   SQLite     │  Indexed logs
    │   Database   │  (trace_id, span_id, parent_span_id)
    └──────┬───────┘
           │
           ↓
    ┌──────────────┐
    │  FastAPI     │  REST endpoints
    │   Server     │  Tree reconstruction
    └──────┬───────┘
           │
           ↓
    ┌──────────────┐
    │   Web UI     │  Collapsible trace trees
    │ (2 versions) │  1. Simple (static/)
    └──────────────┘  2. Advanced (aitrace_viewer/)
```

### Components

#### 1. Tracing Layer (OpenTelemetry)

**File:** `aitrace/tracing.py`

**Design Decision:** Use OpenTelemetry for span/trace management but **without exporters**.

```python
def setup_tracing(service_name: str) -> trace.Tracer:
    """Initialize OpenTelemetry with no exporters"""
    resource = Resource.create({"service.name": service_name})
    tp = TracerProvider(resource=resource)
    trace.set_tracer_provider(tp)
    return trace.get_tracer(service_name)
```

**Rationale:**

- Spans exist in-process only for context/ID generation
- No network latency or external dependencies
- Logs are the source of truth

**Trade-off:** Can't use standard OTel exporters/backends, but gains simplicity and zero infrastructure.

#### 2. Logging Layer (structlog)

**File:** `aitrace/logging_config.py`

**Design Decision:** Use structlog for structured JSON logging with automatic trace ID injection.

```python
def _otel_ids_processor(_, __, event_dict):
    """Inject trace_id, span_id, parent_span_id from OpenTelemetry context"""
    span = trace.get_current_span()
    ctx = span.get_span_context()

    if ctx and ctx.is_valid:
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")

        parent = getattr(span, "parent", None)
        if parent and getattr(parent, "is_valid", False):
            event_dict["parent_span_id"] = format(parent.span_id, "016x")

    return event_dict
```

**Key Features:**

- Every log entry automatically gets trace/span/parent IDs
- JSON output for easy parsing
- Context propagation via contextvars (thread & async safe)
- Custom processors for extensibility

#### 3. Instrumentation Layer

**File:** `aitrace/decorators.py`

**Design Decision:** Decorator pattern for zero-boilerplate span creation.

```python
@auto_span()
def my_function():
    log.info("doing work")
```

**Rationale:**

- Minimal code changes to instrument functions
- Automatic span naming from function names
- Captures function metadata (name, module)

**Alternative:** Manual span creation with context managers for fine-grained control.

#### 4. Buffer Layer

**File:** `aitrace/buffer.py`

**Design Decision:** BufferedLogger for flexible log routing with automatic serialization.

**Features:**

- Multiple output targets (HTTP, file, stdout)
- Automatic JSON serialization (handles UUID, datetime, dataclasses, etc.)
- Context manager for auto-flush
- Environment variable configuration

**Output Targets:**

| Target     | Format       | Example                              | Use Case                      |
| ---------- | ------------ | ------------------------------------ | ----------------------------- |
| **HTTP**   | `http://...` | `http://localhost:8000/api/ingest`   | Development/Production server |
| **File**   | Path         | `~/logs/app/<YYYYMMDD_HHMMSS>.jsonl` | Archival, offline analysis    |
| **Stdout** | `-`          | `-`                                  | Container logs, piping        |

**Advanced Serialization:**

```python
def _json_serializer(obj):
    """Handle non-JSON-serializable types"""
    # UUID → string
    # datetime → ISO format
    # dataclass → dict
    # Sets → lists
    # Custom objects → dict with __type__ field
```

#### 5. Storage Layer (SQLite)

**File:** `aitrace/server.py`

**Design Decision:** SQLite with JSON1 extension for local, serverless storage.

**Schema:**

```sql
CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT,
    level TEXT,
    logger TEXT,
    event TEXT,
    attrs TEXT,              -- JSON dump of additional fields
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    parent_span_id TEXT      -- NULL for root spans
);

-- Indexes for fast queries
CREATE INDEX idx_logs_trace ON logs(trace_id);
CREATE INDEX idx_logs_span ON logs(span_id);
CREATE INDEX idx_logs_parent ON logs(parent_span_id);
CREATE INDEX idx_logs_ts ON logs(ts);
```

**Rationale:**

- No database server required
- Perfect for development and moderate production use
- JSON1 allows flexible attribute storage
- Fast queries with proper indexing

**Limits:**

- Good up to ~100K logs
- Acceptable to ~1M logs
- Single writer (workers=1)

#### 6. API Layer (FastAPI)

**File:** `aitrace/server.py`

**Design Decision:** RESTful API with minimal endpoints.

**Endpoints:**

- `POST /api/ingest` - Batch ingest log records
- `GET /api/traces` - List all traces with metadata
- `GET /api/trace/{id}` - Get trace details with tree structure
- `GET /api/search` - Search logs by filters

**Tree Reconstruction Algorithm:**

```python
def fetch_trace(conn, trace_id):
    # 1. Fetch all logs for trace
    rows = fetch_logs_by_trace_id(trace_id)

    # 2. Group by span_id
    logs_by_span = group_by_span(rows)

    # 3. Build parent-child map
    children = {}
    roots = []
    for span_id, parent_id in parent_map.items():
        if parent_id and parent_id in children:
            children[parent_id].append(span_id)
        else:
            roots.append(span_id)

    # 4. Return tree structure
    return {
        "roots": roots,
        "children": children,
        "logs_by_span": logs_by_span
    }
```

#### 7. UI Layers

**Design Decision:** Two UI implementations for different needs.

**A. Simple UI (`aitrace/static/`)**

- Vanilla JavaScript
- Server-side rendered
- Good for basic trace viewing
- Bundled with Python package

**B. Advanced UI (`aitrace_viewer/`)**

- Preact + TypeScript + Vite
- Client-side only (no server needed)
- Drag-and-drop JSONL files
- Advanced lens system for field rendering
- Deployed to GitHub Pages

**Viewer Architecture:**

```typescript
// Data Model
type SpanNode = {
  id: string;              // span_id
  traceId: string;
  parentId?: string | null;
  children: string[];      // child span ids
  depth: number;
  timestamp: number;       // epoch ms
  level: "debug" | "info" | "warn" | "error";
  msg?: string;            // event field
  raw: Record<string, unknown>[]; // all log entries
};

// Tree Construction
1. Index all lines by span_id
2. Handle missing parents (pending map)
3. Compute depth with DFS
4. Sort siblings by timestamp
```

**Lens System:**

Lenses define how log entries are rendered:

```typescript
export const LLM_START_LENS: Lens = {
  eventPattern: /llm_start/i,
  fields: [
    {
      key: "prompts",
      display: "Prompts",
      type: "json-tree",
      maxInitialDepth: 2,
    },
    { key: "model", display: "Model", type: "text" },
  ],
  priority: 10,
};
```

**Smart Rendering:**

- Simple values (<80 chars) → compact chips
- Complex objects/arrays → expandable JSON trees
- Automatic JSON string parsing
- Context menus for copy/download

---

## Technical Stack

### Python Library (`aitrace/`)

| Component     | Library           | Version  | Purpose                      |
| ------------- | ----------------- | -------- | ---------------------------- |
| Tracing       | opentelemetry-sdk | 1.38.0+  | Span/trace ID generation     |
| Logging       | structlog         | 25.4.0+  | Structured logging           |
| Web Framework | fastapi           | 0.119.0+ | REST API                     |
| ASGI Server   | uvicorn           | 0.38.0+  | Production server            |
| HTTP Client   | requests          | 2.32.5+  | HTTP target flushing         |
| Config        | configargparse    | 1.7+     | Multi-source configuration   |
| YAML          | pyyaml            | 6.0.2+   | Config file parsing          |
| TOML          | tomli             | 2.2.1+   | Config file parsing (< 3.11) |

### Web Viewer (`aitrace_viewer/`)

| Component  | Library         | Version | Purpose                       |
| ---------- | --------------- | ------- | ----------------------------- |
| Framework  | Preact          | Latest  | Lightweight React alternative |
| Build Tool | Vite            | Latest  | Fast dev server + bundling    |
| Language   | TypeScript      | Latest  | Type safety                   |
| Icons      | Bootstrap Icons | Latest  | UI icons                      |

### Package Management

**Tool:** uv (recommended)

**Rationale:**

- Fast dependency resolution
- Modern tooling
- Works well with Python 3.13+
- Better developer experience than pip/poetry

---

## Design Decisions & Trade-offs

### 1. No External Services

**Decision:** Self-contained system without Zipkin/Jaeger/Tempo

**Pros:**

- Zero deployment complexity
- No network latency
- Perfect for local development
- Easy to understand and debug
- No infrastructure costs

**Cons:**

- No distributed tracing across multiple services
- Limited to what SQLite can handle
- Single-machine only

**When to Upgrade:** If you need:

- Distributed tracing across microservices
- Very high volume (>10M logs/day)
- Advanced query capabilities (regex, aggregations)
- Long-term retention with archival
- Multi-machine deployment

### 2. Logs as Source of Truth

**Decision:** Spans create IDs but don't store data; logs store everything

**Pros:**

- Simple architecture
- Easy to export/archive logs
- Familiar debugging workflow
- No span lifecycle management

**Cons:**

- Spans don't have timing information by default
- Must emit logs for visibility
- Can't use standard OTel span exporters

**Implications:**

- Spans are just ID generators
- All data in log entries
- Must flush logs explicitly

### 3. Python 3.10+ Only

**Decision:** Modern Python with type hints and recent features

**Pros:**

- Clean, modern code
- Good IDE support
- Latest library features
- Pattern matching (3.10+)
- Better performance

**Cons:**

- Not compatible with older Python versions
- May limit adoption in legacy environments

**Rationale:** Modern codebases should use modern Python.

### 4. uv for Package Management

**Decision:** Use uv instead of pip/poetry

**Pros:**

- Fast dependency resolution (Rust-based)
- Modern tooling
- Works well with Python 3.13+
- Built-in virtual environment management
- Better lockfile handling

**Cons:**

- Newer tool, smaller ecosystem
- Some users may not be familiar

**Migration:** Users can still use pip/poetry if preferred.

### 5. SQLite with Workers=1

**Decision:** Single-writer SQLite, no connection pooling

**Pros:**

- No database locks
- Simpler deployment
- Sufficient for most use cases

**Cons:**

- Can't scale horizontally
- Limited concurrent writes

**When to Upgrade:** Switch to PostgreSQL if you need:

- Multiple workers
- High concurrent write volume
- Replication/HA setup

### 6. Dual UI Implementation

**Decision:** Two separate UI implementations

**Rationale:**

- **Simple UI:** Bundled with Python, server-rendered, good for basic use
- **Advanced UI:** Standalone, client-side, advanced features, no server required

**Trade-off:** Maintain two UIs, but serves different use cases well.

---

## Component Details

### Configuration System

**File:** `aitrace/config.py`

**Design:** Layered configuration with priority

**Priority Order:**

1. Command line arguments (highest)
2. Environment variables (AITRACE\_\*)
3. Config file (~/.config/aitrace/config.yaml or config.toml)
4. Defaults (lowest)

**Example:**

```bash
# Config file
port: 8000

# Environment
export AITRACE_PORT=9000

# CLI (wins)
aitrace --port 10000
```

**Configuration Directory:** `~/.config/aitrace/`

- `config.yaml` - YAML format
- `config.toml` - TOML format
- `logs.db` - SQLite database
- `.db-shm`, `.db-wal` - SQLite WAL files

### Test Infrastructure

**Directory:** `test/`

**Files:**

- `common.py` - Shared utilities (InspectHandler, init_llm, setup_tracing_and_logging)
- `01_initial.py` - Complex e-commerce test
- `02_simple.py` - Simple chatbot example
- `03_router.py` - Router pattern with multiple agents
- `04_buffered_simple.py` - BufferedLogger patterns
- `05_target_modes.py` - Output target modes demo

**Design Philosophy:**

- Real-world scenarios (e-commerce, chatbots)
- Nested function calls (4+ levels)
- Error handling and logging
- Random failures for testing
- LangChain/LangGraph integration

---

## Data Flow

### Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Your Application                                        │
│                                                         │
│  @auto_span()                                           │
│  def my_function():                                     │
│      log.info("doing work", user_id=42)                 │
│                                                         │
│  ↓ OpenTelemetry creates span with IDs                  │
│  ↓ structlog injects trace_id, span_id, parent_span_id  │
│  ↓ BufferedLogger collects to in-memory buffer          │
│  ↓ flush() sends via target (HTTP/file/stdout)          │
└─────────────────────────────────────────────────────────┘
                          ↓
          ┌───────────────┼───────────────┐
          ↓               ↓               ↓
    HTTP POST         File Write      Stdout Print
    /api/ingest       .jsonl          JSON lines
          │
          ↓
┌─────────────────────────────────────────────────────────┐
│ FastAPI Server                                          │
│                                                         │
│  1. Normalize records (extract standard fields)         │
│  2. Batch INSERT into SQLite                            │
│  3. Return {"ingested": N}                              │
└─────────────────────────────────────────────────────────┘
          │
          ↓ (Browser requests)
┌─────────────────────────────────────────────────────────┐
│ GET /api/trace/{id}                                     │
│                                                         │
│  1. Query logs by trace_id                              │
│  2. Group by span_id                                    │
│  3. Build parent-child map                              │
│  4. Return tree structure                               │
└─────────────────────────────────────────────────────────┘
          │
          ↓
┌─────────────────────────────────────────────────────────┐
│ Browser UI                                              │
│                                                         │
│  root_span (▼)                                          │
│    ├─ log: "request received"                           │
│    ├─ child_span_1 (▼)                                  │
│    │   ├─ log: "fetching user"                          │
│    │   └─ log: "user fetched"                           │
│    ├─ child_span_2 (▼)                                  │
│    │   └─ log: "processing payment"                     │
│    └─ log: "request completed"                          │
└─────────────────────────────────────────────────────────┘
```

### Log Entry Structure

**Generated by application:**

```json
{
  "timestamp": "2025-10-24T12:00:00.123Z",
  "event": "user_login",
  "level": "info",
  "trace_id": "abc123...",
  "span_id": "def456...",
  "parent_span_id": "ghi789...",
  "user_id": 42,
  "ip_address": "192.168.1.1"
}
```

**Stored in SQLite:**

- Standard fields → dedicated columns (ts, level, event, trace_id, span_id, parent_span_id)
- Custom fields → JSON in `attrs` column

**Returned by API:**

- Full reconstruction with tree structure
- Logs grouped by span
- Children arrays for navigation

---

## Extension Points

### 1. Custom structlog Processors

Add your own logging processors:

```python
def my_processor(logger, name, event_dict):
    event_dict["environment"] = "production"
    event_dict["hostname"] = socket.gethostname()
    return event_dict

# Add to configuration
structlog.configure(
    processors=[
        my_processor,
        # ... other processors
    ]
)
```

### 2. Span Attributes

Add metadata to spans:

```python
@auto_span()
def my_function(user_id):
    span = trace.get_current_span()
    span.set_attribute("user.id", user_id)
    span.set_attribute("user.tier", "premium")
```

**Note:** Attributes are not persisted by default (logs are). To persist, emit a log entry with the attributes.

### 3. Custom Log Routing

Implement custom flush targets:

```python
class BufferedLogger:
    def _flush_custom(self):
        # Send to Kafka, S3, etc.
        pass
```

### 4. API Authentication

Add authentication to the API:

```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer

security = HTTPBearer()

@app.post("/api/ingest")
async def ingest(records: List[Dict], token: str = Depends(security)):
    if not verify_token(token.credentials):
        raise HTTPException(401, "Invalid token")
    # ... rest of implementation
```

### 5. Custom UI Lenses

Create lenses for specific log patterns:

```typescript
export const MY_LENS: Lens = {
  eventPattern: /my_event/i,
  fields: [
    {
      key: "request",
      display: "Request",
      type: "json-tree",
      maxInitialDepth: 2,
    },
    { key: "duration", display: "Duration (ms)", type: "text" },
  ],
  priority: 15,
};
```

### 6. Database Schema Extensions

Add custom columns:

```sql
ALTER TABLE logs ADD COLUMN duration_ms REAL;
ALTER TABLE logs ADD COLUMN user_id TEXT;
CREATE INDEX idx_user ON logs(user_id);
```

---

## Performance Considerations

### Current Limits

- **SQLite:** Good up to ~100K logs, acceptable to ~1M
- **Browser:** Can render traces with ~1000 spans
- **API:** Handles ~100 concurrent requests
- **Ingestion:** ~10K logs/sec with batch inserts

### Optimization Strategies

#### For Large Traces

- Implement pagination in tree rendering
- Add lazy loading for child spans
- Use virtual scrolling
- Limit tree depth display

#### For High Volume

- Batch inserts (already implemented)
- Add log rotation (daily/hourly files)
- Consider PostgreSQL for production
- Implement archival (move old logs to S3/Parquet)

#### For Long-Term Storage

- Export old logs to Parquet/Parquet
- Keep recent data (last 7 days) in SQLite
- Add archive/restore functionality
- Implement TTL-based cleanup

### Monitoring

**Key Metrics:**

- Database size (`du -h logs.db`)
- Ingestion rate (logs/sec)
- Query latency (p50, p95, p99)
- UI render time (browser devtools)

---

## Development Approach

### Human-AI Collaboration Notes

**Iterative Development Process:**

1. **Initial Exploration** (2025-10-18)

   - User asked about LLM invocation inspection
   - AI suggested logging frameworks and HTML collapsible logs
   - User pivoted to JSON logging with indexing

2. **Architecture Discussion**

   - AI proposed OpenTelemetry + Loki/Jaeger approach
   - Also offered lightweight SQLite alternative
   - User asked about trace_id/span_id concepts
   - AI explained distributed tracing fundamentals

3. **Implementation Deep Dive**

   - User wanted automatic span generation
   - AI provided Zipkin integration example
   - User simplified: wanted logs only, no Zipkin
   - AI refactored to remove exporters

4. **Final Implementation**
   - User requested trace tree viewer
   - AI provided complete SQLite + FastAPI + HTML solution
   - Included collapsible UI with search capabilities

### Key User Decisions

1. **"Logging json sounds the way to go"** → Structured logging
2. **"I do not need the zipkin exporter"** → Simplified architecture
3. **"add a tiny SQLite + FastAPI snippet"** → Self-contained solution

### AI Contributions

1. Explained distributed tracing concepts clearly
2. Provided multiple architecture options (full vs. lightweight)
3. Created complete, working implementations
4. Handled edge cases (parent span ID extraction, CSS collapsing)
5. Generated comprehensive documentation

### Lessons Learned

1. **Simplicity Wins:** Removing Zipkin made the system more usable
2. **Logs Are Enough:** Don't need separate span storage for most use cases
3. **SQLite Is Powerful:** Handles more than people expect
4. **Vanilla JS:** No framework needed for simple UIs
5. **uv Is Fast:** Modern Python tooling matters
6. **Iteration Matters:** Multiple refinement cycles led to better design

---

## Testing Strategy

### Test Applications (`test/`)

**Coverage:**

- ✅ Span creation and nesting
- ✅ Log entry with context
- ✅ Trace ID propagation
- ✅ Error logging with exceptions
- ✅ Tree reconstruction
- ✅ UI rendering
- ✅ LangChain/LangGraph integration
- ✅ Multiple output targets
- ✅ Fallback HTML generation

**Scenarios:**

- E-commerce checkout flows
- Background jobs
- Nested function calls (4+ levels deep)
- Error handling and logging
- Random failures for testing error states
- Multi-agent routing

### Testing Commands

```bash
# Simple chatbot
uv run python test/02_simple.py

# Router pattern
uv run python test/03_router.py

# BufferedLogger patterns
uv run python test/04_buffered_simple.py

# Output target modes
uv run python test/05_target_modes.py
```

---

## Future Enhancements

### Discussed but Not Implemented

1. **Real-time Updates** - WebSocket for live trace streaming
2. **Metrics** - Add span duration tracking (start/end times)
3. **Alerting** - Email/Slack on ERROR logs
4. **Export** - Download traces as JSON/CSV
5. **Compare** - Diff two traces side-by-side
6. **Search** - Full-text search with highlighting
7. **Filtering** - Advanced filters (duration > X, errors only)
8. **Dashboards** - Summary stats and charts
9. **Distributed Tracing** - Multi-service support
10. **Sampling** - Probabilistic trace sampling

### Potential Improvements

- PostgreSQL backend option
- Docker/Kubernetes deployment
- Horizontal scaling
- Span compression
- Advanced analytics
- Machine learning insights

---

## References

### Documentation

- [OpenTelemetry Python Docs](https://opentelemetry.io/docs/languages/python/)
- [structlog Documentation](https://www.structlog.org/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLite JSON1 Extension](https://www.sqlite.org/json1.html)
- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)

### Related Projects

- [Jaeger](https://www.jaegertracing.io/) - Distributed tracing platform
- [Zipkin](https://zipkin.io/) - Distributed tracing system
- [Tempo](https://grafana.com/oss/tempo/) - Distributed tracing backend
- [OpenTelemetry](https://opentelemetry.io/) - Observability framework

---

**Document Version:** 2.0  
**Last Updated:** 2025-10-24  
**Maintained By:** AI Trace Viewer Team
