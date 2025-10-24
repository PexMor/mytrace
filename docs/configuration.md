# AI Trace Viewer - Configuration Guide

## Overview

AI Trace Viewer uses a flexible configuration system that supports:

- **Config files** (YAML or TOML)
- **Environment variables**
- **Command line arguments**

Configuration priority (highest to lowest):

1. Command line arguments
2. Environment variables (prefixed with `AITRACE_`)
3. Config file (`~/.config/aitrace/config.yaml` or `config.toml`)
4. Default values

## Configuration Directory

All configuration and data files are stored in:

```
~/.config/aitrace/
├── config.yaml          # Active YAML config (optional)
├── config.toml          # Active TOML config (optional)
├── config.yaml.example  # Example YAML config
├── config.toml.example  # Example TOML config
└── logs.db              # SQLite database (+ .db-shm, .db-wal)
```

The directory is automatically created when you first run the server.

## Configuration Options

### Server Settings

| Option  | CLI Flag    | Environment Variable | Default   | Description                |
| ------- | ----------- | -------------------- | --------- | -------------------------- |
| Host    | `--host`    | `AITRACE_HOST`       | `0.0.0.0` | Host to bind the server to |
| Port    | `--port`    | `AITRACE_PORT`       | `8000`    | Port to bind the server to |
| Workers | `--workers` | `AITRACE_WORKERS`    | `1`       | Number of worker processes |

### Database Settings

| Option        | CLI Flag    | Environment Variable | Default                     | Description                  |
| ------------- | ----------- | -------------------- | --------------------------- | ---------------------------- |
| Database Path | `--db-path` | `AITRACE_DB_PATH`    | `~/.config/aitrace/logs.db` | Path to SQLite database file |

### Development Settings

| Option      | CLI Flag       | Environment Variable | Default | Description                                       |
| ----------- | -------------- | -------------------- | ------- | ------------------------------------------------- |
| Auto-reload | `--reload`     | `AITRACE_RELOAD`     | `false` | Enable auto-reload for development                |
| Log Level   | `--log-level`  | `AITRACE_LOG_LEVEL`  | `info`  | Logging level (critical/error/warning/info/debug) |
| Access Log  | `--access-log` | `AITRACE_ACCESS_LOG` | `false` | Enable HTTP access logging                        |

### Config File

| Option      | CLI Flag          | Environment Variable | Default                         | Description                |
| ----------- | ----------------- | -------------------- | ------------------------------- | -------------------------- |
| Config File | `--config` / `-c` | N/A                  | `~/.config/aitrace/config.yaml` | Path to custom config file |

## Usage Examples

### 1. Using Config File (Recommended)

Create a config file:

```bash
# Copy example to active config
cp ~/.config/aitrace/config.yaml.example ~/.config/aitrace/config.yaml

# Edit the config
vim ~/.config/aitrace/config.yaml
```

Example `config.yaml`:

```yaml
# Server configuration
host: 0.0.0.0
port: 8000

# Database configuration
db-path: ~/.config/aitrace/logs.db

# Development options
reload: false
log-level: info
access-log: false

# Worker processes
workers: 1
```

Run the server (uses config file automatically):

```bash
python -m aitrace
# or
aitrace
```

### 2. Using Environment Variables

```bash
# Set environment variables
export AITRACE_HOST=localhost
export AITRACE_PORT=9000
export AITRACE_LOG_LEVEL=debug
export AITRACE_ACCESS_LOG=true

# Run the server
python -m aitrace
```

### 3. Using Command Line Arguments

```bash
# Override specific settings
python -m aitrace --host localhost --port 9000 --log-level debug

# Use custom database location
python -m aitrace --db-path /tmp/my-traces.db

# Development mode with auto-reload
python -m aitrace --reload --log-level debug --access-log
```

### 4. Using Custom Config File

```bash
# Use a custom config file location
python -m aitrace --config /path/to/my-config.yaml

# Or with environment variable
export AITRACE_CONFIG=/path/to/my-config.yaml
python -m aitrace
```

### 5. Combining All Methods

Config files, environment variables, and CLI args can be combined. The priority order ensures the most specific setting wins:

```bash
# config.yaml has port: 8000
# Environment has AITRACE_PORT=9000
# CLI has --port 10000

python -m aitrace --port 10000
# Result: Server runs on port 10000 (CLI wins)
```

## Example Configurations

### Production Configuration

```yaml
# ~/.config/aitrace/config.yaml
host: 0.0.0.0
port: 8000
db-path: /var/lib/aitrace/logs.db
log-level: warning
access-log: false
workers: 1 # Keep at 1 for SQLite
```

### Development Configuration

```yaml
# ~/.config/aitrace/config.yaml
host: localhost
port: 8000
db-path: ~/.config/aitrace/dev.db
reload: true
log-level: debug
access-log: true
workers: 1
```

### TOML Format

If you prefer TOML, create `config.toml` instead:

```toml
# ~/.config/aitrace/config.toml
host = "0.0.0.0"
port = 8000
db-path = "~/.config/aitrace/logs.db"
reload = false
log-level = "info"
access-log = false
workers = 1
```

## Programmatic Access

You can also access configuration in your Python code:

```python
from aitrace import get_config_dir, get_data_dir, load_config

# Get config directory
config_dir = get_config_dir()
print(f"Config directory: {config_dir}")

# Get data directory (same as config for now)
data_dir = get_data_dir()
print(f"Data directory: {data_dir}")

# Load configuration programmatically
config = load_config()
print(f"Server will run on {config.host}:{config.port}")
print(f"Database location: {config.db_path}")
```

## Tips & Best Practices

1. **Use config files for persistent settings**: Put stable settings in `config.yaml`
2. **Use environment variables for per-environment settings**: Different values for dev/staging/prod
3. **Use CLI args for one-off overrides**: Quick testing or debugging
4. **Keep workers=1 with SQLite**: SQLite doesn't handle multiple writers well
5. **Use absolute paths for custom database locations**: Avoids confusion with relative paths
6. **Enable access-log only for debugging**: It can be verbose in production
7. **Use reload mode only in development**: Has performance overhead

## Troubleshooting

### Config file not found

If you see messages about missing config files:

```bash
# Initialize default config files
python -m aitrace
# This creates the example files automatically

# Then copy and edit
cp ~/.config/aitrace/config.yaml.example ~/.config/aitrace/config.yaml
```

### Database locked errors

If you get "database is locked" errors:

- Ensure `workers: 1` in your config
- Don't run multiple server instances with the same database
- Check for stale lock files (`.db-shm`, `.db-wal`)

### Permission denied

If you can't write to `~/.config/aitrace`:

```bash
# Check/fix permissions
mkdir -p ~/.config/aitrace
chmod 755 ~/.config/aitrace

# Or use a custom location
python -m aitrace --db-path /tmp/logs.db
```

## See Also

- [README.md](../README.md) - Main documentation
- [QUICKSTART.md](../QUICKSTART.md) - Quick start guide
- [CHANGELOG.md](../CHANGELOG.md) - Version history
