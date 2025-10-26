"""Decorator for automatic span creation on function calls."""
import functools
from typing import Optional
from opentelemetry import trace
import structlog


def auto_span(name: Optional[str] = None, **span_kwargs):
    """
    Decorator that creates a child span around the function call.
    
    Emits two lifecycle events:
    - {function_name}.start: Provisional event when span begins
    - {function_name}.end: Final event when span completes
    
    Args:
        name: Optional custom span name. If not provided, uses function's qualified name.
        **span_kwargs: Additional arguments to pass to start_as_current_span.
    
    Usage:
        @auto_span()
        def my_function():
            pass
        
        @auto_span("custom_name")
        def another_function():
            pass
    """
    tracer = trace.get_tracer(__name__)

    def decorator(fn):
        span_name = name or fn.__qualname__

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            log = structlog.get_logger()
            
            with tracer.start_as_current_span(span_name, **span_kwargs) as span:
                # Add function metadata
                span.set_attribute("code.function", fn.__name__)
                span.set_attribute("code.namespace", fn.__module__)
                
                # Emit span start event (provisional)
                log.info(f"{span_name}.start", provisional=True)
                
                try:
                    # Execute function
                    result = fn(*args, **kwargs)
                    
                    # Emit span end event (final)
                    log.info(f"{span_name}.end")
                    
                    return result
                except Exception as e:
                    # Emit span end event even on error
                    log.error(f"{span_name}.end", error=str(e), exc_info=True)
                    raise
        
        return wrapper
    
    return decorator

