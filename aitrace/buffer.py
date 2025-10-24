"""Buffered logging for batch ingestion to AI Trace server."""
import os
import json
import sys
import structlog
import requests
from typing import List, Dict, Any, Optional, Literal
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime
from uuid import UUID

from .logging_config import _otel_ids_processor


# HTML template for trace export
HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Trace Export - {timestamp}</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 30px;
        }}
        h1 {{
            color: #2563eb;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }}
        .info {{
            background: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
        }}
        .log-entry {{
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 15px;
            background: #fafafa;
        }}
        .log-header {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-weight: 500;
        }}
        .log-level {{
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }}
        .log-level.info {{ background: #dbeafe; color: #1e40af; }}
        .log-level.error {{ background: #fee2e2; color: #991b1b; }}
        .log-level.warning {{ background: #fef3c7; color: #92400e; }}
        .log-level.debug {{ background: #f3f4f6; color: #374151; }}
        .log-timestamp {{
            color: #6b7280;
            font-size: 13px;
        }}
        .log-event {{
            font-size: 16px;
            color: #111827;
            margin-bottom: 8px;
        }}
        .log-details {{
            font-family: "Monaco", "Courier New", monospace;
            font-size: 13px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 10px;
            overflow-x: auto;
        }}
        .trace-info {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }}
        .trace-field {{
            font-size: 12px;
        }}
        .trace-label {{
            color: #6b7280;
            font-weight: 500;
        }}
        .trace-value {{
            font-family: "Monaco", "Courier New", monospace;
            color: #374151;
            word-break: break-all;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 AI Trace Export</h1>
        
        <div class="info">
            <strong>Exported:</strong> {timestamp}<br>
            <strong>Total Logs:</strong> {count}<br>
            <strong>Service:</strong> {service_name}
        </div>
        
        <div class="logs">
            {logs_html}
        </div>
    </div>
</body>
</html>
"""


def _json_serializer(obj):
    """Advanced JSON serializer for complex objects.
    
    Handles:
    - UUID objects (converted to strings)
    - datetime objects (ISO format)
    - Objects with __dict__ (converted to dict)
    - dataclasses
    - Enums
    - Sets, frozensets (converted to lists)
    - bytes (decoded or hex)
    - Other iterables
    """
    from datetime import datetime, date, time, timedelta
    from decimal import Decimal
    from enum import Enum
    from dataclasses import is_dataclass, asdict
    
    # Handle UUIDs
    if isinstance(obj, UUID):
        return str(obj)
    
    # Handle datetime objects
    if isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    
    if isinstance(obj, timedelta):
        return obj.total_seconds()
    
    # Handle Decimal
    if isinstance(obj, Decimal):
        return float(obj)
    
    # Handle Enums
    if isinstance(obj, Enum):
        return obj.value
    
    # Handle sets and frozensets
    if isinstance(obj, (set, frozenset)):
        return list(obj)
    
    # Handle bytes
    if isinstance(obj, bytes):
        try:
            return obj.decode('utf-8')
        except UnicodeDecodeError:
            return obj.hex()
    
    # Handle dataclasses
    if is_dataclass(obj) and not isinstance(obj, type):
        try:
            return asdict(obj)
        except Exception:
            pass
    
    # Handle objects with __dict__
    if hasattr(obj, '__dict__'):
        try:
            result = {}
            for key, value in obj.__dict__.items():
                if not key.startswith('_'):  # Skip private attributes
                    try:
                        # Recursively serialize nested objects
                        result[key] = _json_serializer(value) if not isinstance(value, (str, int, float, bool, type(None))) else value
                    except Exception:
                        result[key] = str(value)
            if result:
                result['__type__'] = type(obj).__name__
                return result
        except Exception:
            pass
    
    # Handle iterables (but not strings)
    if hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes)):
        try:
            return [_json_serializer(item) if not isinstance(item, (str, int, float, bool, type(None))) else item 
                    for item in obj]
        except Exception:
            pass
    
    # Fallback to string representation
    try:
        return str(obj)
    except Exception:
        return f"<non-serializable: {type(obj).__name__}>"


class BufferedLogger:
    """Logger that buffers log entries for batch ingestion.
    
    Output target is determined by:
    1. Explicit `target` parameter in constructor
    2. LOG_TRG environment variable
    3. Falls back to stdout if neither is set
    
    Target formats:
    - HTTP URL: "http://localhost:8000/api/ingest" or "https://..."
    - File: Any path like "~/tmp/my-app/logs.jsonl" (supports ~ expansion)
    - Stdout: "-" (dash) or None (fallback)
    """
    
    def __init__(self, target: Optional[str] = None):
        """Initialize buffered logger.
        
        Args:
            target: Output target (URL, file path, or "-" for stdout).
                   If not provided, reads from LOG_TRG environment variable.
                   Falls back to stdout if neither is set.
        """
        # Determine target from parameter or environment variable
        if target is None:
            target = os.environ.get("LOG_TRG")
        
        # Parse and set up target
        self.target_type, self.target_value = self._parse_target(target)
        self.buffer: List[Dict[str, Any]] = []
        self._configure_structlog()
        self.logger = structlog.get_logger()
    
    def _parse_target(self, target: Optional[str]) -> tuple[Literal["http", "file", "stdout"], Any]:
        """Parse target string and return (type, value) tuple.
        
        Args:
            target: Target string to parse
            
        Returns:
            Tuple of (target_type, target_value) where:
            - ("http", url) for HTTP endpoints
            - ("file", Path) for file outputs
            - ("stdout", None) for stdout
        """
        # Default to stdout if no target specified
        if not target or target == "-":
            return ("stdout", None)
        
        # HTTP target
        if target.startswith("http://") or target.startswith("https://"):
            return ("http", target)
        
        # File target - expand ~ and create timestamp
        expanded = os.path.expanduser(target)
        
        # Replace timestamp placeholders if present
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        expanded = expanded.replace("<YYYYMMDD_HHMMSS>", timestamp)
        
        file_path = Path(expanded)
        
        # Create parent directories if they don't exist
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        return ("file", file_path)
    
    def _configure_structlog(self):
        """Configure structlog to buffer logs.
        
        For HTTP and file targets, logs are only buffered (not printed).
        For stdout target, logs are buffered AND printed.
        """
        processors = [
            structlog.contextvars.merge_contextvars,
            structlog.processors.TimeStamper(fmt="iso"),
            _otel_ids_processor,
            structlog.processors.dict_tracebacks,
            self._buffering_processor,
        ]
        
        # Only add JSONRenderer for stdout target (immediate output)
        # For http/file targets, logs are buffered only (no printing)
        if self.target_type == "stdout":
            processors.append(structlog.processors.JSONRenderer())
        
        structlog.configure(
            processors=processors,
            cache_logger_on_first_use=False,
        )
    
    def _buffering_processor(self, logger, name, event_dict):
        """Processor that captures logs to buffer.
        
        For non-stdout targets, this also prevents logs from being printed
        by raising DropEvent after buffering.
        """
        self.buffer.append(event_dict)
        
        # For http/file targets, drop the event to prevent printing
        # For stdout, return event_dict to continue processing
        if self.target_type != "stdout":
            raise structlog.DropEvent
        
        return event_dict
    
    def clear(self):
        """Clear the log buffer."""
        self.buffer.clear()
    
    def get_logs(self) -> List[Dict[str, Any]]:
        """Get all buffered logs."""
        return self.buffer.copy()
    
    def flush(self, clear_after: bool = True) -> Dict[str, Any]:
        """Send buffered logs to configured target.
        
        Args:
            clear_after: Whether to clear buffer after sending
            
        Returns:
            Response data with at least {"ingested": count} field
            
        Raises:
            requests.exceptions.RequestException: If HTTP target fails
            IOError: If file write fails
        """
        if not self.buffer:
            return {"ingested": 0, "message": "No logs to send"}
        
        # Route to appropriate handler based on target type
        if self.target_type == "http":
            result = self._flush_http()
        elif self.target_type == "file":
            result = self._flush_file()
        else:  # stdout
            result = self._flush_stdout()
        
        if clear_after:
            self.clear()
        
        return result
    
    def _flush_http(self) -> Dict[str, Any]:
        """Flush logs to HTTP endpoint.
        
        If connection fails, automatically falls back to saving traces
        to a temporary HTML file in ~/tmp/temp-trace/
        """
        # Serialize with custom handler for UUID and other types
        json_data = json.dumps(self.buffer, default=_json_serializer)
        
        try:
            response = requests.post(
                self.target_value,
                data=json_data,
                headers={"Content-Type": "application/json"},
                timeout=5
            )
            response.raise_for_status()
            return response.json()
        except (requests.exceptions.ConnectionError, 
                requests.exceptions.Timeout,
                requests.exceptions.RequestException) as e:
            # Server unreachable - fallback to HTML export
            fallback_path = self._export_to_html_fallback()
            
            # Print user-friendly error message
            print(f"\n⚠️  Cannot connect to trace server at {self.target_value}", file=sys.stderr)
            print(f"    Error: {str(e)}", file=sys.stderr)
            print(f"\n✓  Trace saved to local file instead:", file=sys.stderr)
            print(f"    {fallback_path}", file=sys.stderr)
            print(f"\n    Open in browser: file://{fallback_path}\n", file=sys.stderr)
            
            return {
                "ingested": len(self.buffer),
                "target": "fallback_html",
                "path": str(fallback_path),
                "error": str(e)
            }
    
    def _export_to_html_fallback(self) -> Path:
        """Export buffered logs to an HTML file in ~/tmp/temp-trace/.
        
        Returns:
            Path to the created HTML file
        """
        # Create fallback directory
        fallback_dir = Path.home() / "tmp" / "temp-trace"
        fallback_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate timestamped filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        html_path = fallback_dir / f"{timestamp}.html"
        
        # Generate HTML content
        html_content = self._generate_html_trace()
        
        # Write to file
        with open(html_path, "w") as f:
            f.write(html_content)
        
        return html_path
    
    def _generate_html_trace(self) -> str:
        """Generate HTML representation of buffered logs.
        
        Returns:
            Complete HTML document as string
        """
        # Build log entries HTML
        logs_html = []
        for log_entry in self.buffer:
            level = log_entry.get("level", "info").lower()
            event = log_entry.get("event", "")
            timestamp = log_entry.get("timestamp", "")
            
            # Extract trace information
            trace_id = log_entry.get("trace_id", "N/A")
            span_id = log_entry.get("span_id", "N/A")
            parent_span_id = log_entry.get("parent_span_id", "N/A")
            
            # Create details dict (exclude standard fields)
            details = {k: v for k, v in log_entry.items() 
                      if k not in ["level", "event", "timestamp", "trace_id", 
                                   "span_id", "parent_span_id", "logger"]}
            
            details_json = json.dumps(details, indent=2, default=_json_serializer)
            
            log_html = f"""
            <div class="log-entry">
                <div class="log-header">
                    <span class="log-level {level}">{level}</span>
                    <span class="log-timestamp">{timestamp}</span>
                </div>
                <div class="log-event">{event}</div>
                <div class="trace-info">
                    <div class="trace-field">
                        <div class="trace-label">Trace ID:</div>
                        <div class="trace-value">{trace_id}</div>
                    </div>
                    <div class="trace-field">
                        <div class="trace-label">Span ID:</div>
                        <div class="trace-value">{span_id}</div>
                    </div>
                    <div class="trace-field">
                        <div class="trace-label">Parent Span:</div>
                        <div class="trace-value">{parent_span_id}</div>
                    </div>
                </div>
                <div class="log-details">{details_json}</div>
            </div>
            """
            logs_html.append(log_html)
        
        # Extract service name from logs (if available)
        service_name = "Unknown Service"
        for log_entry in self.buffer:
            if "service_name" in log_entry:
                service_name = log_entry["service_name"]
                break
        
        # Fill template
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        html = HTML_TEMPLATE.format(
            timestamp=timestamp,
            count=len(self.buffer),
            service_name=service_name,
            logs_html="\n".join(logs_html)
        )
        
        return html
    
    def _flush_file(self) -> Dict[str, Any]:
        """Flush logs to file (append mode, one JSON object per line)."""
        with open(self.target_value, "a") as f:
            for log_entry in self.buffer:
                json.dump(log_entry, f, default=_json_serializer)
                f.write("\n")
        
        return {
            "ingested": len(self.buffer),
            "target": "file",
            "path": str(self.target_value)
        }
    
    def _flush_stdout(self) -> Dict[str, Any]:
        """Flush logs to stdout (one JSON object per line)."""
        for log_entry in self.buffer:
            json.dump(log_entry, sys.stdout, default=_json_serializer)
            sys.stdout.write("\n")
        sys.stdout.flush()
        
        return {
            "ingested": len(self.buffer),
            "target": "stdout"
        }
    
    @contextmanager
    def trace_context(self, tracer, span_name: str):
        """Context manager that auto-flushes logs after trace completion.
        
        Args:
            tracer: OpenTelemetry tracer instance
            span_name: Name for the root span
            
        Yields:
            The logger instance
            
        Example:
            >>> buffered = BufferedLogger()
            >>> with buffered.trace_context(tracer, "my_operation"):
            ...     buffered.logger.info("doing work")
        """
        self.clear()
        with tracer.start_as_current_span(span_name):
            yield self.logger
        self.flush()

