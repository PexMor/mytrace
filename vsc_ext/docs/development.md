# Trace Viewer - Development Guide

Guide for developers contributing to or modifying the Trace Viewer extension.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Building](#building)
- [Testing](#testing)
- [Debugging](#debugging)
- [Packaging](#packaging)
- [Publishing](#publishing)

---

## Prerequisites

- **Node.js** 16+ and npm
- **VSCode** 1.92.0 or later
- **aitrace** Python library (for generating test traces)
- Basic TypeScript knowledge

---

## Setup

### 1. Install Dependencies

```bash
cd vsc_ext
npm install
```

This installs:
- TypeScript compiler
- VSCode extension types (@types/vscode)
- Development tools (eslint, vsce)

### 2. Build Extension

```bash
npm run build
```

Compiles TypeScript files from `src/` to JavaScript in `out/`.

### 3. Open in VSCode

```bash
code .
```

Open the `vsc_ext` folder in VSCode to use the debug configuration.

---

## Development Workflow

### Watch Mode

Start TypeScript compiler in watch mode:

```bash
npm run watch
```

- Automatically recompiles on file changes
- Keep this running in a terminal
- Faster than manual builds

### Launch Extension Development Host

1. Press `F5` (or `Run → Start Debugging`)
2. VSCode launches new window with extension loaded
3. Make changes to code
4. In Extension Development Host, reload window (`Cmd+R`)

### Hot Reload

After making code changes:
1. Save file (TypeScript auto-compiles if watch mode is running)
2. In Extension Development Host window: `Cmd+R` / `Ctrl+R`
3. Or Command Palette → `Developer: Reload Window`

---

## Project Structure

```
vsc_ext/
├── src/
│   └── extension.ts         # Main extension code (450 lines)
│                            # - Trace loading & parsing
│                            # - Workspace root detection
│                            # - Decorations & CodeLens
│                            # - File watching
│                            # - Webview panels
│
├── media/
│   ├── info.svg            # Blue circle icon
│   ├── warn.svg            # Yellow triangle icon
│   └── error.svg           # Red X icon
│
├── docs/
│   ├── user-guide.md       # User documentation
│   └── development.md      # This file
│
├── out/                    # Compiled JavaScript (gitignored)
├── node_modules/           # Dependencies (gitignored)
│
├── .vscode/
│   ├── launch.json         # VSCode debug config
│   └── tasks.json          # Build tasks
│
├── package.json            # Extension manifest
├── tsconfig.json           # TypeScript configuration
│
├── README.md               # Brief overview
├── AGENTS.md               # Architecture decisions
├── CHANGELOG.md            # Version history
│
├── .gitignore
└── .vscodeignore
```

### Key Files

**src/extension.ts**
- `activate()` - Extension entry point
- `deactivate()` - Cleanup on extension unload
- `TraceItem` type - Data structure for traces
- `TraceCodeLensProvider` - CodeLens implementation
- `detectWorkspaceRoot()` - Path resolution logic
- Command handlers - User action implementations

**package.json**
- Extension metadata
- Command definitions
- Configuration options
- Dependencies

**tsconfig.json**
- TypeScript compiler settings
- ES2020 target
- Strict mode enabled

---

## Building

### Development Build

```bash
npm run build
```

- Compiles TypeScript to JavaScript
- Output in `out/` directory
- Source maps included for debugging

### Watch Build

```bash
npm run watch
```

- Continuous compilation
- Rebuilds on file save
- Faster development cycle

### Production Build

```bash
npm run vscode:prepublish
```

- Runs `npm run build`
- Called automatically by `vsce package`
- Prepares for distribution

---

## Testing

### Manual Testing

#### 1. Generate Test Traces

From project root:

```bash
cd ..
LOG_TRG=/tmp/test_trace.jsonl uv run python test/test_source_location.py
```

#### 2. Load in Extension

1. Press `F5` to launch Extension Development Host
2. Open any Python file from the project
3. Command Palette → `Trace: Load trace file`
4. Select `/tmp/test_trace.jsonl`
5. Choose "Yes" to watch

#### 3. Verify Features

- [ ] Gutter icons appear on traced lines
- [ ] Icons match severity (blue/yellow/red)
- [ ] Hover shows trace preview
- [ ] Overview ruler has markers
- [ ] CodeLens appears above lines
- [ ] Click CodeLens opens details panel
- [ ] Toggle decorations works
- [ ] Clear traces works

### Test with Different Trace Files

```bash
# Simple traces
LOG_TRG=/tmp/simple.jsonl uv run python test/02_simple.py

# Complex traces with nesting
LOG_TRG=/tmp/complex.jsonl uv run python test/01_initial.py 5

# Router pattern
LOG_TRG=/tmp/router.jsonl uv run python test/03_router.py
```

### Test File Watching

```bash
# Terminal 1: Start watching a file
LOG_TRG=/tmp/live.jsonl

# Terminal 2: Generate traces continuously
while true; do
  uv run python test/04_buffered_simple.py
  sleep 2
done

# VSCode: Set traceMarkers.traceFile to /tmp/live.jsonl
# Verify auto-reload works
```

### Edge Cases to Test

- [ ] Empty trace file
- [ ] Malformed JSON (should skip invalid lines)
- [ ] Large file (10K+ traces)
- [ ] File outside workspace
- [ ] Missing `file` or `line` fields
- [ ] Multiple workspace folders
- [ ] Windows path separators

---

## Debugging

### VSCode Debugger

1. Set breakpoints in `src/extension.ts`
2. Press `F5` to start debugging
3. Extension Development Host launches
4. Trigger extension functionality
5. Debugger stops at breakpoints

**Debug Console**
- View variables
- Evaluate expressions
- See console.log output

**Call Stack**
- Navigate execution flow
- See function calls

### Extension Host Logs

View logs: `Help → Toggle Developer Tools → Console`

Add debug logging:
```typescript
console.log('Loading trace file:', filePath);
console.log('Found traces:', traces.length);
```

### Common Issues

**Extension doesn't activate**
- Check `activationEvents` in package.json
- Verify no TypeScript errors: `npm run build`
- Look for errors in Extension Host logs

**Decorations not showing**
- Check file paths are relative
- Verify workspace root detection
- Log decoration options before applying

**CodeLens not appearing**
- Verify provider registered for Python files
- Check `enabled` flag
- Log `provideCodeLenses` output

---

## Packaging

### Create VSIX Package

```bash
npm run package
```

Creates: `trace-viewer-0.1.0.vsix`

### Install Package Locally

```bash
code --install-extension trace-viewer-0.1.0.vsix
```

### Update Version

1. Edit `package.json`: increment version
2. Update `CHANGELOG.md`: add release notes
3. Commit changes
4. Tag release: `git tag v0.1.1`

### Package Contents

`.vscodeignore` controls what's included:

**Included**:
- `out/` - Compiled JavaScript
- `media/` - Icons
- `README.md`, `CHANGELOG.md`
- `package.json`

**Excluded**:
- `src/` - TypeScript source
- `node_modules/` - Dependencies
- `.vscode/` - Editor config
- `docs/` - Documentation

---

## Publishing

### Publish to Marketplace

1. **Create Publisher Account**
   - Go to [Visual Studio Marketplace](https://marketplace.visualstudio.com/)
   - Sign in with Microsoft account
   - Create publisher ID

2. **Get Personal Access Token**
   - Azure DevOps settings
   - Personal Access Tokens
   - Create new token with Marketplace scope

3. **Login with vsce**
   ```bash
   npx vsce login <publisher-name>
   ```

4. **Publish**
   ```bash
   npx vsce publish
   ```

5. **Verify**
   - Check marketplace listing
   - Install from marketplace
   - Test functionality

### Publishing Checklist

- [ ] Version bumped in package.json
- [ ] CHANGELOG.md updated
- [ ] README.md accurate
- [ ] All tests passing
- [ ] No console errors
- [ ] Icons display correctly
- [ ] Package builds successfully
- [ ] Local install works

---

## Code Guidelines

### TypeScript Style

- Use strict type checking
- Prefer `const` over `let`
- Use arrow functions for callbacks
- Add JSDoc comments for public functions

```typescript
/**
 * Loads trace file and parses entries
 * @param filePath Absolute path to trace file
 * @returns Number of traces loaded
 */
async function loadTraceFromFile(filePath: string): Promise<number> {
  // ...
}
```

### Error Handling

Always handle errors gracefully:

```typescript
try {
  await loadTraceFromFile(filePath);
} catch (error: any) {
  vscode.window.showErrorMessage(
    `Failed to load trace: ${error.message}`
  );
}
```

### VSCode API Best Practices

- Dispose resources in `deactivate()`
- Use `context.subscriptions.push()` for disposables
- Batch decoration updates
- Debounce frequent operations

### Performance

- Cache workspace root detection
- Index traces by file for O(1) lookup
- Debounce file watch events (250ms)
- Limit decoration updates

---

## Contributing

### Pull Request Process

1. Fork repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Make changes
4. Add tests if applicable
5. Update documentation
6. Commit: `git commit -am "Add feature"`
7. Push: `git push origin feature/my-feature`
8. Create Pull Request

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] TypeScript compiles without errors
- [ ] No linter warnings
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Tested manually
- [ ] No performance regressions

---

## Troubleshooting Development Issues

### TypeScript Errors

```bash
# Check for errors
npm run build

# Common fixes
rm -rf node_modules out
npm install
npm run build
```

### Extension Not Loading

1. Check Extension Host logs (Developer Tools → Console)
2. Verify `activationEvents` in package.json
3. Try: `Developer: Reload Window`
4. Restart VSCode

### Source Maps Not Working

Ensure `tsconfig.json` has:
```json
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

### Package Installation Fails

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## See Also

- [User Guide](user-guide.md) - Using the extension
- [AGENTS.md](../AGENTS.md) - Architecture decisions
- [CHANGELOG.md](../CHANGELOG.md) - Version history

