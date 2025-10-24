"""Decorator for automatic span creation on function calls."""
import functools
from typing import Optional
from opentelemetry import trace


def auto_span(name: Optional[str] = None, **span_kwargs):
    """
    Decorator that creates a child span around the function call.
    
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
            with tracer.start_as_current_span(span_name, **span_kwargs) as span:
                # Add function metadata
                span.set_attribute("code.function", fn.__name__)
                span.set_attribute("code.namespace", fn.__module__)
                return fn(*args, **kwargs)
        
        return wrapper
    
    return decorator

