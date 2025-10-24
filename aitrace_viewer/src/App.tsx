import { useState, useEffect } from 'preact/hooks';
import { buildSpanForest } from './logic/buildSpanTree';
import { TreeView } from './components/TreeView';
import { TimestampSettingsPanel } from './components/TimestampSettings';
import { DensitySettingsPanel } from './components/DensitySettings';
import { 
  loadTimestampSettings, 
  saveTimestampSettings,
  type TimestampSettings 
} from './utils/timestampFormat';
import {
  loadDensitySettings,
  saveDensitySettings,
  type DensitySettings
} from './utils/densitySettings';
import { computeSHA256 } from './utils/hash';
import { useExpandCollapseStore } from './stores/expandCollapseStore';
import { useCustomLensStore } from './stores/customLensStore';

interface Sample {
  id: string;
  name: string;
  description: string;
  filename: string;
  icon: string;
}

interface SamplesConfig {
  samples: Sample[];
}

export default function App() {
  const [forest, setForest] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selectedSample, setSelectedSample] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [timestampSettings, setTimestampSettings] = useState<TimestampSettings>(loadTimestampSettings());
  const [densitySettings, setDensitySettings] = useState<DensitySettings>(loadDensitySettings());
  const [currentFileName, setCurrentFileName] = useState<string>('');
  
  const { setDocumentHash, clearCurrentDocState, clearAllState, loadFromIndexedDB } = useExpandCollapseStore();
  const { loadFromIndexedDB: loadCustomLenses } = useCustomLensStore();

  useEffect(() => {
    // Load state from IndexedDB on mount
    loadFromIndexedDB();
    loadCustomLenses();
    
    // Load samples config on mount
    fetch('./samples/config.json')
      .then(res => res.json())
      .then((config: SamplesConfig) => {
        setSamples(config.samples);
        if (config.samples.length > 0) {
          setSelectedSample(config.samples[0].id);
        }
      })
      .catch(err => console.error('Failed to load samples config:', err));
  }, []);

  async function loadSampleById(sampleId: string) {
    const sample = samples.find(s => s.id === sampleId);
    if (!sample) return;

    setLoading(true);
    try {
      const response = await fetch(`./samples/${sample.filename}`);
      const text = await response.text();
      const rows = text.trim().split('\n').map(l => JSON.parse(l));
      
      // Compute hash and set document hash for state persistence
      const hash = await computeSHA256(text);
      await setDocumentHash(hash);
      setCurrentFileName(sample.filename);
      
      setForest(buildSpanForest(rows));
    } catch (err) {
      console.error('Failed to load sample:', err);
      alert('Failed to load sample file');
    } finally {
      setLoading(false);
    }
  }

  function handleSampleSelect(e: Event) {
    const select = e.target as HTMLSelectElement;
    const sampleId = select.value;
    setSelectedSample(sampleId);
    loadSampleById(sampleId);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const rows = text.trim().split('\n').map(l => JSON.parse(l));
      
      // Compute hash and set document hash for state persistence
      const hash = await computeSHA256(text);
      await setDocumentHash(hash);
      setCurrentFileName(file.name);
      
      setForest(buildSpanForest(rows));
    };
    reader.readAsText(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFile(file);
  }

  function handleTimestampSettingsChange(newSettings: TimestampSettings) {
    setTimestampSettings(newSettings);
    saveTimestampSettings(newSettings);
  }

  function handleDensitySettingsChange(newSettings: DensitySettings) {
    setDensitySettings(newSettings);
    saveDensitySettings(newSettings);
  }

  return (
    <div class='container-fluid py-3'>
      <div class='trace-header d-flex align-items-center'>
        <i class='bi bi-diagram-3 me-2'></i>
        <span>AI Trace Viewer</span>
      </div>

      <div class='controls-section'>
        <div class='row g-2 mb-2'>
          <div class='col-auto'>
            <select 
              class='form-select form-select-sm'
              value={selectedSample}
              onChange={handleSampleSelect}
              disabled={loading || samples.length === 0}
            >
              {samples.length === 0 && (
                <option>Loading samples...</option>
              )}
              {samples.map(sample => (
                <option key={sample.id} value={sample.id}>
                  {sample.name}
                </option>
              ))}
            </select>
          </div>
          <div class='col-auto'>
            <button 
              onClick={() => loadSampleById(selectedSample)} 
              class='btn btn-primary btn-sm'
              disabled={loading || !selectedSample}
            >
              <i class='bi bi-play-fill me-1'></i>
              {loading ? 'Loading...' : 'Load'}
            </button>
          </div>
          <div class='col-auto'>
            <input 
              type='file' 
              accept='.jsonl,.ndjson' 
              onChange={handleFileInput}
              class='form-control form-control-sm'
              style={{ width: '200px' }}
            />
          </div>
          <div class='col-auto ms-auto d-flex gap-2'>
            <button
              onClick={clearCurrentDocState}
              class='btn btn-outline-secondary btn-sm'
              disabled={!forest}
              title='Clear expand/collapse state for current document'
            >
              <i class='bi bi-arrow-clockwise me-1'></i>
              Reset View
            </button>
            <button
              onClick={() => {
                if (confirm('Clear all saved expand/collapse states for all documents?')) {
                  clearAllState();
                }
              }}
              class='btn btn-outline-danger btn-sm'
              title='Clear all saved expand/collapse states'
            >
              <i class='bi bi-trash me-1'></i>
              Clear All States
            </button>
            <DensitySettingsPanel 
              settings={densitySettings}
              onSettingsChange={handleDensitySettingsChange}
            />
            <TimestampSettingsPanel 
              settings={timestampSettings}
              onSettingsChange={handleTimestampSettingsChange}
            />
          </div>
        </div>
        
        {currentFileName && (
          <div class='text-muted small mb-2'>
            <i class='bi bi-file-text me-1'></i>
            Current file: <strong>{currentFileName}</strong>
          </div>
        )}

        {selectedSample && samples.find(s => s.id === selectedSample) && (
          <div class='sample-info mb-2'>
            <i class={`bi ${samples.find(s => s.id === selectedSample)?.icon} me-2 text-primary`}></i>
            <small class='text-muted'>
              {samples.find(s => s.id === selectedSample)?.description}
            </small>
          </div>
        )}

        <div 
          class={`upload-area ${dragActive ? 'drag-active' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
        >
          <i class='bi bi-cloud-upload me-2'></i>
          Drop NDJSON/JSONL file here
        </div>
      </div>

      {forest && <TreeView forest={forest} timestampSettings={timestampSettings} densitySettings={densitySettings} />}
    </div>
  );
}