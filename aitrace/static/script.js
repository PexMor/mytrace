// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update active content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Load data when switching to traces
        if (tabName === 'traces') {
            loadTraces();
        }
    });
});

// Load traces list
async function loadTraces() {
    const container = document.getElementById('traces-list');
    container.innerHTML = '<p class="loading">Loading traces...</p>';
    
    try {
        const response = await fetch('/api/traces');
        const data = await response.json();
        
        if (data.traces.length === 0) {
            container.innerHTML = '<p class="info">No traces found. Run the test app to generate some traces.</p>';
            return;
        }
        
        container.innerHTML = data.traces.map(trace => `
            <div class="trace-item" data-trace-id="${trace.trace_id}">
                <div>
                    <div class="trace-id">${trace.trace_id}</div>
                </div>
                <div class="trace-meta">
                    <span>📊 ${trace.events} events</span>
                    <span>⏰ ${formatTimestamp(trace.start_ts)}</span>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        document.querySelectorAll('.trace-item').forEach(item => {
            item.addEventListener('click', () => {
                const traceId = item.dataset.traceId;
                loadTraceDetail(traceId);
            });
        });
    } catch (error) {
        container.innerHTML = `<p class="info">Error loading traces: ${error.message}</p>`;
    }
}

// Filter traces
document.getElementById('filter-traces').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll('.trace-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? '' : 'none';
    });
});

// Refresh traces
document.getElementById('refresh-traces').addEventListener('click', loadTraces);

// Load trace detail
async function loadTraceDetail(traceId) {
    const modal = document.getElementById('trace-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    modal.classList.add('active');
    modalTitle.textContent = `Trace: ${traceId}`;
    modalBody.innerHTML = '<p class="loading">Loading trace details...</p>';
    
    try {
        const response = await fetch(`/api/trace/${traceId}`);
        const data = await response.json();
        
        modalBody.innerHTML = renderTraceTree(data);
        
        // Add toggle handlers
        document.querySelectorAll('.span-header').forEach(header => {
            header.addEventListener('click', () => {
                const span = header.parentElement;
                span.classList.toggle('collapsed');
                const toggle = header.querySelector('.span-toggle');
                toggle.textContent = span.classList.contains('collapsed') ? '▶' : '▼';
            });
        });
    } catch (error) {
        modalBody.innerHTML = `<p class="info">Error loading trace: ${error.message}</p>`;
    }
}

// Render trace tree
function renderTraceTree(trace) {
    function renderSpan(spanId, depth = 0) {
        const title = trace.title_for_span[spanId] || spanId;
        const logs = trace.logs_by_span[spanId] || [];
        const children = trace.children[spanId] || [];
        
        return `
            <div class="span">
                <div class="span-header">
                    <span class="span-toggle">▼</span>
                    <span class="span-title">${escapeHtml(title)}</span>
                    <span class="span-id">${spanId}</span>
                </div>
                <div class="span-logs">
                    ${logs.map(log => renderLog(log)).join('')}
                </div>
                ${children.map(childId => renderSpan(childId, depth + 1)).join('')}
            </div>
        `;
    }
    
    return trace.roots.map(rootId => renderSpan(rootId)).join('');
}

// Render individual log
function renderLog(log) {
    const level = log.level || 'INFO';
    const event = log.event || '';
    const ts = log.ts || '';
    const attrs = log.attrs || {};
    
    const attrsHtml = Object.entries(attrs)
        .filter(([key]) => !key.startsWith('code.'))
        .map(([key, value]) => {
            let displayValue = value;
            if (typeof value === 'object') {
                displayValue = JSON.stringify(value);
            }
            return `<span class="kv"><span class="kv-key">${escapeHtml(key)}:</span> <code class="kv-value">${escapeHtml(String(displayValue))}</code></span>`;
        })
        .join('');
    
    return `
        <div class="span-log">
            <div class="log-header">
                <span class="log-level ${level}">${level}</span>
                <span class="log-ts">${formatTimestamp(ts)}</span>
            </div>
            <div><strong>${escapeHtml(event)}</strong></div>
            ${attrsHtml ? `<div style="margin-top: 0.5rem;">${attrsHtml}</div>` : ''}
        </div>
    `;
}

// Search functionality
document.getElementById('search-btn').addEventListener('click', async () => {
    const level = document.getElementById('search-level').value;
    const event = document.getElementById('search-event').value;
    const limit = document.getElementById('search-limit').value;
    
    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (event) params.append('event', event);
    if (limit) params.append('limit', limit);
    
    const container = document.getElementById('search-results');
    container.innerHTML = '<p class="loading">Searching...</p>';
    
    try {
        const response = await fetch(`/api/search?${params}`);
        const data = await response.json();
        
        if (data.results.length === 0) {
            container.innerHTML = '<p class="info">No results found</p>';
            return;
        }
        
        container.innerHTML = `
            <p style="margin-bottom: 1rem; color: var(--text-secondary);">
                Found ${data.count} result(s)
            </p>
            ${data.results.map(log => renderSearchResult(log)).join('')}
        `;
    } catch (error) {
        container.innerHTML = `<p class="info">Error: ${error.message}</p>`;
    }
});

// Render search result
function renderSearchResult(log) {
    const level = log.level || 'INFO';
    const event = log.event || '';
    const ts = log.ts || '';
    const attrs = log.attrs || {};
    const traceId = log.trace_id;
    
    const attrsHtml = Object.entries(attrs)
        .map(([key, value]) => {
            let displayValue = value;
            if (typeof value === 'object') {
                displayValue = JSON.stringify(value);
            }
            return `<span class="kv"><span class="kv-key">${escapeHtml(key)}:</span> <code class="kv-value">${escapeHtml(String(displayValue))}</code></span>`;
        })
        .join('');
    
    return `
        <div class="log-entry level-${level}">
            <div class="log-header">
                <span class="log-level ${level}">${level}</span>
                <span class="log-ts">${formatTimestamp(ts)}</span>
            </div>
            <div><strong>${escapeHtml(event)}</strong></div>
            ${attrsHtml ? `<div style="margin-top: 0.5rem;">${attrsHtml}</div>` : ''}
            <div style="margin-top: 0.5rem;">
                <a href="#" onclick="loadTraceDetail('${traceId}'); return false;" style="color: var(--primary);">
                    View trace →
                </a>
            </div>
        </div>
    `;
}

// Modal close
document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('trace-modal').classList.remove('active');
});

// Close modal on background click
document.getElementById('trace-modal').addEventListener('click', (e) => {
    if (e.target.id === 'trace-modal') {
        e.target.classList.remove('active');
    }
});

// Utility functions
function formatTimestamp(ts) {
    if (!ts) return 'N/A';
    try {
        const date = new Date(ts);
        return date.toLocaleString();
    } catch {
        return ts;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initial load
loadTraces();

