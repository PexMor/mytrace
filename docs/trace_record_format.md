# AI Trace Record Format Specification

**Version:** 2.0  
**Last Updated:** 2025-10-26  
**Status:** Active

---

## Overview

This document defines the JSON format for trace records in the AI Trace system. Starting from version 2.0, all trace records use the `__tracer_meta__` namespace to separate tracer infrastructure metadata from user application data.

## Breaking Changes from v1.x

**This is a BREAKING CHANGE.** Version 2.0 introduces a new format that is NOT backward compatible with v1.x logs.

### What Changed

- **Metadata Namespace**: All tracer metadata now lives in `__tracer_meta__` object
- **Clean Separation**: User data stays at top-level, tracer metadata in `__tracer_meta__`
- **Span Lifecycle**: Spans now emit two events: `.start` (provisional) and `.end` (final)
- **No Top-Level Pollution**: Tracer fields no longer clutter user data namespace

### Migration

Old logs (v1.x format with metadata at top-level) must be re-generated. The system does NOT support reading old format logs.

---

## Record Format

### Structure

Every trace record has this structure:

```json
{
  "user_field_1": "value",
  "user_field_2": { "nested": "data" },
  "__tracer_meta__": {
    "timestamp": "ISO8601 datetime",
    "event": "event_name",
    "trace_id": "hex string",
    "span_id": "hex string",
    "parent_span_id": "hex string or null",
    "file": "relative/path/to/file.py",
    "line": 123,
    "function": "function_name",
    "level": "info|debug|warning|error"
  }
}
```

### Metadata Fields (`__tracer_meta__`)

All tracer infrastructure metadata is contained in the `__tracer_meta__` object:

| Field            | Type    | Required | Description                                              |
| ---------------- | ------- | -------- | -------------------------------------------------------- |
| `timestamp`      | string  | Yes      | ISO 8601 timestamp (e.g., "2025-10-26T11:44:38.316023Z") |
| `event`          | string  | Yes      | Event name or span lifecycle marker                      |
| `trace_id`       | string  | Yes      | 32-character hex trace ID                                |
| `span_id`        | string  | Yes      | 16-character hex span ID                                 |
| `parent_span_id` | string  | No       | 16-character hex parent span ID (null for root spans)    |
| `file`           | string  | Yes      | Relative path from workspace root                        |
| `line`           | integer | Yes      | Line number in source file (1-based)                     |
| `function`       | string  | No       | Function name where log was emitted                      |
| `level`          | string  | No       | Log level (info, debug, warning, error)                  |
| `provisional`    | boolean | No       | True for span start events (see Span Lifecycle)          |

### User Data Fields (Top-Level)

Any fields NOT in the metadata list are user data and stay at top-level:

```json
{
  "user_id": "u123",
  "amount": 42.50,
  "items": ["apple", "banana"],
  "metadata": {"custom": "nested structure"},
  "__tracer_meta__": { ... }
}
```

User data can be:

- Primitive values (string, number, boolean, null)
- Arrays
- Nested objects
- Any JSON-serializable structure

---

## Record Types

### 1. Span Lifecycle Events

Span lifecycle events mark the beginning and end of function execution. They contain ONLY metadata (no user data).

#### Span Start (Provisional)

Emitted immediately when a span begins:

```json
{
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.316023Z",
    "event": "process_order.start",
    "file": "src/orders.py",
    "line": 83,
    "function": "process_order",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "e9491fc6fff42c5d",
    "parent_span_id": "c945084284bd5c4f",
    "provisional": true
  }
}
```

**Key characteristics:**

- Event name: `{function_name}.start`
- Contains `"provisional": true` marker
- No user data fields
- Emitted before function execution

#### Span End (Final)

Emitted when a span completes:

```json
{
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.676870Z",
    "event": "process_order.end",
    "file": "src/orders.py",
    "line": 83,
    "function": "process_order",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "e9491fc6fff42c5d",
    "parent_span_id": "c945084284bd5c4f"
  }
}
```

**Key characteristics:**

- Event name: `{function_name}.end`
- No `provisional` field
- No user data fields
- Emitted after function execution

### 2. User Log Events

User log events are explicitly emitted by application code using the logger. They contain both metadata and user data.

```json
{
  "user_id": "u2",
  "items": 3,
  "total": 469.74,
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.316023Z",
    "event": "checkout_started",
    "file": "src/checkout.py",
    "line": 111,
    "function": "simulate_checkout",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "c945084284bd5c4f",
    "parent_span_id": "f4c85b034aaea034",
    "level": "info"
  }
}
```

**Key characteristics:**

- Event name: user-defined (e.g., "checkout_started")
- User data at top-level
- Metadata in `__tracer_meta__`
- Emitted explicitly via `log.info()`, `log.error()`, etc.

---

## Compatibility Mode

For integration with external tools (Elastic, OpenTelemetry, Splunk, etc.) that expect `timestamp` at top-level, enable compatibility mode.

### Configuration

Set environment variable or config file:

```bash
export AITRACE_COMPAT_MODE=true
```

Or in Python:

```python
from aitrace import config
config.get_config().compat_mode = True
```

### Compatibility Mode Format

When `compat_mode=true`, ONLY `timestamp` is duplicated at top-level:

```json
{
  "timestamp": "2025-10-26T11:44:38.316023Z",
  "user_id": "u2",
  "items": 3,
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.316023Z",
    "event": "checkout_started",
    "file": "src/checkout.py",
    "line": 111,
    "function": "simulate_checkout",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "c945084284bd5c4f",
    "parent_span_id": "f4c85b034aaea034"
  }
}
```

**Why only timestamp?**

- Timestamp is the most commonly indexed field by external systems
- Other metadata fields are less critical for external tool compatibility
- Keeps format clean while maintaining practical compatibility

---

## Examples

### Complete Trace Flow

Here's a complete trace showing span lifecycle and user logs:

```json
// 1. Root span starts
{
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.316023Z",
    "event": "process_order.start",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "e9491fc6fff42c5d",
    "parent_span_id": null,
    "provisional": true
  }
}

// 2. User logs processing info
{
  "user_id": "u2",
  "items": 3,
  "total": 469.74,
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.320000Z",
    "event": "processing_order",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "e9491fc6fff42c5d"
  }
}

// 3. Child span starts (payment validation)
{
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.484084Z",
    "event": "validate_payment.start",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "b2dc8391b63d0eab",
    "parent_span_id": "e9491fc6fff42c5d",
    "provisional": true
  }
}

// 4. User logs payment validation
{
  "amount": 422.766,
  "method": "credit_card",
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.569797Z",
    "event": "payment_validated",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "b2dc8391b63d0eab",
    "parent_span_id": "e9491fc6fff42c5d"
  }
}

// 5. Child span ends
{
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.570000Z",
    "event": "validate_payment.end",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "b2dc8391b63d0eab",
    "parent_span_id": "e9491fc6fff42c5d"
  }
}

// 6. Root span ends
{
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.676870Z",
    "event": "process_order.end",
    "trace_id": "7902f7b02e9e2b9ce0c11a928f3e2153",
    "span_id": "e9491fc6fff42c5d"
  }
}
```

### Complex User Data

User data can contain nested structures:

```json
{
  "user": {
    "id": "u123",
    "name": "Alice",
    "preferences": {
      "theme": "dark",
      "notifications": true
    }
  },
  "cart": [
    { "item_id": "A", "quantity": 2, "price": 10.0 },
    { "item_id": "B", "quantity": 1, "price": 25.5 }
  ],
  "payment": {
    "method": "credit_card",
    "last4": "4242"
  },
  "__tracer_meta__": {
    "timestamp": "2025-10-26T11:44:38.316023Z",
    "event": "checkout_completed",
    "trace_id": "abc123",
    "span_id": "def456"
  }
}
```

---

## Implementation Notes

### For Application Developers

When logging with user data:

```python
# Good - user data as keyword arguments
log.info("checkout_started", user_id="u2", items=3, total=469.74)

# Good - nested structures work naturally
log.info("user_preferences",
         preferences={"theme": "dark", "lang": "en"})

# The logger automatically:
# - Puts user data at top-level
# - Puts tracer metadata in __tracer_meta__
```

### For Viewer Developers

When parsing trace records:

```typescript
// Extract metadata
const meta = record.__tracer_meta__;
const timestamp = meta.timestamp;
const traceId = meta.trace_id;
const spanId = meta.span_id;
const event = meta.event;

// Extract user data (everything except __tracer_meta__)
const userData = { ...record };
delete userData.__tracer_meta__;

// Check if it's a span lifecycle event
const isSpanStart = event.endsWith(".start");
const isSpanEnd = event.endsWith(".end");
const isProvisional = meta.provisional === true;
```

### For Server/Storage Developers

Database schema considerations:

```sql
CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    -- Metadata columns (from __tracer_meta__)
    ts TIMESTAMP,
    trace_id TEXT NOT NULL,
    span_id TEXT NOT NULL,
    parent_span_id TEXT,
    event TEXT,
    file TEXT,
    line INTEGER,
    function TEXT,
    level TEXT,

    -- User data (JSON blob)
    attrs JSONB,

    -- Indexes
    INDEX idx_trace_id (trace_id),
    INDEX idx_span_id (span_id),
    INDEX idx_ts (ts)
);
```

---

## Viewer Behavior

### Provisional Entry Handling

Viewers should:

1. **Load all entries** for a trace
2. **Filter provisional entries**: When a `.end` event exists for a span_id, hide the corresponding `.start` event
3. **Display span as single node**: Use `.end` timestamp as the span's representative time
4. **Show only user logs**: User log events (non-lifecycle) are always displayed

### Tree Reconstruction

```
Root Span (span_id: abc)
├─ span.start (provisional) → HIDE if span.end exists
├─ user_log_1
├─ Child Span (span_id: def)
│  ├─ span.start (provisional) → HIDE
│  ├─ user_log_2
│  └─ span.end (final) → USE THIS
├─ user_log_3
└─ span.end (final) → USE THIS
```

---

## Design Rationale

### Why `__tracer_meta__`?

1. **Namespace Isolation**: Double underscore prefix signals "internal/system" in Python convention
2. **No Collisions**: User data can have fields like `event`, `timestamp` without conflicts
3. **Easy Filtering**: Single field to exclude when extracting user data
4. **Explicit Separation**: Clear distinction between tracer infrastructure and application data

### Why Span Lifecycle Events?

1. **Real-time Visibility**: See spans as they start, not just after completion
2. **Long-running Operations**: Track operations that take minutes/hours
3. **Failure Detection**: If `.start` exists but no `.end`, operation failed or is still running
4. **Natural Ordering**: Events appear in execution order

### Why No Backward Compatibility?

1. **Cleaner Implementation**: No branching logic for old vs new format
2. **Better Performance**: Single code path
3. **Easier Maintenance**: One format to test and document
4. **Development Phase**: Project is pre-1.0, breaking changes acceptable

---

## See Also

### Documentation

- [README.md](../README.md) - Main documentation
- [AGENTS.md](../AGENTS.md) - Architecture and design decisions
- [Source Location Tracking](source_location_tracking.md) - IDE integration
- [VSCode Plugin Format](vscode/plugin_format.md) - Plugin integration
- [Configuration Guide](configuration.md) - Server configuration

### External References

- [OpenTelemetry Trace Specification](https://opentelemetry.io/docs/specs/otel/trace/)
- [Elastic Common Schema](https://www.elastic.co/guide/en/ecs/current/index.html)
- [JSON Lines Format](https://jsonlines.org/)

---

## Changelog

### Version 2.0 (2025-10-26)

**BREAKING CHANGES:**

- Introduced `__tracer_meta__` namespace for all tracer metadata
- Span lifecycle events (`.start` and `.end`)
- Removed support for v1.x flat format
- Added compatibility mode (timestamp at top-level)

### Version 1.0 (2025-10-18)

- Initial format with metadata at top-level
- No span lifecycle events

---

**Document Version:** 2.0  
**Format Version:** 2.0  
**Last Updated:** 2025-10-26
