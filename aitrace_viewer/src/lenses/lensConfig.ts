// Lens configuration for different event types

export interface LensField {
  key: string;
  display?: string;
  type?: 'json-tree' | 'text' | 'code' | 'hidden';
  maxInitialDepth?: number;
}

export interface Lens {
  eventPattern: string | RegExp;
  fields: LensField[];
  priority?: number; // Higher priority lenses are checked first
}

// Default lens - shows all fields as JSON trees
export const DEFAULT_LENS: Lens = {
  eventPattern: /.*/,
  fields: [
    {
      key: '*', // Special wildcard to show all fields
      type: 'json-tree',
      maxInitialDepth: 1
    }
  ],
  priority: 0
};

// Lens for LLM start events
export const LLM_START_LENS: Lens = {
  eventPattern: /llm_start/i,
  fields: [
    { key: 'prompts', display: 'Prompts', type: 'json-tree', maxInitialDepth: 2 },
    { key: 'model', display: 'Model', type: 'text' },
    { key: 'run_id', display: 'Run ID', type: 'text' },
  ],
  priority: 10
};

// Lens for LLM end events
export const LLM_END_LENS: Lens = {
  eventPattern: /llm_end/i,
  fields: [
    { key: 'response', display: 'Response', type: 'json-tree', maxInitialDepth: 2 },
    { key: 'run_id', display: 'Run ID', type: 'text' },
  ],
  priority: 10
};

// Lens for chatbot events
export const CHATBOT_LENS: Lens = {
  eventPattern: /chatbot_(invoked|response_generated|error)/i,
  fields: [
    { key: 'message_count', display: 'Message Count', type: 'text' },
    { key: 'response_length', display: 'Response Length', type: 'text' },
    { key: 'error', display: 'Error', type: 'json-tree', maxInitialDepth: 2 },
  ],
  priority: 10
};

// Registry of all lenses
export const LENS_REGISTRY: Lens[] = [
  LLM_START_LENS,
  LLM_END_LENS,
  CHATBOT_LENS,
  DEFAULT_LENS
];

/**
 * Find the best matching lens for a given event name
 */
export function findLens(eventName: string): Lens {
  // Sort by priority (highest first) and find first match
  const sortedLenses = [...LENS_REGISTRY].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  
  for (const lens of sortedLenses) {
    if (typeof lens.eventPattern === 'string') {
      if (lens.eventPattern === eventName) {
        return lens;
      }
    } else if (lens.eventPattern instanceof RegExp) {
      if (lens.eventPattern.test(eventName)) {
        return lens;
      }
    }
  }
  
  return DEFAULT_LENS;
}

/**
 * Determine if a value is "simple" (can be rendered as a chip)
 */
function isSimpleValue(value: any): boolean {
  if (value === null || value === undefined) return true;
  
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    // String length check - keep chips for short strings
    if (type === 'string' && value.length > 80) return false;
    return true;
  }
  
  // Arrays and objects are complex
  if (Array.isArray(value) || type === 'object') return false;
  
  return true;
}

/**
 * Get fields to display for a log entry using the appropriate lens
 */
export function getFieldsForEntry(entry: any): { key: string; display: string; value: any; type: string; maxInitialDepth?: number }[] {
  const lens = findLens(entry.event || '');
  const result: any[] = [];
  
  // Standard fields to skip
  const skipFields = new Set(['timestamp', 'event', 'trace_id', 'span_id', 'parent_span_id', 'level']);
  
  // If lens has wildcard, show all non-standard fields
  const hasWildcard = lens.fields.some(f => f.key === '*');
  
  if (hasWildcard) {
    const wildcardField = lens.fields.find(f => f.key === '*')!;
    Object.entries(entry).forEach(([key, value]) => {
      if (!skipFields.has(key)) {
        // Auto-detect type based on value complexity
        const inferredType = isSimpleValue(value) ? 'text' : (wildcardField.type || 'json-tree');
        
        result.push({
          key,
          display: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value,
          type: inferredType,
          maxInitialDepth: wildcardField.maxInitialDepth
        });
      }
    });
  } else {
    // Use specific fields from lens
    lens.fields.forEach(field => {
      if (entry[field.key] !== undefined) {
        // If type not specified in lens, infer it
        const inferredType = field.type || (isSimpleValue(entry[field.key]) ? 'text' : 'json-tree');
        
        result.push({
          key: field.key,
          display: field.display || field.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: entry[field.key],
          type: inferredType,
          maxInitialDepth: field.maxInitialDepth
        });
      }
    });
  }
  
  return result;
}

