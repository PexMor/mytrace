import { useState } from 'preact/hooks';
import { formatTimestamp, type TimestampSettings } from '../utils/timestampFormat';
import { JsonTree } from './JsonTree';
import { getFieldsForEntry } from '../lenses/lensConfig';

interface NodeRowProps {
  node: any;
  trace: any;
  timestampSettings: TimestampSettings;
  traceStartTime?: string;
}

export function NodeRow({ node, trace, timestampSettings, traceStartTime }: NodeRowProps) {
  const [open, setOpen] = useState(false);
  
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

  return (
    <div style={{ marginLeft: node.depth * 16 + 'px' }}>
      <div class='node-row'>
        <div 
          class='node-content' 
          onClick={() => isExpandable && setOpen(!open)}
          style={{ cursor: isExpandable ? 'pointer' : 'default' }}
        >
          <i class={`bi ${icon} node-icon`}></i>
          <span class='node-message'>{node.msg || '(no event)'}</span>
          <span class={`badge ${levelClass} node-badge`}>{node.level}</span>
          {hasMultipleLogs && (
            <span class='badge badge-secondary ms-1'>{node.raw.length} logs</span>
          )}
          {hasExtraFields && !hasMultipleLogs && (
            <i class='bi bi-info-circle text-muted ms-2' title='Has additional fields'></i>
          )}
        </div>
      </div>
      
      {/* Show fields inline for single-log spans without expansion */}
      {!open && !hasChildren && !hasMultipleLogs && hasExtraFields && node.raw && node.raw.length === 1 && (
        <div style={{ marginLeft: '24px', marginTop: '4px' }}>
          {(() => {
            const fields = getFieldsForEntry(node.raw[0]);
            const simpleFields = fields.filter(f => f.type === 'text');
            return simpleFields.length > 0 && (
              <div class='field-chips d-flex flex-wrap gap-1'>
                {simpleFields.map(field => (
                  <span key={field.key} class='field-chip badge bg-light text-dark border'>
                    <span class='field-chip-label'>{field.display}:</span>
                    <span class='field-chip-value'>{String(field.value)}</span>
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      )}
      
      {open && hasLogs && (
        <div class='node-details' style={{ marginLeft: '24px', marginTop: '4px', marginBottom: '8px' }}>
          {node.raw.map((entry, idx) => {
            const [showRaw, setShowRaw] = useState(false);
            const fields = getFieldsForEntry(entry);
            return (
              <div key={idx} class='log-entry'>
                <div class='log-entry-header'>
                  {timestampSettings.showInNodes && (
                    <span class='log-timestamp text-muted'>
                      {formatTimestamp(entry.timestamp, timestampSettings, traceStartTime)}
                    </span>
                  )}
                  <span class='log-event fw-bold ms-2'>{entry.event}</span>
                  <button 
                    class='btn btn-xxs btn-light text-muted border-0 ms-2 raw-toggle'
                    onClick={() => setShowRaw(!showRaw)}
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
                      {fields.filter(f => f.type === 'text').map(field => (
                        <span key={field.key} class='field-chip badge bg-light text-dark border'>
                          <span class='field-chip-label'>{field.display}:</span>
                          <span class='field-chip-value'>{String(field.value)}</span>
                        </span>
                      ))}
                    </div>
                    
                    {/* Render complex fields as expandable trees */}
                    {fields.filter(f => f.type === 'json-tree').map(field => (
                      <div key={field.key} class='field-container mb-2'>
                        <JsonTree 
                          data={field.value}
                          name={field.display}
                          maxInitialDepth={field.maxInitialDepth || 1}
                        />
                      </div>
                    ))}
                  </div>
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
          traceStartTime={traceStartTime}
        />
      )}
    </div>
  );
}