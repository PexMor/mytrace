export function buildSpanForest(rows: any[]) {
  const traces = new Map();
  
  // First pass: create all nodes and collect logs by span
  for (const r of rows) {
    const traceId = r.trace_id ?? 'no-trace';
    const spanId = r.span_id ?? crypto.randomUUID();
    const parentId = r.parent_span_id ?? null;
    
    // Use aitrace format: timestamp and event
    const timestamp = r.timestamp;
    const message = r.event;
    const level = r.level ?? 'info';
    
    if (!traces.has(traceId)) traces.set(traceId, { roots: [], nodes: new Map() });
    const t = traces.get(traceId);
    
    // Get or create node
    const node = t.nodes.get(spanId) || { 
      id: spanId, 
      traceId, 
      parentId, 
      children: [], 
      depth: 0, 
      level: level,
      msg: message,
      timestamp: timestamp,
      raw: [] 
    };
    
    // Update node data with latest log entry
    if (!node.msg && message) node.msg = message;
    if (!node.timestamp && timestamp) node.timestamp = timestamp;
    if (!node.level || node.level === 'info') node.level = level;
    if (parentId && !node.parentId) node.parentId = parentId;
    
    node.raw.push(r);
    t.nodes.set(spanId, node);
  }
  
  // Second pass: build parent-child relationships and identify roots
  for (const t of traces.values()) {
    const childrenSet = new Set();
    
    for (const node of t.nodes.values()) {
      if (node.parentId) {
        // Ensure parent exists
        if (!t.nodes.has(node.parentId)) {
          // Create placeholder parent if it doesn't exist
          t.nodes.set(node.parentId, {
            id: node.parentId,
            traceId: node.traceId,
            parentId: null,
            children: [],
            depth: 0,
            level: 'info',
            msg: `[span ${node.parentId}]`,
            timestamp: node.timestamp,
            raw: []
          });
        }
        
        const parent = t.nodes.get(node.parentId);
        if (!parent.children.includes(node.id)) {
          parent.children.push(node.id);
        }
        childrenSet.add(node.id);
      }
    }
    
    // Roots are nodes that are not children of any other node
    t.roots = Array.from(t.nodes.keys()).filter(id => !childrenSet.has(id));
    
    // Sort children by timestamp
    for (const node of t.nodes.values()) {
      if (node.children.length > 1) {
        node.children.sort((a, b) => {
          const nodeA = t.nodes.get(a);
          const nodeB = t.nodes.get(b);
          const tsA = nodeA?.timestamp || '';
          const tsB = nodeB?.timestamp || '';
          return tsA < tsB ? -1 : tsA > tsB ? 1 : 0;
        });
      }
    }
  }
  
  // Third pass: compute depths
  for (const t of traces.values()) {
    const seen = new Set();
    const dfs = (id, depth) => {
      const n = t.nodes.get(id);
      if (!n || seen.has(id)) return; // Prevent cycles
      n.depth = depth;
      seen.add(id);
      n.children.forEach(c => dfs(c, depth + 1));
    };
    t.roots.forEach(r => dfs(r, 0));
  }
  
  // Fourth pass: compute trace metadata (name, time span, duration)
  for (const [traceId, t] of traces.entries()) {
    // Trace name from first root span
    const rootNode = t.roots.length > 0 ? t.nodes.get(t.roots[0]) : null;
    t.name = rootNode?.msg || `Trace ${traceId}`;
    
    // Find earliest and latest timestamps
    let earliestTime = null;
    let latestTime = null;
    
    for (const node of t.nodes.values()) {
      if (node.timestamp) {
        if (!earliestTime || node.timestamp < earliestTime) {
          earliestTime = node.timestamp;
        }
        if (!latestTime || node.timestamp > latestTime) {
          latestTime = node.timestamp;
        }
      }
    }
    
    t.startTime = earliestTime;
    t.endTime = latestTime;
    
    // Calculate duration in milliseconds
    if (earliestTime && latestTime) {
      const start = new Date(earliestTime).getTime();
      const end = new Date(latestTime).getTime();
      t.durationMs = end - start;
    }
  }
  
  return traces;
}