import { useState } from 'preact/hooks';
import type { TimestampSettings, TimestampMode } from '../utils/timestampFormat';

interface TimestampSettingsProps {
  settings: TimestampSettings;
  onSettingsChange: (settings: TimestampSettings) => void;
}

export function TimestampSettingsPanel({ settings, onSettingsChange }: TimestampSettingsProps) {
  const [expanded, setExpanded] = useState(false);

  function handleModeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    onSettingsChange({ ...settings, mode: select.value as TimestampMode });
  }

  function handleDecimalChange(e: Event) {
    const input = e.target as HTMLInputElement;
    onSettingsChange({ ...settings, decimalPlaces: parseInt(input.value, 10) });
  }

  function handleLocaleToggle() {
    onSettingsChange({ ...settings, forceEnUS: !settings.forceEnUS });
  }

  function handleShowInNodesToggle() {
    onSettingsChange({ ...settings, showInNodes: !settings.showInNodes });
  }

  return (
    <div class='timestamp-settings-container'>
      <button
        class='btn btn-outline-secondary btn-sm'
        onClick={() => setExpanded(!expanded)}
        type='button'
      >
        <i class='bi bi-clock-history me-1'></i>
        Timestamp Format
        <i class={`bi bi-chevron-${expanded ? 'up' : 'down'} ms-1`}></i>
      </button>

      {expanded && (
        <div class='timestamp-settings-panel'>
          <div class='setting-group'>
            <label class='setting-label'>
              <i class='bi bi-layout-text-window me-1'></i>
              Display Mode:
            </label>
            <select 
              class='form-select form-select-sm'
              value={settings.mode}
              onChange={handleModeChange}
            >
              <option value='full'>Full Date & Time</option>
              <option value='time'>Time Only</option>
              <option value='relative'>Relative to Start</option>
              <option value='hidden'>Hidden</option>
            </select>
            <small class='text-muted setting-hint'>
              {settings.mode === 'full' && 'Oct 24, 10:31:44.917 AM'}
              {settings.mode === 'time' && '10:31:44.917 AM'}
              {settings.mode === 'relative' && '+1.857s'}
              {settings.mode === 'hidden' && 'Timestamps hidden'}
            </small>
          </div>

          {settings.mode === 'relative' && (
            <div class='setting-group'>
              <label class='setting-label'>
                <i class='bi bi-dash-circle me-1'></i>
                Decimal Places:
              </label>
              <input
                type='number'
                class='form-control form-control-sm'
                value={settings.decimalPlaces}
                min='0'
                max='6'
                onChange={handleDecimalChange}
              />
              <small class='text-muted setting-hint'>
                Example: +{(1.857123).toFixed(settings.decimalPlaces)}s
              </small>
            </div>
          )}

          {(settings.mode === 'time' || settings.mode === 'full') && (
            <div class='setting-group'>
              <label class='setting-checkbox'>
                <input
                  type='checkbox'
                  class='form-check-input me-2'
                  checked={settings.forceEnUS}
                  onChange={handleLocaleToggle}
                />
                <span>Force en-US locale</span>
              </label>
              <small class='text-muted setting-hint'>
                {settings.forceEnUS 
                  ? 'Using US format (AM/PM, MM/DD)' 
                  : 'Using browser locale'}
              </small>
            </div>
          )}

          <div class='setting-group'>
            <label class='setting-checkbox'>
              <input
                type='checkbox'
                class='form-check-input me-2'
                checked={settings.showInNodes}
                onChange={handleShowInNodesToggle}
              />
              <span>Show timestamps in log entries</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

