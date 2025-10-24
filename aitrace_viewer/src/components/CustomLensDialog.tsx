import { useState, useRef, useEffect } from 'preact/hooks';

interface CustomLensDialogProps {
  isOpen: boolean;
  jsonPath?: string;
  value?: any;
  eventName?: string;
  initialData?: {
    name: string;
    eventPattern: string;
    jsonPath: string;
  };
  onConfirm: (data: { name: string; eventPattern: string; jsonPath: string }) => void;
  onCancel: () => void;
}

export function CustomLensDialog({ 
  isOpen, 
  jsonPath, 
  value, 
  eventName, 
  initialData,
  onConfirm, 
  onCancel 
}: CustomLensDialogProps) {
  const [name, setName] = useState('');
  const [eventPattern, setEventPattern] = useState('');
  const [path, setPath] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const isEditMode = !!initialData;
  
  useEffect(() => {
    console.log('CustomLensDialog: isOpen changed', isOpen);
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      
      if (initialData) {
        // Edit mode - pre-fill with existing data
        setName(initialData.name);
        setEventPattern(initialData.eventPattern);
        setPath(initialData.jsonPath);
      } else if (jsonPath) {
        // Create mode - suggest name from path
        const suggestedName = jsonPath.split(/\.|\[/).pop()?.replace(/\]/, '') || 'custom-value';
        console.log('CustomLensDialog: Setting suggested name', suggestedName);
        setName(suggestedName);
        setEventPattern(eventName || '.*'); // Default to match all if no event name
        setPath(jsonPath);
      }
    }
  }, [isOpen, jsonPath, eventName, initialData]);
  
  if (!isOpen) {
    console.log('CustomLensDialog: Not rendering (isOpen=false)');
    return null;
  }
  
  console.log('CustomLensDialog: Rendering dialog', { name, eventPattern, path });
  
  const handleSubmit = (e: Event) => {
    e.preventDefault();
    console.log('CustomLensDialog: Form submitted', { name: name.trim(), eventPattern: eventPattern.trim(), path });
    if (name.trim() && path.trim()) {
      console.log('CustomLensDialog: Calling onConfirm');
      onConfirm({
        name: name.trim(),
        eventPattern: eventPattern.trim(),
        jsonPath: path.trim()
      });
    } else {
      console.log('CustomLensDialog: Name or path is empty, not calling onConfirm');
    }
  };
  
  const valuePreview = typeof value === 'string' 
    ? `"${value}"` 
    : JSON.stringify(value);
  
  return (
    <div class='custom-lens-dialog-backdrop' onClick={onCancel}>
      <div class='custom-lens-dialog' onClick={(e) => e.stopPropagation()}>
        <div class='custom-lens-dialog-header'>
          <h5>{isEditMode ? 'Edit Custom Chip' : 'Create Custom Chip'}</h5>
          <button class='btn-close' onClick={onCancel}></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div class='custom-lens-dialog-body'>
            <div class='mb-3'>
              <label class='form-label small fw-bold'>JSON Path</label>
              <input 
                type='text' 
                class='form-control form-control-sm' 
                value={path}
                onInput={(e) => setPath((e.target as HTMLInputElement).value)}
                disabled={!isEditMode}
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
              />
            </div>
            
            {!isEditMode && value !== undefined && (
              <div class='mb-3'>
                <label class='form-label small fw-bold'>Current Value</label>
                <input 
                  type='text' 
                  class='form-control form-control-sm' 
                  value={valuePreview}
                  disabled
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
              </div>
            )}
            
            <div class='mb-3'>
              <label class='form-label small fw-bold'>
                Chip Name <span class='text-danger'>*</span>
              </label>
              <input 
                ref={inputRef}
                type='text' 
                class='form-control form-control-sm' 
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder='e.g., temperature, max-tokens, my-value'
                required
              />
              <small class='text-muted'>This name will appear as a badge: [Chip Name: value]</small>
            </div>
            
            <div class='mb-3'>
              <label class='form-label small fw-bold'>Event Pattern</label>
              <div class='input-group input-group-sm mb-2'>
                <input 
                  type='text' 
                  class='form-control' 
                  value={eventPattern}
                  onInput={(e) => setEventPattern((e.target as HTMLInputElement).value)}
                  placeholder='e.g., llm_end or llm_.*'
                  style={{ fontFamily: 'monospace' }}
                />
                <button 
                  type='button'
                  class={`btn btn-outline-secondary ${useRegex ? 'active' : ''}`}
                  onClick={() => setUseRegex(!useRegex)}
                  title='Toggle regex mode'
                >
                  .*
                </button>
              </div>
              <small class='text-muted'>
                {useRegex 
                  ? 'Regex pattern to match event names (e.g., llm_.* matches llm_start, llm_end)'
                  : 'Exact event name to match (will be converted to case-insensitive match)'
                }
              </small>
            </div>
            
            <div class='alert alert-info py-2 px-3' style={{ fontSize: '0.8rem' }}>
              <i class='bi bi-info-circle me-2'></i>
              This chip will appear inline for all events matching "{eventPattern}"
            </div>
          </div>
          
          <div class='custom-lens-dialog-footer'>
            <button type='button' class='btn btn-sm btn-secondary' onClick={onCancel}>
              Cancel
            </button>
            <button type='submit' class='btn btn-sm btn-primary' disabled={!name.trim() || !path.trim()}>
              <i class={`bi ${isEditMode ? 'bi-check-circle' : 'bi-plus-circle'} me-1`}></i>
              {isEditMode ? 'Save Changes' : 'Create Chip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

