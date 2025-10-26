# AI Trace Viewer Documentation

This directory contains the comprehensive documentation for the AI Trace Viewer project.

## User Guides

Start here if you're new to AI Trace Viewer:

- [📖 Quick Start Guide](quickstart.md) - Get up and running in 3 steps
- [⚙️ Configuration Guide](configuration.md) - Server and environment setup
- [👁️ Trace Viewer Guide](viewer.md) - Web-based trace visualization
- [🚀 Deployment Guide](deployment.md) - Production deployment options

## Developer Resources

For developers working on or integrating with AI Trace Viewer:

- [🛠️ Development Guide](development.md) - Setup, testing, and contributing
- [📋 Trace Record Format](trace_record_format.md) - JSON format specification
- [📍 Source Location Tracking](source_location_tracking.md) - IDE integration details

## IDE Integration

Resources for VSCode/Cursor plugin integration:

- [🔌 VSCode Plugin Format](vscode/plugin_format.md) - Plugin integration guide
- [📄 Format Example](vscode/format_example.jsonl) - Sample trace file

## Project-Level Documentation

Core project documentation (in root directory):

- [📘 README.md](../README.md) - Project overview and quick reference
- [🏗️ AGENTS.md](../AGENTS.md) - Architecture & design decisions (for humans and AI agents)
- [📝 CHANGELOG.md](../CHANGELOG.md) - Version history and breaking changes

## Archive

Historical documentation and feature summaries:

- [archive/](archive/) - Implementation notes, feature summaries, and historical docs

## Documentation Structure

```
docs/
├── README.md                    # This file
├── quickstart.md                # Quick start guide
├── configuration.md             # Configuration reference
├── viewer.md                    # Web viewer documentation
├── deployment.md                # Deployment guide
├── development.md               # Development guide
├── trace_record_format.md       # Log format spec
├── source_location_tracking.md  # IDE integration
├── vscode/                      # VSCode plugin docs
│   ├── plugin_format.md
│   └── format_example.jsonl
├── archive/                     # Historical docs
│   ├── README.md
│   ├── implementation_summary.md
│   └── ...
├── app/                         # Built viewer app (GitHub Pages)
└── _site/                       # Jekyll site (generated)
```

## Contributing to Documentation

When updating documentation:

1. Keep README.md brief - it should be a quick reference with pointers
2. AGENTS.md should contain all architectural and technical decisions
3. CHANGELOG.md should follow [Keep a Changelog](https://keepachangelog.com/) format
4. User guides in `docs/` should be comprehensive but focused
5. Update cross-references when moving or renaming files
6. Add historical docs to `docs/archive/` when superseded

## External Links

- [GitHub Repository](https://github.com/yourusername/mytrace)
- [GitHub Pages Site](https://yourusername.github.io/mytrace/app/)
- [OpenTelemetry Docs](https://opentelemetry.io/docs/languages/python/)
- [structlog Docs](https://www.structlog.org/)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
