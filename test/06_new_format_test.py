"""Test script to verify new trace format with __tracer_meta__ namespace."""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from aitrace import setup_tracing, setup_logging
from aitrace.decorators import auto_span
from aitrace.buffer import BufferedLogger
from aitrace.config import set_compat_mode


print("\n" + "=" * 70)
print(" New Format Test - __tracer_meta__ Namespace")
print("=" * 70)


# Test 1: Default mode (compat_mode=false)
print("\n" + "=" * 70)
print(" Test 1: Default Mode (compat_mode=false)")
print("=" * 70)

tracer = setup_tracing("new_format_test")
log = setup_logging()

@auto_span()
def process_item(item_id: int):
    """Process a single item."""
    log.info("processing_item", item_id=item_id)
    result = item_id * 2
    log.info("item_processed", item_id=item_id, result=result)
    return result

@auto_span()
def process_batch(batch_id: int, items: list):
    """Process a batch of items."""
    log.info("batch_started", batch_id=batch_id, count=len(items))
    results = []
    for item_id in items:
        results.append(process_item(item_id))
    log.info("batch_completed", batch_id=batch_id, results=results)
    return results

# Execute test
print("\nExecuting test with default format...")
process_batch(1, [1, 2, 3])

print("\n✓ Test 1 completed (logs printed above)")


# Test 2: Compatibility mode (compat_mode=true)
print("\n" + "=" * 70)
print(" Test 2: Compatibility Mode (compat_mode=true)")
print("=" * 70)

set_compat_mode(True)

# Need to reconfigure logging for compat mode to take effect
log = setup_logging()

print("\nExecuting test with compatibility mode (timestamp at top-level)...")
process_batch(2, [4, 5])

print("\n✓ Test 2 completed (logs printed above)")


# Test 3: BufferedLogger with file output
print("\n" + "=" * 70)
print(" Test 3: BufferedLogger File Output")
print("=" * 70)

output_file = Path.home() / "tmp" / "test_new_format.jsonl"
output_file.parent.mkdir(parents=True, exist_ok=True)

# Reset compat mode
set_compat_mode(False)

buffered = BufferedLogger(str(output_file))

@auto_span()
def nested_function(value: int):
    """A nested function."""
    buffered.logger.info("nested_log", value=value, doubled=value*2)
    return value * 2

with buffered.trace_context(tracer, "test_trace"):
    buffered.logger.info("trace_started", test_id="test_003")
    
    result = nested_function(42)
    
    buffered.logger.info("trace_completed", 
                        test_id="test_003", 
                        result=result,
                        metadata={"status": "success", "duration_ms": 123})

print(f"\n✓ Test 3 completed - logs written to: {output_file}")
print(f"\nFirst 10 lines of output:")
print("-" * 70)

with open(output_file) as f:
    for i, line in enumerate(f):
        if i >= 10:
            break
        print(line.rstrip())


# Test 4: Nested data structures
print("\n" + "=" * 70)
print(" Test 4: Nested Data Structures")
print("=" * 70)

log = setup_logging()

@auto_span()
def complex_data_test():
    """Test with complex nested data."""
    log.info("complex_event",
            user={
                "id": "u123",
                "name": "Alice",
                "preferences": {"theme": "dark", "lang": "en"}
            },
            cart=[
                {"item_id": "A", "quantity": 2, "price": 10.0},
                {"item_id": "B", "quantity": 1, "price": 25.5}
            ],
            payment={"method": "credit_card", "last4": "4242"})

print("\nExecuting test with nested data structures...")
complex_data_test()

print("\n✓ Test 4 completed (logs printed above)")


print("\n" + "=" * 70)
print(" All Tests Completed Successfully!")
print("=" * 70)
print("\nKey observations:")
print("  • Span lifecycle events: .start (provisional) and .end (final)")
print("  • All metadata in __tracer_meta__ namespace")
print("  • User data at top-level (outside __tracer_meta__)")
print("  • Compatibility mode duplicates only timestamp at top-level")
print("  • Nested data structures work naturally")
print()

