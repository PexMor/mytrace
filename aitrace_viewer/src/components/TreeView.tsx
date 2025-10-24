import { NodeRow } from './NodeRow';
import { formatTimestamp, type TimestampSettings } from '../utils/timestampFormat';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

interface TreeViewProps {
  forest: Map<string, any>;
  timestampSettings: TimestampSettings;
}

export function TreeView({ forest, timestampSettings }: TreeViewProps) {
  const traces = Array.from(forest.values());
  return (
    <div class='traces-container'>
      {traces.map((t, idx) => (
        <div key={idx} class='trace-section'>
          <div class='trace-header-card compact'>
            <div class='trace-header-line'>
              <i class='bi bi-diagram-3 me-2'></i>
              <span class='trace-name small'>{t.name || 'Unknown Trace'}</span>
            </div>
            <div class='trace-metadata'>
              <div class='trace-meta-item'>
                <i class='bi bi-fingerprint me-1'></i>
                <span class='text-muted small'>ID:</span> 
                <code class='trace-id-code'>{t.roots.join(', ') || 'unknown'}</code>
              </div>
              {t.startTime && timestampSettings.mode !== 'hidden' && timestampSettings.mode !== 'relative' && (
                <div class='trace-meta-item'>
                  <i class='bi bi-clock me-1'></i>
                  <span class='text-muted small'>Start:</span> 
                  <span class='trace-time'>{formatTimestamp(t.startTime, timestampSettings)}</span>
                </div>
              )}
              {t.endTime && t.startTime !== t.endTime && timestampSettings.mode !== 'hidden' && timestampSettings.mode !== 'relative' && (
                <div class='trace-meta-item'>
                  <i class='bi bi-clock-history me-1'></i>
                  <span class='text-muted small'>End:</span> 
                  <span class='trace-time'>{formatTimestamp(t.endTime, timestampSettings)}</span>
                </div>
              )}
              {t.durationMs !== undefined && t.durationMs > 0 && (
                <div class='trace-meta-item'>
                  <i class='bi bi-hourglass-split me-1'></i>
                  <span class='text-muted small'>Duration:</span> 
                  <span class='trace-duration badge bg-secondary'>{formatDuration(t.durationMs)}</span>
                </div>
              )}
            </div>
          </div>
          <div class='trace-tree'>
            {t.roots.map(rootId => {
              const node = t.nodes.get(rootId);
              return <NodeRow 
                key={rootId} 
                node={node} 
                trace={t} 
                timestampSettings={timestampSettings}
                traceStartTime={t.startTime}
              />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}