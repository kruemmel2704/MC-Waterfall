import React, { useState, useEffect } from 'react';
import { 
  Download, Upload, RotateCcw, AlertTriangle, CheckCircle2, 
  AlertCircle, RefreshCw, HardDrive, FileArchive, Layers, 
  Sparkles, ShieldCheck, Flame, Compass, Folder
} from 'lucide-react';
import { GrassBlockIcon, NetherPortalIcon, WaterfallBeaconIcon } from './MinecraftIcons';

export default function WorldsTab({ onToast }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Import State
  const [selectedFile, setSelectedFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetDims, setResetDims] = useState({
    overworld: true,
    nether: true,
    the_end: true,
    lobby: false
  });
  const [customSeed, setCustomSeed] = useState('');
  const [createBackup, setCreateBackup] = useState(true);
  const [resetResult, setResetResult] = useState(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/worlds/overview');
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error(err);
      onToast?.({ type: 'error', text: 'Konnte Welten-Übersicht nicht laden.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleExportAll = async () => {
    setExporting(true);
    onToast?.({ type: 'info', text: 'Erstelle 1-Klick Welt-Backup... Chunks werden gespeichert.' });
    try {
      const res = await fetch('/api/worlds/export');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Export fehlgeschlagen');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition');
      let fileName = 'minecraft_cluster_worlds.zip';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) fileName = match[1];
      }

      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      onToast?.({ type: 'success', text: 'Welt-Archiv erfolgreich heruntergeladen!' });
    } catch (err) {
      onToast?.({ type: 'error', text: err.message });
    } finally {
      setExporting(false);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Bitte wähle eine .zip Datei aus.');
      return;
    }

    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('/api/worlds/import', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      setImportResult(data);
      if (data.success) {
        onToast?.({ type: 'success', text: 'Welten erfolgreich importiert und aufgeteilt!' });
        fetchOverview();
      } else {
        onToast?.({ type: 'error', text: data.message });
      }
    } catch (err) {
      onToast?.({ type: 'error', text: 'Fehler beim Upload: ' + err.message });
    } finally {
      setImporting(false);
    }
  };

  const handleResetConfirm = async () => {
    const selected = Object.keys(resetDims).filter(k => resetDims[k]);
    if (selected.length === 0) {
      alert('Bitte mindestens eine Dimension zum Zurücksetzen auswählen.');
      return;
    }

    setResetting(true);
    setResetResult(null);

    try {
      const res = await fetch('/api/worlds/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: selected,
          customSeed: customSeed.trim() || null,
          createBackupBeforeReset: createBackup
        })
      });

      const data = await res.json();
      setResetResult(data);
      if (data.success) {
        onToast?.({ type: 'success', text: 'Welt-Reset erfolgreich durchgeführt!' });
        setShowResetModal(false);
        fetchOverview();
      } else {
        onToast?.({ type: 'error', text: data.message });
      }
    } catch (err) {
      onToast?.({ type: 'error', text: 'Fehler beim Reset: ' + err.message });
    } finally {
      setResetting(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Banner */}
      <div className="mc-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Compass size={24} color="var(--mc-yellow)" />
            <h2 className="mc-title" style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>
              WELTEN-MANAGER & ARCHIV (DOWNLOAD / IMPORT / RESET)
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--mc-gray)' }}>
            Lade alle Dimensionen mit 1 Klick als ZIP herunter, importiere externe Welten mit automatischer Aufteilung oder setze Dimensionen zurück.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="mc-btn"
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin-anim' : ''} /> AKTUALISIEREN
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {overview.dimensions.map(dim => {
            const isNether = dim.DimensionKey === 'nether';
            const isEnd = dim.DimensionKey === 'the_end';
            const isLobby = dim.DimensionKey === 'lobby';

            let borderColor = 'var(--mc-green)';
            let IconComponent = GrassBlockIcon;
            if (isNether) {
              borderColor = 'var(--mc-red)';
              IconComponent = NetherPortalIcon;
            } else if (isEnd) {
              borderColor = '#9c27b0';
              IconComponent = Layers;
            } else if (isLobby) {
              borderColor = 'var(--mc-aqua)';
              IconComponent = WaterfallBeaconIcon;
            }

            return (
              <div 
                key={dim.DimensionKey} 
                className="mc-card" 
                style={{ 
                  padding: '16px', 
                  borderLeft: `4px solid ${borderColor}`,
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IconComponent size={20} />
                    <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{dim.DimensionName}</strong>
                  </div>
                  <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--mc-gray)', display: 'block', marginTop: '4px' }}>
                    Ordner: {dim.WorldFolderName}
                  </span>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '12px', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--mc-yellow)' }}>
                      Größe: <strong>{formatBytes(dim.SizeBytes)}</strong>
                    </span>
                    <span style={{ color: 'var(--mc-aqua)' }}>
                      Regionen: <strong>{dim.RegionFileCount} .mca</strong>
                    </span>
                  </div>
                </div>

                <span className={`mc-badge ${dim.Exists ? 'mc-badge-overworld' : 'mc-badge-nether'}`} style={{ fontSize: '0.65rem' }}>
                  {dim.Exists ? 'AKTIV' : 'LEER / INIT'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Actions Grid (Download / Import / Reset) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: 1-Click All Worlds Export */}
        <div className="mc-panel" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Download size={22} color="var(--mc-aqua)" />
              <h3 className="mc-subtitle" style={{ margin: 0, color: 'var(--mc-aqua)' }}>
                1. ALLE WELTEN HERUNTERLADEN (.ZIP)
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--mc-gray)', lineHeight: 1.4, marginBottom: '16px' }}>
              Erstellt mit <strong>einem einzigen Klick</strong> ein vollständiges ZIP-Backup aller Dimensionen (Overworld, Nether, The End, Lobby).
              <br /><br />
              Vor dem Packen wird auf den Servern automatisch ein Chunks-Flush (<code>save-all</code>) durchgeführt, damit keine ungespeicherten Daten verloren gehen.
            </p>
          </div>

          <button
            onClick={handleExportAll}
            disabled={exporting}
            className="mc-btn mc-btn-blue"
            style={{ width: '100%', padding: '12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {exporting ? (
              <>
                <RefreshCw size={16} className="spin-anim" /> ARCHIVIERE WELTEN...
              </>
            ) : (
              <>
                <FileArchive size={16} /> JETZT ALLE WELTEN HERUNTERLADEN (.ZIP)
              </>
            )}
          </button>
        </div>

        {/* Card 2: World ZIP Import & Auto-Split */}
        <div className="mc-panel" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Upload size={22} color="var(--mc-green)" />
            <h3 className="mc-subtitle" style={{ margin: 0, color: 'var(--mc-green)' }}>
              2. WELT IMPORTIEREN & AUTOMATISCH AUFTEILEN
            </h3>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--mc-gray)', lineHeight: 1.4, marginBottom: '14px' }}>
            Lade eine beliebige Minecraft-Welt (.zip) hoch. Unser System erkennt die Struktur und teilt die Dimensionen automatisch auf:
          </p>

          <div style={{ background: '#12141c', border: '1px solid #2e3347', padding: '10px', borderRadius: '4px', fontSize: '0.72rem', color: '#ccc', marginBottom: '16px' }}>
            <div>✔ <strong>Singleplayer / Vanilla World:</strong> <code>DIM-1</code> ➔ Nether-Server | <code>DIM1</code> ➔ End-Server</div>
            <div style={{ marginTop: '4px' }}>✔ <strong>Paper / Spigot World:</strong> <code>world</code>, <code>world_nether</code>, <code>world_the_end</code></div>
            <div style={{ marginTop: '4px' }}>✔ <strong>Automatisches Backup:</strong> Das alte Terrain wird vor dem Entpacken gesichert.</div>
          </div>

          <form onSubmit={handleImportSubmit}>
            <input
              type="file"
              accept=".zip"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="mc-input"
              style={{ marginBottom: '12px', padding: '8px' }}
              required
            />

            <button
              type="submit"
              disabled={importing || !selectedFile}
              className="mc-btn mc-btn-green"
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {importing ? (
                <>
                  <RefreshCw size={16} className="spin-anim" /> IMPORTIERE & VERTEILE AUF CLUSTER...
                </>
              ) : (
                <>
                  <Upload size={16} /> WELT HOCHLADEN & VERTEILEN
                </>
              )}
            </button>
          </form>

          {importResult && (
            <div style={{
              marginTop: '14px',
              padding: '12px',
              background: importResult.success ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
              border: `2px solid ${importResult.success ? 'var(--mc-green)' : 'var(--mc-red)'}`,
              borderRadius: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: importResult.success ? 'var(--mc-green)' : 'var(--mc-red)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                {importResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {importResult.message}
              </div>
              {importResult.details?.length > 0 && (
                <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: '0.72rem', color: 'var(--mc-gray)' }}>
                  {importResult.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Card 3: World Reset */}
        <div className="mc-panel" style={{ padding: '22px', border: '2px solid rgba(244, 67, 54, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Flame size={22} color="var(--mc-red)" />
            <h3 className="mc-subtitle" style={{ margin: 0, color: 'var(--mc-red)' }}>
              3. WELTEN ZURÜCKSETZEN (WELT-RESET)
            </h3>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--mc-gray)', lineHeight: 1.4, marginBottom: '14px' }}>
            Setze einzelne Dimensionen oder das gesamte Cluster auf den Urzustand zurück. Minecraft generiert beim Neustart eine brandneue, unberührte Landschaft.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resetDims.overworld}
                onChange={e => setResetDims({ ...resetDims, overworld: e.target.checked })}
              />
              <span>Overworld Dimension (world) zurücksetzen</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resetDims.nether}
                onChange={e => setResetDims({ ...resetDims, nether: e.target.checked })}
              />
              <span>Nether Dimension (world_nether) zurücksetzen</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resetDims.the_end}
                onChange={e => setResetDims({ ...resetDims, the_end: e.target.checked })}
              />
              <span>The End Dimension (world_the_end) zurücksetzen</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resetDims.lobby}
                onChange={e => setResetDims({ ...resetDims, lobby: e.target.checked })}
              />
              <span>Lobby Server (world_lobby) zurücksetzen</span>
            </label>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            className="mc-btn mc-btn-red"
            style={{ width: '100%', padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <RotateCcw size={16} /> WELTEN ZURÜCKSETZEN...
          </button>
        </div>

      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="mc-panel" style={{ maxWidth: '520px', width: '100%', padding: '24px', border: '3px solid var(--mc-red)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <AlertTriangle size={26} color="var(--mc-red)" />
              <h3 className="mc-title" style={{ fontSize: '1rem', color: 'var(--mc-red)', margin: 0 }}>
                WELTEN-RESET BESTÄTIGEN
              </h3>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#eee', lineHeight: 1.5, marginBottom: '16px' }}>
              Bist du sicher, dass du die ausgewählten Dimensionen zurücksetzen möchtest?
              Alle gebauten Strukturen und Chunks werden aus diesen Dimensionen entfernt!
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label className="mc-label">NEUER WORLD-SEED (OPTIONAL):</label>
              <input
                type="text"
                className="mc-input font-mono"
                placeholder="z.B. -1234567890 (leer lassen für Zufall)"
                value={customSeed}
                onChange={e => setCustomSeed(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--mc-green)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={createBackup}
                  onChange={e => setCreateBackup(e.target.checked)}
                />
                <span>Automatisches Backup der alten Welten (.bak) auf dem Server anlegen</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="mc-btn"
                disabled={resetting}
              >
                ABBRECHEN
              </button>
              <button
                type="button"
                onClick={handleResetConfirm}
                disabled={resetting}
                className="mc-btn mc-btn-red"
              >
                {resetting ? 'SETZE ZURÜCK...' : 'JA, WELTEN ZURÜCKSETZEN'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
