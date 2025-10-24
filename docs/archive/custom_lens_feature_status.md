# Custom Lens Feature - Implementation Status

**Date:** 2025-10-24  
**Status:** Phase 1 Complete - Dialog & Storage Implemented

## Overview

This feature allows users to extract nested JSON values and display them as inline chips (badges) by right-clicking on values in the JSON tree.

## ✅ Implemented (Phase 1)

### 1. Core Infrastructure

**Custom Lens Store** (`stores/customLensStore.ts`)
- ✅ Zustand store for managing custom lenses
- ✅ IndexedDB persistence
- ✅ Add/update/delete operations
- ✅ Export/import as JSON
- ✅ JSON path extraction helper (`extractValueByPath`)
- ✅ Event pattern matching (regex or exact)

**Custom Lens Interface:**
```typescript
interface CustomLensField {
  id: string;
  name: string;          // Display name (e.g., "my-value")
  eventPattern: string;   // Event to match (e.g., "llm_end")
  jsonPath: string;       // Extraction path (e.g., "l1.l2.l3.a[0]")
  createdAt: number;
}
```

### 2. User Interface Components

**Context Menu** (`components/JsonContextMenu.tsx`)
- ✅ "Copy Value" option
- ✅ "Download JSON" option
- ✅ "Use as Chip" option (for primitive values only)
- ✅ Visual distinction for chip creation option

**Creation Dialog** (`components/CustomLensDialog.tsx`)
- ✅ Shows JSON path
- ✅ Shows current value
- ✅ Input for chip name
- ✅ Event pattern configuration
- ✅ Regex toggle
- ✅ Auto-suggests name from JSON path

### 3. JSON Tree Integration

**JsonTree Updates** (`components/JsonTree.tsx`)
- ✅ Context menus on primitive values (strings, numbers)
- ✅ JSON path tracking through recursion
- ✅ Event name propagation
- ✅ Dialog integration
- ✅ Store integration for saving custom lenses

**NodeRow Updates** (`components/NodeRow.tsx`)
- ✅ Passes event name to JsonTree
- ✅ Passes initial JSON path

### 4. Styling

**CSS Additions** (`style.css`)
- ✅ `.json-value-clickable` - hover effect on clickable values
- ✅ `.custom-lens-dialog-*` - dialog styling
- ✅ `.menu-divider` - context menu separator
- ✅ `.menu-item-primary` - highlighted menu item

## ⏳ TODO (Phase 2)

### 1. Apply Custom Lenses

**Integration Needed:**
- Load custom lenses in App component
- Update `getFieldsForEntry` to include custom fields
- Extract values using `extractValueByPath`
- Add to field list as "text" type fields

**Example:**
```typescript
// In lensConfig.ts or new customLensIntegration.ts
export function applyCustomLenses(entry: any, eventName: string): Field[] {
  const customFields = useCustomLensStore.getState().getFieldsForEvent(eventName);
  
  return customFields.map(customField => {
    const value = extractValueByPath(entry, customField.jsonPath);
    return {
      key: `custom-${customField.id}`,
      display: customField.name,
      type: 'text',
      value: value,
      isCustom: true  // Flag for styling
    };
  }).filter(field => field.value !== undefined);
}
```

### 2. Visual Distinction

**Custom Chip Styling:**
- Add different background color (e.g., light blue/purple)
- Add icon or indicator (e.g., ⭐)
- Make it distinguishable from regular chips

**CSS Example:**
```css
.field-chip.custom-chip {
  background-color: #e7f1ff;
  border-color: #0d6efd;
}

.field-chip.custom-chip::before {
  content: '⭐ ';
}
```

### 3. Edit/Delete Custom Lenses

**Right-click on Chip:**
- Context menu on custom chips
- "Edit" option → Opens dialog with pre-filled values
- "Delete" option → Confirms and removes

**Implementation:**
```typescript
// In NodeRow.tsx, for custom chips
<span 
  class='field-chip custom-chip'
  onContextMenu={(e) => {
    e.preventDefault();
    showCustomChipMenu(field.id);
  }}
>
  {field.display}: {field.value}
</span>
```

### 4. Export/Import UI

**Global Menu:**
- Add "Custom Lenses" dropdown in top toolbar
- Export button → Downloads JSON file
- Import button → Uploads JSON file
- Clear all button → Removes all custom lenses

**Component Example:**
```typescript
// components/CustomLensManager.tsx
export function CustomLensManager() {
  const { customFields, exportCustomFields, importCustomFields } = useCustomLensStore();
  
  return (
    <div class='custom-lens-manager'>
      <button onClick={handleExport}>
        <i class='bi bi-download'></i> Export Custom Lenses
      </button>
      <input type='file' onChange={handleImport} />
    </div>
  );
}
```

### 5. Load Custom Lenses on App Start

**App.tsx:**
```typescript
const { loadFromIndexedDB: loadCustomLenses } = useCustomLensStore();

useEffect(() => {
  loadFromIndexedDB();
  loadCustomLenses(); // Load custom lenses
  // ...
}, []);
```

## User Workflow (When Complete)

### Creating a Custom Chip

1. User expands JSON tree to find nested value
2. Right-clicks on primitive value (e.g., `12.3`)
3. Clicks "Use as Chip"
4. Dialog shows:
   - JSON Path: `l1.l2.l3.a[0]`
   - Current Value: `12.3`
   - Name: (auto-suggested: "0" or "a")
5. User enters name: "temperature"
6. Confirms event pattern: "llm_end"
7. Clicks "Create Chip"

### Viewing Custom Chip

1. User collapses node or loads new trace
2. For matching events, custom chip appears inline:
   - `▸ llm_end [Model: ChatOpenAI] [temperature: 12.3] ⭐ info`
3. Custom chip has distinct styling (blue background)

### Editing Custom Chip

1. User right-clicks on custom chip
2. Selects "Edit"
3. Dialog opens with current values pre-filled
4. User changes name or event pattern
5. Saves changes

### Exporting Custom Lenses

1. User clicks "Custom Lenses" dropdown
2. Clicks "Export"
3. Downloads `custom-lenses.json`
4. Can share with team or backup

## Technical Details

### JSON Path Format

Supports:
- Dot notation: `l1.l2.l3`
- Array indices: `a[0]`
- Mixed: `l1.l2.a[1].b`

### Event Pattern Matching

**Exact Match:**
- `llm_end` → matches only "llm_end"
- Case-insensitive by default

**Regex Match:**
- `llm_.*` → matches "llm_start", "llm_end", "llm_error"
- `.*_end` → matches any event ending with "_end"

### Storage

**IndexedDB:**
- Database: `aitrace-viewer`
- Store: `custom-lenses`
- Key: `customFields`
- Value: Array of CustomLensField

**Export Format:**
```json
[
  {
    "id": "custom-1730000000000-abc123",
    "name": "temperature",
    "eventPattern": "llm_end",
    "jsonPath": "l1.l2.l3.a[0]",
    "createdAt": 1730000000000
  }
]
```

## Next Steps

1. **Phase 2A:** Apply custom lenses (display as chips)
2. **Phase 2B:** Add visual distinction
3. **Phase 2C:** Edit/delete functionality
4. **Phase 2D:** Export/import UI
5. **Phase 3:** Polish and optimize

## Build Status

- ✅ Compiles successfully
- ✅ No linting errors
- ✅ Bundle size: 62.80 kB (gzipped: 20.97 kB)
- ✅ All TypeScript types correct

## Testing Checklist (When Complete)

- [ ] Right-click on number value shows context menu
- [ ] "Use as Chip" option appears
- [ ] Dialog opens with correct JSON path
- [ ] Can create custom lens
- [ ] Custom lens appears as chip on matching events
- [ ] Custom chip has distinct styling
- [ ] Can edit custom lens via right-click
- [ ] Can delete custom lens
- [ ] Can export custom lenses
- [ ] Can import custom lenses
- [ ] Custom lenses persist across sessions
- [ ] Works with nested JSON (5+ levels deep)
- [ ] Works with array indices
- [ ] Regex patterns work correctly

---

**Last Updated:** 2025-10-24  
**Next Action:** Implement Phase 2A (Apply Custom Lenses)

