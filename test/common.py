"""Common utilities for test examples."""
import os
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.callbacks.base import BaseCallbackHandler
from aitrace import setup_tracing, BufferedLogger


# Load environment variables
load_dotenv()


class InspectHandler(BaseCallbackHandler):
    """Custom callback handler to log LLM interactions.
    
    Logs:
    - LLM invocation starts (with prompts and model info)
    - LLM invocation completions (with responses)
    - LLM invocation errors
    """
    
    def __init__(self, logger):
        """Initialize the handler with a logger instance.
        
        Args:
            logger: structlog logger instance from BufferedLogger
        """
        super().__init__()
        self.logger = logger
    
    def on_llm_start(self, serialized, prompts, **kwargs):
        """Log when LLM invocation starts."""
        self.logger.info(
            "llm_start",
            prompts=prompts,
            model=serialized.get("name", "unknown"),
            run_id=kwargs.get("run_id")
        )
    
    def on_llm_end(self, response, **kwargs):
        """Log when LLM invocation completes."""
        # Try to convert LangChain/LangGraph response to a JSON-serializable dict
        payload = None
        try:
            # Prefer structured form if available
            if hasattr(response, 'to_dict') and callable(getattr(response, 'to_dict')):
                payload = response.to_dict()
            elif hasattr(response, 'model_dump'):
                payload = response.model_dump()
            else:
                # Fallback: attempt to coerce common attributes
                payload = {
                    'type': type(response).__name__,
                }
                # Capture known attrs if present
                for attr in ['generations', 'llm_output', 'run', 'usage_metadata', 'response_metadata']:
                    if hasattr(response, attr):
                        payload[attr] = getattr(response, attr)
                # If it looks like a BaseMessage-like object (LC), grab content
                if hasattr(response, 'content'):
                    payload['content'] = response.content
        except Exception:
            payload = None

        self.logger.info(
            "llm_end",
            response=payload if payload is not None else str(response),
            run_id=kwargs.get("run_id")
        )
    
    def on_llm_error(self, error, **kwargs):
        """Log when LLM invocation fails."""
        self.logger.error(
            "llm_error",
            error=str(error),
            run_id=kwargs.get("run_id")
        )


def init_llm(default_model: str = "claude-3-5-sonnet-latest"):
    """Initialize LLM with llmlite proxy support.
    
    Checks environment variables for llmlite configuration:
    - LLMLITE_BASE_URL: llmlite proxy URL (e.g., http://localhost:8080/v1)
    - LLMLITE_API_KEY: llmlite API key
    - LLMLITE_MODEL: Model name (defaults to claude-3-5-sonnet-latest)
    
    If llmlite is not configured, falls back to direct Anthropic connection.
    
    Args:
        default_model: Default model name if LLMLITE_MODEL is not set
        
    Returns:
        Initialized LLM instance
        
    Example:
        >>> llm = init_llm()
        >>> llm = init_llm("claude-3-opus-latest")
    """
    llmlite_base_url = os.getenv("LLMLITE_BASE_URL")
    llmlite_api_key = os.getenv("LLMLITE_API_KEY")
    llmlite_model = os.getenv("LLMLITE_MODEL", default_model)
    
    if llmlite_base_url and llmlite_api_key:
        # Using llmlite as OpenAI-compatible proxy
        return init_chat_model(
            llmlite_model,
            model_provider="openai",
            api_key=llmlite_api_key,
            base_url=llmlite_base_url
        )
    else:
        # Fallback to direct Anthropic connection
        return init_chat_model(f"anthropic:{default_model}")


def setup_tracing_and_logging(service_name: str, target: str = None):
    """Initialize tracing and buffered logging.
    
    Args:
        service_name: Name for this service/application (appears in traces)
        target: Log target - HTTP URL, file path, or "-" for stdout
               If None, uses LOG_TRG environment variable or defaults to http://localhost:8000/api/ingest
        
    Returns:
        Tuple of (tracer, buffered_logger)
        
    Example:
        >>> tracer, buffered = setup_tracing_and_logging("my-app")
        >>> log = buffered.logger
        >>> log.info("application started")
    """
    # If no target provided, check LOG_TRG env var or use default
    if target is None:
        target = os.environ.get("LOG_TRG", "http://localhost:8000/api/ingest")
    
    tracer = setup_tracing(service_name)
    buffered = BufferedLogger(target)
    return tracer, buffered

