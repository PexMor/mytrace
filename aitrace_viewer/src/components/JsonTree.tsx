import { useEffect, useRef, useState } from 'preact/hooks';

interface JsonTreeProps {
  data: any;
  name?: string;
  depth?: number;
  maxInitialDepth?: number;
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

type CtxMenu = { open: boolean; x: number; y: number; jsonText: string };

function JsonValue({ value, name, depth = 0, maxInitialDepth = 2 }: JsonTreeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < maxInitialDepth);
  const [ctx, setCtx] = useState<CtxMenu>({ open: false, x: 0, y: 0, jsonText: '' });
  const menuRef = useRef<HTMLDivElement>(null);

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

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const text = (() => {
      try { return JSON.stringify(tryParseJSON(value), null, 2); } catch { return String(value); }
    })();
    const anyE: any = e;
    setCtx({ open: true, x: anyE.clientX || 0, y: anyE.clientY || 0, jsonText: text });
  };
  
  // Try to parse stringified JSON
  const parsedValue = tryParseJSON(value);
  
  // Determine type and render accordingly
  if (parsedValue === null) {
    return <span class='json-null'>null</span>;
  }
  
  if (parsedValue === undefined) {
    return <span class='json-undefined'>undefined</span>;
  }
  
  if (typeof parsedValue === 'boolean') {
    return <span class='json-boolean'>{parsedValue ? 'true' : 'false'}</span>;
  }
  
  if (typeof parsedValue === 'number') {
    return <span class='json-number'>{parsedValue}</span>;
  }
  
  if (typeof parsedValue === 'string') {
    // Check if it's a very long string
    if (parsedValue.length > 100) {
      const [showFull, setShowFull] = useState(false);
      return (
        <span class='json-string'>
          "{showFull ? parsedValue : parsedValue.substring(0, 100)}
          {!showFull && '...'}
          "
          <button 
            class='json-expand-text'
            onClick={() => setShowFull(!showFull)}
          >
            {showFull ? 'less' : 'more'}
          </button>
        </span>
      );
    }
    return <span class='json-string'>"{parsedValue}"</span>;
  }
  
  if (Array.isArray(parsedValue)) {
    if (parsedValue.length === 0) {
      return <span class='json-array'>[]</span>;
    }
    
    return (
      <div class='json-array-container' onContextMenu={onContextMenu}>
        <span class='json-toggle compact' onClick={() => setIsExpanded(!isExpanded)}>
          <i class={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}></i>
          {name && <span class='json-key'>{name}: </span>}
          <span class='json-bracket'>[</span>
          {!isExpanded && <span class='json-preview'>{parsedValue.length} items</span>}
          {!isExpanded && <span class='json-bracket'>]</span>}
        </span>
        {isExpanded && (
          <div class='json-array-items compact'>
            {parsedValue.map((item, index) => (
              <div key={index} class='json-item'>
                <JsonValue value={item} depth={depth + 1} maxInitialDepth={maxInitialDepth} />
              </div>
            ))}
            <span class='json-bracket'>]</span>
          </div>
        )}
        {ctx.open && (
          <div ref={menuRef} class='json-context-menu' style={{ top: ctx.y + 'px', left: ctx.x + 'px' }}>
            <button class='menu-item' onClick={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}>Copy JSON</button>
            <button class='menu-item' onClick={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}>Download JSON</button>
          </div>
        )}
      </div>
    );
  }
  
  if (typeof parsedValue === 'object') {
    const entries = Object.entries(parsedValue);
    if (entries.length === 0) {
      return <span class='json-object'>{'{}'}</span>;
    }
    
    return (
      <div class='json-object-container' onContextMenu={onContextMenu}>
        <span class='json-toggle compact' onClick={() => setIsExpanded(!isExpanded)}>
          <i class={`bi bi-chevron-${isExpanded ? 'down' : 'right'}`}></i>
          {name && <span class='json-key'>{name}: </span>}
          <span class='json-bracket'>{'{'}</span>
          {!isExpanded && <span class='json-preview'>{entries.length} props</span>}
          {!isExpanded && <span class='json-bracket'>{'}'}</span>}
        </span>
        {isExpanded && (
          <div class='json-object-items compact'>
            {entries.map(([key, val]) => (
              <div key={key} class='json-property'>
                <span class='json-key'>{key}:</span>
                <JsonValue value={val} depth={depth + 1} maxInitialDepth={maxInitialDepth} />
              </div>
            ))}
            <span class='json-bracket'>{'}'}</span>
          </div>
        )}
        {ctx.open && (
          <div ref={menuRef} class='json-context-menu' style={{ top: ctx.y + 'px', left: ctx.x + 'px' }}>
            <button class='menu-item' onClick={() => { copyToClipboard(ctx.jsonText); setCtx(c => ({ ...c, open: false })); }}>Copy JSON</button>
            <button class='menu-item' onClick={() => { const blob = new Blob([ctx.jsonText], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click(); setCtx(c => ({ ...c, open: false })); }}>Download JSON</button>
          </div>
        )}
      </div>
    );
  }
  
  // Fallback
  return <span class='json-unknown'>{String(parsedValue)}</span>;
}

export function JsonTree({ data, name, depth = 0, maxInitialDepth = 2 }: JsonTreeProps) {
  return (
    <div class='json-tree'>
      <JsonValue value={data} name={name} depth={depth} maxInitialDepth={maxInitialDepth} />
    </div>
  );
}

