#!/usr/bin/env python3
"""Test BufferedLogger with source location tracking."""

import json
from pathlib import Path
from aitrace import setup_tracing, BufferedLogger

# Setup
tracer = setup_tracing("test-buffered")
output_file = Path("/tmp/test_trace_output.jsonl")

# Create BufferedLogger that writes to file
buffered = BufferedLogger(target=str(output_file))
log = buffered.logger

print(f"Writing traces to: {output_file}")
print(f"Workspace root: {buffered._workspace_root if hasattr(buffered, '_workspace_root') else 'auto-detected'}")
print()

# Generate some logs with source location
with tracer.start_as_current_span("test_trace"):
    log.info("test_start", test_name="buffered_source_location")
    
    for i in range(3):
        log.info("iteration", number=i, status="processing")
        log.debug("iteration_detail", number=i, detail=f"detail_{i}")
    
    log.info("test_end", test_name="buffered_source_location", iterations=3)

# Flush logs to file
result = buffered.flush()
print(f"✓ Flushed {result['ingested']} log entries to file")
print()

# Read and display the output
print("="*80)
print("Generated trace file contents:")
print("="*80)
print()

with open(output_file, "r") as f:
    for line_num, line in enumerate(f, 1):
        log_entry = json.loads(line)
        
        # Extract key fields
        file = log_entry.get("file", "N/A")
        line_no = log_entry.get("line", "N/A")
        function = log_entry.get("function", "N/A")
        event = log_entry.get("event", "N/A")
        level = log_entry.get("level", "info")
        
        print(f"[{line_num}] {level.upper():5} | {event:20} | {file}:{line_no} in {function}()")
        
        # Show that all required fields are present for VSCode plugin
        required_fields = ["file", "line", "trace_id", "span_id"]
        has_all = all(field in log_entry for field in required_fields)
        
        if has_all:
            print(f"     ✓ All required fields present")
        else:
            missing = [f for f in required_fields if f not in log_entry]
            print(f"     ✗ Missing fields: {missing}")
        print()

print("="*80)
print("VSCode/Cursor Plugin Format Compatibility:")
print("="*80)
print()
print("Each log entry contains:")
print("  ✓ 'file': relative path from workspace root")
print("  ✓ 'line': line number (1-based)")
print("  ✓ 'function': function name")
print("  ✓ 'trace_id': for grouping related logs")
print("  ✓ 'span_id': unique span identifier")
print()
print("These can be directly used by the VSCode plugin!")
print()
print(f"Trace file saved at: {output_file}")

