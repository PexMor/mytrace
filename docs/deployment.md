---
layout: page
title: Deployment Guide
---

# Deployment Guide for AI Trace Viewer

## Quick Build & Deploy

### Build for GitHub Pages

```bash
cd aitrace_viewer
yarn build
```

This will compile the viewer and output to `docs/app/` ready for GitHub Pages.

### Enable GitHub Pages

1. Push changes to GitHub
2. Go to **Settings** → **Pages**
3. Set source to: **Deploy from a branch**
4. Select branch: `main` (or your default)
5. Select folder: `/docs`
6. Save

Your site will be live at: `https://<username>.github.io/<repository>/app/`

## File Structure

```
mytrace/
├── aitrace_viewer/          # Source code (Preact + Vite)
│   ├── src/
│   ├── public/samples/      # Sample JSONL files
│   ├── vite.config.ts       # Build configuration
│   └── package.json
│
├── docs/                    # GitHub Pages root
│   ├── app/                 # Built application (generated)
│   │   ├── index.html
│   │   ├── assets/          # Bundled JS/CSS
│   │   └── samples/         # Copied from public/
│   ├── .nojekyll            # Prevents Jekyll processing
│   └── README.md            # GitHub Pages documentation
│
└── aitrace/                 # Python tracing library
```

## Build Configuration

The build is configured in `aitrace_viewer/vite.config.ts`:

```typescript
{
  base: './',                           // Relative paths for flexibility
  build: {
    outDir: resolve(__dirname, '../docs/app'),  // Output to docs/app/
    emptyOutDir: true,                  // Clean before build
  }
}
```

### Customizing Base URL

If deploying to a subdirectory, update the `base` in `vite.config.ts`:

```typescript
// For: https://example.com/mytrace/app/
base: "/mytrace/app/";

// For: https://example.com/ (root)
base: "/";

// For: Flexible hosting (default)
base: "./";
```

## Adding Sample Files

To add new sample traces:

1. Add `.jsonl` or `.ndjson` file to `aitrace_viewer/public/samples/`
2. Update `aitrace_viewer/public/samples/config.json`:

```json
{
  "samples": [
    {
      "id": "my-sample",
      "name": "My Sample Trace",
      "description": "Description shown in UI",
      "filename": "my-sample.jsonl",
      "icon": "bi-diagram-3"
    }
  ]
}
```

3. Rebuild: `cd aitrace_viewer && yarn build`

## Testing Locally

### Development Mode

```bash
cd aitrace_viewer
yarn dev
```

Opens at `http://localhost:5173` with hot reload.

### Preview Production Build

```bash
cd aitrace_viewer
yarn build
yarn preview
```

Opens at `http://localhost:4173` serving the built version.

## CI/CD (Optional)

For automatic deployment, add a GitHub Action:

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd aitrace_viewer && yarn install
      - run: cd aitrace_viewer && yarn build
      - uses: actions/upload-pages-artifact@v2
        with:
          path: docs/app
      - uses: actions/deploy-pages@v2
```

## Troubleshooting

### Assets not loading

- Check `base` setting in `vite.config.ts`
- Verify `.nojekyll` exists in `docs/`
- Check browser console for 404 errors

### Sample files not loading

- Ensure files are in `aitrace_viewer/public/samples/`
- Verify `config.json` is valid JSON
- Check network tab in browser devtools

### Context menu copy not working

- Uses fallback for insecure origins (http://localhost)
- Should work normally on GitHub Pages (https://)

---

## See Also

- [README.md](../README.md) - Main documentation
- [Viewer Documentation](viewer.md) - Web viewer features
- [Configuration Guide](configuration.md) - Server configuration
- [Development Guide](development.md) - Development setup
- [AGENTS.md](../AGENTS.md) - Architecture and design decisions
