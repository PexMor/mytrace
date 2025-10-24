"""OpenTelemetry tracing setup without exporters."""
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource


def setup_tracing(service_name: str = "trace-viewer") -> trace.Tracer:
    """
    Initialize OpenTelemetry tracing with no exporters.
    
    Spans are created in-process only for context/ID generation.
    They are not exported anywhere - logs are the source of truth.
    """
    resource = Resource.create({"service.name": service_name})
    tp = TracerProvider(resource=resource)
    trace.set_tracer_provider(tp)
    return trace.get_tracer(service_name)

