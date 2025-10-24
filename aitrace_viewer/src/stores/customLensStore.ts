import { create } from 'zustand';

/**
 * Store for custom user-defined lens transformations
 * Allows users to extract nested values and display them as chips
 */

export interface CustomLensField {
  id: string;                    // Unique ID
  name: string;                  // Display name (e.g., "my-value")
  eventPattern: string;          // Event pattern to match (e.g., "llm_end")
  jsonPath: string;              // JSON path to extract (e.g., "l1.l2.l3.a[0]")
  createdAt: number;             // Timestamp
}

interface CustomLensState {
  customFields: CustomLensField[];
  
  // Actions
  addCustomField: (field: Omit<CustomLensField, 'id' | 'createdAt'>) => void;
  updateCustomField: (id: string, updates: Partial<CustomLensField>) => void;
  deleteCustomField: (id: string) => void;
  getFieldsForEvent: (eventName: string) => CustomLensField[];
  exportCustomFields: () => string;
  importCustomFields: (json: string) => void;
  loadFromIndexedDB: () => Promise<void>;
  saveToIndexedDB: () => Promise<void>;
}

const DB_NAME = 'aitrace-viewer';
const STORE_NAME = 'custom-lenses';
const DB_VERSION = 2; // Increment version to add new store

// IndexedDB helpers
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create expand-collapse store if it doesn't exist (from previous version)
      if (!db.objectStoreNames.contains('expand-collapse-state')) {
        db.createObjectStore('expand-collapse-state');
      }
      
      // Create custom-lenses store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function loadCustomFieldsFromDB(): Promise<CustomLensField[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('customFields');
      
      request.onsuccess = () => {
        resolve(request.result || []);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load custom fields from IndexedDB:', error);
    return [];
  }
}

async function saveCustomFieldsToDB(fields: CustomLensField[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(fields, 'customFields');
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save custom fields to IndexedDB:', error);
  }
}

/**
 * Extract value from object using JSON path
 * Supports dot notation and array indices: "l1.l2.l3.a[0]"
 */
export function extractValueByPath(obj: any, path: string): any {
  try {
    console.log('extractValueByPath: Starting extraction');
    console.log('extractValueByPath: Object keys at root:', Object.keys(obj || {}));
    console.log('extractValueByPath: Path:', path);
    
    const parts = path.split(/\.|\[|\]/).filter(p => p !== '');
    console.log('extractValueByPath: Path parts:', parts);
    
    let current = obj;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log(`extractValueByPath: Step ${i}: accessing "${part}" in:`, typeof current, Array.isArray(current) ? `Array(${current.length})` : '');
      
      if (current === null || current === undefined) {
        console.log(`extractValueByPath: Current is null/undefined at step ${i}, returning undefined`);
        return undefined;
      }
      
      if (typeof current === 'object') {
        console.log(`extractValueByPath: Available keys:`, Object.keys(current));
      }
      
      current = current[part];
      console.log(`extractValueByPath: After accessing "${part}":`, typeof current, current === undefined ? 'UNDEFINED!' : '');
    }
    
    console.log('extractValueByPath: Final value:', current);
    return current;
  } catch (error) {
    console.error('Failed to extract value by path:', path, error);
    return undefined;
  }
}

export const useCustomLensStore = create<CustomLensState>((set, get) => ({
  customFields: [],
  
  addCustomField: (field) => {
    console.log('customLensStore.addCustomField called with:', field);
    const newField: CustomLensField = {
      ...field,
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now()
    };
    console.log('Created new custom field:', newField);
    
    const customFields = [...get().customFields, newField];
    set({ customFields });
    console.log('Updated customFields:', customFields);
    get().saveToIndexedDB();
  },
  
  updateCustomField: (id, updates) => {
    const customFields = get().customFields.map(field =>
      field.id === id ? { ...field, ...updates } : field
    );
    set({ customFields });
    get().saveToIndexedDB();
  },
  
  deleteCustomField: (id) => {
    const customFields = get().customFields.filter(field => field.id !== id);
    set({ customFields });
    get().saveToIndexedDB();
  },
  
  getFieldsForEvent: (eventName) => {
    const allFields = get().customFields;
    console.log('customLensStore.getFieldsForEvent: Looking for event', eventName, 'in', allFields.length, 'custom fields');
    
    const matches = allFields.filter(field => {
      try {
        const regex = new RegExp(field.eventPattern, 'i');
        const matched = regex.test(eventName);
        console.log(`customLensStore.getFieldsForEvent: Pattern "${field.eventPattern}" ${matched ? 'MATCHES' : 'does not match'} event "${eventName}"`);
        return matched;
      } catch {
        const matched = field.eventPattern.toLowerCase() === eventName.toLowerCase();
        console.log(`customLensStore.getFieldsForEvent: Exact match "${field.eventPattern}" ${matched ? 'MATCHES' : 'does not match'} event "${eventName}"`);
        return matched;
      }
    });
    
    console.log('customLensStore.getFieldsForEvent: Returning', matches.length, 'matching fields');
    return matches;
  },
  
  exportCustomFields: () => {
    const { customFields } = get();
    return JSON.stringify(customFields, null, 2);
  },
  
  importCustomFields: (json) => {
    try {
      const imported = JSON.parse(json);
      if (Array.isArray(imported)) {
        set({ customFields: imported });
        get().saveToIndexedDB();
      }
    } catch (error) {
      console.error('Failed to import custom fields:', error);
      throw new Error('Invalid JSON format');
    }
  },
  
  loadFromIndexedDB: async () => {
    const customFields = await loadCustomFieldsFromDB();
    set({ customFields });
  },
  
  saveToIndexedDB: async () => {
    const { customFields } = get();
    await saveCustomFieldsToDB(customFields);
  },
}));

