# AI Trace Test Examples

This directory contains example scripts demonstrating how to use AI Trace Viewer with various frameworks.

## Structure

```
test/
├── __init__.py          # Package initialization
├── common.py            # Shared utilities for all examples
├── 01_initial.py        # Original comprehensive example
├── 02_simple.py         # Simple LangGraph chatbot
├── 03_router.py         # Router pattern with multiple agents
├── 04_buffered_simple.py # BufferedLogger patterns
├── 05_target_modes.py   # Different logging targets
└── README.md            # This file
```

### common.py - Shared Utilities

The `common.py` module provides reusable utilities used across examples:

**`InspectHandler`** - LangChain callback handler
- Logs LLM invocation starts (with prompts and model)
- Logs LLM completions (with responses)
- Logs LLM errors

**`init_llm(default_model)`** - Initialize LLM with llmlite support
- Automatically configures llmlite proxy if env vars are set
- Falls back to direct Anthropic if not configured
- Supports custom default model

**`setup_tracing_and_logging(service_name, api_url)`** - Initialize tracing
- Sets up OpenTelemetry tracer
- Creates BufferedLogger instance
- Returns tuple of (tracer, buffered_logger)

Example usage:
```python
from common import InspectHandler, init_llm, setup_tracing_and_logging

# Initialize
tracer, buffered = setup_tracing_and_logging("my-app")
llm = init_llm()

# Use in your code
log = buffered.logger
inspect_handler = InspectHandler(log)
response = llm.invoke(messages, config={"callbacks": [inspect_handler]})
```

## Prerequisites

Install the optional example dependencies:

```bash
uv sync --extra examples
```

This installs:
- `langgraph` - LangGraph framework
- `langchain` - LangChain framework
- `langchain-anthropic` - Anthropic/Claude integration
- `python-dotenv` - Environment variable management

## Examples

### 02_simple.py - Simple LangGraph Chatbot

A minimal LangGraph chatbot with AI Trace integration.

**Features:**
- OpenTelemetry tracing with `@auto_span` decorator
- Custom callback handler for LLM invocation logging
- Structured logging with trace/span IDs
- Automatic log flushing with `trace_context`
- Optional llmlite proxy configuration

**Setup:**

1. Create a `.env` file or copy from `env.example`:
   ```bash
   cp env.example .env
   ```

2. Configure your LLM:
   
   **Option 1: Direct Anthropic**
   ```bash
   export ANTHROPIC_API_KEY=your-api-key
   ```
   
   **Option 2: Via llmlite proxy**
   ```bash
   export LLMLITE_BASE_URL=http://localhost:8080/v1
   export LLMLITE_API_KEY=your-llmlite-key
   export LLMLITE_MODEL=claude-3-5-sonnet-latest
   ```

3. Start the AI Trace server (in another terminal):
   ```bash
   uv run aitrace
   ```

4. Run the example:
   ```bash
   uv run python test/02_simple.py
   ```

5. Open http://localhost:8000 to view the trace tree

**What gets logged:**
- Chatbot function invocation
- LLM start event (with prompts and model)
- LLM completion event (with response)
- Any errors during LLM invocation

### 03_router.py - Router Pattern with Multiple Agents

A more complex LangGraph example with conditional routing between different agents.

**Features:**
- Message classification (emotional vs. logical)
- Conditional routing to specialized agents
- Two different agent personalities (therapist vs. logical)
- Full tracing of the entire routing flow
- Per-conversation-turn trace management
- LLM invocation logging for all agents

**Architecture:**
```
User Input → Classifier → Router → [Therapist Agent | Logical Agent] → Response
```

**Setup:**

1. Configure your LLM (same as 02_simple.py):
   ```bash
   # Option 1: Direct Anthropic
   export ANTHROPIC_API_KEY=your-api-key
   
   # Option 2: Via llmlite proxy
   export LLMLITE_BASE_URL=http://localhost:8080/v1
   export LLMLITE_API_KEY=your-llmlite-key
   export LLMLITE_MODEL=claude-3-5-sonnet-latest
   ```

2. Start the AI Trace server:
   ```bash
   uv run aitrace
   ```

3. Run the example:
   ```bash
   uv run python test/03_router.py
   ```

4. Try different types of messages:
   - Emotional: "I'm feeling really stressed about work"
   - Logical: "What's the capital of France?"

5. View traces at http://localhost:8000 - you'll see:
   - Classification process
   - Routing decision
   - Agent-specific processing
   - Each conversation turn as a separate trace tree

**What gets traced:**
- `classify_message` - Message classification with LLM call
- `router` - Routing logic and decision
- `therapist_agent` - Emotional response generation
- `logical_agent` - Factual response generation
- Each conversation turn gets its own trace tree

### Other Examples

- `01_initial.py` - Original comprehensive example
- `04_buffered_simple.py` - BufferedLogger usage patterns
- `05_target_modes.py` - Different logging target modes

## Environment Variables

### LLM Configuration

- `ANTHROPIC_API_KEY` - Direct Anthropic API key
- `LLMLITE_BASE_URL` - llmlite proxy URL (e.g., `http://localhost:8080/v1`)
- `LLMLITE_API_KEY` - llmlite API key
- `LLMLITE_MODEL` - Model name for llmlite

### AI Trace Configuration

- `AITRACE_HOST` - Server host (default: 0.0.0.0)
- `AITRACE_PORT` - Server port (default: 8000)
- `LOG_TRG` - Log target (HTTP URL, file path, or `-` for stdout)

## Log Target Configuration (LOG_TRG)

All examples now support the `LOG_TRG` environment variable to control where logs are sent.

### Target Modes

**1. HTTP Target (default)**
```bash
# Default - sends to local trace server
export LOG_TRG="http://localhost:8000/api/ingest"

# Custom server
export LOG_TRG="https://my-trace-server.com/api/ingest"
```

**2. File Target**
```bash
# Simple file
export LOG_TRG="~/tmp/my-app/logs.jsonl"

# With automatic timestamp (recommended)
export LOG_TRG="~/tmp/my-logs/<YYYYMMDD_HHMMSS>.jsonl"
```

The `<YYYYMMDD_HHMMSS>` placeholder is automatically replaced with the current timestamp (e.g., `20251024_103014`).

**3. Stdout Target**
```bash
# Print logs to stdout
export LOG_TRG="-"
```

### Automatic Fallback

When using HTTP target and the server is unreachable, traces are automatically saved as HTML files:

```bash
# Set HTTP target
export LOG_TRG="http://localhost:8000/api/ingest"

# Run example without server running
uv run test/02_simple.py

# Output:
# ⚠️  Cannot connect to trace server at http://localhost:8000/api/ingest
# ✓  Trace saved to local file instead:
#     ~/tmp/temp-trace/20251024_103014.html
#     Open in browser: file:///Users/.../tmp/temp-trace/20251024_103014.html
```

The HTML files are:
- Self-contained with embedded styling
- Viewable directly in any browser
- Color-coded by log level (info, warning, error, debug)
- Include full trace/span information
- Chronologically ordered

### Usage Examples

**Development (file-based)**
```bash
export LOG_TRG="~/tmp/dev-logs/<YYYYMMDD_HHMMSS>.jsonl"
uv run test/02_simple.py
```

**Testing without server**
```bash
# Just run - it will fallback to HTML automatically
unset LOG_TRG
uv run test/03_router.py
```

**Production (HTTP)**
```bash
export LOG_TRG="http://trace-server:8000/api/ingest"
uv run test/04_buffered_simple.py
```

**CI/CD (collect as artifacts)**
```bash
export LOG_TRG="/tmp/ci-traces/<YYYYMMDD_HHMMSS>.jsonl"
uv run test/01_initial.py
```

## Tips

1. **No server required for development**: Examples automatically fallback to HTML when server is unavailable
2. **Use file target for local dev**: `export LOG_TRG="~/tmp/dev/<YYYYMMDD_HHMMSS>.jsonl"`
3. **Check the UI**: Open http://localhost:8000 after running examples (if server is running)
4. **Environment variables**: Use `.env` file for persistent configuration
5. **Debug mode**: Add `--log-level debug --access-log` to aitrace for verbose output
6. **Custom database**: Use `--db-path /tmp/test.db` for temporary traces
7. **View HTML fallbacks**: HTML trace files in `~/tmp/temp-trace/` can be opened directly in browser

## Troubleshooting

### Module not found errors

Make sure you've installed the example dependencies:
```bash
uv sync --extra examples
```

### Connection refused errors

The AI Trace server isn't running. You have two options:

**Option 1: Start the server**
```bash
uv run aitrace
```

**Option 2: Use file target or let it fallback**
```bash
# Use file target
export LOG_TRG="~/tmp/my-logs/<YYYYMMDD_HHMMSS>.jsonl"

# Or just run - traces will be saved as HTML in ~/tmp/temp-trace/
uv run test/02_simple.py
```

### API key errors

Set your API keys in `.env` or environment variables:
```bash
export ANTHROPIC_API_KEY=your-key
# or for llmlite
export LLMLITE_API_KEY=your-key
```

### No logs appearing

1. Check that `BufferedLogger` target is correct (default: `http://localhost:8000/api/ingest`)
2. Ensure you're using `trace_context()` or manually calling `flush()`
3. Check server logs for any ingestion errors

## Creating Your Own Examples

Template for a new example:

```python
from aitrace import setup_tracing, auto_span, BufferedLogger

# Initialize tracing and logging
tracer = setup_tracing("my-example")
buffered = BufferedLogger("http://localhost:8000/api/ingest")

@auto_span()
def my_function():
    log = buffered.logger
    log.info("doing work", param="value")
    # ... your code ...

# Use trace_context for automatic flushing
with buffered.trace_context(tracer, "my_operation"):
    my_function()

# Logs automatically sent to server
```

See the existing examples for more patterns!

