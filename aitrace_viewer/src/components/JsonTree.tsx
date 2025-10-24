import { useEffect, useRef, useState } from 'preact/hooks';
import { useExpandCollapseStore } from '../stores/expandCollapseStore';
import { CustomLensDialog } from './CustomLensDialog';
import { useCustomLensStore } from '../stores/customLensStore';
import { JsonContextMenu } from './JsonContextMenu';

interface JsonTreeProps {
  data: any;
  name?: string;       // Display name (can be capitalized)
  jsonKey?: string;    // Actual JSON key (for path building)
  depth?: number;
  maxInitialDepth?: number;
  pathPrefix?: string;
  eventName?: string;  // Event name for custom lens creation
  jsonPath?: string;   // Current JSON path for extraction
}

function tryParseJSON(value: any): any {
  if (typeof value !== 'string') return value;
  
  // Try to parse if it looks like JSON
  const trimmed = value.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard && (window as any).isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
  } catch {}
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-10000px';
  ta.style.top = '-10000px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

type CtxMenu = { open: boolean; x: number; y: number; jsonText: string; isPrimitive?: boolean; value?: any; jsonPath?: string };

function JsonValue({ value, name, jsonKey, depth = 0, maxInitialDepth = 0, pathPrefix = '', eventName = '', jsonPath = '' }: JsonTreeProps) {
  const { isExpanded: isExpandedInStore, toggleExpanded } = useExpandCollapseStore();
  const { addCustomField } = useCustomLensStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<CtxMenu>({ open: false, x: 0, y: 0, jsonText: '' });
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [dialogData, setDialogData] = useState<{ path: string; value: any } | null>(null);
  
  // Build unique path for this node (use display name for UI state)
  const nodePath = pathPrefix + (name ? `:${name}` : `:${depth}`);
  
  // Build JSON path for extraction (use actual JSON key, not display name)
  const keyForPath = jsonKey || name; // Use jsonKey if provided, otherwise fallback to name
  const currentJsonPath = keyForPath 
    ? (jsonPath ? `${jsonPath}.${keyForPath}` : keyForPath)  // Add dot only if jsonPath is not empty
    : jsonPath;
  
  // Check if expanded from store, default to collapsed
  const isExpanded = isExpandedInStore(nodePath);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCtx(c => ({ ...c, open: false }));
      }
    };
    window.addEventListener('click', onDocClick);
    window.addEventListener('scroll', onDocClick, true);
    return () => {
      window.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', onDocClick, true);
    };
  }, []);
  
  useEffect(() => {
    console.log('ctx state changed:', ctx);
  }, [ctx]);

  const onContextMenu = (e: Event, isPrimitive: boolean = false, primitiveValue?: any) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling to parent JSON nodes
    
    console.log('onContextMenu called!', { 
      isPrimitive, 
      currentJsonPath, 
      eventName,
      hasValue: primitiveValue !== undefined 
    });
    
    const text = (() => {
      try { 
        const val = primitiveValue !== undefined ? primitiveValue : tryParseJSON(value);
        return JSON.stringify(val, null, 2); 
      } catch { 
        return String(primitiveValue !== undefined ? primitiveValue : value); 
      }
    })();
    
    // Get mouse position from event
    const mouseEvent = e as MouseEvent;
    const x = mouseEvent.clientX || 0;
    const y = mouseEvent.clientY || 0;
    
    console.log('Setting ctx state:', { open: true, x, y, isPrimitive, jsonPath: currentJsonPath });
    
    setCtx({ 
      open: true, 
      x,
      y,
      jsonText: text,
      isPrimitive,
      value: primitiveValue !== undefined ? primitiveValue : value,
      jsonPath: currentJsonPath
    });
  };
  
  const handleCustomLensCreate = () => {
    if (ctx.jsonPath && ctx.value !== undefined) {
      setDialogData({ path: ctx.jsonPath, value: ctx.value });
      setShowCustomDialog(true);
      setCtx(c => ({ ...c, open: false }));
    }
  };
  
  const handleCustomLensConfirm = (data: { name: string; eventPattern: string; jsonPath: string }) => {
    console.log('handleCustomLensConfirm called', { data, dialogData });
    console.log('Creating custom field:', data);
    addCustomField({
      name: data.name,
      eventPattern: data.eventPattern,
      jsonPath: data.jsonPath
    });
    console.log('Custom field created successfully!');
    setShowCustomDialog(false);
    setDialogData(null);
  };
  
  // Try to parse stringified JSON
  const parsedValue = tryParseJSON(value);
  
  // Determine type and render accordingly
  if (parsedValue === null) {
    return (
      <>
        <span class='json-inline'>
          {name && <span class='json-key'>{name}: </span>}
          <span 
            class='json-null json-value-clickable'
            onContextMenu={(e) => onContextMenu(e, true, parsedValue)}
            title='Right-click for options'
          >null</span>
        </span>
        <JsonContextMenu
          isOpen={ctx.open}
          x={ctx.x}
          y={ctx.y}
          jsonText={ctx.jsonText}
          isPrimitive={ctx.isPrimitive}
          onCopyJson={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}
          onDownloadJson={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}
          onUseAsChip={ctx.isPrimitive ? handleCustomLensCreate : undefined}
          onClose={() => setCtx(c => ({ ...c, open: false }))}
        />
        <CustomLensDialog
          isOpen={showCustomDialog}
          jsonPath={dialogData?.path || ''}
          value={dialogData?.value}
          eventName={eventName}
          onConfirm={handleCustomLensConfirm}
          onCancel={() => { setShowCustomDialog(false); setDialogData(null); }}
        />
      </>
    );
  }
  
  if (parsedValue === undefined) {
    return (
      <>
        <span class='json-inline'>
          {name && <span class='json-key'>{name}: </span>}
          <span 
            class='json-undefined json-value-clickable'
            onContextMenu={(e) => onContextMenu(e, true, parsedValue)}
            title='Right-click for options'
          >undefined</span>
        </span>
        <JsonContextMenu
          isOpen={ctx.open}
          x={ctx.x}
          y={ctx.y}
          jsonText={ctx.jsonText}
          isPrimitive={ctx.isPrimitive}
          onCopyJson={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}
          onDownloadJson={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}
          onUseAsChip={ctx.isPrimitive ? handleCustomLensCreate : undefined}
          onClose={() => setCtx(c => ({ ...c, open: false }))}
        />
        <CustomLensDialog
          isOpen={showCustomDialog}
          jsonPath={dialogData?.path || ''}
          value={dialogData?.value}
          eventName={eventName}
          onConfirm={handleCustomLensConfirm}
          onCancel={() => { setShowCustomDialog(false); setDialogData(null); }}
        />
      </>
    );
  }
  
  if (typeof parsedValue === 'boolean') {
    return (
      <>
        <span class='json-inline'>
          {name && <span class='json-key'>{name}: </span>}
          <span 
            class='json-boolean json-value-clickable'
            onContextMenu={(e) => onContextMenu(e, true, parsedValue)}
            title='Right-click for options'
          >{parsedValue ? 'true' : 'false'}</span>
        </span>
        <JsonContextMenu
          isOpen={ctx.open}
          x={ctx.x}
          y={ctx.y}
          jsonText={ctx.jsonText}
          isPrimitive={ctx.isPrimitive}
          onCopyJson={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}
          onDownloadJson={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}
          onUseAsChip={ctx.isPrimitive ? handleCustomLensCreate : undefined}
          onClose={() => setCtx(c => ({ ...c, open: false }))}
        />
        <CustomLensDialog
          isOpen={showCustomDialog}
          jsonPath={dialogData?.path || ''}
          value={dialogData?.value}
          eventName={eventName}
          onConfirm={handleCustomLensConfirm}
          onCancel={() => { setShowCustomDialog(false); setDialogData(null); }}
        />
      </>
    );
  }
  
  if (typeof parsedValue === 'number') {
    return (
      <>
        <span class='json-inline'>
          {name && <span class='json-key'>{name}: </span>}
          <span 
            class='json-number json-value-clickable'
            onContextMenu={(e) => onContextMenu(e, true, parsedValue)}
            title='Right-click for options'
          >{parsedValue}</span>
        </span>
        <JsonContextMenu
          isOpen={ctx.open}
          x={ctx.x}
          y={ctx.y}
          jsonText={ctx.jsonText}
          isPrimitive={ctx.isPrimitive}
          onCopyJson={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}
          onDownloadJson={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}
          onUseAsChip={ctx.isPrimitive ? handleCustomLensCreate : undefined}
          onClose={() => setCtx(c => ({ ...c, open: false }))}
        />
        <CustomLensDialog
          isOpen={showCustomDialog}
          jsonPath={dialogData?.path || ''}
          value={dialogData?.value}
          eventName={eventName}
          onConfirm={handleCustomLensConfirm}
          onCancel={() => { setShowCustomDialog(false); setDialogData(null); }}
        />
      </>
    );
  }
  
  if (typeof parsedValue === 'string') {
    // Check if it's a very long string
    if (parsedValue.length > 100) {
      const longStringPath = nodePath + ':longstring';
      const showFull = isExpandedInStore(longStringPath);
      return (
        <>
          <span class='json-inline'>
            {name && <span class='json-key'>{name}: </span>}
            <span 
              class='json-string json-value-clickable' 
              onContextMenu={(e) => onContextMenu(e, true, parsedValue)}
              title='Right-click for options'
            >
              "{showFull ? parsedValue : parsedValue.substring(0, 100)}
              {!showFull && '...'}
              "
              <button 
                class='json-expand-text'
                onClick={() => toggleExpanded(longStringPath)}
              >
                {showFull ? 'less' : 'more'}
              </button>
            </span>
          </span>
          <JsonContextMenu
            isOpen={ctx.open}
            x={ctx.x}
            y={ctx.y}
            jsonText={ctx.jsonText}
            isPrimitive={ctx.isPrimitive}
            onCopyJson={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}
            onDownloadJson={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}
            onUseAsChip={ctx.isPrimitive ? handleCustomLensCreate : undefined}
            onClose={() => setCtx(c => ({ ...c, open: false }))}
          />
          <CustomLensDialog
            isOpen={showCustomDialog}
            jsonPath={dialogData?.path || ''}
            value={dialogData?.value}
            eventName={eventName}
            onConfirm={handleCustomLensConfirm}
            onCancel={() => { setShowCustomDialog(false); setDialogData(null); }}
          />
        </>
      );
    }
    return (
      <>
        <span class='json-inline'>
          {name && <span class='json-key'>{name}: </span>}
          <span 
            class='json-string json-value-clickable' 
            onContextMenu={(e) => onContextMenu(e, true, parsedValue)}
            title='Right-click for options'
          >"{parsedValue}"</span>
        </span>
        <JsonContextMenu
          isOpen={ctx.open}
          x={ctx.x}
          y={ctx.y}
          jsonText={ctx.jsonText}
          isPrimitive={ctx.isPrimitive}
          onCopyJson={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}
          onDownloadJson={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}
          onUseAsChip={ctx.isPrimitive ? handleCustomLensCreate : undefined}
          onClose={() => setCtx(c => ({ ...c, open: false }))}
        />
        <CustomLensDialog
          isOpen={showCustomDialog}
          jsonPath={dialogData?.path || ''}
          value={dialogData?.value}
          eventName={eventName}
          onConfirm={handleCustomLensConfirm}
          onCancel={() => { setShowCustomDialog(false); setDialogData(null); }}
        />
      </>
    );
  }
  
  if (Array.isArray(parsedValue)) {
    if (parsedValue.length === 0) {
      return (
        <span class='json-inline'>
          {name && <span class='json-key'>{name}: </span>}
          <span class='json-bracket'>[]</span>
        </span>
      );
    }
    
    // Check if array is simple and short enough for inline display
    const isSimpleArray = parsedValue.every(item => 
      typeof item !== 'object' || item === null
    );
    const inlineStr = isSimpleArray && parsedValue.length <= 5
      ? parsedValue.map(v => 
          v === null ? 'null' : 
          typeof v === 'string' ? `"${v}"` : 
          String(v)
        ).join(', ')
      : null;
    const fitsInline = inlineStr && inlineStr.length < 60;
    
    return (
      <div class='json-array-container' onContextMenu={onContextMenu}>
        <div class='json-toggle-line'>
          <span class='json-toggle-icon' onClick={() => toggleExpanded(nodePath)}>
            <i class={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}></i>
          </span>
          <span class='json-inline-content'>
            {name && <span class='json-key'>{name}: </span>}
            <span class='json-bracket'>[</span>
            {!isExpanded && fitsInline && <span class='json-inline-items'>{inlineStr}</span>}
            {!isExpanded && !fitsInline && <span class='json-preview'>{parsedValue.length} items</span>}
            {!isExpanded && <span class='json-bracket'>]</span>}
          </span>
        </div>
        {isExpanded && (
          <div class='json-array-items'>
            {parsedValue.map((item, index) => (
              <div key={index} class='json-item'>
                <JsonValue 
                  value={item} 
                  depth={depth + 1} 
                  maxInitialDepth={maxInitialDepth}
                  pathPrefix={nodePath + `:[${index}]`}
                  eventName={eventName}
                  jsonPath={currentJsonPath + `[${index}]`}
                />
              </div>
            ))}
            <span class='json-bracket'>]</span>
          </div>
        )}
        <JsonContextMenu
          isOpen={ctx.open}
          x={ctx.x}
          y={ctx.y}
          jsonText={ctx.jsonText}
          isPrimitive={ctx.isPrimitive}
          onCopyJson={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}
          onDownloadJson={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}
          onUseAsChip={ctx.isPrimitive ? handleCustomLensCreate : undefined}
          onClose={() => setCtx(c => ({ ...c, open: false }))}
        />
        <CustomLensDialog
          isOpen={showCustomDialog}
          jsonPath={dialogData?.path || ''}
          value={dialogData?.value}
          eventName={eventName}
          onConfirm={handleCustomLensConfirm}
          onCancel={() => { setShowCustomDialog(false); setDialogData(null); }}
        />
      </div>
    );
  }
  
  if (typeof parsedValue === 'object') {
    const entries = Object.entries(parsedValue);
    if (entries.length === 0) {
      return (
        <span class='json-inline'>
          {name && <span class='json-key'>{name}: </span>}
          <span class='json-bracket'>{'{}'}</span>
        </span>
      );
    }
    
    // Check if object is simple and short enough for inline display
    const isSimpleObject = entries.every(([k, v]) => 
      typeof v !== 'object' || v === null
    );
    const inlineStr = isSimpleObject && entries.length <= 3
      ? entries.map(([k, v]) => {
          const valStr = v === null ? 'null' : 
                        typeof v === 'string' ? `"${v}"` : 
                        String(v);
          return `${k}: ${valStr}`;
        }).join(', ')
      : null;
    const fitsInline = inlineStr && inlineStr.length < 60;
    
    return (
      <div class='json-object-container' onContextMenu={onContextMenu}>
        <div class='json-toggle-line'>
          <span class='json-toggle-icon' onClick={() => toggleExpanded(nodePath)}>
            <i class={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}></i>
          </span>
          <span class='json-inline-content'>
            {name && <span class='json-key'>{name}: </span>}
            <span class='json-bracket'>{'{'}</span>
            {!isExpanded && fitsInline && <span class='json-inline-items'>{inlineStr}</span>}
            {!isExpanded && !fitsInline && <span class='json-preview'>{entries.length} props</span>}
            {!isExpanded && <span class='json-bracket'>{'}'}</span>}
          </span>
        </div>
        {isExpanded && (
          <div class='json-object-items'>
            {entries.map(([key, val]) => (
              <div key={key} class='json-property'>
                <JsonValue 
                  name={key}
                  jsonKey={key}  // Pass actual JSON key for path building
                  value={val} 
                  depth={depth + 1} 
                  maxInitialDepth={maxInitialDepth}
                  pathPrefix={nodePath}
                  eventName={eventName}
                  jsonPath={currentJsonPath}
                />
              </div>
            ))}
            <span class='json-bracket'>{'}'}</span>
          </div>
        )}
        <JsonContextMenu
          isOpen={ctx.open}
          x={ctx.x}
          y={ctx.y}
          jsonText={ctx.jsonText}
          isPrimitive={ctx.isPrimitive}
          onCopyJson={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}
          onDownloadJson={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}
          onUseAsChip={ctx.isPrimitive ? handleCustomLensCreate : undefined}
          onClose={() => setCtx(c => ({ ...c, open: false }))}
        />
        {/* Dialog is shared, only render once at top level */}
      </div>
    );
  }
  
  // Fallback
  return (
    <span class='json-inline'>
      {name && <span class='json-key'>{name}: </span>}
      <span class='json-unknown'>{String(parsedValue)}</span>
    </span>
  );
}

export function JsonTree({ data, name, jsonKey, depth = 0, maxInitialDepth = 0, pathPrefix = '', eventName = '', jsonPath = '' }: JsonTreeProps) {
  return (
    <div class='json-tree'>
      <JsonValue 
        value={data} 
        name={name}
        jsonKey={jsonKey}  // Pass through jsonKey
        depth={depth} 
        maxInitialDepth={maxInitialDepth}
        pathPrefix={pathPrefix}
        eventName={eventName}
        jsonPath={jsonPath}
      />
    </div>
  );
}

