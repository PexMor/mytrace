# AI Trace Viewer Documentation

Welcome to the AI Trace Viewer documentation. This directory contains comprehensive guides for using and developing the trace viewer.

## Documentation Structure

### Getting Started

- [📖 Quick Start Guide](quickstart.md) - Get up and running in 3 steps
- [⚙️ Configuration Guide](configuration.md) - Server and environment setup

### User Guides

- [👁️ Trace Viewer](viewer.md) - Web-based trace visualization
  - Simple viewer (bundled with server)
  - Advanced viewer (standalone web app)
  - Lens system for customizing log display
  - Drag & drop file loading

- [🚀 Deployment Guide](deployment.md) - GitHub Pages deployment
  - Building the viewer
  - Deployment configuration
  - Custom domains

### Developer Reference

- [🛠️ Development Notes](development.md) - Internal implementation details
  - Development setup
  - Project structure
  - Implementation details
  - Testing
  - Recent updates

- [🏗️ Architecture & Design](../AGENTS.md) - Technical decisions for developers and AI agents
  - System architecture
  - Component details
  - Design decisions and trade-offs
  - Extension points
  - Performance considerations

### Reference

- [📝 Changelog](../CHANGELOG.md) - Version history and changes

## GitHub Pages Application

This directory also hosts the built Advanced Viewer application in the `app/` subdirectory:

- **URL:** `https://<username>.github.io/<repository>/app/`
- **Source:** `aitrace_viewer/` (Preact + TypeScript + Vite)
- **Build:** `cd aitrace_viewer && yarn build` (outputs to `docs/app/`)

The viewer can:
- Load sample JSONL files from the dropdown
- Accept drag-and-drop JSONL/NDJSON files
- Display trace trees with collapsible spans
- Show detailed log entries with JSON trees

## Archive

The [archive/](archive/) directory contains historical documentation:

- **buffered_logger_refactoring.md** - BufferedLogger implementation details
- **target_modes_feature.md** - Target modes development notes
- **config_system_summary.md** - Configuration system summary
- **CLEANUP_SUMMARY.md** - Documentation cleanup notes
- **FEATURE_SUMMARY.md** - Recent feature summaries

These files are preserved for reference but are not part of the main documentation.

## Quick Navigation

**I want to...**

- **Get started quickly** → [quickstart.md](quickstart.md)
- **Configure the server** → [configuration.md](configuration.md)
- **Deploy the viewer** → [deployment.md](deployment.md)
- **Understand the architecture** → [../AGENTS.md](../AGENTS.md)
- **Contribute to development** → [development.md](development.md)
- **See what changed** → [../CHANGELOG.md](../CHANGELOG.md)
- **Use the web viewer** → [viewer.md](viewer.md)
- **Load JSONL files** → [viewer.md](viewer.md#usage)
- **Create custom lenses** → [viewer.md](viewer.md#creating-custom-lenses)

## Need Help?

1. Check the relevant guide above
2. Review [AGENTS.md](../AGENTS.md) for architecture details
3. Look at example scripts in `test/` directory
4. Check [CHANGELOG.md](../CHANGELOG.md) for recent changes
5. Open an issue on GitHub

---

**Repository:** https://github.com/yourusername/mytrace  
**Last Updated:** 2025-10-24
