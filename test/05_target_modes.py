"""Test BufferedLogger with different output targets (HTTP, file, stdout)."""
import os
import sys
from pathlib import Path

from aitrace import setup_tracing, auto_span, BufferedLogger

# Initialize tracing
tracer = setup_tracing("target-test-app")


@auto_span()
def process_item(item_id: int, log):
    """Process a single item."""
    log.info("processing_item", item_id=item_id)
    result = item_id * 2
    log.info("item_processed", item_id=item_id, result=result)
    return result


def test_stdout_target():
    """Test 1: Output to stdout (default when LOG_TRG not set)."""
    print("\n" + "=" * 60)
    print("Test 1: STDOUT Target (default)")
    print("=" * 60)
    
    # Clear LOG_TRG if set
    if "LOG_TRG" in os.environ:
        del os.environ["LOG_TRG"]
    
    buffered = BufferedLogger()
    print(f"Target type: {buffered.target_type}")
    print(f"Target value: {buffered.target_value}")
    print("\nLog output (JSON lines):")
    print("-" * 60)
    
    with buffered.trace_context(tracer, "stdout_test"):
        log = buffered.logger
        log.info("test_started", target="stdout")
        process_item(1, log)
        log.info("test_completed", target="stdout")
    
    print("-" * 60)
    print("✓ Logs written to stdout\n")


def test_stdout_explicit():
    """Test 2: Explicit stdout target with '-'."""
    print("\n" + "=" * 60)
    print("Test 2: STDOUT Target (explicit with '-')")
    print("=" * 60)
    
    buffered = BufferedLogger(target="-")
    print(f"Target type: {buffered.target_type}")
    print(f"Target value: {buffered.target_value}")
    print("\nLog output (JSON lines):")
    print("-" * 60)
    
    with buffered.trace_context(tracer, "stdout_explicit_test"):
        log = buffered.logger
        log.info("test_started", target="stdout-explicit")
        process_item(2, log)
        log.info("test_completed", target="stdout-explicit")
    
    print("-" * 60)
    print("✓ Logs written to stdout\n")


def test_file_target():
    """Test 3: Output to file with timestamp and ~ expansion."""
    print("\n" + "=" * 60)
    print("Test 3: FILE Target with timestamp")
    print("=" * 60)
    
    # Use timestamp placeholder
    target = "~/tmp/ai-trace-test/<YYYYMMDD_HHMMSS>_test.jsonl"
    buffered = BufferedLogger(target=target)
    
    print(f"Target type: {buffered.target_type}")
    print(f"Target value: {buffered.target_value}")
    print(f"Resolved path: {buffered.target_value.absolute()}")
    
    buffered.clear()
    
    with tracer.start_as_current_span("file_test"):
        log = buffered.logger
        log.info("test_started", target="file")
        process_item(3, log)
        process_item(4, log)
        log.info("test_completed", target="file")
    
    result = buffered.flush()
    
    print(f"\n✓ Flushed {result['ingested']} logs to file")
    print(f"  Path: {result['path']}")
    
    # Verify file exists and show contents
    if buffered.target_value.exists():
        print(f"\n✓ File exists, size: {buffered.target_value.stat().st_size} bytes")
        print("\nFirst 3 lines of file:")
        print("-" * 60)
        with open(buffered.target_value, "r") as f:
            for i, line in enumerate(f):
                if i >= 3:
                    break
                print(line.rstrip())
        print("-" * 60)
    print()


def test_file_from_env():
    """Test 4: File target from LOG_TRG environment variable."""
    print("\n" + "=" * 60)
    print("Test 4: FILE Target from LOG_TRG env var")
    print("=" * 60)
    
    # Set environment variable
    target = "~/tmp/ai-trace-test/env_<YYYYMMDD_HHMMSS>.jsonl"
    os.environ["LOG_TRG"] = target
    
    # Create logger without explicit target (reads from env)
    buffered = BufferedLogger()
    
    print(f"LOG_TRG env var: {os.environ['LOG_TRG']}")
    print(f"Target type: {buffered.target_type}")
    print(f"Target value: {buffered.target_value}")
    print(f"Resolved path: {buffered.target_value.absolute()}")
    
    buffered.clear()
    
    with tracer.start_as_current_span("env_file_test"):
        log = buffered.logger
        log.info("test_started", target="file-from-env")
        process_item(5, log)
        log.info("test_completed", target="file-from-env")
    
    result = buffered.flush()
    
    print(f"\n✓ Flushed {result['ingested']} logs to file")
    print(f"  Path: {result['path']}")
    print()
    
    # Clean up
    del os.environ["LOG_TRG"]


def test_http_target():
    """Test 5: HTTP target (requires server running)."""
    print("\n" + "=" * 60)
    print("Test 5: HTTP Target (requires server)")
    print("=" * 60)
    
    target = "http://localhost:8000/api/ingest"
    buffered = BufferedLogger(target=target)
    
    print(f"Target type: {buffered.target_type}")
    print(f"Target value: {buffered.target_value}")
    
    buffered.clear()
    
    with tracer.start_as_current_span("http_test"):
        log = buffered.logger
        log.info("test_started", target="http")
        process_item(6, log)
        log.info("test_completed", target="http")
    
    try:
        result = buffered.flush()
        print(f"\n✓ Flushed {result['ingested']} logs to HTTP endpoint")
        print(f"  Status: {result}")
    except Exception as e:
        print(f"\n✗ HTTP flush failed: {e}")
        print("  (This is expected if the server is not running)")
    print()


def main():
    """Run all target mode tests."""
    print("\n" + "=" * 70)
    print(" BufferedLogger Target Modes Test Suite")
    print("=" * 70)
    
    test_stdout_target()
    test_stdout_explicit()
    test_file_target()
    test_file_from_env()
    test_http_target()
    
    print("=" * 70)
    print(" All tests completed!")
    print("=" * 70)
    print("\nTarget modes supported:")
    print("  1. stdout (default)       - LOG_TRG not set or LOG_TRG='-'")
    print("  2. file with timestamp    - LOG_TRG='~/path/<YYYYMMDD_HHMMSS>.jsonl'")
    print("  3. HTTP endpoint          - LOG_TRG='http://localhost:8000/api/ingest'")
    print("\nFiles created in: ~/tmp/ai-trace-test/")
    print("=" * 70)


if __name__ == "__main__":
    main()

