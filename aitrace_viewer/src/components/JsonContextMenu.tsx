import { useRef, useEffect } from 'preact/hooks';

interface JsonContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  jsonText: string;
  isPrimitive?: boolean;
  onCopyJson: () => void;
  onDownloadJson: () => void;
  onUseAsChip?: () => void;
  onClose: () => void;
}

export function JsonContextMenu({
  isOpen,
  x,
  y,
  jsonText,
  isPrimitive = false,
  onCopyJson,
  onDownloadJson,
  onUseAsChip,
  onClose
}: JsonContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    console.log('JsonContextMenu render state:', { isOpen, isPrimitive, hasUseAsChip: !!onUseAsChip });
  }, [isOpen, isPrimitive, onUseAsChip]);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);
  
  if (!isOpen) {
    console.log('JsonContextMenu: not rendering (isOpen=false)');
    return null;
  }
  
  console.log('JsonContextMenu: rendering menu at', { x, y });
  
  return (
    <div 
      ref={menuRef} 
      class='json-context-menu' 
      style={{ top: y + 'px', left: x + 'px' }}
    >
      <button class='menu-item' onClick={onCopyJson}>
        <i class='bi bi-clipboard me-2'></i>
        Copy Value
      </button>
      <button class='menu-item' onClick={onDownloadJson}>
        <i class='bi bi-download me-2'></i>
        Download JSON
      </button>
      {isPrimitive && onUseAsChip && (
        <>
          <div class='menu-divider'></div>
          <button class='menu-item menu-item-primary' onClick={onUseAsChip}>
            <i class='bi bi-star me-2'></i>
            Use as Chip
          </button>
        </>
      )}
    </div>
  );
}

