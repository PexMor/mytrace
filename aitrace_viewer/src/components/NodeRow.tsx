import { useState, useEffect } from 'preact/hooks';
import { formatTimestamp, type TimestampSettings } from '../utils/timestampFormat';
import { getDensityPadding, getDensityMargin, type DensitySettings } from '../utils/densitySettings';
import { JsonTree } from './JsonTree';
import { getFieldsForEntry } from '../lenses/lensConfig';
import { useExpandCollapseStore } from '../stores/expandCollapseStore';
import { useCustomLensStore, extractValueByPath, type CustomLensField } from '../stores/customLensStore';
import { CustomLensDialog } from './CustomLensDialog';

interface NodeRowProps {
  node: any;
  trace: any;
  timestampSettings: TimestampSettings;
  densitySettings: DensitySettings;
  traceStartTime?: string;
}

export function NodeRow({ node, trace, timestampSettings, densitySettings, traceStartTime }: NodeRowProps) {
  const { isExpanded, toggleExpanded } = useExpandCollapseStore();
  const { getFieldsForEvent, deleteCustomField, updateCustomField } = useCustomLensStore();
  
  // Context menu state for chips
  const [chipContextMenu, setChipContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    customFieldId?: string;
    customField?: CustomLensField;
  }>({ open: false, x: 0, y: 0 });
  
  // Dialog state for editing custom lens
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomLensField | null>(null);
  
  // Close context menu when clicking outside
  useEffect(() => {
    if (!chipContextMenu.open) return;
    
    const handleClick = () => setChipContextMenu({ open: false, x: 0, y: 0 });
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [chipContextMenu.open]);
  
  // Helper function to apply custom lenses to an entry
  const applyCustomLenses = (entry: any): any[] => {
    const eventName = entry.event || '';
    console.log('NodeRow.applyCustomLenses: Processing event', eventName);
    console.log('NodeRow.applyCustomLenses: Log entry structure:', entry);
    const customFields = getFieldsForEvent(eventName);
    console.log('NodeRow.applyCustomLenses: Found custom fields', customFields);
    
    const results = customFields.map(customField => {
      console.log(`NodeRow.applyCustomLenses: Trying to extract from path "${customField.jsonPath}"`);
      const value = extractValueByPath(entry, customField.jsonPath);
      console.log(`NodeRow.applyCustomLenses: Extracted "${customField.name}" from "${customField.jsonPath}":`, value);
      if (value !== undefined) {
        return {
          key: `custom-${customField.id}`,
          display: customField.name,
          value: value,
          type: 'text',
          isCustom: true
        };
      }
      return null;
    }).filter(Boolean);
    
    console.log('NodeRow.applyCustomLenses: Returning', results.length, 'custom fields');
    return results;
  };
  
  // Node ID for state persistence
  const nodeId = `span:${node.id}`;
  const open = isExpanded(nodeId);
  
  // Get density padding and margin
  const padding = getDensityPadding(densitySettings.mode);
  const margin = getDensityMargin(densitySettings.mode);
  
  const levelClass = {
    'info': 'badge-info',
    'debug': 'badge-debug',
    'warn': 'badge-warn',
    'error': 'badge-error'
  }[node.level] || 'badge-info';

  const hasChildren = node.children.length > 0;
  const hasLogs = node.raw && node.raw.length > 0;
  const hasMultipleLogs = node.raw && node.raw.length > 1;
  
  // Check if any log entry has extra fields
  const hasExtraFields = hasLogs && node.raw.some((entry: any) => {
    const fields = getFieldsForEntry(entry);
    return fields.length > 0;
  });
  
  const isExpandable = hasChildren || hasMultipleLogs || hasExtraFields;
  
  const icon = isExpandable
    ? (open ? 'bi-chevron-down' : 'bi-chevron-right')
    : 'bi-dot';

  // Get simple fields for inline display
  const firstLogBaseFields = hasLogs && node.raw.length >= 1 ? getFieldsForEntry(node.raw[0]) : [];
  const firstLogCustomFields = hasLogs && node.raw.length >= 1 ? applyCustomLenses(node.raw[0]) : [];
  const firstLogFields = [...firstLogBaseFields, ...firstLogCustomFields];
  const simpleFieldsForInline = firstLogFields.filter(f => f.type === 'text');
  const hasComplexFields = firstLogFields.some(f => f.type === 'json-tree');
  
  // Determine if we should show inline fields
  const showInlineFields = !open && simpleFieldsForInline.length > 0;
  
  return (
    <div style={{ marginLeft: node.depth * 16 + 'px' }}>
      <div class='node-row' style={{ 
        padding: `${padding.vertical} ${padding.horizontal}`,
        margin: margin
      }}>
        <div class='node-content'>
          <i 
            class={`bi ${icon} node-icon`}
            onClick={() => isExpandable && toggleExpanded(nodeId)}
            style={{ cursor: isExpandable ? 'pointer' : 'default' }}
            title={isExpandable ? 'Click to expand/collapse' : ''}
          ></i>
          <span class='node-message'>{node.msg || '(no event)'}</span>
          
          {/* Show simple fields inline when collapsed */}
          {showInlineFields && simpleFieldsForInline.map((field, idx) => {
            const foldId = `chipfold:${nodeId}:inline:${field.key}`;
            const isFolded = !isExpanded(foldId);
            const isCustomChip = (field as any).isCustom;
            const customFieldId = isCustomChip ? (field.key as string).replace('custom-', '') : undefined;
            const entry = node.raw[0];
            
            return (
              <span 
                key={field.key} 
                class={`field-chip badge ${isCustomChip ? 'custom-chip' : 'bg-light text-dark border'} ms-1 ${isFolded ? 'chip-folded' : 'chip-unfolded'}`}
                style={{ fontWeight: 'normal' }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(foldId);
                }}
                onContextMenu={(e) => {
                  if (isCustomChip && customFieldId) {
                    e.preventDefault();
                    e.stopPropagation();
                    const customFields = getFieldsForEvent(entry?.event || '');
                    const customField = customFields.find(f => f.id === customFieldId);
                    setChipContextMenu({
                      open: true,
                      x: e.clientX,
                      y: e.clientY,
                      customFieldId,
                      customField
                    });
                  }
                }}
              >
                <span class='field-chip-label' style={{ fontWeight: 600, color: '#6c757d' }}>{field.display}:</span>{' '}
                <span class='field-chip-value' style={{ fontFamily: 'Courier New, monospace' }}>{String(field.value)}</span>
              </span>
            );
          })}
          
          <span class={`badge ${levelClass} node-badge ms-1`}>{node.level}</span>
          {hasMultipleLogs && (
            <span class='badge badge-secondary ms-1'>{node.raw.length} logs</span>
          )}
        </div>
      </div>
      
      {open && hasLogs && (
        <div class='node-details' style={{ 
          marginLeft: densitySettings.mode === 'compact' ? '16px' : '24px', 
          marginTop: densitySettings.mode === 'compact' ? '2px' : '4px', 
          marginBottom: densitySettings.mode === 'compact' ? '2px' : '8px',
          padding: densitySettings.mode === 'compact' ? '2px 4px' : '4px 8px'
        }}>
          {node.raw.map((entry, idx) => {
            const baseFields = getFieldsForEntry(entry);
            const customFields = applyCustomLenses(entry);
            const fields = [...baseFields, ...customFields];
            const logId = `log:${node.id}:${idx}`;
            const logExpandId = `logexpand:${node.id}:${idx}`;
            const showRaw = isExpanded(logId);
            const logExpanded = isExpanded(logExpandId);
            const hasFields = fields.length > 0;
            const simpleFields = fields.filter(f => f.type === 'text');
            const complexFields = fields.filter(f => f.type === 'json-tree');
            const hasComplexFields = complexFields.length > 0;
            
            return (
              <div key={idx} class='log-entry'>
                {/* Ultra-compact one-line view when log is collapsed */}
                {!logExpanded && (
                  <div 
                    class='log-entry-compact'
                    style={{ 
                      padding: `${padding.vertical} 0`,
                      margin: margin
                    }}
                  >
                    {hasMultipleLogs && (
                      <i 
                        class='bi bi-chevron-right' 
                        onClick={() => toggleExpanded(logExpandId)}
                        style={{ fontSize: '0.75rem', marginRight: '4px', cursor: 'pointer' }}
                        title='Click to expand log entry'
                      ></i>
                    )}
                    {hasMultipleLogs && (
                      <span class='log-event' style={{ fontWeight: 500, marginRight: '8px' }}>{entry.event}</span>
                    )}
                    {/* Show simple fields inline */}
                    {simpleFields.map(field => {
                      const foldId = `chipfold:${node.id}:${idx}:compact:${field.key}`;
                      const isFolded = !isExpanded(foldId);
                      const isCustomChip = (field as any).isCustom;
                      const customFieldId = isCustomChip ? (field.key as string).replace('custom-', '') : undefined;
                      
                      return (
                        <span 
                          key={field.key} 
                          class={`field-chip badge ${isCustomChip ? 'custom-chip' : 'bg-light text-dark border'} ms-1 ${isFolded ? 'chip-folded' : 'chip-unfolded'}`}
                          style={{ fontWeight: 'normal', fontSize: '0.7rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(foldId);
                          }}
                          onContextMenu={(e) => {
                            if (isCustomChip && customFieldId) {
                              e.preventDefault();
                              e.stopPropagation();
                              const customFields = getFieldsForEvent(entry.event || '');
                              const customField = customFields.find(f => f.id === customFieldId);
                              setChipContextMenu({
                                open: true,
                                x: e.clientX,
                                y: e.clientY,
                                customFieldId,
                                customField
                              });
                            }
                          }}
                        >
                          <span class='field-chip-label' style={{ fontWeight: 600, color: '#6c757d' }}>{field.display}:</span>{' '}
                          <span class='field-chip-value' style={{ fontFamily: 'Courier New, monospace' }}>{String(field.value)}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                {/* Expanded view with all details */}
                {logExpanded && (
                  <>
                    <div class='log-entry-header'>
                      <i 
                        class='bi bi-chevron-down' 
                        onClick={() => toggleExpanded(logExpandId)}
                        style={{ fontSize: '0.75rem', marginRight: '4px', cursor: 'pointer' }}
                        title='Click to collapse log entry'
                      ></i>
                      {timestampSettings.showInNodes && (
                        <span class='log-timestamp text-muted'>
                          {formatTimestamp(entry.timestamp, timestampSettings, traceStartTime)}
                        </span>
                      )}
                      {hasMultipleLogs && (
                        <span class='log-event fw-bold ms-2'>{entry.event}</span>
                      )}
                      <button 
                        class='btn btn-xxs btn-light text-muted border-0 ms-2 raw-toggle'
                        onClick={(e) => { e.stopPropagation(); toggleExpanded(logId); }}
                        type='button'
                      >
                        {showRaw ? 'hide raw' : 'raw'}
                      </button>
                    </div>
                    {showRaw && (
                      <pre class='raw-json border rounded p-2 bg-light'>
{JSON.stringify(entry, null, 2)}
                      </pre>
                    )}
                    {fields.length > 0 && (
                      <div class='log-extra-fields mt-2'>
                        {/* Render simple fields as compact chips */}
                        <div class='field-chips d-flex flex-wrap gap-1 mb-2'>
                          {simpleFields.map(field => {
                            const fieldValue = String(field.value || '');
                            const isLongValue = fieldValue.length > 50;
                            const chipId = `chip:${node.id}:${idx}:${field.key}`;
                            const foldId = `chipfold:${node.id}:${idx}:${field.key}`;
                            const isChipExpanded = isExpanded(chipId);
                            const isFolded = !isExpanded(foldId);
                            const displayValue = isLongValue && !isChipExpanded 
                              ? fieldValue.substring(0, 50) + '...'
                              : fieldValue;
                            
                            const isCustomChip = (field as any).isCustom;
                            const customFieldId = isCustomChip ? (field.key as string).replace('custom-', '') : undefined;
                            
                            return (
                              <span 
                                key={field.key} 
                                class={`field-chip badge ${isCustomChip ? 'custom-chip' : 'bg-light text-dark border'} ${isChipExpanded ? 'chip-expanded' : ''} ${isFolded ? 'chip-folded' : 'chip-unfolded'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(foldId);
                                }}
                                onContextMenu={(e) => {
                                  if (isCustomChip && customFieldId) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const customFields = getFieldsForEvent(entry.event || '');
                                    const customField = customFields.find(f => f.id === customFieldId);
                                    setChipContextMenu({
                                      open: true,
                                      x: e.clientX,
                                      y: e.clientY,
                                      customFieldId,
                                      customField
                                    });
                                  }
                                }}
                              >
                                <span class='field-chip-label'>{field.display}:</span>
                                <span class='field-chip-value'>{displayValue}</span>
                                {isLongValue && (
                                  <button
                                    class="chip-toggle-btn ml-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpanded(chipId);
                                    }}
                                    title={isChipExpanded ? 'Show less' : 'Show more'}
                                  >
                                    {isChipExpanded ? '−' : '+'}
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                        
                        {/* Render complex fields as expandable trees */}
                        {complexFields.map(field => (
                          <div key={field.key} class='field-container mb-2'>
                            <JsonTree 
                              data={field.value}
                              name={field.display}  // Display name (can be capitalized)
                              jsonKey={field.key}   // Actual JSON key (for path building)
                              maxInitialDepth={field.maxInitialDepth || 0}
                              pathPrefix={`json:${node.id}:${idx}:${field.key}`}
                              eventName={entry.event}
                              jsonPath=""  // Start with empty path, JsonTree will build it from jsonKey
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {open && hasChildren && node.children.map(id => 
        <NodeRow 
          key={id} 
          node={trace.nodes.get(id)} 
          trace={trace}
          timestampSettings={timestampSettings}
          densitySettings={densitySettings}
          traceStartTime={traceStartTime}
        />
      )}
      
      {/* Chip context menu */}
      {chipContextMenu.open && (
        <div 
          class='chip-context-menu'
          style={{ left: `${chipContextMenu.x}px`, top: `${chipContextMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            class='chip-context-menu-item'
            onClick={() => {
              if (chipContextMenu.customField) {
                setEditingField(chipContextMenu.customField);
                setEditDialogOpen(true);
                setChipContextMenu({ open: false, x: 0, y: 0 });
              }
            }}
          >
            <i class='bi bi-pencil'></i>
            <span>Edit Lens</span>
          </div>
          <div 
            class='chip-context-menu-item danger'
            onClick={() => {
              if (chipContextMenu.customFieldId) {
                if (confirm('Delete this custom chip lens?')) {
                  deleteCustomField(chipContextMenu.customFieldId);
                }
                setChipContextMenu({ open: false, x: 0, y: 0 });
              }
            }}
          >
            <i class='bi bi-trash'></i>
            <span>Delete Lens</span>
          </div>
        </div>
      )}
      
      {/* Edit dialog */}
      {editDialogOpen && editingField && (
        <CustomLensDialog
          isOpen={editDialogOpen}
          initialData={{
            name: editingField.name,
            eventPattern: editingField.eventPattern,
            jsonPath: editingField.jsonPath
          }}
          onConfirm={(data) => {
            updateCustomField(editingField.id, {
              name: data.name,
              eventPattern: data.eventPattern,
              jsonPath: data.jsonPath
            });
            setEditDialogOpen(false);
            setEditingField(null);
          }}
          onCancel={() => {
            setEditDialogOpen(false);
            setEditingField(null);
          }}
        />
      )}
    </div>
  );
}