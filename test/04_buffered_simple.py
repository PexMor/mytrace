"""Simplified test showing the cleanest usage of BufferedLogger."""
import sys

from aitrace import setup_tracing, auto_span, BufferedLogger

# Initialize tracing and buffered logging
# BufferedLogger will use LOG_TRG env var if set, otherwise defaults to http://localhost:8000/api/ingest
import os
tracer = setup_tracing("simple-app")
buffered = BufferedLogger(os.environ.get("LOG_TRG", "http://localhost:8000/api/ingest"))


@auto_span()
def process_data(item_id: int):
    """Process a single data item."""
    log = buffered.logger
    log.info("processing_item", item_id=item_id)
    
    # Simulate some work
    result = item_id * 2
    
    log.info("item_processed", item_id=item_id, result=result)
    return result


def example_1_manual_flush():
    """Example 1: Manually control buffer clearing and flushing."""
    print("Example 1: Manual flush")
    
    buffered.clear()
    
    with tracer.start_as_current_span("manual_operation"):
        log = buffered.logger
        log.info("operation_started")
        
        for i in range(3):
            process_data(i)
        
        log.info("operation_completed")
    
    # Send logs to server
    result = buffered.flush()
    print(f"  ✓ Ingested {result['ingested']} log entries\n")


def example_2_auto_flush():
    """Example 2: Use trace_context for automatic flushing."""
    print("Example 2: Auto-flush with trace_context")
    
    with buffered.trace_context(tracer, "auto_operation"):
        log = buffered.logger
        log.info("operation_started")
        
        for i in range(3, 6):
            process_data(i)
        
        log.info("operation_completed")
    
    # Logs automatically sent when context exits
    print("  ✓ Logs automatically flushed\n")


def main():
    """Run examples."""
    print("=" * 60)
    print("BufferedLogger Usage Examples")
    print("=" * 60)
    print()
    
    example_1_manual_flush()
    example_2_auto_flush()
    
    print("=" * 60)
    print("Done! Traces sent (or saved locally if server unavailable)")
    print("=" * 60)


if __name__ == "__main__":
    main()

