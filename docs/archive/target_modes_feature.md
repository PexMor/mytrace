# BufferedLogger Output Target Modes

**Version:** 0.2.0  
**Date:** 2025-10-19  
**Feature:** Multiple output targets for BufferedLogger

## Overview

The BufferedLogger now supports three different output targets, configurable via the `target` parameter or `LOG_TRG` environment variable:

1. **HTTP** - Send logs to a remote API endpoint
2. **File** - Write logs to local files with timestamp support
3. **Stdout** - Write logs to standard output (default)

## Quick Examples

### HTTP Target

```python
from aitrace import BufferedLogger

# Explicit target
buffered = BufferedLogger(target="http://localhost:8000/api/ingest")

# Or via environment variable
import os
os.environ["LOG_TRG"] = "http://localhost:8000/api/ingest"
buffered = BufferedLogger()
```

### File Target

```python
# With timestamp placeholder
buffered = BufferedLogger(target="~/logs/app/<YYYYMMDD_HHMMSS>.jsonl")

# Or via environment variable
os.environ["LOG_TRG"] = "~/logs/app/<YYYYMMDD_HHMMSS>.jsonl"
buffered = BufferedLogger()

# Result: ~/logs/app/20251019_150007.jsonl
```

### Stdout Target

```python
# Default (no configuration)
buffered = BufferedLogger()

# Explicit
buffered = BufferedLogger(target="-")

# Or via environment variable
os.environ["LOG_TRG"] = "-"
buffered = BufferedLogger()
```

## Configuration Priority

The target is determined in the following order (highest to lowest priority):

1. Explicit `target` parameter: `BufferedLogger(target="...")`
2. Deprecated `api_url` parameter: `BufferedLogger(api_url="...")`
3. `LOG_TRG` environment variable
4. Default to stdout if none specified

## Target Detection

The target type is automatically detected from the string format:

| String Format                       | Detected Type    | Example                            |
| ----------------------------------- | ---------------- | ---------------------------------- |
| Starts with `http://` or `https://` | HTTP             | `http://localhost:8000/api/ingest` |
| `-` (dash)                          | Stdout           | `-`                                |
| Any other string                    | File             | `~/logs/app.jsonl`                 |
| None/empty                          | Stdout (default) | -                                  |

## File Target Features

### Tilde Expansion

The `~` character is automatically expanded to the user's home directory:

```python
# Input:  "~/logs/app.jsonl"
# Result: "/Users/username/logs/app.jsonl"  (macOS)
# Result: "/home/username/logs/app.jsonl"   (Linux)
```

### Timestamp Substitution

Use `<YYYYMMDD_HHMMSS>` placeholder for automatic timestamp substitution:

```python
buffered = BufferedLogger(target="~/logs/<YYYYMMDD_HHMMSS>_app.jsonl")
# Result: ~/logs/20251019_150007_app.jsonl

# Timestamp is set at initialization time
buffered1 = BufferedLogger(target="~/logs/<YYYYMMDD_HHMMSS>.jsonl")
time.sleep(5)
buffered2 = BufferedLogger(target="~/logs/<YYYYMMDD_HHMMSS>.jsonl")
# buffered1 and buffered2 will have different timestamps
```

### Automatic Directory Creation

Parent directories are automatically created if they don't exist:

```python
buffered = BufferedLogger(target="~/logs/2025/october/app.jsonl")
# Creates ~/logs/2025/october/ if it doesn't exist
```

### JSONL Format

Files are written in JSONL (JSON Lines) format - one JSON object per line:

```jsonl
{"event": "started", "timestamp": "...", "trace_id": "..."}
{"event": "processing", "timestamp": "...", "trace_id": "..."}
{"event": "completed", "timestamp": "...", "trace_id": "..."}
```

This format is:

- Easy to parse line-by-line
- Streamable (no need to load entire file)
- Compatible with many log processing tools
- Human-readable

### Append Mode

Files are opened in append mode (`"a"`), making it safe to:

- Run the same script multiple times
- Have multiple processes write to the same file (with caveats)
- Accumulate logs over time

## HTTP Target Features

### Protocol Support

Both HTTP and HTTPS are supported:

```python
BufferedLogger(target="http://localhost:8000/api/ingest")   # HTTP
BufferedLogger(target="https://api.example.com/ingest")     # HTTPS
```

### Error Handling

HTTP errors raise `requests.exceptions.RequestException`:

```python
try:
    result = buffered.flush()
    print(f"Sent {result['ingested']} logs")
except requests.exceptions.RequestException as e:
    print(f"Failed to send logs: {e}")
```

### Response Format

The HTTP endpoint should return JSON with at least an `ingested` field:

```json
{
  "ingested": 42,
  "status": "ok",
  "trace_ids": ["abc...", "def..."]
}
```

## Stdout Target Features

### Default Behavior

Stdout is the default when no target is specified:

```python
# These are equivalent
BufferedLogger()
BufferedLogger(target=None)
BufferedLogger(target="-")
```

### JSONL Output

Logs are written as JSONL to stdout:

```bash
$ python my_app.py
{"event": "started", "timestamp": "...", "trace_id": "..."}
{"event": "processing", "timestamp": "...", "trace_id": "..."}
{"event": "completed", "timestamp": "...", "trace_id": "..."}
```

### Piping and Redirection

Stdout mode is useful for piping to other tools:

```bash
# Pipe to jq for pretty printing
python my_app.py | jq

# Redirect to file
python my_app.py > logs.jsonl

# Grep for errors
python my_app.py | grep '"level":"ERROR"'
```

### Container Logging

In containerized environments, stdout is captured by the container runtime:

```bash
# Docker captures stdout
docker run my-app

# Kubernetes captures stdout
kubectl logs my-pod
```

## Use Cases by Environment

### Development

**Use stdout for immediate feedback:**

```bash
# No configuration needed
python my_app.py
```

**Or use file for later inspection:**

```bash
export LOG_TRG="./dev_logs/<YYYYMMDD_HHMMSS>.jsonl"
python my_app.py
```

### Testing

**Write to files for test inspection:**

```bash
export LOG_TRG="./test_output/<YYYYMMDD_HHMMSS>.jsonl"
pytest
```

**Check test logs:**

```bash
ls test_output/
cat test_output/20251019_150007.jsonl | jq
```

### Staging/Production

**Send to centralized trace server:**

```bash
export LOG_TRG="https://traces.company.com/api/ingest"
python my_app.py
```

### Container Deployments

**Use stdout for container log collection:**

```bash
export LOG_TRG="-"
docker run my-app
# Logs captured by Docker/Kubernetes
```

### Offline/Air-gapped Environments

**Write to files, transfer later:**

```bash
export LOG_TRG="/data/logs/<YYYYMMDD_HHMMSS>.jsonl"
python my_app.py

# Later: Transfer files to analysis server
scp /data/logs/*.jsonl analysis-server:/import/
```

## Flush Return Values

The `flush()` method returns different data based on target type:

### HTTP Target

```python
{
    "ingested": 42,
    # Plus any additional fields from server response
    "status": "ok",
    "trace_ids": [...]
}
```

### File Target

```python
{
    "ingested": 42,
    "target": "file",
    "path": "/Users/username/logs/app.jsonl"
}
```

### Stdout Target

```python
{
    "ingested": 42,
    "target": "stdout"
}
```

## Backward Compatibility

The `api_url` parameter is deprecated but still supported:

```python
# Old way (v0.1.0) - still works in v0.2.0
buffered = BufferedLogger(api_url="http://localhost:8000/api/ingest")

# New way (v0.2.0+)
buffered = BufferedLogger(target="http://localhost:8000/api/ingest")
```

## Environment Variable Configuration

Using `LOG_TRG` enables zero-code-change deployment:

### Development Config

```bash
# .env.dev
LOG_TRG=-
```

### Staging Config

```bash
# .env.staging
LOG_TRG=https://traces-staging.company.com/api/ingest
```

### Production Config

```bash
# .env.prod
LOG_TRG=https://traces.company.com/api/ingest
```

### Application Code (unchanged)

```python
# Same code works in all environments
from aitrace import BufferedLogger

buffered = BufferedLogger()  # Reads from LOG_TRG
log = buffered.logger

# ... your application code ...
```

## Best Practices

### 1. Use Environment Variables for Configuration

```python
# Good: Configurable via environment
buffered = BufferedLogger()

# Less flexible: Hardcoded target
buffered = BufferedLogger(target="http://localhost:8000/api/ingest")
```

### 2. Use Timestamps in File Paths

```python
# Good: Unique file per run
target = "~/logs/app/<YYYYMMDD_HHMMSS>.jsonl"

# Risky: Overwrites on each run
target = "~/logs/app.jsonl"
```

### 3. Handle Flush Errors

```python
try:
    result = buffered.flush()
    logger.info(f"Flushed {result['ingested']} logs")
except Exception as e:
    logger.error(f"Failed to flush logs: {e}")
    # Optionally: Save to fallback location
```

### 4. Use Stdout in Containers

```dockerfile
# Dockerfile
ENV LOG_TRG="-"
CMD ["python", "app.py"]
```

### 5. Structure Log Directories

```python
# Good: Organized by date
LOG_TRG="~/logs/2025/10/19/app_<YYYYMMDD_HHMMSS>.jsonl"

# Or by service
LOG_TRG="~/logs/myservice/<YYYYMMDD_HHMMSS>.jsonl"
```

## Troubleshooting

### File Permission Errors

```python
# Error: Permission denied
buffered = BufferedLogger(target="/var/log/app.jsonl")
```

**Solution:** Use a writable directory like `~/logs/` or configure proper permissions.

### Directory Creation Fails

```python
# Error: Cannot create directory
buffered = BufferedLogger(target="/readonly/logs/app.jsonl")
```

**Solution:** Ensure parent directory is writable or already exists.

### HTTP Connection Refused

```python
# Error: Connection refused
buffered = BufferedLogger(target="http://localhost:8000/api/ingest")
```

**Solution:** Ensure the server is running at the specified URL.

### File Already Open

Multiple `BufferedLogger` instances can write to the same file, but may interleave logs. For better control:

```python
# Use a single BufferedLogger instance
global_logger = BufferedLogger(target="~/logs/app.jsonl")

# Reuse across your application
def my_function():
    log = global_logger.logger
    log.info("doing work")
```

## Performance Considerations

### File I/O

- Files are opened on each `flush()` (not kept open)
- Uses append mode for safety
- Buffering reduces I/O frequency

### Network I/O

- HTTP requests are blocking
- Consider async version for high-throughput applications
- Network failures will raise exceptions

### Stdout

- Fastest option (no network/file I/O)
- Buffered by Python and OS
- Good for containerized applications

## Future Enhancements

Potential improvements for future versions:

1. **Async Support** - Non-blocking HTTP and file I/O
2. **Compression** - Gzip compression for file and HTTP targets
3. **Rotation** - Automatic log rotation for file targets
4. **Batching** - Configurable batch size for HTTP targets
5. **Retry Logic** - Automatic retries for transient failures
6. **Multiple Targets** - Send to multiple destinations simultaneously

## See Also

- [BufferedLogger Refactoring Documentation](./buffered_logger_refactoring.md)
- [README.md](../README.md) - General usage
- [CHANGELOG.md](../CHANGELOG.md) - Version history
- [test/05_target_modes.py](../test/05_target_modes.py) - Example code

---

**Created:** 2025-10-19  
**Version:** 0.2.0  
**Status:** Stable
