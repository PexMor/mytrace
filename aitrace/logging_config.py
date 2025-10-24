"""structlog configuration that injects OpenTelemetry trace IDs."""
import structlog
from opentelemetry import trace


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


def setup_logging():
    """Configure structlog with OpenTelemetry ID injection and JSON output."""
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.TimeStamper(fmt="iso"),
            _otel_ids_processor,
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ],
        cache_logger_on_first_use=True,
    )
    return structlog.get_logger()

