/**
 * Density settings for node spacing/padding
 */

export type DensityMode = 'compact' | 'cozy' | 'comfortable';

export interface DensitySettings {
  mode: DensityMode;
}

const STORAGE_KEY = 'aitrace-density-settings';

const DEFAULT_SETTINGS: DensitySettings = {
  mode: 'comfortable'
};

export function loadDensitySettings(): DensitySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Failed to load density settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveDensitySettings(settings: DensitySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save density settings:', error);
  }
}

/**
 * Get CSS class name for density mode
 */
export function getDensityClass(mode: DensityMode): string {
  return `density-${mode}`;
}

/**
 * Get padding values for density mode
 */
export function getDensityPadding(mode: DensityMode): { vertical: string; horizontal: string } {
  switch (mode) {
    case 'compact':
      return { vertical: '0px', horizontal: '0.125rem' };
    case 'cozy':
      return { vertical: '0.125rem', horizontal: '0.375rem' };
    case 'comfortable':
    default:
      return { vertical: '0.25rem', horizontal: '0.5rem' };
  }
}

/**
 * Get margin values for density mode
 */
export function getDensityMargin(mode: DensityMode): string {
  switch (mode) {
    case 'compact':
      return '0px 0';
    case 'cozy':
      return '0.0625rem 0';
    case 'comfortable':
    default:
      return '0.125rem 0';
  }
}

