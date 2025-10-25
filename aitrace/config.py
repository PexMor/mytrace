"""Configuration management for AI Trace Viewer."""
import sys
from pathlib import Path
from typing import Optional, Union

import configargparse


def path_to_display(path: Union[Path, str]) -> str:
    """Convert an absolute path to use ~ notation for display.
    
    Args:
        path: Path object or string path
        
    Returns:
        Path string with ~ for user's home directory
    """
    path = Path(path)
    try:
        # Try to make it relative to home
        rel = path.relative_to(Path.home())
        return f"~/{rel}"
    except ValueError:
        # Not relative to home, return as-is
        return str(path)


def expand_path(path: Union[Path, str]) -> Path:
    """Expand ~ and convert to absolute Path.
    
    Args:
        path: Path with potential ~ notation
        
    Returns:
        Expanded absolute Path object
    """
    return Path(path).expanduser().resolve()


def get_config_dir() -> Path:
    """Get the configuration directory path."""
    config_dir = Path.home() / ".config" / "aitrace"
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir


def get_data_dir() -> Path:
    """Get the data directory path (same as config for now)."""
    return get_config_dir()


def create_parser() -> configargparse.ArgumentParser:
    """
    Create argument parser with support for config file, env vars, and CLI args.
    
    Priority (highest to lowest):
    1. Command line arguments
    2. Environment variables (prefixed with AITRACE_)
    3. Config file (~/.config/aitrace/config.yaml or config.toml)
    4. Defaults
    """
    config_dir = get_config_dir()
    
    # Look for config files
    config_files = [
        config_dir / "config.yaml",
        config_dir / "config.toml",
    ]
    
    # Filter to existing files
    existing_configs = [str(f) for f in config_files if f.exists()]
    
    parser = configargparse.ArgumentParser(
        description="AI Trace Viewer - View structured logs as execution trees",
        default_config_files=existing_configs,
        config_file_parser_class=configargparse.YAMLConfigFileParser,
        formatter_class=configargparse.ArgumentDefaultsHelpFormatter,
        auto_env_var_prefix="AITRACE_",
    )
    
    parser.add_argument(
        "-c",
        "--config",
        is_config_file=True,
        help="Path to config file (YAML or TOML)",
    )
    
    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind the server to",
    )
    
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind the server to",
    )
    
    parser.add_argument(
        "--db-path",
        default=None,
        help=(
            "Path to SQLite database file. "
            f"Defaults to {{config_dir}}/logs.db (~/.config/aitrace/logs.db)"
        ),
    )
    
    parser.add_argument(
        "--reload",
        action="store_true",
        default=False,
        help="Enable auto-reload for development",
    )
    
    parser.add_argument(
        "--log-level",
        default="info",
        choices=["critical", "error", "warning", "info", "debug"],
        help="Logging level for the server",
    )
    
    parser.add_argument(
        "--access-log",
        action="store_true",
        default=False,
        help="Enable access logging",
    )
    
    parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (not recommended with SQLite)",
    )
    
    return parser


def load_config(args: Optional[list] = None):
    """
    Load configuration from all sources.
    
    Args:
        args: Command line arguments (defaults to sys.argv[1:])
    
    Returns:
        Namespace with configuration values
    """
    parser = create_parser()
    config = parser.parse_args(args)
    
    # Set default db_path if not specified, then expand it
    if config.db_path is None:
        config.db_path = str(get_data_dir() / "logs.db")
    else:
        # Expand ~ and resolve to absolute path
        config.db_path = str(expand_path(config.db_path))
    
    return config


def generate_default_config_yaml() -> str:
    """Generate a default YAML config file content."""
    return """# AI Trace Viewer Configuration
# This file is located at: ~/.config/aitrace/config.yaml
#
# You can override these settings with:
# - Environment variables: AITRACE_HOST, AITRACE_PORT, etc.
# - Command line arguments: --host, --port, etc.

# Server configuration
host: 0.0.0.0
port: 8000

# Database configuration
# db-path: ~/.config/aitrace/logs.db  # Default location

# Development options
reload: false
log-level: info
access-log: false

# Worker processes (keep at 1 for SQLite)
workers: 1
"""


def generate_default_config_toml() -> str:
    """Generate a default TOML config file content."""
    return """# AI Trace Viewer Configuration
# This file is located at: ~/.config/aitrace/config.toml
#
# You can override these settings with:
# - Environment variables: AITRACE_HOST, AITRACE_PORT, etc.
# - Command line arguments: --host, --port, etc.

# Server configuration
host = "0.0.0.0"
port = 8000

# Database configuration
# db-path = "~/.config/aitrace/logs.db"  # Default location

# Development options
reload = false
log-level = "info"
access-log = false

# Worker processes (keep at 1 for SQLite)
workers = 1
"""


def init_config_files():
    """Initialize default config files if they don't exist."""
    config_dir = get_config_dir()
    
    yaml_config = config_dir / "config.yaml.example"
    toml_config = config_dir / "config.toml.example"
    
    if not yaml_config.exists():
        yaml_config.write_text(generate_default_config_yaml())
        print(f"Created example config: {path_to_display(yaml_config)}")
    
    if not toml_config.exists():
        toml_config.write_text(generate_default_config_toml())
        print(f"Created example config: {path_to_display(toml_config)}")
    
    # Check if user has an active config
    active_configs = [
        config_dir / "config.yaml",
        config_dir / "config.toml",
    ]
    
    if not any(c.exists() for c in active_configs):
        print(f"\nNo active config found. To create one, run:")
        print(f"  cp {path_to_display(yaml_config)} {path_to_display(config_dir / 'config.yaml')}")
        print(f"  # or")
        print(f"  cp {path_to_display(toml_config)} {path_to_display(config_dir / 'config.toml')}")

