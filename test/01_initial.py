"""Test application that generates sample traces for the viewer."""
import random
import time
import sys
import requests

from aitrace import setup_tracing, auto_span, BufferedLogger

# Initialize tracing and buffered logging
# BufferedLogger will use LOG_TRG env var if set, otherwise defaults to http://localhost:8000/api/ingest
import os
tracer = setup_tracing("test-app")
buffered = BufferedLogger(os.environ.get("LOG_TRG", "http://localhost:8000/api/ingest"))
log = buffered.logger


@auto_span()
def fetch_user_data(user_id: str) -> dict:
    """Simulate fetching user data from database."""
    log.info("fetching_user_data", user_id=user_id)
    time.sleep(0.1)
    
    if random.random() < 0.1:
        log.warning("user_cache_miss", user_id=user_id)
    
    user_data = {
        "id": user_id,
        "name": f"User {user_id}",
        "email": f"user{user_id}@example.com",
    }
    
    log.info("user_data_fetched", user_id=user_id, fields=len(user_data))
    return user_data


@auto_span()
def calculate_discount(user_id: str, cart_total: float) -> float:
    """Calculate discount for user."""
    log.info("calculating_discount", user_id=user_id, cart_total=cart_total)
    
    # Simulate some logic
    time.sleep(0.05)
    
    discount = 0.0
    if cart_total > 100:
        discount = 0.1
        log.info("applied_discount", type="bulk_purchase", rate=0.1)
    
    if random.random() < 0.2:
        discount += 0.05
        log.info("applied_discount", type="loyalty", rate=0.05)
    
    final_discount = cart_total * discount
    log.info("discount_calculated", discount=final_discount)
    return final_discount


@auto_span()
def validate_payment(amount: float) -> bool:
    """Validate payment amount."""
    log.info("validating_payment", amount=amount)
    time.sleep(0.08)
    
    if amount <= 0:
        log.error("invalid_payment_amount", amount=amount, reason="non_positive")
        return False
    
    if amount > 10000:
        log.warning("large_payment_amount", amount=amount, threshold=10000)
    
    # Simulate occasional payment failures
    if random.random() < 0.15:
        log.error("payment_validation_failed", amount=amount, reason="fraud_check")
        return False
    
    log.info("payment_validated", amount=amount)
    return True


@auto_span()
def process_order(user_id: str, items: int, total: float):
    """Process an order with all its steps."""
    log.info("processing_order", user_id=user_id, items=items, total=total)
    
    # Fetch user data
    user = fetch_user_data(user_id)
    
    # Calculate discounts
    discount = calculate_discount(user_id, total)
    final_amount = total - discount
    
    log.info("order_totals", original=total, discount=discount, final=final_amount)
    
    # Validate payment
    if not validate_payment(final_amount):
        log.error("order_failed", user_id=user_id, reason="payment_validation")
        return False
    
    # Simulate order completion
    time.sleep(0.1)
    log.info("order_completed", user_id=user_id, amount=final_amount, items=items)
    return True


@auto_span("checkout_session")
def simulate_checkout():
    """Simulate a checkout session with multiple steps."""
    session_id = f"sess_{random.randint(1000, 9999)}"
    user_id = f"u{random.randint(1, 100)}"
    
    log.info("checkout_started", session_id=session_id, user_id=user_id)
    
    # Simulate cart
    num_items = random.randint(1, 5)
    cart_total = round(random.uniform(20, 500), 2)
    
    log.info("cart_loaded", items=num_items, total=cart_total)
    
    # Process the order
    success = process_order(user_id, num_items, cart_total)
    
    if success:
        log.info("checkout_completed", session_id=session_id, user_id=user_id)
    else:
        log.error("checkout_failed", session_id=session_id, user_id=user_id)
    
    return success


@auto_span("background_job")
def simulate_background_job():
    """Simulate a background job processing."""
    job_id = f"job_{random.randint(1000, 9999)}"
    log.info("job_started", job_id=job_id, type="daily_report")
    
    try:
        # Simulate work
        time.sleep(0.15)
        
        processed = random.randint(50, 200)
        log.info("processing_records", count=processed)
        
        if random.random() < 0.1:
            raise Exception("Database connection timeout")
        
        log.info("job_completed", job_id=job_id, records_processed=processed)
    except Exception as e:
        log.error("job_failed", job_id=job_id, error=str(e), exc_info=True)


def generate_traces(num_traces: int = 5):
    """Generate multiple traces."""
    print(f"Generating {num_traces} traces...")
    
    for i in range(num_traces):
        buffered.clear()
        
        # Create a root span for this trace
        with tracer.start_as_current_span(f"request_{i+1}"):
            log.info("request_received", request_id=i+1)
            
            # Mix of checkout sessions and background jobs
            if random.random() < 0.7:
                simulate_checkout()
            else:
                simulate_background_job()
            
            log.info("request_completed", request_id=i+1)
        
        # Send logs to API (will fallback to HTML if server is unreachable)
        result = buffered.flush()
        if result.get("target") == "fallback_html":
            print(f"  ✓ Trace {i+1}: Saved to {result['path']}")
        else:
            print(f"  ✓ Trace {i+1}: Ingested {result['ingested']} log entries")
        
        # Small delay between traces
        time.sleep(0.2)


def main():
    """Entry point for generating test traces."""
    num = 5
    if len(sys.argv) > 1:
        try:
            num = int(sys.argv[1])
        except ValueError:
            print("Usage: python test_app.py [num_traces]")
            sys.exit(1)
    
    print("=" * 60)
    print("AI Trace Test Generator")
    print("=" * 60)
    
    generate_traces(num)
    
    print("\n" + "=" * 60)
    print("Done! Traces sent (or saved locally if server unavailable)")
    print("=" * 60)


if __name__ == "__main__":
    main()

