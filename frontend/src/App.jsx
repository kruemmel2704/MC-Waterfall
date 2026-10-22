import React, { useState, useEffect } from 'react';
import { 
  Play, Square, RotateCw, Plus, RefreshCw, CheckCircle2, AlertCircle, Shield, Package, Settings, LogOut, User as UserIcon, Compass
} from 'lucide-react';

import ClusterTopology from './components/ClusterTopology';
import NodeCard from './components/NodeCard';
import NodeEditModal from './components/NodeEditModal';
import LiveConsole from './components/LiveConsole';
import ClusterDeployModal from './components/ClusterDeployModal';
import PortalGuide from './components/PortalGuide';
import DiscordAuthTab from './components/DiscordAuthTab';
import DiscordOAuthCallbackPage from './components/DiscordOAuthCallbackPage';
import PluginManagerTab from './components/PluginManagerTab';
import WorldsTab from './components/WorldsTab';
import SetupWizardPage from './components/SetupWizardPage';
import LoginPage from './components/LoginPage';
import SettingsTab from './components/SettingsTab';
import { GrassBlockIcon, WaterfallBeaconIcon, CommandBlockIcon, NetherPortalIcon } from './components/MinecraftIcons';

export default function App() {
  const [clusterConfig, setClusterConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('topology');
  const [editingNode, setEditingNode] = useState(null);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [deployingNode, setDeployingNode] = useState(null);
  const [isFullClusterDeploy, setIsFullClusterDeploy] = useState(false);
  const [consoleNodeId, setConsoleNodeId] = useState('');
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication & Setup Wizard State
  const [authStatus, setAuthStatus] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showSetupWizard, setShowSetupWizard] = useState(
    window.location.pathname === '/setup' || window.location.hash === '#setup'
  );

  // Close mobile drawer on Escape and lock body scrolling when open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Check if current URL is an OAuth callback
  const isOAuthCallback = window.location.pathname.startsWith('/auth/discord') || 
                          window.location.pathname.startsWith('/discord/callback') ||
                          (window.location.search.includes('code=') && window.location.search.includes('state='));

  if (isOAuthCallback) {
    return <DiscordOAuthCallbackPage onBackToDashboard={() => window.location.href = '/'} />;
  }

  // Verify authentication and setup status
  const fetchAuthStatus = async () => {
    try {
      const token = localStorage.getItem('mc_session_token');
      const res = await fetch('/api/auth/status', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
        if (!data.isConfigured) {
          setShowSetupWizard(true);
        } else {
          setShowSetupWizard(false);
          if (window.location.pathname === '/setup' || window.location.hash === '#setup') {
            window.history.replaceState({}, document.title, '/');
          }
        }
        return data;
      }
    } catch (err) {
      console.error('Failed to fetch auth status:', err);
    } finally {
      setIsCheckingAuth(false);
    }
    return null;
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('mc_session_token');
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
    } catch (e) {}
    localStorage.removeItem('mc_session_token');
    setAuthStatus(prev => prev ? { ...prev, isAuthenticated: false } : null);
    showToast('Erfolgreich abgemeldet.');
  };

  // Load cluster config
  const fetchCluster = async () => {
    try {
      const res = await fetch('/api/cluster');
      if (res.ok) {
        const data = await res.json();
        setClusterConfig(data);
        if (!consoleNodeId && data.nodes?.length > 0) {
          setConsoleNodeId(data.nodes[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load cluster:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll live status every 5 seconds
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/cluster/status');
      if (res.ok) {
        const metricsList = await res.json();
        setClusterConfig(prev => {
          if (!prev) return prev;
          const updatedNodes = prev.nodes.map(n => {
            const m = metricsList.find(x => x.nodeId === n.id);
            if (m) {
              return {
                ...n,
                status: m.status,
                cpuPercent: m.cpuPercent,
                ramUsedMb: m.memoryUsedMb
              };
            }
            return n;
          });
          return { ...prev, nodes: updatedNodes };
        });
      }
    } catch {}
  };

  useEffect(() => {
    fetchAuthStatus().then(status => {
      if (status?.isAuthenticated) {
        fetchCluster();
      }
    });

    const interval = setInterval(() => {
      if (authStatus?.isAuthenticated) {
        fetchStatus();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [authStatus?.isAuthenticated]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Node Actions
  const handleSaveNode = async (nodeData) => {
    try {
      const res = await fetch('/api/cluster/node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nodeData)
      });
      if (res.ok) {
        showToast(`Server '${nodeData.name}' gespeichert.`);
        setEditingNode(null);
        setIsAddingNode(false);
        fetchCluster();
      }
    } catch (err) {
      showToast('Fehler beim Speichern: ' + err.message, 'error');
    }
  };

  const handleDeleteNode = async (nodeId) => {
    if (!window.confirm('Diesen Server wirklich aus dem Cluster entfernen?')) return;
    try {
      const res = await fetch(`/api/cluster/node/${nodeId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Server entfernt.');
        fetchCluster();
      }
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error');
    }
  };

  const handleStartNode = async (nodeId) => {
    try {
      showToast('Start-Befehl gesendet...', 'info');
      await fetch(`/api/cluster/node/${nodeId}/start`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      showToast('Fehler beim Starten: ' + err.message, 'error');
    }
  };

  const handleStopNode = async (nodeId) => {
    try {
      showToast('Stopp-Befehl gesendet...', 'info');
      await fetch(`/api/cluster/node/${nodeId}/stop`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      showToast('Fehler beim Stoppen: ' + err.message, 'error');
    }
  };

  const handleRestartNode = async (nodeId) => {
    try {
      showToast('Neustart-Befehl gesendet...', 'info');
      await fetch(`/api/cluster/node/${nodeId}/restart`, { method: 'POST' });
      fetchStatus();
    } catch (err) {
      showToast('Fehler beim Neustart: ' + err.message, 'error');
    }
  };

  const handleStartAll = async () => {
    try {
      showToast('Starte gesamtes Dimension-Cluster...', 'info');
      await fetch('/api/cluster/start-all', { method: 'POST' });
      setTimeout(fetchStatus, 3000);
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error');
    }
  };

  const handleStopAll = async () => {
    try {
      showToast('Stoppe gesamtes Dimension-Cluster...', 'info');
      await fetch('/api/cluster/stop-all', { method: 'POST' });
      setTimeout(fetchStatus, 3000);
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error');
    }
  };

  const handleSyncWaterfall = async () => {
    try {
      showToast('Synchronisiere Waterfall-Proxy mit Dimensionen...', 'info');
      const res = await fetch('/api/cluster/sync-waterfall', { method: 'POST' });
      if (res.ok) {
        showToast('Waterfall config.yml aktualisiert & neu geladen!');
      }
    } catch (err) {
      showToast('Fehler bei der Synchronisation: ' + err.message, 'error');
    }
  };

  const handleOpenConsole = (nodeId) => {
    setConsoleNodeId(nodeId);
    setActiveTab('console');
  };

  const nodes = clusterConfig?.nodes || [];
  const onlineCount = nodes.filter(n => n.status === 'Online').length;
  const totalRamMb = nodes.reduce((acc, curr) => acc + (curr.memoryAllocationMb || 0), 0);

  // Permission calculation based on authStatus
  const perms = authStatus?.permissions || (authStatus?.authMethod === 'local' ? {
    isSuperAdmin: true,
    allowDashboardLogin: true,
    canControlCluster: true,
    canManageNodes: true,
    canAccessConsole: true,
    canManageWorlds: true,
    canManagePlugins: true,
    canManageDiscord: true
  } : null);

  const isSuperAdmin = !!perms?.isSuperAdmin;
  const canControlCluster = isSuperAdmin || !!perms?.canControlCluster;
  const canManageNodes = isSuperAdmin || !!perms?.canManageNodes;
  const canAccessConsole = isSuperAdmin || !!perms?.canAccessConsole;
  const canManageWorlds = isSuperAdmin || !!perms?.canManageWorlds;
  const canManagePlugins = isSuperAdmin || !!perms?.canManagePlugins;
  const canManageDiscord = isSuperAdmin || !!perms?.canManageDiscord;

  const navigationTabs = [
    { id: 'topology', label: 'TOPOLOGIE', icon: <WaterfallBeaconIcon size={16} />, visible: true },
    { id: 'nodes', label: `SERVER & SSH (${nodes.length})`, icon: <GrassBlockIcon size={16} />, visible: canManageNodes },
    { id: 'console', label: 'LIVE KONSOLE', icon: <CommandBlockIcon size={16} />, visible: canAccessConsole },
    { id: 'portals', label: 'DIMENSIONS & PORTALS', icon: <NetherPortalIcon size={16} />, visible: canManageNodes },
    { id: 'discord', label: 'DISCORD AUTH & OAUTH2', icon: <Shield size={16} />, visible: canManageDiscord },
    { id: 'plugins', label: 'MODRINTH PLUGINS', icon: <Package size={16} />, visible: canManagePlugins },
    { id: 'worlds', label: 'WELTEN & BACKUP', icon: <Compass size={16} />, visible: canManageWorlds },
    { id: 'settings', label: 'EINSTELLUNGEN', icon: <Settings size={16} />, visible: isSuperAdmin }
  ];

  const visibleTabs = navigationTabs.filter(t => t.visible);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(t => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [visibleTabs, activeTab]);

  if (isCheckingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0e13' }}>
        <RefreshCw size={28} className="spin-anim" color="var(--mc-aqua)" />
        <span style={{ color: 'var(--mc-gray)', fontFamily: 'var(--mc-font)', marginLeft: '12px', fontSize: '0.8rem' }}>
          Lade System-Authentifizierung...
        </span>
      </div>
    );
  }

  // Setup is strictly one-time: only show if the system is not configured yet
  if (!authStatus?.isConfigured) {
    return (
      <SetupWizardPage
        onSetupCompleted={() => {
          setShowSetupWizard(false);
          fetchAuthStatus().then(() => fetchCluster());
        }}
      />
    );
  }

  if (!authStatus?.isAuthenticated) {
    return (
      <LoginPage
        authStatus={authStatus}
        onLoginSuccess={() => {
          fetchAuthStatus().then(() => fetchCluster());
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 2000,
          background: toast.type === 'error' ? '#591616' : '#102e1c',
          border: `3px solid ${toast.type === 'error' ? 'var(--mc-red)' : 'var(--mc-green)'}`,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#fff',
          fontSize: '0.8rem',
          fontFamily: 'var(--mc-font)',
          boxShadow: '0 8px 24px #000'
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} color="var(--mc-red)" /> : <CheckCircle2 size={18} color="var(--mc-green)" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Minecraft Navigation Header */}
      <header className="mc-header-container" style={{
        background: '#191b22',
        borderBottom: '4px solid #373945',
        boxShadow: '0 4px 0 #0d0e12, 0 10px 25px rgba(0,0,0,0.8)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '14px 24px'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          {/* Brand with Generated Minecraft Discord Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: '#0d0e12',
              border: '2px solid var(--mc-blue)',
              boxShadow: '0 0 14px rgba(85,85,255,0.4), inset 2px 2px 0 #000',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              <img
                src="/logo.jpg"
                alt="Waterfall Discord Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 className="mc-title mc-title-brand" style={{ fontSize: '1.05rem', color: 'var(--mc-white)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {clusterConfig?.clusterName?.toUpperCase() || 'MINECRAFT WATERFALL CLUSTER'}
                </h1>
                <span className="mc-badge mc-badge-proxy desktop-only" style={{ fontSize: '0.65rem' }}>
                  DISCORD OAUTH2
                </span>
              </div>
              <p className="desktop-only" style={{ fontSize: '0.7rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                Multi-Dimension Server Orchestration & Discord In-Game Verification
              </p>
            </div>
          </div>

          {/* Minecraft Item Slots for Stats - Desktop */}
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="mc-slot">
              <span style={{ fontSize: '0.6rem', color: 'var(--mc-gray)', display: 'block' }}>ONLINE SERVER</span>
              <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: onlineCount > 0 ? 'var(--mc-green)' : 'var(--mc-dark-gray)' }}>
                {onlineCount} / {nodes.length}
              </span>
            </div>
            <div className="mc-slot">
              <span style={{ fontSize: '0.6rem', color: 'var(--mc-gray)', display: 'block' }}>GESAMT-RAM</span>
              <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--mc-aqua)' }}>
                {(totalRamMb / 1024).toFixed(1)} GB
              </span>
            </div>
          </div>

          {/* Global Master Cluster Controls - Desktop */}
          <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canControlCluster && (
              <>
                <button onClick={handleStartAll} className="mc-btn mc-btn-green" title="Alle Server starten">
                  <Play size={13} /> CLUSTER STARTEN
                </button>
                <button onClick={handleStopAll} className="mc-btn mc-btn-red" title="Alle Server herunterfahren">
                  <Square size={13} /> STOPPEN
                </button>
                <button onClick={handleSyncWaterfall} className="mc-btn mc-btn-blue" title="Waterfall config.yml aktualisieren und neu laden">
                  <RotateCw size={13} /> PROXY SYNC
                </button>
              </>
            )}

            {/* Logged in Admin Pill & Logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '2px solid #2d303b', paddingLeft: '10px' }}>
              <div className="mc-slot" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', height: 'auto' }}>
                {authStatus?.avatarUrl ? (
                  <img src={authStatus.avatarUrl} alt="Avatar" style={{ width: '18px', height: '18px', borderRadius: '50%' }} />
                ) : (
                  <UserIcon size={14} color="var(--mc-aqua)" />
                )}
                <span style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 'bold' }}>
                  {authStatus?.username || 'Admin'}
                </span>
                {isSuperAdmin ? (
                  <span className="mc-badge mc-badge-gold" style={{ fontSize: '0.55rem', padding: '1px 5px' }}>👑 SUPER-ADMIN</span>
                ) : authStatus?.authMethod === 'discord' ? (
                  <span className="mc-badge mc-badge-proxy" style={{ fontSize: '0.55rem', padding: '1px 5px' }}>DISCORD</span>
                ) : null}
              </div>
              <button
                onClick={handleLogout}
                className="mc-btn mc-btn-red"
                style={{ padding: '6px 10px' }}
                title="Vom Dashboard abmelden"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>

          {/* Mobile Right Controls: Compact Online Status & Animated 3-Bar Hamburger */}
          <div className="mobile-only" style={{ alignItems: 'center', gap: '10px' }}>
            <div className="mc-slot" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`mc-status-dot ${onlineCount > 0 ? 'mc-status-online' : 'mc-status-offline'}`} />
              <span className="font-mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: onlineCount > 0 ? 'var(--mc-green)' : 'var(--mc-gray)' }}>
                {onlineCount}/{nodes.length}
              </span>
            </div>

            {/* The Animated 3-Bar Hamburger Button */}
            <button
              type="button"
              className={`mc-hamburger-btn ${mobileMenuOpen ? 'is-active' : ''}`}
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? 'Menü schließen' : 'Menü öffnen'}
              title="Menü umschalten"
            >
              <span className="mc-hamburger-bar"></span>
              <span className="mc-hamburger-bar"></span>
              <span className="mc-hamburger-bar"></span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Desktop Horizontal View */}
        <div className="desktop-only" style={{ maxWidth: '1400px', margin: '14px auto 0', display: 'flex', gap: '8px', borderTop: '2px solid #282a35', paddingTop: '10px', flexWrap: 'wrap' }}>
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`mc-btn ${activeTab === tab.id ? 'mc-btn-blue' : ''}`}
              style={{ padding: '6px 14px', fontSize: '0.75rem' }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      <div 
        className={`mc-mobile-backdrop ${mobileMenuOpen ? 'open' : ''}`} 
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Slide-out Mobile Drawer */}
      <aside className={`mc-mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        {/* Drawer Header */}
        <div className="mc-drawer-header">
          <div className="mc-drawer-title">
            <WaterfallBeaconIcon size={18} />
            <span>CLUSTER MENÜ</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="mc-btn mc-btn-red"
            style={{ padding: '5px 10px', fontSize: '0.75rem' }}
            title="Schließen"
          >
            ✕
          </button>
        </div>

        {/* User / Admin Info */}
        <div className="mc-slot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {authStatus?.avatarUrl ? (
              <img src={authStatus.avatarUrl} alt="Avatar" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
            ) : (
              <UserIcon size={18} color="var(--mc-aqua)" />
            )}
            <div>
              <div style={{ fontSize: '0.78rem', color: '#fff', fontWeight: 'bold' }}>
                {authStatus?.username || 'Admin'}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--mc-gray)' }}>
                {isSuperAdmin ? '👑 Super-Admin' : authStatus?.authMethod === 'discord' ? 'Discord OAuth2' : 'Passwort Auth'}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
            className="mc-btn mc-btn-red"
            style={{ padding: '5px 10px', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Abmelden"
          >
            <LogOut size={12} /> LOGOUT
          </button>
        </div>

        {/* Server Metrics in Mobile Drawer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div className="mc-slot">
            <span style={{ fontSize: '0.58rem', color: 'var(--mc-gray)', display: 'block' }}>ONLINE SERVER</span>
            <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: onlineCount > 0 ? 'var(--mc-green)' : 'var(--mc-dark-gray)' }}>
              {onlineCount} / {nodes.length}
            </span>
          </div>
          <div className="mc-slot">
            <span style={{ fontSize: '0.58rem', color: 'var(--mc-gray)', display: 'block' }}>GESAMT-RAM</span>
            <span className="font-mono" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--mc-aqua)' }}>
              {(totalRamMb / 1024).toFixed(1)} GB
            </span>
          </div>
        </div>

        {/* Cluster Action Buttons in Mobile Drawer */}
        {canControlCluster && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span className="mc-label" style={{ fontSize: '0.68rem', color: 'var(--mc-aqua)', marginBottom: '2px' }}>
              ⚡ CLUSTER-AKTIONEN
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button 
                onClick={() => { setMobileMenuOpen(false); handleStartAll(); }} 
                className="mc-btn mc-btn-green"
                style={{ padding: '8px 10px', fontSize: '0.72rem', justifyContent: 'center' }}
              >
                <Play size={13} /> STARTEN
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); handleStopAll(); }} 
                className="mc-btn mc-btn-red"
                style={{ padding: '8px 10px', fontSize: '0.72rem', justifyContent: 'center' }}
              >
                <Square size={13} /> STOPPEN
              </button>
            </div>
            <button 
              onClick={() => { setMobileMenuOpen(false); handleSyncWaterfall(); }} 
              className="mc-btn mc-btn-blue"
              style={{ padding: '8px 10px', fontSize: '0.72rem', justifyContent: 'center', marginTop: '2px' }}
            >
              <RotateCw size={13} /> PROXY SYNC
            </button>
          </div>
        )}

        {/* Navigation Tabs in Mobile Drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
          <span className="mc-label" style={{ fontSize: '0.68rem', color: 'var(--mc-aqua)', marginBottom: '2px' }}>
            🧭 DIMENSIONEN & NAVIGATION
          </span>
          {visibleTabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`mc-btn mc-drawer-item ${isActive ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {tab.icon}
                  <span>{tab.label}</span>
                </div>
                {isActive && <span style={{ color: 'var(--mc-yellow)', fontWeight: 'bold', fontSize: '1rem' }}>›</span>}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1400px', width: '100%', margin: '0 auto', padding: '24px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '12px' }}>
            <RefreshCw size={24} className="spin-anim" color="var(--mc-aqua)" />
            <span style={{ color: 'var(--mc-gray)', fontFamily: 'var(--mc-font)' }}>Lade Cluster-Konfiguration...</span>
          </div>
        ) : (
          <>
            {activeTab === 'topology' && (
              <ClusterTopology
                nodes={nodes}
                onSelectNode={(node) => {
                  setEditingNode(node);
                }}
                onDeployCluster={() => {
                  setIsFullClusterDeploy(true);
                  setDeployingNode(null);
                }}
              />
            )}

            {activeTab === 'nodes' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 className="mc-title" style={{ fontSize: '1.05rem', color: '#fff' }}>
                      CLUSTER-KNOTEN & SSH-VERWALTUNG
                    </h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                      Definiere IP-Adressen, SSH-Benutzer, Passwörter und Ports für alle Dimensionen
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsAddingNode(true);
                      setEditingNode(null);
                    }}
                    className="mc-btn mc-btn-gold"
                    style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                  >
                    <Plus size={16} /> SERVER HINZUFÜGEN
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                  {nodes.map(node => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      onEdit={(n) => setEditingNode(n)}
                      onDelete={handleDeleteNode}
                      onStart={handleStartNode}
                      onStop={handleStopNode}
                      onRestart={handleRestartNode}
                      onOpenConsole={handleOpenConsole}
                      onDeploy={(nodeId) => {
                        const targetNode = nodes.find(n => n.id === nodeId);
                        setDeployingNode(targetNode);
                        setIsFullClusterDeploy(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'console' && (
              <LiveConsole
                nodes={nodes}
                activeNodeId={consoleNodeId}
                onSelectNode={(node) => setConsoleNodeId(node.id)}
              />
            )}

            {activeTab === 'portals' && (
              <PortalGuide />
            )}

            {activeTab === 'discord' && (
              <DiscordAuthTab />
            )}

            {activeTab === 'plugins' && (
              <PluginManagerTab
                nodes={nodes}
                onToast={showToast}
                onRestartNode={handleRestartNode}
              />
            )}

            {activeTab === 'worlds' && (
              <WorldsTab
                onToast={showToast}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsTab
                authStatus={authStatus}
                onLogout={handleLogout}
                onToast={showToast}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        padding: '16px',
        borderTop: '3px solid #282a35',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--mc-gray)',
        background: '#121318',
        fontFamily: 'var(--mc-font)'
      }}>
        Minecraft Waterfall Cluster Manager • Discord OAuth2 In-Game Verification • SSH Automation
      </footer>

      {/* Node Edit / Add Modal */}
      {(editingNode || isAddingNode) && (
        <NodeEditModal
          node={editingNode}
          onSave={handleSaveNode}
          onClose={() => {
            setEditingNode(null);
            setIsAddingNode(false);
          }}
        />
      )}

      {/* Cluster / Node Deploy Modal */}
      {(deployingNode || isFullClusterDeploy) && (
        <ClusterDeployModal
          node={deployingNode}
          isFullCluster={isFullClusterDeploy}
          onClose={() => {
            setDeployingNode(null);
            setIsFullClusterDeploy(false);
          }}
          onCompleted={() => {
            fetchCluster();
          }}
        />
      )}
    </div>
  );
}
