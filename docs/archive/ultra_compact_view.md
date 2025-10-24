# Ultra-Compact Node View

**Date:** 2025-10-24

## Overview

The AI Trace Viewer now features an ultra-compact single-line view for nodes, making it easy to scan through traces without unnecessary clutter.

## Feature Description

### Default Collapsed View (Ultra-Compact)

When a node is collapsed, all information is displayed on **one line**:

```
▸ llm_start [Model: ChatOpenAI] [Run ID: f3577ee7-8cc6-4bed-93c8-c6ca1ce268f8] info ⌄
```

**Key Elements:**

- **Chevron** (▸): Indicates expandable node
- **Event Name**: The log event (e.g., `llm_start`)
- **Simple Fields**: Shown as inline badges (Model, Run ID, etc.)
- **Level Badge**: Log level (info, debug, warn, error)
- **Hint Icon** (⌄): Small chevron-down indicating complex fields hidden

**What's Hidden:**

- ❌ Complex JSON trees (Prompts, Response, etc.)
- ❌ "raw" button
- ❌ Detailed timestamps (unless multiple logs)
- ❌ Extra vertical spacing

### Expanded View (Full Details)

Click the node to reveal everything:

```
▾ llm_start
  ┌─ Timestamp: 2025-10-24 12:00:00
  ├─ [Model: ChatOpenAI] [Run ID: f3577ee7-8cc6-4bed-93c8-c6ca1ce268f8]
  ├─ [raw] button
  └─ Prompts: ▸ ["Human: Abc"]
```

**What's Revealed:**

- ✅ All simple fields (still as badges)
- ✅ Complex JSON trees (expandable)
- ✅ "raw" button for JSON inspection
- ✅ Timestamp (if configured)
- ✅ Full event details

## Benefits

### Space Savings

**Before (old 3-line view):**

```
▸ llm_start                           info
   Model: ChatOpenAI
   Run ID: f3577ee7-8cc6-4bed-93c8-c6ca1ce268f8
   ▸ Prompts: [...]
```

**Height:** 4 lines

**After (ultra-compact):**

```
▸ llm_start [Model: ChatOpenAI] [Run ID: f3577ee7-...] info ⌄
```

**Height:** 1 line (75% reduction!)

### Improved Scanning

Users can now:

1. **Quickly scan** through hundreds of events
2. **Spot patterns** at a glance (all Run IDs visible, all Models visible)
3. **Identify issues** faster (error levels more visible)
4. **Expand only what matters** for detailed investigation

### Reduced Clutter

- No premature JSON tree expansion
- No "raw" button distraction
- No unnecessary empty space
- Clean, professional appearance

## Technical Implementation

### Field Classification

Fields are categorized by the lens system:

**Simple Fields (Inline):**

- Type: `text`
- Rendered as: Inline badges
- Examples: Model, Run ID, User ID, Status

**Complex Fields (Hidden Until Expanded):**

- Type: `json-tree`
- Rendered as: Expandable JSON trees
- Examples: Prompts, Response, Metadata objects

### Rendering Logic

```typescript
// Get simple fields for inline display
const firstLogFields =
  hasLogs && node.raw.length >= 1 ? getFieldsForEntry(node.raw[0]) : [];
const simpleFieldsForInline = firstLogFields.filter((f) => f.type === "text");
const hasComplexFields = firstLogFields.some((f) => f.type === "json-tree");

// Show inline when collapsed
const showInlineFields = !open && simpleFieldsForInline.length > 0;
```

**Collapsed State:**

- Simple fields → Inline badges on same line as event name
- Complex fields → Hidden
- "raw" button → Hidden
- Visual hint (⌄) → Shown if complex fields exist

**Expanded State:**

- Simple fields → Still as badges (for consistency)
- Complex fields → Shown as expandable JSON trees
- "raw" button → Shown
- Full timestamp → Shown (if configured)

### Visual Indicators

**Expandability Icons:**

- `▸` (right chevron) - Collapsed node with children or fields
- `▾` (down chevron) - Expanded node
- `•` (dot) - Non-expandable node
- `⌄` (small chevron-down) - Hint that complex fields are hidden

## User Experience

### Workflow Example

**1. Initial Load (Clean View)**

```
▸ process_order [Order: #1234] [User: john@example.com] info ⌄
▸ validate_payment [Amount: $99.99] [Method: card] info ⌄
▸ llm_start [Model: ChatOpenAI] [Run ID: abc123] info ⌄
▸ llm_end [Model: ChatOpenAI] [Run ID: abc123] info ⌄
▸ send_confirmation [Email: john@example.com] [Status: sent] info ⌄
```

**Scan Factor:** Extremely easy - all key info visible, 5 lines total

**2. Expand Interesting Node**

```
▸ process_order [Order: #1234] [User: john@example.com] info ⌄
▸ validate_payment [Amount: $99.99] [Method: card] info ⌄
▾ llm_start info
  [Model: ChatOpenAI] [Run ID: abc123] [raw]
  ▸ Prompts: ["Human: Abc"]

▸ llm_end [Model: ChatOpenAI] [Run ID: abc123] info ⌄
▸ send_confirmation [Email: john@example.com] [Status: sent] info ⌄
```

**Focus:** One node expanded, others remain compact

**3. Expand JSON Tree**

```
▾ llm_start info
  [Model: ChatOpenAI] [Run ID: abc123] [raw]
  ▾ Prompts:
    ├─ [0]: "Human: Abc"
```

**Deep Dive:** Progressive disclosure of nested data

### Before vs After Comparison

**Scenario:** Viewing 20 LLM invocations in a trace

**Old View (3 lines per node):**

- 60 lines of vertical space
- Lots of scrolling required
- Hard to see patterns
- All JSON trees visible by default (overwhelming)

**New View (1 line per node):**

- 20 lines of vertical space (67% reduction!)
- Minimal scrolling
- Easy pattern recognition
- Clean, focused interface

## Configuration

### Lens System Integration

Lenses define which fields are simple vs complex:

```typescript
export const LLM_START_LENS: Lens = {
  eventPattern: /llm_start/i,
  fields: [
    // Simple fields → Inline badges
    { key: "model", display: "Model", type: "text" },
    { key: "run_id", display: "Run ID", type: "text" },

    // Complex fields → Hidden until expanded
    {
      key: "prompts",
      display: "Prompts",
      type: "json-tree",
      maxInitialDepth: 0, // Collapsed by default
    },
  ],
  priority: 10,
};
```

### Customization Options

**To always show complex fields inline:**

- Change field type from `json-tree` to `text`
- Or increase `maxInitialDepth` (but defeats purpose of compact view)

**To hide simple fields:**

- Don't include them in lens fields array
- They won't appear in inline badges

## Edge Cases

### Multiple Log Entries Per Span

If a span has multiple log entries:

- First entry's simple fields shown inline
- When expanded, all entries shown with full details
- Event name repeated for each entry when expanded

### No Fields

If a node has no extra fields:

- Just shows event name and level badge
- No chevron-down hint icon
- No expansion behavior for fields (only for children)

### Long Field Values

- Field values are displayed in monospace font
- Very long values (Run IDs) may wrap or truncate
- Full value visible on hover or when expanded

### Complex Only

If a node has only complex fields (no simple fields):

- Shows just event name and level badge when collapsed
- Shows chevron-down hint (⌄)
- All complex fields revealed when expanded

## Performance Impact

**Rendering Cost:**

- Initial render: Slightly faster (fewer DOM elements)
- Re-render on expand: Same cost as before
- Memory usage: Reduced (fewer rendered elements initially)

**User Perception:**

- Feels much faster (less visual clutter)
- Easier to navigate large traces
- Better focus on important details

## Accessibility

**Keyboard Navigation:**

- Tab to node → Enter to expand
- Chevron icons indicate interactive elements
- Screen readers announce "expandable" for nodes with hint icon

**Visual Indicators:**

- Clear distinction between collapsed/expanded states
- Chevron-down hint for hidden complex fields
- Consistent badge styling for simple fields

## Future Enhancements

### Potential Improvements

1. **Configurable Badge Style**

   - User preference: Pills vs brackets vs chips
   - Example: `[Model: X]` vs `Model: X` vs `Model=X`

2. **Field Ordering**

   - User-defined order for inline badges
   - Most important fields first

3. **Field Filtering**

   - Hide/show specific fields
   - "Show only errors" view

4. **Truncation Settings**

   - Max inline badge count (e.g., show only 3 most important)
   - "...and 2 more" indicator

5. **Color Coding**
   - Different badge colors for different field types
   - Error fields in red, success in green

## Related Features

- **State Persistence**: Expand/collapse state saved per document
- **JSON Tree Compact View**: Arrays/objects inline when simple
- **Lens System**: Defines which fields are simple vs complex

## References

- **CHANGELOG.md** - Feature announcement
- **docs/viewer.md** - User guide with examples
- **lenses/lensConfig.ts** - Lens definitions
- **components/NodeRow.tsx** - Implementation

---

**Document Version:** 1.0  
**Last Updated:** 2025-10-24  
**Maintained By:** AI Trace Viewer Team
