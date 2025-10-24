"""AI Trace Viewer - View structured logs as execution trees."""

__version__ = "0.2.0"

from .tracing import setup_tracing
from .logging_config import setup_logging
from .decorators import auto_span
from .buffer import BufferedLogger
from .config import (
    get_config_dir,
    get_data_dir,
    load_config,
    init_config_files,
)

__all__ = [
    "setup_tracing",
    "setup_logging",
    "auto_span",
    "BufferedLogger",
    "get_config_dir",
    "get_data_dir",
    "load_config",
    "init_config_files",
]

