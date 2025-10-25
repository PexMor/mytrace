---
layout: single
title: "AI Trace Viewer Documentation"
permalink: /
---

Welcome to the AI Trace Viewer documentation. This directory contains comprehensive guides for using and developing the trace viewer.

## Documentation Structure

### Getting Started

- [📖 Quick Start Guide](quickstart.html) - Get up and running in 3 steps
- [⚙️ Configuration Guide](configuration.html) - Server and environment setup

### User Guides

- [👁️ Trace Viewer](viewer.html) - Web-based trace visualization
  - Simple viewer (bundled with server)
  - Advanced viewer (standalone web app)
  - Lens system for customizing log display
  - Drag & drop file loading

- [🚀 Deployment Guide](deployment.html) - GitHub Pages deployment
  - Building the viewer
  - Deployment configuration
  - Custom domains

### Developer Reference

- [🛠️ Development Notes](development.html) - Internal implementation details
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

- **URL:** <https://pexmor.github.io/mytrace/app/>
- **Source:** `aitrace_viewer/` (Preact + TypeScript + Vite)
- **Build:** `cd aitrace_viewer && yarn build` (outputs to `docs/app/`)

The viewer can:
- Load sample JSONL files from the dropdown
- Accept drag-and-drop JSONL/NDJSON files
- Display trace trees with collapsible spans
- Show detailed log entries with JSON trees

## Quick Navigation

**I want to...**

- **Get started quickly** → [quickstart.html](quickstart.html)
- **Configure the server** → [configuration.html](configuration.html)
- **Deploy the viewer** → [deployment.html](deployment.html)
- **Understand the architecture** → [../AGENTS.md](../AGENTS.md)
- **Contribute to development** → [development.html](development.html)
- **See what changed** → [../CHANGELOG.md](../CHANGELOG.md)
- **Use the web viewer** → [viewer.html](viewer.html)

## Need Help?

1. Check the relevant guide above
2. Review [AGENTS.md](../AGENTS.md) for architecture details
3. Look at example scripts in `test/` directory
4. Check [CHANGELOG.md](../CHANGELOG.md) for recent changes
5. Open an issue on GitHub

---

**Repository:** https://github.com/PexMor/mytrace  
**Last Updated:** 2025-10-25

