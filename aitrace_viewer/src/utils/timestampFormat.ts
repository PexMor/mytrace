export type TimestampMode = 'relative' | 'time' | 'full' | 'hidden';

export interface TimestampSettings {
  mode: TimestampMode;
  decimalPlaces: number; // for relative mode
  forceEnUS: boolean; // for time/full mode
  showInNodes: boolean; // show timestamps in node rows
}

export const DEFAULT_TIMESTAMP_SETTINGS: TimestampSettings = {
  mode: 'full',
  decimalPlaces: 3,
  forceEnUS: false,
  showInNodes: true
};

export function formatTimestamp(
  timestamp: string | null | undefined,
  settings: TimestampSettings,
  traceStartTime?: string
): string {
  if (!timestamp || settings.mode === 'hidden') return '';
  
  try {
    const date = new Date(timestamp);
    
    switch (settings.mode) {
      case 'relative': {
        if (!traceStartTime) return timestamp;
        const start = new Date(traceStartTime).getTime();
        const current = date.getTime();
        const diffSeconds = (current - start) / 1000;
        const sign = diffSeconds >= 0 ? '+' : '';
        return `${sign}${diffSeconds.toFixed(settings.decimalPlaces)}s`;
      }
      
      case 'time': {
        const locale = settings.forceEnUS ? 'en-US' : undefined;
        return date.toLocaleString(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        });
      }
      
      case 'full': {
        const locale = settings.forceEnUS ? 'en-US' : undefined;
        return date.toLocaleString(locale, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3
        });
      }
      
      default:
        return timestamp;
    }
  } catch {
    return timestamp;
  }
}

export function loadTimestampSettings(): TimestampSettings {
  try {
    const saved = localStorage.getItem('aitrace_timestamp_settings');
    if (saved) {
      return { ...DEFAULT_TIMESTAMP_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load timestamp settings:', e);
  }
  return DEFAULT_TIMESTAMP_SETTINGS;
}

export function saveTimestampSettings(settings: TimestampSettings): void {
  try {
    localStorage.setItem('aitrace_timestamp_settings', JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save timestamp settings:', e);
  }
}

