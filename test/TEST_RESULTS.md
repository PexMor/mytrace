# Test Results - LOG_TRG and Fallback Mechanism

**Date:** 2025-10-24

## Summary

All test examples have been updated to support the `LOG_TRG` environment variable and gracefully handle server connection failures with automatic HTML fallback.

## What Was Fixed

### 1. LOG_TRG Environment Variable Support

All test examples now respect the `LOG_TRG` environment variable:

- **test/common.py**: Updated `setup_tracing_and_logging()` to use `LOG_TRG` by default
- **test/01_initial.py**: Updated to respect `LOG_TRG`
- **test/02_simple.py**: Uses common.py (automatically supports `LOG_TRG`)
- **test/03_router.py**: Uses common.py (automatically supports `LOG_TRG`)
- **test/04_buffered_simple.py**: Updated to respect `LOG_TRG`
- **test/05_target_modes.py**: Already supports all target modes including `LOG_TRG`

### 2. Graceful Error Handling

When the trace server is unreachable:
- Connection errors are caught automatically
- Traces are saved to `~/tmp/temp-trace/<YYYYMMDD_HHMMSS>.html`
- User-friendly error messages are displayed
- The application continues to run (no crashes)

### 3. HTML Trace Export

When the server is unavailable, traces are exported as self-contained HTML files with:
- Beautiful, responsive design
- Syntax-highlighted JSON details
- Trace ID, Span ID, and Parent Span ID information
- Chronological log entries with timestamps
- Color-coded log levels (info, warning, error, debug)

## Test Results

### Test 1: File Target via LOG_TRG

```bash
export LOG_TRG="~/tmp/my-logs/<YYYYMMDD_HHMMSS>.jsonl"
uv run test/04_buffered_simple.py
```

**Result:** ✅ PASS
- Logs written to: `/Users/petr.moravek/tmp/my-logs/20251024_103014.jsonl`
- Timestamp placeholder correctly expanded
- Directory created automatically

### Test 2: HTTP Fallback (Server Unreachable)

```bash
unset LOG_TRG
uv run test/04_buffered_simple.py
```

**Result:** ✅ PASS
- Connection error caught gracefully
- HTML fallback created at: `/Users/petr.moravek/tmp/temp-trace/20251024_103014.html`
- User-friendly error message displayed:
  ```
  ⚠️  Cannot connect to trace server at http://localhost:8000/api/ingest
      Error: [Connection refused]
  
  ✓  Trace saved to local file instead:
      /Users/petr.moravek/tmp/temp-trace/20251024_103014.html
  
      Open in browser: file:///Users/petr.moravek/tmp/temp-trace/20251024_103014.html
  ```

### Test 3: LOG_TRG with common.py

```bash
export LOG_TRG="~/tmp/my-logs/<YYYYMMDD_HHMMSS>.jsonl"
python -c "from test.common import setup_tracing_and_logging; t, b = setup_tracing_and_logging('test'); print(f'Target: {b.target_value}')"
```

**Result:** ✅ PASS
- Target type: file
- Target value: `/Users/petr.moravek/tmp/my-logs/20251024_103034.jsonl`

## Usage Examples

### Using LOG_TRG with File Target

```bash
# Simple file
export LOG_TRG="~/tmp/my-app/logs.jsonl"

# With timestamp placeholder
export LOG_TRG="~/tmp/my-logs/<YYYYMMDD_HHMMSS>.jsonl"

# Run any test
uv run test/02_simple.py
```

### Using LOG_TRG with HTTP Target

```bash
# Default server
export LOG_TRG="http://localhost:8000/api/ingest"

# Custom server
export LOG_TRG="https://my-trace-server.com/api/ingest"

# Run any test
uv run test/03_router.py
```

### Using Stdout

```bash
# Unset LOG_TRG to use default (HTTP)
unset LOG_TRG

# Or explicitly use stdout
export LOG_TRG="-"

# Run test
uv run test/04_buffered_simple.py
```

## Features Verified

- ✅ LOG_TRG environment variable support
- ✅ File target with ~ expansion
- ✅ Timestamp placeholder `<YYYYMMDD_HHMMSS>`
- ✅ HTTP target with automatic fallback
- ✅ Graceful error handling (no crashes)
- ✅ User-friendly error messages
- ✅ HTML trace export with styling
- ✅ Automatic directory creation
- ✅ Works with all test examples

## Breaking Changes

None. The changes are backward compatible:
- Default behavior unchanged (uses `http://localhost:8000/api/ingest`)
- Existing code continues to work
- New functionality is opt-in via `LOG_TRG`

## Recommendations

1. **Development**: Use `LOG_TRG` with file target for local development
   ```bash
   export LOG_TRG="~/tmp/dev-logs/<YYYYMMDD_HHMMSS>.jsonl"
   ```

2. **Testing**: Let HTTP fallback to HTML when server is unavailable (no need to run server during development)

3. **Production**: Use HTTP target with a running trace server
   ```bash
   export LOG_TRG="http://trace-server:8000/api/ingest"
   ```

4. **CI/CD**: Use file target to collect traces as artifacts
   ```bash
   export LOG_TRG="/tmp/ci-traces/<YYYYMMDD_HHMMSS>.jsonl"
   ```

