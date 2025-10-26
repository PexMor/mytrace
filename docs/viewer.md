---
layout: page
title: Web Viewer
---

# AI Trace Viewer - Web Interface

The AI Trace Viewer provides two web interfaces for visualizing trace data:

1. **Simple Viewer** - Bundled with the Python server (server-rendered)
2. **Advanced Viewer** - Standalone web application (client-side, no server required)

---

## Simple Viewer

**Location:** `aitrace/static/`

### Features

- Server-rendered trace trees
- Collapsible span visualization
- Basic search and filtering
- Bundled with Python package
- Accessible at `http://localhost:8000` when server is running

### Usage

```bash
# Start the server
uv run aitrace

# Open browser
open http://localhost:8000
```

### Architecture

- **Technology:** Vanilla JavaScript, HTML, CSS
- **Data Source:** FastAPI server via REST API
- **Rendering:** Server-side tree reconstruction
- **Deployment:** Served by Uvicorn

---

## Advanced Viewer

**Location:** `aitrace_viewer/`

### Overview

A modern, standalone web application for viewing trace logs. Built with Preact, TypeScript, and Vite, it provides advanced features like drag-and-drop file loading, customizable lenses, and detailed JSON inspection.

### Features

- 📁 **Drag & Drop** - Load JSONL/NDJSON files directly in browser
- 🔍 **Smart Rendering** - Automatic detection of simple vs complex values
- 🎨 **Lens System** - Customizable display rules for different log types
- 📋 **Context Menus** - Copy/download JSON data with right-click
- 🌐 **No Server Required** - Completely client-side
- 📱 **Responsive Design** - Works on desktop and mobile
- 🎯 **Compact JSON Trees** - YAML-like inline display for simple data structures
- 🔄 **Smart Expansion** - Automatic inline/expanded view based on data complexity
- 💾 **State Persistence** - Expand/collapse state saved to IndexedDB per document
- 🔑 **Hash-Based Storage** - SHA256 hash identifies documents, not filenames
- 🗑️ **State Management** - Reset current view or clear all saved states

### Log Format

The viewer accepts **NDJSON** (Newline Delimited JSON) or **JSONL** (JSON Lines) files.

#### Example

```jsonl
{"event":"start","timestamp":"2025-10-23T12:00:00Z","trace_id":"abc","span_id":"1"}
{"event":"process","timestamp":"2025-10-23T12:00:01Z","trace_id":"abc","span_id":"2","parent_span_id":"1"}
{"event":"finish","timestamp":"2025-10-23T12:00:02Z","trace_id":"abc","span_id":"1"}
```

#### Required Fields

- `trace_id` - Groups logs into a single trace
- `span_id` - Unique identifier for this span/operation
- `event` - Description of what happened
- `timestamp` - ISO 8601 timestamp

#### Optional Fields

- `parent_span_id` - Links this span to a parent (creates tree structure)
- `level` - Log level (debug, info, warn, error) - defaults to "info"
- Any other fields - stored in the raw data for inspection

### Usage

#### Development Mode

```bash
cd aitrace_viewer
yarn install
yarn dev
```

Opens at `http://localhost:5173` with hot reload.

#### Load Sample Data

Click "Load sample logs" to see demo traces.

#### Upload Your Own Logs

1. Click the file input to browse for a `.jsonl` or `.ndjson` file
2. Or drag and drop a file onto the drop zone
3. The viewer will parse and display the trace tree

#### Navigate the Tree

- Click nodes to expand/collapse child spans
- Right-click for context menu (copy/download JSON)
- View full JSON data in expandable trees

**Ultra-Compact View (Two-Level):**

- **Level 1 - Spans**: Everything on one line when collapsed
  - Example: `▸ llm_start [Model: ChatOpenAI] [Run ID: f3577...] info ⌄`
  - Click to reveal log entries (also compact)
- **Level 2 - Log Entries**: Also one line when collapsed
  - Example: `▸ [Model: ChatOpenAI] [Run ID: f3577...] ⌄`
  - Click to reveal JSON trees, raw button, full details
- **Progressive Disclosure**: Expand only what you need at each level
- **Space Savings**: 80-90% less vertical space for typical traces
- Simple fields (Model, Run ID, etc.) shown as inline badges
- Complex fields (JSON trees) hidden until explicitly expanded

**Configurable Density:**

- **Three modes** to control spacing: Compact (zero padding), Cozy (minimal), Comfortable (default)
- **Top-right dropdown** - Click density button to adjust spacing
- **Instant updates** - Changes apply to all nodes immediately
- **Persistent** - Setting saved to browser localStorage

#### State Persistence

**Your expand/collapse state is automatically saved!**

When you load a file, the viewer:

1. Computes a SHA256 hash of the file content
2. Uses this hash to identify the document uniquely
3. Restores any previously saved expand/collapse state from IndexedDB
4. Saves state changes automatically as you navigate

**Benefits:**

- ✅ Reload the page → Your view is preserved
- ✅ Close and reopen the browser → Your view is preserved
- ✅ Same file content → Same state (even with different filename)
- ✅ Different file content → Different state (even with same filename)

**State Management Controls:**

- **Reset View** button (🔄): Collapses everything for current document
- **Clear All States** button (🗑️): Wipes all saved states for all documents (requires confirmation)
- **Current filename** display: Shows which file you're viewing

**What's Saved:**

- Span expand/collapse state
- Log entry "raw" JSON visibility
- JSON tree expand/collapse (every nested level)
- Long string "more/less" expansion

**Default Behavior:**

- All JSON trees start fully collapsed for clean initial view
- Expand only what you need to investigate
- Your expansions are remembered for next time

### Architecture

#### Data Model

```typescript
type SpanNode = {
  id: string; // span_id
  traceId: string;
  parentId?: string | null;
  children: string[]; // child span ids
  depth: number;
  timestamp: number; // epoch ms
  level: "debug" | "info" | "warn" | "error";
  msg?: string; // event field
  raw: Record<string, unknown>[]; // all log entries for this span
};
```

#### Tree Construction

1. Index all lines by `span_id`; maintain `trace_id → roots`
2. If a child arrives before parent, keep a pending map; fix up after ingestion
3. Compute `depth` with DFS
4. Handle edge cases: missing parents, orphan nodes, cycles
5. Sort siblings by timestamp

#### Components

- **App.tsx** - Main container with file upload, sample loading, and hash computation
- **TreeView.tsx** - Renders the forest of traces
- **NodeRow.tsx** - Individual span node with fold/unfold capability (uses state store)
- **JsonTree.tsx** - Expandable JSON tree with syntax highlighting (uses state store)
- **TimestampSettings.tsx** - Timestamp format configuration

#### State Management

- **stores/expandCollapseStore.ts** - Zustand store for expand/collapse state
  - Document hash tracking
  - Node expansion state (keyed by document hash)
  - IndexedDB persistence
  - State reset/clear operations
- **utils/hash.ts** - SHA256 hash computation for document identification
- **IndexedDB** - Browser persistent storage
  - Database: `aitrace-viewer`
  - Store: `expand-collapse-state`
  - Survives page reloads and browser restarts

---

## Lens System

The lens system provides a powerful way to customize how different types of log entries are displayed.

### What are Lenses?

Lenses are display configurations that match specific event patterns and define how their data should be rendered. They allow you to:

- Parse stringified JSON automatically
- Show data as expandable JSON trees
- Control initial expansion depth
- Hide irrelevant fields
- Customize field display names

### How Lenses Work

When a log entry is displayed, the viewer:

1. Finds the best matching lens based on the event name
2. Extracts fields according to the lens configuration
3. Renders each field with the appropriate component (text, JSON tree, etc.)
4. Automatically parses stringified JSON values

### Built-in Lenses

#### LLM Start Lens

Matches: Events matching `/llm_start/i`

Displays:

- **Prompts**: Expandable JSON tree showing the input prompts (depth 2)
- **Model**: Text display of the model name
- **Run ID**: Text display of the execution ID

#### LLM End Lens

Matches: Events matching `/llm_end/i`

Displays:

- **Response**: Expandable JSON tree with the LLM response structure (depth 2)
- **Run ID**: Text display of the execution ID

#### Chatbot Lens

Matches: Events matching `/chatbot_(invoked|response_generated|error)/i`

Displays:

- **Message Count**: Number of messages
- **Response Length**: Length of the response
- **Error**: Error details if present (JSON tree, depth 2)

#### Default Lens

Matches: All events (fallback)

Displays:

- All non-standard fields as JSON trees with depth 1

### Creating Custom Lenses

Edit `src/lenses/lensConfig.ts` and add your lens to the `LENS_REGISTRY`:

```typescript
export const MY_CUSTOM_LENS: Lens = {
  eventPattern: /my_event_name/i, // Regex or string to match event names
  fields: [
    {
      key: "field_name", // Field key from log entry
      display: "Display Name", // Human-readable label
      type: "json-tree", // 'json-tree' or 'text'
      maxInitialDepth: 2, // How many levels to expand initially
    },
    {
      key: "simple_field",
      display: "Simple Field",
      type: "text", // Plain text display
    },
  ],
  priority: 10, // Higher priority = checked first
};

// Add to registry
export const LENS_REGISTRY: Lens[] = [
  MY_CUSTOM_LENS,
  LLM_START_LENS,
  LLM_END_LENS,
  CHATBOT_LENS,
  DEFAULT_LENS,
];
```

### Field Types

#### `json-tree`

Displays data as an expandable JSON tree with syntax highlighting.

Features:

- Automatic parsing of stringified JSON
- Collapsible nested structures
- Color-coded values (strings, numbers, booleans, null)
- "more/less" buttons for long strings (>100 chars)

```typescript
{
  key: 'response',
  display: 'Response Data',
  type: 'json-tree',
  maxInitialDepth: 2  // Expand 2 levels by default
}
```

#### `text`

Displays values as plain text in monospace font.

```typescript
{
  key: 'model',
  display: 'Model Name',
  type: 'text'
}
```

#### Wildcard (`*`)

Show all non-standard fields:

```typescript
{
  key: '*',
  type: 'json-tree',
  maxInitialDepth: 1
}
```

---

## JSON Tree Display

The advanced viewer includes an intelligent JSON tree component that adapts its display based on data complexity.

### Smart Inline Display

Simple arrays and objects are displayed inline when collapsed to save vertical space:

**Simple Arrays (≤5 primitives, <60 chars):**

```
▸ tags: ["python", "debug", "error"]
▸ ids: [1, 2, 3, 4, 5]
```

**Simple Objects (≤3 properties, <60 chars):**

```
▸ metadata: {status: "ok", code: 200, cached: true}
▸ user: {id: 42, name: "John"}
```

**Complex Structures:**

```
▸ response: {15 props}
▸ items: [42 items]
```

### Consistent Layout

All values display with their keys inline:

```
▸ name: "John Doe"
▸ age: 42
▸ active: true
▸ notes: null
```

### Tree Controls

- **Toggle Icons**: Left-aligned chevrons (▸/▾) for consistent hierarchy
- **Hover State**: Icons highlight on hover for better visibility
- **Click Area**: Entire icon area is clickable (16px wide)

### Context Menus

Right-click on any array or object to:

- Copy JSON to clipboard
- Download as JSON file

### Visual Features

- **Color Coding**: Different colors for strings, numbers, booleans, null
- **Type Indicators**: Visual distinction between arrays `[]` and objects `{}`
- **Nested Indentation**: 18px left margin with visual border guide
- **Long Strings**: Automatic truncation at 100 chars with "more/less" toggle

---

### Smart Value Rendering

The viewer automatically detects "simple" vs "complex" values:

**Simple values (<80 chars)** → Rendered as compact chips:

```
[Message Count: 1] [Model: ChatOpenAI]
```

**Complex values (objects/arrays)** → Rendered as expandable trees:

```
▶ Response: {11 props}
```

### Priority System

Lenses with higher priority values are checked first:

- Priority 10+: Specific event patterns
- Priority 0-9: General patterns
- Priority 0: Default lens (always matches last)

### Pattern Matching

Event patterns can be:

**Regex (recommended)**:

```typescript
eventPattern: /llm_(start|end|error)/i; // Case-insensitive, multiple events
```

**String (exact match)**:

```typescript
eventPattern: "exact_event_name";
```

### Advanced Examples

#### Complex Nested Data

```typescript
export const DATABASE_QUERY_LENS: Lens = {
  eventPattern: /db_query/i,
  fields: [
    { key: "query", display: "SQL Query", type: "text" },
    {
      key: "params",
      display: "Parameters",
      type: "json-tree",
      maxInitialDepth: 3,
    },
    { key: "result", display: "Result", type: "json-tree", maxInitialDepth: 1 },
    { key: "duration_ms", display: "Duration (ms)", type: "text" },
  ],
  priority: 15,
};
```

#### Error Handling

```typescript
export const ERROR_LENS: Lens = {
  eventPattern: /error|exception|failed/i,
  fields: [
    { key: "error_type", display: "Error Type", type: "text" },
    { key: "message", display: "Message", type: "text" },
    {
      key: "stack_trace",
      display: "Stack Trace",
      type: "json-tree",
      maxInitialDepth: 2,
    },
    {
      key: "context",
      display: "Context",
      type: "json-tree",
      maxInitialDepth: 2,
    },
  ],
  priority: 20,
};
```

---

## Deployment

### Building for Production

```bash
cd aitrace_viewer
yarn build
```

This compiles the viewer and outputs to `docs/app/` ready for deployment.

### GitHub Pages

The built application is automatically deployed to `docs/app/` which can be served via GitHub Pages.

#### Setup

1. Push changes to GitHub
2. Go to **Settings** → **Pages**
3. Set source to: **Deploy from a branch**
4. Select branch: `main` (or your default)
5. Select folder: `/docs`
6. Save

Your site will be live at: `https://<username>.github.io/<repository>/app/`

#### Local Preview

```bash
cd aitrace_viewer
yarn build
yarn preview
```

Opens at `http://localhost:4173` serving the built version.

### Customizing Base URL

If deploying to a subdirectory, update the `base` in `aitrace_viewer/vite.config.ts`:

```typescript
// For: https://example.com/mytrace/app/
base: "/mytrace/app/";

// For: https://example.com/ (root)
base: "/";

// For: Flexible hosting (default)
base: "./";
```

Then rebuild with `yarn build`.

---

## Technology Stack

### Advanced Viewer

| Component  | Library         | Purpose                       |
| ---------- | --------------- | ----------------------------- |
| Framework  | Preact          | Lightweight React alternative |
| Build Tool | Vite            | Fast dev server + bundling    |
| Language   | TypeScript      | Type safety                   |
| Icons      | Bootstrap Icons | UI icons                      |

### Simple Viewer

| Component | Technology         | Purpose                   |
| --------- | ------------------ | ------------------------- |
| Frontend  | Vanilla JavaScript | No framework overhead     |
| Styling   | CSS                | Custom, responsive design |
| Backend   | FastAPI            | REST API server           |
| Database  | SQLite             | Log storage               |

---

## Tips & Best Practices

### For Developers

1. **Start with maxInitialDepth=1** for large objects to avoid visual clutter
2. **Use text type** for simple values (IDs, counts, short strings)
3. **Higher priority for specific patterns** to override general ones
4. **Test with real data** to adjust expansion depth
5. **Skip standard fields** (timestamp, event, trace_id, etc.) - they're handled automatically

### For Users

1. **Use samples** to learn the interface
2. **Right-click nodes** for context menus
3. **Collapse deep trees** to see the big picture
4. **Export logs to files** for sharing/archival
5. **View in browser** - no server installation required (advanced viewer)

---

## Troubleshooting

### Lens not matching?

- Check regex syntax with a tool like regex101.com
- Ensure priority is higher than DEFAULT_LENS (0)
- Verify event name matches the pattern

### Data not expanding?

- Check if the data is actually JSON (use browser console)
- Increase `maxInitialDepth` if needed
- Verify field key matches log entry

### Performance issues with large trees?

- Reduce `maxInitialDepth` to 0 or 1
- Consider filtering fields in Python before logging
- Use text type for very large strings

### Assets not loading (GitHub Pages)?

- Check `base` setting in `vite.config.ts`
- Verify `.nojekyll` exists in `docs/`
- Check browser console for 404 errors

### Sample files not loading?

- Ensure files are in `aitrace_viewer/public/samples/`
- Verify `config.json` is valid JSON
- Check network tab in browser devtools

---

## Future Enhancements

Possible additions:

- Search and filtering across traces
- Virtualized rendering for huge traces
- Timeline visualization
- Performance metrics (span durations, critical path)
- Export/import session configurations
- Real-time trace streaming via WebSocket
- Advanced analytics and dashboards

---

## See Also

- [README.md](../README.md) - Main documentation
- [Quick Start Guide](quickstart.md) - Get started quickly
- [Configuration Guide](configuration.md) - Server configuration
- [Deployment Guide](deployment.md) - GitHub Pages deployment
- [Trace Record Format](trace_record_format.md) - Log format specification
- [AGENTS.md](../AGENTS.md) - Architecture and technical details
- [CHANGELOG.md](../CHANGELOG.md) - Version history
