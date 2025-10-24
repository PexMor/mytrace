import { create } from 'zustand';

/**
 * Store for tracking expand/collapse state of nodes
 * State is persisted to IndexedDB and keyed by document hash
 */

interface ExpandCollapseState {
  // Current document hash
  currentDocHash: string | null;
  
  // Map of document hash -> node ID -> expanded state
  // Node IDs are: span:{span_id}, log:{span_id}:{log_index}, json:{path}
  expandedState: Record<string, Record<string, boolean>>;
  
  // Actions
  setDocumentHash: (hash: string) => void;
  isExpanded: (nodeId: string) => boolean;
  setExpanded: (nodeId: string, expanded: boolean) => void;
  toggleExpanded: (nodeId: string) => void;
  clearCurrentDocState: () => void;
  clearAllState: () => void;
  loadFromIndexedDB: () => Promise<void>;
  saveToIndexedDB: () => Promise<void>;
}

const DB_NAME = 'aitrace-viewer';
const STORE_NAME = 'expand-collapse-state';
const DB_VERSION = 2; // Updated to match customLensStore

// IndexedDB helpers
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Create expand-collapse store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      // Create custom-lenses store (for customLensStore)
      if (!db.objectStoreNames.contains('custom-lenses')) {
        db.createObjectStore('custom-lenses');
      }
    };
  });
}

async function loadStateFromDB(): Promise<Record<string, Record<string, boolean>>> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('expandedState');
      
      request.onsuccess = () => {
        resolve(request.result || {});
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to load state from IndexedDB:', error);
    return {};
  }
}

async function saveStateToDB(state: Record<string, Record<string, boolean>>): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(state, 'expandedState');
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to save state to IndexedDB:', error);
  }
}

export const useExpandCollapseStore = create<ExpandCollapseState>((set, get) => ({
  currentDocHash: null,
  expandedState: {},
  
  setDocumentHash: async (hash: string) => {
    const state = get();
    
    // Load from IndexedDB if not already loaded
    if (Object.keys(state.expandedState).length === 0) {
      await get().loadFromIndexedDB();
    }
    
    set({ currentDocHash: hash });
  },
  
  isExpanded: (nodeId: string): boolean => {
    const { currentDocHash, expandedState } = get();
    if (!currentDocHash) return false;
    return expandedState[currentDocHash]?.[nodeId] ?? false;
  },
  
  setExpanded: (nodeId: string, expanded: boolean) => {
    const { currentDocHash, expandedState } = get();
    if (!currentDocHash) return;
    
    const docState = expandedState[currentDocHash] || {};
    const newDocState = { ...docState, [nodeId]: expanded };
    const newExpandedState = { ...expandedState, [currentDocHash]: newDocState };
    
    set({ expandedState: newExpandedState });
    
    // Debounced save to IndexedDB
    get().saveToIndexedDB();
  },
  
  toggleExpanded: (nodeId: string) => {
    const { isExpanded, setExpanded } = get();
    setExpanded(nodeId, !isExpanded(nodeId));
  },
  
  clearCurrentDocState: () => {
    const { currentDocHash, expandedState } = get();
    if (!currentDocHash) return;
    
    const newExpandedState = { ...expandedState };
    delete newExpandedState[currentDocHash];
    
    set({ expandedState: newExpandedState });
    get().saveToIndexedDB();
  },
  
  clearAllState: async () => {
    set({ expandedState: {}, currentDocHash: null });
    
    try {
      const db = await openDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Failed to clear IndexedDB:', error);
    }
  },
  
  loadFromIndexedDB: async () => {
    const expandedState = await loadStateFromDB();
    set({ expandedState });
  },
  
  saveToIndexedDB: async () => {
    const { expandedState } = get();
    await saveStateToDB(expandedState);
  },
}));

