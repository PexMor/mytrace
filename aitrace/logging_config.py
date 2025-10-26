"""structlog configuration that injects OpenTelemetry trace IDs and source location."""
import inspect
import structlog
from pathlib import Path
from typing import Optional
from opentelemetry import trace


# Cache for workspace root detection
_workspace_root: Optional[Path] = None


def _detect_workspace_root() -> Optional[Path]:
    """Detect the workspace/project root directory.
    
    Looks for common project markers (in order of priority):
    - .git directory
    - pyproject.toml
    - setup.py
    - requirements.txt
    
    Returns:
        Path to workspace root or None if not detected
    """
    global _workspace_root
    
    # Return cached value if available
    if _workspace_root is not None:
        return _workspace_root
    
    # Try to detect from current working directory upwards
    cwd = Path.cwd()
    
    # Markers in order of priority
    markers = ['.git', 'pyproject.toml', 'setup.py', 'requirements.txt']
    
    # Walk up the directory tree
    current = cwd
    while current != current.parent:  # Stop at root
        for marker in markers:
            marker_path = current / marker
            if marker_path.exists():
                _workspace_root = current
                return _workspace_root
        current = current.parent
    
    # If no marker found, use cwd as fallback
    _workspace_root = cwd
    return _workspace_root


def _get_relative_path(absolute_path: str) -> str:
    """Convert absolute path to relative path from workspace root.
    
    Args:
        absolute_path: Absolute file path
        
    Returns:
        Relative path from workspace root, or absolute path if conversion fails
    """
    try:
        abs_path = Path(absolute_path).resolve()
        workspace_root = _detect_workspace_root()
        
        if workspace_root:
            try:
                return str(abs_path.relative_to(workspace_root))
            except ValueError:
                # Path is not relative to workspace root
                pass
        
        # Fallback: return as-is
        return str(abs_path)
    except Exception:
        # If anything fails, return the original path
        return absolute_path


def _source_location_processor(_, __, event_dict):
    """Inject source file and line number information.
    
    Adds:
    - file: relative path from workspace root
    - line: line number where log was called
    - function: function name (if available)
    """
    # Walk up the stack to find the actual logging call site
    # Skip frames from logging infrastructure
    stack = inspect.stack()
    
    # Find the first frame that's not in structlog or aitrace internal modules
    skip_modules = {'structlog', 'aitrace.logging_config', 'aitrace.buffer', 'logging'}
    caller_frame = None
    
    for frame_info in stack[1:]:  # Skip current frame
        module_name = frame_info.frame.f_globals.get('__name__', '')
        
        # Skip internal logging infrastructure frames
        if not any(skip in module_name for skip in skip_modules):
            caller_frame = frame_info
            break
    
    if caller_frame:
        # Get absolute path and convert to relative
        abs_path = caller_frame.filename
        rel_path = _get_relative_path(abs_path)
        
        event_dict["file"] = rel_path
        event_dict["line"] = caller_frame.lineno
        
        # Add function name if available and useful
        func_name = caller_frame.function
        if func_name and func_name != '<module>':
            event_dict["function"] = func_name
    
    return event_dict


def _otel_ids_processor(_, __, event_dict):
    """Inject trace_id, span_id, and parent_span_id from current OpenTelemetry context."""
    span = trace.get_current_span()
    ctx = span.get_span_context()
    
    if ctx and ctx.is_valid:
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
        
        # Try to get parent span ID
        parent = getattr(span, "parent", None)
        if parent and getattr(parent, "is_valid", False):
            event_dict["parent_span_id"] = format(parent.span_id, "016x")
    
    return event_dict


def _wrap_tracer_metadata_processor(_, __, event_dict):
    """Wrap tracer metadata into __tracer_meta__ namespace.
    
    This processor moves all tracer infrastructure fields into a dedicated
    __tracer_meta__ namespace, leaving user data at the top level.
    
    Metadata fields that get wrapped:
    - timestamp
    - event
    - trace_id
    - span_id
    - parent_span_id
    - file
    - line
    - function
    - level
    - provisional (if present)
    
    In compatibility mode (AITRACE_COMPAT_MODE=true), timestamp is duplicated
    at the top level for external tools like Elastic/OpenTelemetry.
    """
    # Import config here to avoid circular import
    from .config import get_config
    
    # Define metadata fields to wrap
    metadata_fields = [
        "timestamp",
        "event",
        "trace_id",
        "span_id",
        "parent_span_id",
        "file",
        "line",
        "function",
        "level",
        "logger",
        "provisional",
    ]
    
    # Create __tracer_meta__ dict with all metadata
    tracer_meta = {}
    for field in metadata_fields:
        if field in event_dict:
            tracer_meta[field] = event_dict[field]
    
    # Only wrap if we have metadata
    if tracer_meta:
        # Remove metadata from top-level
        for field in metadata_fields:
            event_dict.pop(field, None)
        
        # Add __tracer_meta__ with all metadata
        event_dict["__tracer_meta__"] = tracer_meta
        
        # In compatibility mode, duplicate timestamp at top-level
        try:
            config = get_config()
            if getattr(config, "compat_mode", False) and "timestamp" in tracer_meta:
                event_dict["timestamp"] = tracer_meta["timestamp"]
        except Exception:
            # If config loading fails, default to no compat mode
            pass
    
    return event_dict


def setup_logging():
    """Configure structlog with OpenTelemetry ID injection, source location, and JSON output."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.TimeStamper(fmt="iso"),
            _source_location_processor,  # Add source file and line info
            _otel_ids_processor,  # Add trace/span IDs
            structlog.processors.dict_tracebacks,
            _wrap_tracer_metadata_processor,  # Wrap metadata into __tracer_meta__
            structlog.processors.JSONRenderer(),
        ],
        cache_logger_on_first_use=True,
    )
    return structlog.get_logger()


def set_workspace_root(root_path: str | Path) -> None:
    """Manually set the workspace root path.
    
    This is useful when automatic detection fails or when you want to
    override the detected workspace root.
    
    Args:
        root_path: Path to the workspace root directory
        
    Example:
        >>> from aitrace import logging_config
        >>> logging_config.set_workspace_root("/path/to/my/project")
        >>> # Now all file paths will be relative to this root
    """
    global _workspace_root
    _workspace_root = Path(root_path).resolve()


def get_workspace_root() -> Optional[Path]:
    """Get the current workspace root path.
    
    Returns:
        Path to workspace root or None if not yet detected
    """
    return _workspace_root if _workspace_root is not None else _detect_workspace_root()

