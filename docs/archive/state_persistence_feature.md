# State Persistence Feature

**Date:** 2025-10-24

## Overview

The AI Trace Viewer now includes comprehensive state persistence using IndexedDB and Zustand. The expand/collapse state of all nodes (spans, logs, and JSON trees) is automatically saved and restored when reopening the same document.

## Key Features

### 1. Document-Based State Storage

- Each document is identified by its **SHA256 hash**
- State is keyed by document hash, not filename
- Same file content = same state, regardless of filename
- Different file content = different state, even with same filename

### 2. Comprehensive State Tracking

The following UI states are persisted:

- **Span Nodes**: Expand/collapse state of each span
- **Log Entries**: Whether "raw" JSON is shown for each log
- **JSON Trees**: Expand/collapse state of every nested object/array
- **Long Strings**: Whether "more" is expanded in long strings

### 3. Default Collapsed State

- **All JSON trees default to collapsed** (maxInitialDepth = 0)
- Users must explicitly expand what they want to see
- Previously expanded nodes are restored from IndexedDB
- Clean, uncluttered initial view

### 4. State Management

**Technologies:**

- **Zustand**: Lightweight state management library
- **IndexedDB**: Browser's persistent storage
- **SHA256**: Cryptographic hash for document identification

**Storage Location:**

- IndexedDB database: `aitrace-viewer`
- Object store: `expand-collapse-state`
- Key: `expandedState`
- Value: `{ [docHash]: { [nodeId]: boolean } }`

### 5. User Controls

**Reset View Button:**

- Clears expand/collapse state for current document
- Icon: 🔄 (arrow-clockwise)
- Tooltip: "Clear expand/collapse state for current document"

**Clear All States Button:**

- Clears all saved states for all documents
- Icon: 🗑️ (trash)
- Requires confirmation
- Tooltip: "Clear all saved expand/collapse states"

## Technical Implementation

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User loads JSONL file                                   │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Compute SHA256 hash of file content                    │
│ - crypto.subtle.digest('SHA-256', data)                 │
│ - Returns hex string (64 characters)                    │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Set document hash in Zustand store                     │
│ - setDocumentHash(hash)                                 │
│ - Loads state from IndexedDB if not already loaded     │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Components check expansion state                        │
│ - isExpanded(nodeId) → boolean                          │
│ - Returns false for unseen nodes (default collapsed)   │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ User clicks expand/collapse                             │
│ - toggleExpanded(nodeId)                                │
│ - Updates Zustand store                                 │
│ - Saves to IndexedDB                                    │
└─────────────────────────────────────────────────────────┘
```

### Node ID Format

Each expandable element has a unique node ID:

| Element Type | ID Format                                   | Example                                  |
| ------------ | ------------------------------------------- | ---------------------------------------- |
| Span         | `span:{span_id}`                            | `span:abc123def456`                      |
| Log Raw      | `log:{span_id}:{log_index}`                 | `log:abc123:0`                           |
| JSON Tree    | `json:{span_id}:{log_index}:{field}:{path}` | `json:abc123:0:response:generations:[0]` |
| Long String  | `{path}:longstring`                         | `json:abc123:0:text:longstring`          |

### Zustand Store

**File:** `aitrace_viewer/src/stores/expandCollapseStore.ts`

```typescript
interface ExpandCollapseState {
  currentDocHash: string | null;
  expandedState: Record<string, Record<string, boolean>>;

  setDocumentHash: (hash: string) => void;
  isExpanded: (nodeId: string) => boolean;
  setExpanded: (nodeId: string, expanded: boolean) => void;
  toggleExpanded: (nodeId: string) => void;
  clearCurrentDocState: () => void;
  clearAllState: () => void;
  loadFromIndexedDB: () => Promise<void>;
  saveToIndexedDB: () => Promise<void>;
}
```

**Key Methods:**

```typescript
// Check if a node is expanded
const isExpanded = useExpandCollapseStore((state) => state.isExpanded);
isExpanded("span:abc123"); // → true/false

// Toggle expansion
const toggleExpanded = useExpandCollapseStore((state) => state.toggleExpanded);
toggleExpanded("span:abc123"); // Flips state and saves to IndexedDB

// Set document hash (loads state automatically)
const setDocumentHash = useExpandCollapseStore(
  (state) => state.setDocumentHash
);
await setDocumentHash("a7f3e2d..."); // 64-char SHA256 hash

// Clear current document state
const clearCurrentDocState = useExpandCollapseStore(
  (state) => state.clearCurrentDocState
);
clearCurrentDocState(); // Resets to all collapsed

// Clear all states
const clearAllState = useExpandCollapseStore((state) => state.clearAllState);
await clearAllState(); // Wipes IndexedDB
```

### SHA256 Hash Computation

**File:** `aitrace_viewer/src/utils/hash.ts`

```typescript
export async function computeSHA256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex; // 64-character hex string
}
```

**Usage in App:**

```typescript
// When loading a file
const text = await response.text();
const hash = await computeSHA256(text);
await setDocumentHash(hash);
setForest(buildSpanForest(rows));
```

### Component Integration

**NodeRow Component:**

```typescript
export function NodeRow({ node, ... }) {
  const { isExpanded, toggleExpanded } = useExpandCollapseStore();

  const nodeId = `span:${node.id}`;
  const open = isExpanded(nodeId);

  return (
    <div onClick={() => toggleExpanded(nodeId)}>
      {/* ... */}
    </div>
  );
}
```

**JsonTree Component:**

```typescript
function JsonValue({ value, name, pathPrefix, ... }) {
  const { isExpanded: isExpandedInStore, toggleExpanded } = useExpandCollapseStore();

  const nodePath = pathPrefix + (name ? `:${name}` : `:${depth}`);
  const isExpanded = isExpandedInStore(nodePath);

  return (
    <div onClick={() => toggleExpanded(nodePath)}>
      {/* ... */}
    </div>
  );
}
```

## User Experience

### Before (Without State Persistence)

1. User loads a large trace file
2. Expands several spans to investigate an issue
3. Expands nested JSON objects to see details
4. Refreshes page or reloads file
5. **Everything is collapsed again** 😞
6. User must re-expand everything from memory

### After (With State Persistence)

1. User loads a large trace file (hash computed: `a7f3e2d...`)
2. Expands several spans to investigate an issue
3. Expands nested JSON objects to see details
4. State is automatically saved to IndexedDB
5. Refreshes page or reloads file
6. **All previous expansions are restored** 😊
7. User continues exactly where they left off

### Scenarios

**Scenario 1: Same File, Different Session**

```
Day 1: Load production.jsonl → Expand spans A, B, C
Day 2: Load production.jsonl → A, B, C still expanded ✓
```

**Scenario 2: Different File, Same Name**

```
Load prod-monday.jsonl (hash: aaa111) → Expand span A
Load prod-tuesday.jsonl (hash: bbb222) → Nothing expanded ✓
Rename prod-tuesday.jsonl to prod-monday.jsonl → Still hash bbb222 → Nothing expanded ✓
```

**Scenario 3: Reset View**

```
User expands 20+ spans while debugging
Clicks "Reset View" button
All collapses immediately
But state is only cleared for this document (others preserved)
```

**Scenario 4: Clear All States**

```
User has viewed 50 different trace files over time
IndexedDB has 50 document states
Clicks "Clear All States" → Confirms
All 50 states deleted
Clean slate for all future files
```

## Performance Considerations

### Memory Usage

- **Zustand Store**: O(D × N) where D = documents, N = nodes per document
- **IndexedDB**: Limited by browser quota (typically 50-100 MB)
- **Typical Usage**: ~1 KB per document state
- **100 documents**: ~100 KB (negligible)

### Load Time

- **Hash Computation**: ~10ms for 1 MB file (Web Crypto API is fast)
- **IndexedDB Load**: ~5-20ms (asynchronous)
- **State Restoration**: Instant (O(1) lookup per node)

### Save Time

- **Debouncing**: Could be added if needed
- **Current**: Saves immediately on every toggle
- **IndexedDB Write**: ~5-10ms (asynchronous, non-blocking)

### Optimization Opportunities

1. **Debounced Saves**: Wait 200ms after last toggle before saving
2. **Batch Updates**: Save multiple toggles in one IndexedDB write
3. **LRU Eviction**: Auto-delete oldest document states (keep last 50)
4. **Compression**: gzip state before storing (probably overkill)

## Browser Compatibility

**Requirements:**

- Web Crypto API (SHA256 hashing)
- IndexedDB
- ES6+ (Promises, async/await)

**Supported Browsers:**

- ✅ Chrome 60+ (2017)
- ✅ Firefox 57+ (2017)
- ✅ Safari 11+ (2017)
- ✅ Edge 79+ (2020)

**Fallback Behavior:**
If IndexedDB is unavailable:

- State still works within session (Zustand in-memory)
- No persistence across page reloads
- No errors, just degrades gracefully

## Testing

### Manual Test Cases

1. **Basic Persistence**

   - Load file → Expand span → Refresh page → Span still expanded ✓

2. **Multiple Nodes**

   - Load file → Expand 10 spans → Refresh → All 10 still expanded ✓

3. **JSON Trees**

   - Expand nested object → Expand child → Refresh → Both still expanded ✓

4. **Different Documents**

   - Load file A → Expand span 1 → Load file B → Nothing expanded ✓
   - Load file A again → Span 1 still expanded ✓

5. **Reset View**

   - Expand multiple spans → Click "Reset View" → All collapsed ✓
   - Refresh page → Still all collapsed ✓

6. **Clear All States**

   - Load files A, B, C with various expansions
   - Click "Clear All States" → Confirm
   - Reload any file → Nothing expanded ✓

7. **Long Strings**

   - Click "more" on long string → Refresh → Still showing full text ✓

8. **Raw JSON Toggle**
   - Click "raw" on log → Refresh → Still showing raw ✓

## Future Enhancements

### Potential Improvements

1. **Export/Import States**

   - Download state as JSON
   - Import state from JSON
   - Share states with teammates

2. **State Snapshots**

   - Save named snapshots: "Before fix", "After fix"
   - Quick restore to any snapshot
   - Compare two snapshots

3. **Partial State Save**

   - Only save state for "important" nodes
   - Collapse all but marked nodes

4. **Auto-Expand Patterns**

   - User-defined rules: "Always expand error logs"
   - Regex patterns for auto-expansion

5. **State Analytics**

   - Show most expanded nodes across documents
   - Identify common investigation paths

6. **Cloud Sync**
   - Sync state across devices
   - Team-shared state

## Migration Notes

### From Old Version (No State)

- No migration needed
- All users start with empty IndexedDB
- State builds naturally as they use the viewer

### Breaking Changes

**None!** This is a purely additive feature.

### Backward Compatibility

- Old URLs still work
- Old bookmarks still work
- No API changes
- Fully backward compatible

## Troubleshooting

### State Not Persisting

1. **Check Browser Console**: Look for IndexedDB errors
2. **Check Storage Quota**: Browser might be full
3. **Check Private Mode**: Some browsers disable IndexedDB in private mode
4. **Clear Site Data**: May resolve corrupt IndexedDB

### State Persisting Too Much

1. Click "Clear All States" button
2. Or manually delete IndexedDB:
   ```javascript
   // In browser console
   indexedDB.deleteDatabase("aitrace-viewer");
   ```

### Wrong State Restored

This shouldn't happen (hash mismatch), but if it does:

1. Click "Reset View" to clear current document
2. If persistent, click "Clear All States"

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [SHA-256 Specification](https://en.wikipedia.org/wiki/SHA-2)

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-24  
**Maintained By:** AI Trace Viewer Team
