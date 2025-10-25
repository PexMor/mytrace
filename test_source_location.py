#!/usr/bin/env python3
"""Test script to verify source location tracking in log records."""

import json
from aitrace import setup_tracing, setup_logging, auto_span, get_workspace_root

# Setup
tracer = setup_tracing("test-source-location")
log = setup_logging()

# Show detected workspace root
workspace_root = get_workspace_root()
print(f"Detected workspace root: {workspace_root}")
print()


@auto_span()
def process_data(item_id: int):
    """Process a single data item."""
    log.info("processing_item", item_id=item_id, status="started")
    
    # Simulate some processing
    result = item_id * 2
    
    log.info("processing_item", item_id=item_id, status="completed", result=result)
    return result


@auto_span()
def main():
    """Main function to test logging with source location."""
    log.info("application_start", service="test-app", version="1.0.0")
    
    # Process some items
    items = [1, 2, 3]
    for item_id in items:
        result = process_data(item_id)
        log.debug("item_result", item_id=item_id, result=result)
    
    log.info("application_end", total_items=len(items))


if __name__ == "__main__":
    with tracer.start_as_current_span("test_run"):
        main()
    
    print("\n" + "="*80)
    print("Test completed! Check the logs above.")
    print("="*80)
    print("\nEach log entry should now include:")
    print("  - 'file': relative path from workspace root")
    print("  - 'line': line number where log was called")
    print("  - 'function': function name (if applicable)")
    print("\nThese fields can be used by the VSCode/Cursor plugin to:")
    print("  - Show gutter marks on the corresponding lines")
    print("  - Add clickable CodeLens above the lines")
    print("  - Open trace details in a separate tab")

