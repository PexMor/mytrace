import { useState, useRef, useEffect } from 'preact/hooks';
import type { DensitySettings, DensityMode } from '../utils/densitySettings';

interface DensitySettingsPanelProps {
  settings: DensitySettings;
  onSettingsChange: (settings: DensitySettings) => void;
}

export function DensitySettingsPanel({ settings, onSettingsChange }: DensitySettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleModeChange = (mode: DensityMode) => {
    onSettingsChange({ ...settings, mode });
    setIsOpen(false);
  };

  const densityLabels: Record<DensityMode, string> = {
    compact: 'Compact',
    cozy: 'Cozy',
    comfortable: 'Comfortable'
  };

  const densityIcons: Record<DensityMode, string> = {
    compact: 'bi-layout-text-window',
    cozy: 'bi-layout-text-window-reverse',
    comfortable: 'bi-layout-split'
  };

  return (
    <div class='density-settings-container' ref={panelRef}>
      <button
        class='btn btn-outline-secondary btn-sm'
        onClick={() => setIsOpen(!isOpen)}
        title='Adjust spacing/density'
      >
        <i class={`bi ${densityIcons[settings.mode]} me-1`}></i>
        {densityLabels[settings.mode]}
      </button>

      {isOpen && (
        <div class='density-settings-panel'>
          <h6 class='mb-3'>Spacing Density</h6>
          
          <div class='setting-group'>
            <label class='setting-label'>View Density</label>
            <div class='btn-group-vertical w-100' role='group'>
              {(['compact', 'cozy', 'comfortable'] as DensityMode[]).map(mode => (
                <button
                  key={mode}
                  type='button'
                  class={`btn btn-sm ${settings.mode === mode ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => handleModeChange(mode)}
                >
                  <i class={`bi ${densityIcons[mode]} me-2`}></i>
                  {densityLabels[mode]}
                  {mode === 'compact' && <small class='d-block text-muted' style={{ fontSize: '0.7rem' }}>Zero padding</small>}
                  {mode === 'cozy' && <small class='d-block text-muted' style={{ fontSize: '0.7rem' }}>Minimal spacing</small>}
                  {mode === 'comfortable' && <small class='d-block text-muted' style={{ fontSize: '0.7rem' }}>Default spacing</small>}
                </button>
              ))}
            </div>
          </div>

          <div class='mt-3 p-2 bg-light rounded'>
            <small class='text-muted'>
              <i class='bi bi-info-circle me-1'></i>
              Adjust the vertical spacing between nodes for your preference.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}

