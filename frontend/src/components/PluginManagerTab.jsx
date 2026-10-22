import React, { useState, useEffect } from 'react';
import { 
  Search, Download, Package, Trash2, Power, Check, ExternalLink, 
  RefreshCw, AlertCircle, Sparkles, Filter, Server, CheckCircle2, RotateCcw
} from 'lucide-react';
import { CommandBlockIcon, GrassBlockIcon, NetherPortalIcon, EyeOfEnderIcon, WaterfallBeaconIcon, LobbyCrownIcon } from './MinecraftIcons';

const POPULAR_QUICK_PLUGINS = [
  { name: 'LuckPerms', query: 'luckperms', desc: 'Rechte- & Rollenverwaltung', type: 'paper' },
  { name: 'Chunky', query: 'chunky', desc: 'Asynchrone Welt-Vor-Generierung', type: 'paper' },
  { name: 'ViaVersion', query: 'viaversion', desc: 'Unterstützung für neuere Client-Versionen', type: 'both' },
  { name: 'Geyser', query: 'geyser', desc: 'Bedrock Edition Crossplay', type: 'both' },
  { name: 'Spark', query: 'spark', desc: 'CPU & RAM Performance Profiler', type: 'both' },
  { name: 'BungeeGuard', query: 'bungeeguard', desc: 'Absicherung gegen direkten IP-Bypass', type: 'both' },
  { name: 'SkinsRestorer', query: 'skinsrestorer', desc: 'Skin-Wiederherstellung für Proxys', type: 'both' },
  { name: 'Plan', query: 'plan player analytics', desc: 'Webbasiertes Spieler-Analytik-Tool', type: 'both' },
];

export default function PluginManagerTab({ nodes = [], onToast, onRestartNode }) {
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id || 'overworld');
  const [subTab, setSubTab] = useState('store'); // 'store' | 'installed'
  
  // Store search state
  const [searchQuery, setSearchQuery] = useState('');
  const [loaderFilter, setLoaderFilter] = useState('paper'); // 'all' | 'paper' | 'waterfall'
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [installingSlug, setInstallingSlug] = useState(null);

  // Installed plugins state
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(null);

  // Sync selected node default
  useEffect(() => {
    if (!selectedNodeId && nodes.length > 0) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes]);

  // Determine appropriate loader filter when node changes
  useEffect(() => {
    const currentNode = nodes.find(n => n.id === selectedNodeId);
    if (currentNode?.role === 0 || currentNode?.role === 'WaterfallProxy') {
      setLoaderFilter('waterfall');
    } else {
      setLoaderFilter('paper');
    }
  }, [selectedNodeId, nodes]);

  // Load initial popular plugins or search
  useEffect(() => {
    handleSearch(searchQuery);
  }, [loaderFilter]);

  // Load installed plugins when tab switches or node changes
  useEffect(() => {
    if (subTab === 'installed' && selectedNodeId && selectedNodeId !== 'all_paper' && selectedNodeId !== 'all') {
      fetchInstalledPlugins();
    }
  }, [subTab, selectedNodeId]);

  const handleSearch = async (query = '') => {
    setSearching(true);
    try {
      const q = query.trim();
      const loaderParam = loaderFilter === 'all' ? '' : loaderFilter;
      const res = await fetch(`/api/plugins/search?query=${encodeURIComponent(q)}&loader=${encodeURIComponent(loaderParam)}&limit=24`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.hits || []);
      }
    } catch (err) {
      console.error('Failed to search Modrinth:', err);
      onToast?.({ type: 'error', message: 'Fehler bei der Modrinth-Suche.' });
    } finally {
      setSearching(false);
    }
  };

  const fetchInstalledPlugins = async () => {
    if (!selectedNodeId || selectedNodeId === 'all' || selectedNodeId === 'all_paper') return;
    setLoadingInstalled(true);
    try {
      const res = await fetch(`/api/plugins/installed/${selectedNodeId}`);
      if (res.ok) {
        const data = await res.json();
        setInstalledPlugins(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch installed plugins:', err);
      onToast?.({ type: 'error', message: 'Installierte Plugins konnten nicht geladen werden.' });
    } finally {
      setLoadingInstalled(false);
    }
  };

  const handleInstallPlugin = async (hit) => {
    setInstallingSlug(hit.slug);
    try {
      // 1. Fetch latest version for this project matching loader
      const loaderParam = loaderFilter === 'all' ? '' : loaderFilter;
      const vRes = await fetch(`/api/plugins/versions/${hit.slug}?loader=${encodeURIComponent(loaderParam)}`);
      if (!vRes.ok) {
        throw new Error('Versions-Informationen konnten nicht geladen werden.');
      }
      const versions = await vRes.json();
      if (!versions || versions.length === 0) {
        throw new Error('Keine kompatible Version für diesen Loader gefunden.');
      }

      // Pick first primary file or first file
      const latestVersion = versions[0];
      const targetFile = latestVersion.files?.find(f => f.primary) || latestVersion.files?.[0];
      if (!targetFile || !targetFile.url) {
        throw new Error('Keine JAR-Datei in der ausgewählten Version gefunden.');
      }

      // 2. Trigger installation via backend
      const installRes = await fetch('/api/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNodeId,
          downloadUrl: targetFile.url,
          fileName: targetFile.filename,
          pluginName: hit.title
        })
      });

      const result = await installRes.json();
      if (installRes.ok && result.success) {
        onToast?.({ type: 'success', message: result.message });
        if (subTab === 'installed') {
          fetchInstalledPlugins();
        }
      } else {
        throw new Error(result.message || 'Installation fehlgeschlagen.');
      }
    } catch (err) {
      console.error('Plugin install failed:', err);
      onToast?.({ type: 'error', message: err.message || 'Fehler beim Installieren des Plugins.' });
    } finally {
      setInstallingSlug(null);
    }
  };

  const handleTogglePlugin = async (plugin) => {
    setActionInProgress(plugin.fileName);
    try {
      const res = await fetch('/api/plugins/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: selectedNodeId,
          fileName: plugin.fileName,
          enable: !plugin.isEnabled
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast?.({ type: 'success', message: data.message });
        fetchInstalledPlugins();
      } else {
        throw new Error(data.message || 'Fehler beim Umschalten.');
      }
    } catch (err) {
      onToast?.({ type: 'error', message: err.message });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeletePlugin = async (plugin) => {
    if (!window.confirm(`Möchtest du das Plugin '${plugin.fileName}' wirklich vom Server löschen?`)) {
      return;
    }
    setActionInProgress(plugin.fileName);
    try {
      const res = await fetch(`/api/plugins/delete/${selectedNodeId}/${encodeURIComponent(plugin.fileName)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onToast?.({ type: 'success', message: data.message });
        fetchInstalledPlugins();
      } else {
        throw new Error(data.message || 'Fehler beim Löschen.');
      }
    } catch (err) {
      onToast?.({ type: 'error', message: err.message });
    } finally {
      setActionInProgress(null);
    }
  };

  const currentNode = nodes.find(n => n.id === selectedNodeId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Control Deck */}
      <div className="mc-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '2px solid #2d303b', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ 
              width: '44px', 
              height: '44px', 
              background: '#091512', 
              border: '2px solid #1bd96a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(27,217,106,0.3)'
            }}>
              <Package size={26} color="#1bd96a" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 className="mc-title" style={{ fontSize: '1rem', color: '#fff' }}>MODRINTH PLUGIN STORE & VERWALTUNG</h2>
                <span className="mc-badge" style={{ background: '#11291b', color: '#1bd96a', border: '1px solid #1bd96a', fontSize: '0.65rem' }}>
                  MODRINTH v2 API
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '4px' }}>
                Suche, lade und verwalte Plugins mit 1-Klick-SSH-Bereitstellung für all deine Cluster-Server
              </p>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSubTab('store')}
              className={`mc-btn ${subTab === 'store' ? 'mc-btn-green' : ''}`}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              <Sparkles size={14} /> MODRINTH STORE
            </button>
            <button
              onClick={() => setSubTab('installed')}
              className={`mc-btn ${subTab === 'installed' ? 'mc-btn-blue' : ''}`}
              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
            >
              <Package size={14} /> INSTALLIERTE PLUGINS
            </button>
          </div>
        </div>

        {/* Server Target Selector Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', fontFamily: 'var(--mc-font)' }}>
              ZIEL-SERVER:
            </span>
            <select
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              className="mc-input"
              style={{ padding: '8px 14px', fontSize: '0.8rem', minWidth: '240px', background: '#12141a', color: '#fff' }}
            >
              <optgroup label="Einzelne Server">
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.role === 0 || n.role === 'WaterfallProxy' ? 'Waterfall Proxy' : 'Paper Backend'})
                  </option>
                ))}
              </optgroup>
              {subTab === 'store' && (
                <optgroup label="Sammel-Aktionen">
                  <option value="all_paper">⚡ Auf alle Paper-Server verteilen (Overworld, Nether, End, Lobby)</option>
                  <option value="all">⚡ Auf ALLE Server im Cluster verteilen</option>
                </optgroup>
              )}
            </select>

            {currentNode && (
              <span className={`mc-badge ${currentNode.status === 1 || currentNode.status === 'Online' ? 'mc-badge-green' : 'mc-badge-red'}`} style={{ fontSize: '0.7rem' }}>
                {currentNode.status === 1 || currentNode.status === 'Online' ? 'ONLINE' : 'OFFLINE'}
              </span>
            )}
          </div>

          {/* Quick restart node button */}
          {currentNode && onRestartNode && (
            <button
              onClick={() => onRestartNode(currentNode)}
              className="mc-btn mc-btn-gold"
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              title="Startet den ausgewählten Server neu, um Plugin-Änderungen zu laden"
            >
              <RotateCcw size={13} /> {currentNode.name} NEUSTARTEN
            </button>
          )}
        </div>
      </div>

      {/* SUBTAB 1: MODRINTH STORE */}
      {subTab === 'store' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search & Filter Header */}
          <div className="mc-card" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                <Search size={16} color="var(--mc-gray)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  placeholder="Plugin suchen (z.B. LuckPerms, Chunky, ViaVersion, Geyser)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                  className="mc-input"
                  style={{ width: '100%', paddingLeft: '38px', paddingRight: '12px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Loader selector */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setLoaderFilter('all')}
                  className={`mc-btn ${loaderFilter === 'all' ? 'mc-btn-blue' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  Alle
                </button>
                <button
                  onClick={() => setLoaderFilter('paper')}
                  className={`mc-btn ${loaderFilter === 'paper' ? 'mc-btn-green' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  Paper / Spigot
                </button>
                <button
                  onClick={() => setLoaderFilter('waterfall')}
                  className={`mc-btn ${loaderFilter === 'waterfall' ? 'mc-btn-purple' : ''}`}
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  Waterfall / Proxy
                </button>
                <button
                  onClick={() => handleSearch(searchQuery)}
                  className="mc-btn mc-btn-green"
                  style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                  disabled={searching}
                >
                  {searching ? <RefreshCw size={14} className="spin-anim" /> : <Search size={14} />} SUCHEN
                </button>
              </div>
            </div>

            {/* Popular quick tags */}
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', fontFamily: 'var(--mc-font)' }}>
                BELIEBTE PLUGINS:
              </span>
              {POPULAR_QUICK_PLUGINS.map(p => (
                <button
                  key={p.name}
                  onClick={() => {
                    setSearchQuery(p.query);
                    handleSearch(p.query);
                  }}
                  className="mc-slot"
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#fff',
                    transition: 'border-color 0.15s'
                  }}
                >
                  <Sparkles size={11} color="var(--mc-aqua)" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Results Grid */}
          {searching ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px', gap: '12px' }}>
              <RefreshCw size={24} className="spin-anim" color="var(--mc-green)" />
              <span style={{ color: 'var(--mc-gray)', fontFamily: 'var(--mc-font)', fontSize: '0.85rem' }}>
                Durchsuche Modrinth Plugin-Bibliothek...
              </span>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="mc-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--mc-gray)' }}>
              <Package size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontFamily: 'var(--mc-font)', fontSize: '0.85rem' }}>Keine Plugins auf Modrinth gefunden.</p>
              <p style={{ fontSize: '0.75rem', marginTop: '6px' }}>Probiere einen anderen Suchbegriff oder ändere den Filter.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px'
            }}>
              {searchResults.map(hit => (
                <div key={hit.project_id} className="mc-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', border: '2px solid #2e303d' }}>
                  <div>
                    {/* Plugin Header with Icon */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        background: '#12141a',
                        border: '2px solid #3c3e4c',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {hit.icon_url ? (
                          <img src={hit.icon_url} alt={hit.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Package size={24} color="var(--mc-gray)" />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {hit.title}
                          </h3>
                        </div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--mc-gray)' }}>
                          von <span style={{ color: 'var(--mc-aqua)' }}>{hit.author}</span>
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p style={{
                      fontSize: '0.72rem',
                      color: '#bbb',
                      margin: '12px 0',
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {hit.description}
                    </p>

                    {/* Categories & Stats */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                      <span className="mc-badge" style={{ background: '#1c221e', color: 'var(--mc-green)', border: '1px solid #2e593a', fontSize: '0.62rem' }}>
                        📥 {(hit.downloads >= 1000000 ? (hit.downloads / 1000000).toFixed(1) + 'M' : hit.downloads >= 1000 ? (hit.downloads / 1000).toFixed(0) + 'K' : hit.downloads)}
                      </span>
                      {hit.categories?.slice(0, 3).map(cat => (
                        <span key={cat} className="mc-badge" style={{ fontSize: '0.62rem', background: '#20222a', color: '#aaa', border: '1px solid #353846' }}>
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions Deck */}
                  <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #292b36', paddingTop: '12px' }}>
                    <button
                      onClick={() => handleInstallPlugin(hit)}
                      disabled={installingSlug === hit.slug}
                      className="mc-btn mc-btn-green"
                      style={{ flex: 1, padding: '7px 12px', fontSize: '0.75rem', justifyContent: 'center' }}
                    >
                      {installingSlug === hit.slug ? (
                        <>
                          <RefreshCw size={13} className="spin-anim" /> INSTALLIERE...
                        </>
                      ) : (
                        <>
                          <Download size={13} /> INSTALLIEREN
                        </>
                      )}
                    </button>
                    <a
                      href={`https://modrinth.com/plugin/${hit.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mc-btn"
                      style={{ padding: '7px 10px', fontSize: '0.75rem' }}
                      title="Auf Modrinth ansehen"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: INSTALLED PLUGINS */}
      {subTab === 'installed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="mc-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 className="mc-title" style={{ fontSize: '0.9rem', color: '#fff' }}>
                  PLUGINS AUF '{currentNode?.name?.toUpperCase() || 'SERVER'}'
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                  Verzeichnis: {currentNode?.remoteDirectory}/plugins/
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={fetchInstalledPlugins}
                  className="mc-btn"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  disabled={loadingInstalled}
                >
                  <RefreshCw size={13} className={loadingInstalled ? 'spin-anim' : ''} /> AKTUALISIEREN
                </button>
              </div>
            </div>

            {loadingInstalled ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '160px', gap: '12px' }}>
                <RefreshCw size={20} className="spin-anim" color="var(--mc-aqua)" />
                <span style={{ color: 'var(--mc-gray)', fontFamily: 'var(--mc-font)', fontSize: '0.8rem' }}>
                  Lese Plugins via SSH aus...
                </span>
              </div>
            ) : installedPlugins.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--mc-gray)', border: '2px dashed #2d303b' }}>
                <Package size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <p style={{ fontFamily: 'var(--mc-font)', fontSize: '0.8rem' }}>Noch keine Plugins im Ordner /plugins/ vorhanden.</p>
                <p style={{ fontSize: '0.72rem', marginTop: '6px' }}>
                  Wechsle zum Reiter <strong>„Modrinth Store“</strong> oben, um Plugins mit einem Klick zu installieren!
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: '#12141a', borderBottom: '2px solid #282a35', textAlign: 'left', color: 'var(--mc-gray)', fontFamily: 'var(--mc-font)', fontSize: '0.65rem' }}>
                      <th style={{ padding: '10px 14px' }}>STATUS</th>
                      <th style={{ padding: '10px 14px' }}>DATEINAME</th>
                      <th style={{ padding: '10px 14px' }}>GRÖSSE</th>
                      <th style={{ padding: '10px 14px' }}>ZULETZT GEÄNDERT</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>AKTIONEN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installedPlugins.map(p => (
                      <tr key={p.fileName} style={{ borderBottom: '1px solid #242631' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <span className={`mc-badge ${p.isEnabled ? 'mc-badge-green' : 'mc-badge-red'}`} style={{ fontSize: '0.62rem' }}>
                            {p.isEnabled ? 'AKTIV' : 'DEAKTIVIERT'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 'bold', color: p.isEnabled ? '#fff' : 'var(--mc-gray)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Package size={15} color={p.isEnabled ? 'var(--mc-aqua)' : 'var(--mc-dark-gray)'} />
                            <span>{p.fileName}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--mc-gray)', fontFamily: 'var(--mc-font-mono)' }}>
                          {p.sizeFormatted}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--mc-gray)' }}>
                          {p.lastModified ? new Date(p.lastModified).toLocaleDateString() + ' ' + new Date(p.lastModified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleTogglePlugin(p)}
                              disabled={actionInProgress === p.fileName}
                              className={`mc-btn ${p.isEnabled ? 'mc-btn-gold' : 'mc-btn-green'}`}
                              style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                              title={p.isEnabled ? 'Plugin deaktivieren (.jar.disabled)' : 'Plugin aktivieren (.jar)'}
                            >
                              <Power size={12} /> {p.isEnabled ? 'DEAKTIVIEREN' : 'AKTIVIEREN'}
                            </button>
                            <button
                              onClick={() => handleDeletePlugin(p)}
                              disabled={actionInProgress === p.fileName}
                              className="mc-btn mc-btn-red"
                              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                              title="Plugin-Datei unwiderruflich löschen"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Restart hint alert */}
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: '#151720',
              border: '2px solid #282a35',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} color="var(--mc-gold)" />
                <span style={{ fontSize: '0.75rem', color: '#ccc' }}>
                  <strong>Hinweis:</strong> Nach dem Installieren, Umschalten oder Löschen von Plugins muss der Server neugestartet werden, damit Spigot/Paper die Änderungen lädt.
                </span>
              </div>
              {currentNode && onRestartNode && (
                <button
                  onClick={() => onRestartNode(currentNode)}
                  className="mc-btn mc-btn-gold"
                  style={{ padding: '5px 12px', fontSize: '0.72rem' }}
                >
                  <RotateCcw size={12} /> {currentNode.name} JETZT NEUSTARTEN
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
