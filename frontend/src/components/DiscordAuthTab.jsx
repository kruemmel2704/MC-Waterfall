import React, { useState, useEffect } from 'react';
import { 
  Key, Shield, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, 
  Trash2, Plus, Sparkles, UserCheck, ShieldCheck, Copy, Check, Zap, Users, Crown,
  Globe, Terminal, Compass, Server, Box, Edit3, Lock, ShieldAlert, Clock
} from 'lucide-react';
import { CommandBlockIcon, RedstoneTorchIcon, GrassBlockIcon, WaterfallBeaconIcon } from './MinecraftIcons';

export default function DiscordAuthTab() {
  const [config, setConfig] = useState(null);
  const [guildInfo, setGuildInfo] = useState(null);
  const [linkedPlayers, setLinkedPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Manual link form
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ minecraftUsername: '', discordId: '', discordTag: '' });

  // Test Simulator
  const [testPlayerName, setTestPlayerName] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState(null);

  // Role Synchronization State
  const [roleMappings, setRoleMappings] = useState([]);
  const [syncingRoles, setSyncingRoles] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showMappingModal, setShowMappingModal] = useState(false);

  const emptyMapping = {
    id: '',
    discordRoleId: '',
    discordRoleName: '',
    discordRoleColor: 0,
    minecraftGroup: 'vip',
    prefix: '&b[VIP] ',
    priority: 20,
    autoSync: true,
    customCommand: '',
    isOperator: false,
    allowMinecraftJoin: true,
    webPermissions: {
      allowDashboardLogin: false,
      isSuperAdmin: false,
      canControlCluster: false,
      canManageNodes: false,
      canAccessConsole: false,
      canManageWorlds: false,
      canManagePlugins: false,
      canManageDiscord: false
    }
  };

  const [mappingForm, setMappingForm] = useState(emptyMapping);

  const applyPreset = (presetName) => {
    switch (presetName) {
      case 'superadmin':
        setMappingForm(prev => ({
          ...prev,
          minecraftGroup: 'admin',
          prefix: '&c[Admin] ',
          priority: 100,
          customCommand: '',
          isOperator: true,
          allowMinecraftJoin: true,
          webPermissions: {
            allowDashboardLogin: true,
            isSuperAdmin: true,
            canControlCluster: true,
            canManageNodes: true,
            canAccessConsole: true,
            canManageWorlds: true,
            canManagePlugins: true,
            canManageDiscord: true
          }
        }));
        break;
      case 'mod':
        setMappingForm(prev => ({
          ...prev,
          minecraftGroup: 'moderator',
          prefix: '&9[Mod] ',
          priority: 50,
          customCommand: '',
          isOperator: false,
          allowMinecraftJoin: true,
          webPermissions: {
            allowDashboardLogin: true,
            isSuperAdmin: false,
            canControlCluster: true,
            canManageNodes: false,
            canAccessConsole: true,
            canManageWorlds: true,
            canManagePlugins: true,
            canManageDiscord: false
          }
        }));
        break;
      case 'builder':
        setMappingForm(prev => ({
          ...prev,
          minecraftGroup: 'builder',
          prefix: '&a[Builder] ',
          priority: 30,
          customCommand: '',
          isOperator: false,
          allowMinecraftJoin: true,
          webPermissions: {
            allowDashboardLogin: true,
            isSuperAdmin: false,
            canControlCluster: false,
            canManageNodes: false,
            canAccessConsole: false,
            canManageWorlds: true,
            canManagePlugins: false,
            canManageDiscord: false
          }
        }));
        break;
      case 'vip':
        setMappingForm(prev => ({
          ...prev,
          minecraftGroup: 'vip',
          prefix: '&b[VIP] ',
          priority: 20,
          customCommand: '',
          isOperator: false,
          allowMinecraftJoin: true,
          webPermissions: {
            allowDashboardLogin: false,
            isSuperAdmin: false,
            canControlCluster: false,
            canManageNodes: false,
            canAccessConsole: false,
            canManageWorlds: false,
            canManagePlugins: false,
            canManageDiscord: false
          }
        }));
        break;
      case 'player':
        setMappingForm(prev => ({
          ...prev,
          minecraftGroup: 'default',
          prefix: '',
          priority: 10,
          customCommand: '',
          isOperator: false,
          allowMinecraftJoin: true,
          webPermissions: {
            allowDashboardLogin: false,
            isSuperAdmin: false,
            canControlCluster: false,
            canManageNodes: false,
            canAccessConsole: false,
            canManageWorlds: false,
            canManagePlugins: false,
            canManageDiscord: false
          }
        }));
        break;
      default:
        break;
    }
  };

  const handleEditRoleMapping = (m) => {
    setMappingForm({
      id: m.id,
      discordRoleId: m.discordRoleId,
      discordRoleName: m.discordRoleName || '',
      discordRoleColor: m.discordRoleColor || 0,
      minecraftGroup: m.minecraftGroup || 'default',
      prefix: m.prefix || '',
      priority: m.priority ?? 10,
      autoSync: m.autoSync ?? true,
      customCommand: m.customCommand || '',
      isOperator: !!m.isOperator,
      allowMinecraftJoin: m.allowMinecraftJoin !== false,
      webPermissions: {
        allowDashboardLogin: !!m.webPermissions?.allowDashboardLogin,
        isSuperAdmin: !!m.webPermissions?.isSuperAdmin,
        canControlCluster: !!m.webPermissions?.canControlCluster,
        canManageNodes: !!m.webPermissions?.canManageNodes,
        canAccessConsole: !!m.webPermissions?.canAccessConsole,
        canManageWorlds: !!m.webPermissions?.canManageWorlds,
        canManagePlugins: !!m.webPermissions?.canManagePlugins,
        canManageDiscord: !!m.webPermissions?.canManageDiscord
      }
    });
    setShowMappingModal(true);
  };

  const [enforcingWhitelist, setEnforcingWhitelist] = useState(false);
  const [installingSrv, setInstallingSrv] = useState(false);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [cfgRes, linksRes, rolesRes] = await Promise.all([
        fetch('/api/discord/config'),
        fetch('/api/discord/minecraft/links'),
        fetch('/api/discord/roles/mappings')
      ]);

      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setConfig(cfgData);
        if (cfgData.guildId) {
          verifyGuild(cfgData.guildId);
        }
      }

      if (linksRes.ok) {
        const linksData = await linksRes.json();
        setLinkedPlayers(linksData);
      }

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoleMappings(rolesData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncRoles = async () => {
    setSyncingRoles(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/discord/roles/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      setSyncResult(data);
      if (data.success) {
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Synchronisieren: ' + err.message });
    } finally {
      setSyncingRoles(false);
    }
  };

  const handleSaveRoleMapping = async (e) => {
    e.preventDefault();
    if (!mappingForm.discordRoleId) {
      alert('Bitte eine Discord-Rolle auswählen.');
      return;
    }

    const itemToSave = {
      ...mappingForm,
      id: mappingForm.id || Math.random().toString(36).slice(2, 9),
      priority: Number(mappingForm.priority) || 10,
      webPermissions: {
        ...mappingForm.webPermissions,
        allowDashboardLogin: mappingForm.webPermissions?.isSuperAdmin ? true : !!mappingForm.webPermissions?.allowDashboardLogin
      }
    };

    let updated;
    if (mappingForm.id) {
      updated = roleMappings.map(m => m.id === mappingForm.id ? itemToSave : m);
    } else {
      updated = [...roleMappings, itemToSave];
    }

    try {
      const res = await fetch('/api/discord/roles/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setRoleMappings(updated);
        setShowMappingModal(false);
        setMessage({ type: 'success', text: 'Rollen-Zuordnung erfolgreich gespeichert!' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteRoleMapping = async (id) => {
    const updated = roleMappings.filter(m => m.id !== id);
    try {
      const res = await fetch('/api/discord/roles/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setRoleMappings(updated);
        setMessage({ type: 'success', text: 'Rollen-Zuordnung entfernt.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const verifyGuild = async (gId, bToken) => {
    setVerifying(true);
    try {
      const q = new URLSearchParams();
      if (gId) q.append('guildId', gId.trim());
      // Only append botToken if it's a freshly entered token (not masked bullets or asterisks)
      if (bToken && !bToken.includes('•') && !bToken.includes('*')) {
        q.append('botToken', bToken.trim());
      }

      const res = await fetch(`/api/discord/verify-guild?${q.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGuildInfo(data);
      }
    } catch {}
    finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/discord/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Discord-Konfiguration erfolgreich gespeichert!' });
        verifyGuild(config.guildId);
      } else {
        setMessage({ type: 'error', text: 'Fehler beim Speichern.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleEnforceWhitelist = async (enable = true) => {
    setEnforcingWhitelist(true);
    try {
      const res = await fetch(`/api/discord/whitelist/enforce?enabled=${enable}`, { method: 'POST' });
      const data = await res.json();
      setMessage({ type: data.success ? 'success' : 'error', text: data.message });
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler: ' + err.message });
    } finally {
      setEnforcingWhitelist(false);
    }
  };

  const handleInstallDiscordSrv = async () => {
    if (!window.confirm('Möchtest du das DiscordSRV-Plugin jetzt automatisch auf den Minecraft-Servern installieren und mit deinem Bot-Token verbinden?')) return;
    setInstallingSrv(true);
    try {
      const res = await fetch('/api/discord/install-discordsrv', { method: 'POST' });
      const data = await res.json();
      setMessage({ type: data.success ? 'success' : 'error', text: data.message });
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler: ' + err.message });
    } finally {
      setInstallingSrv(false);
    }
  };

  const handleUnlink = async (username) => {
    if (!window.confirm(`Möchtest du ${username} wirklich entkoppeln und von der Whitelist entfernen?`)) return;
    try {
      const res = await fetch(`/api/discord/minecraft/links/${username}`, { method: 'DELETE' });
      if (res.ok) {
        setLinkedPlayers(prev => prev.filter(p => p.minecraftUsername !== username));
        setMessage({ type: 'success', text: `Spieler ${username} entkoppelt.` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleManualLink = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/discord/minecraft/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualForm)
      });
      if (res.ok) {
        const newLink = await res.json();
        setLinkedPlayers(prev => [newLink, ...prev.filter(p => p.minecraftUsername !== newLink.minecraftUsername)]);
        setShowManualModal(false);
        setManualForm({ minecraftUsername: '', discordId: '', discordTag: '' });
        setMessage({ type: 'success', text: `Spieler ${newLink.minecraftUsername} erfolgreich verknüpft!` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleSimulateOAuth = async () => {
    if (!testPlayerName.trim()) return;
    setSimulating(true);
    setSimResult(null);
    try {
      // Fetch OAuth URL with state
      const res = await fetch(`/api/discord/oauth/url?state=${encodeURIComponent(testPlayerName.trim())}`);
      const data = await res.json();
      setSimResult({
        url: data.url,
        player: testPlayerName.trim()
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler: ' + err.message });
    } finally {
      setSimulating(false);
    }
  };

  const botInviteUrl = config?.clientId 
    ? `https://discord.com/oauth2/authorize?client_id=${config.clientId}&scope=bot%20applications.commands&permissions=8`
    : '#';

  if (loading || !config) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', gap: '12px' }}>
        <RefreshCw size={24} className="spin-anim" color="var(--mc-aqua)" />
        <span style={{ color: 'var(--mc-gray)', fontFamily: 'var(--mc-font)' }}>Lade Discord-Konfiguration...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner with Custom Generated Logo */}
      <div className="mc-panel" style={{
        padding: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        borderLeft: '6px solid var(--mc-blue)',
        flexWrap: 'wrap'
      }}>
        <div style={{
          width: '90px',
          height: '90px',
          border: '3px solid var(--mc-blue)',
          boxShadow: '0 0 20px rgba(85, 85, 255, 0.4), inset 2px 2px 0 #000',
          overflow: 'hidden',
          background: '#0d0e12',
          flexShrink: 0
        }}>
          <img
            src="/logo.jpg"
            alt="Minecraft Discord Waterfall Logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="mc-title" style={{ fontSize: '1.2rem', color: '#fff' }}>
              DISCORD OAUTH2 AUTHENTIFIZIERUNG & SERVER-LINK
            </span>
            <span className={`mc-badge ${config.isEnabled ? 'mc-badge-proxy' : 'mc-badge-nether'}`}>
              {config.isEnabled ? 'AKTIV' : 'DEAKTIVIERT'}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--mc-gray)', lineHeight: '1.6' }}>
            Verbinde deinen Discord-Server direkt mit dem Minecraft Waterfall-Cluster. Spieler und Administratoren loggen sich nahtlos via <strong>Discord OAuth2</strong> ein. Nur autorisierte Mitglieder deines Discord-Servers erhalten Zutritt zu den Dimensionen!
          </p>
        </div>

        <div>
          <button
            onClick={() => setConfig({ ...config, isEnabled: !config.isEnabled })}
            className={`mc-btn ${config.isEnabled ? 'mc-btn-red' : 'mc-btn-green'}`}
            style={{ padding: '10px 18px', fontSize: '0.8rem' }}
          >
            {config.isEnabled ? 'AUTH DEAKTIVIEREN' : 'AUTH AKTIVIEREN'}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          background: message.type === 'error' ? '#4a1212' : '#0d381b',
          border: `2px solid ${message.type === 'error' ? 'var(--mc-red)' : 'var(--mc-green)'}`,
          color: '#fff',
          fontFamily: 'var(--mc-font)',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Grid: Settings & Server Verification */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        {/* Discord Bot & App Credentials */}
        <div className="mc-panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <CommandBlockIcon size={22} />
            <h3 className="mc-title" style={{ fontSize: '0.9rem', color: 'var(--mc-yellow)' }}>
              1. DISCORD ENTWICKLER-APP (OAUTH2 & BOT)
            </h3>
          </div>

          <form onSubmit={handleSave}>
            <div style={{ marginBottom: '12px' }}>
              <label className="mc-label">CLIENT ID (APPLICATION ID)</label>
              <input
                type="text"
                className="mc-input"
                placeholder="z.B. 123456789012345678"
                value={config.clientId}
                onChange={e => setConfig({ ...config, clientId: e.target.value })}
                required
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="mc-label">CLIENT SECRET (OAUTH2 SECRET)</label>
              <input
                type="password"
                className="mc-input"
                placeholder="Discord Client Secret"
                value={config.clientSecret}
                onChange={e => setConfig({ ...config, clientSecret: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="mc-label">BOT TOKEN (FÜR GUILD & ROLLEN-VERIFIKATION)</label>
              <input
                type="password"
                className="mc-input"
                placeholder="Discord Bot Token"
                value={config.botToken}
                onChange={e => setConfig({ ...config, botToken: e.target.value })}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label className="mc-label">DISCORD GUILD ID (SERVER-ID DES CLANS/NETZWERKS)</label>
              <input
                type="text"
                className="mc-input font-mono"
                placeholder="z.B. 987654321098765432"
                value={config.guildId}
                onChange={e => setConfig({ ...config, guildId: e.target.value })}
                required
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', marginTop: '2px', display: 'block' }}>
                Rechtsklick auf deinen Discord-Server &gt; Server-ID kopieren (Entwicklermodus muss an sein)
              </span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="mc-label" style={{ margin: 0 }}>OAUTH2 REDIRECT URI</label>
                <button
                  type="button"
                  onClick={() => {
                    const detected = `${window.location.origin}/auth/discord`;
                    setConfig({ ...config, redirectUri: detected });
                    navigator.clipboard.writeText(detected);
                    setMessage({ type: 'success', text: `Aktuelle Redirect URI kopiert & gesetzt: ${detected}` });
                  }}
                  className="mc-btn"
                  style={{ padding: '2px 8px', fontSize: '0.65rem' }}
                >
                  AKTUELLE IP/DOMAIN ÜBERNEHMEN
                </button>
              </div>
              <input
                type="text"
                className="mc-input font-mono"
                value={config.redirectUri}
                onChange={e => setConfig({ ...config, redirectUri: e.target.value })}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', marginTop: '2px', display: 'block' }}>
                Trage genau diese URL im Discord Portal unter <strong>OAuth2 ➔ Redirects</strong> ein!
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" disabled={saving} className="mc-btn mc-btn-green" style={{ flex: 1, padding: '8px' }}>
                {saving ? 'SPEICHERE...' : 'KONFIGURATION SPEICHERN'}
              </button>
              {config.clientId && (
                <a
                  href={botInviteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mc-btn mc-btn-blue"
                  style={{ padding: '8px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  BOT EINLADEN <ExternalLink size={13} />
                </a>
              )}
            </div>
          </form>
        </div>

        {/* Discord Server Status & In-Game Rules */}
        <div className="mc-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RedstoneTorchIcon size={22} />
                <h3 className="mc-title" style={{ fontSize: '0.9rem', color: 'var(--mc-yellow)' }}>
                  2. VERBUNDENER DISCORD-SERVER
                </h3>
              </div>
              <button
                onClick={() => verifyGuild(config.guildId)}
                disabled={verifying || !config.guildId}
                className="mc-btn"
                style={{ padding: '4px 10px', fontSize: '0.7rem' }}
              >
                <RefreshCw size={12} className={verifying ? 'spin-anim' : ''} />
                {verifying ? 'PRÜFE...' : 'SERVER PRÜFEN'}
              </button>
            </div>

            {/* Guild Card */}
            {guildInfo?.isBotPresent ? (
              <div style={{
                background: '#0e261a',
                border: '2px solid var(--mc-green)',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '16px'
              }}>
                {guildInfo.iconUrl ? (
                  <img src={guildInfo.iconUrl} alt="Guild Icon" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--mc-green)' }} />
                ) : (
                  <div style={{ width: '48px', height: '48px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mc-green)', fontWeight: 700 }}>
                    DC
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="mc-title" style={{ fontSize: '0.85rem', color: '#fff' }}>
                      {guildInfo.name}
                    </span>
                    <span className="mc-badge mc-badge-overworld" style={{ fontSize: '0.65rem' }}>
                      VERIFIZIERT & AKTIV
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                    Mitglieder: <strong style={{ color: 'var(--mc-green)' }}>{guildInfo.approxMemberCount || 'Online'}</strong> • Rollen: {guildInfo.roles?.length || 0}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: '#2b1010',
                border: '2px solid var(--mc-red)',
                padding: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mc-red)', fontWeight: 700, fontSize: '0.8rem' }}>
                  <AlertCircle size={16} />
                  <span>NOCH NICHT VERBUNDEN ODER BOT FEHLT</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '4px' }}>
                  {guildInfo?.errorMessage || 'Füge den Bot zu deinem Discord-Server hinzu und trage die Server-ID links ein.'}
                </p>
                {config.clientId && (
                  <a
                    href={botInviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mc-btn mc-btn-gold"
                    style={{ marginTop: '10px', padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    Jetzt Bot zum Server hinzufügen <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            {/* In-Game Security Rules */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="mcOAuth"
                  checked={config.enableMinecraftOAuth2}
                  onChange={e => setConfig({ ...config, enableMinecraftOAuth2: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--mc-green)' }}
                />
                <label htmlFor="mcOAuth" className="mc-label" style={{ cursor: 'pointer', margin: 0, color: '#fff' }}>
                  Minecraft-Spieler MÜSSEN sich via Discord OAuth2 verifizieren
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="reqGuild"
                  checked={config.requireGuildMembership}
                  onChange={e => setConfig({ ...config, requireGuildMembership: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--mc-green)' }}
                />
                <label htmlFor="reqGuild" className="mc-label" style={{ cursor: 'pointer', margin: 0, color: '#fff' }}>
                  Nur Mitglieder des verbundenen Discord-Servers akzeptieren
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="autoWhite"
                  checked={config.enableMinecraftWhitelisting}
                  onChange={e => setConfig({ ...config, enableMinecraftWhitelisting: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--mc-green)' }}
                />
                <label htmlFor="autoWhite" className="mc-label" style={{ cursor: 'pointer', margin: 0, color: '#fff' }}>
                  Automatisch auf allen Dimensionen whitelisten (Overworld, Nether, End)
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', borderTop: '2px solid #282a35', paddingTop: '12px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--mc-gray)', display: 'block', marginBottom: '4px' }}>
              KICK-NACHRICHT FÜR UNVERIFIZIERTE SPIELER:
            </span>
            <input
              type="text"
              className="mc-input font-mono"
              value={config.unverifiedKickMessage}
              onChange={e => setConfig({ ...config, unverifiedKickMessage: e.target.value })}
            />
          </div>

          <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleEnforceWhitelist(true)}
              disabled={enforcingWhitelist}
              className="mc-btn mc-btn-green"
              style={{ flex: 1, padding: '7px 10px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              title="Aktiviert 'whitelist on' auf allen Paper-Servern, sodass nur noch verifizierte Discord-Mitglieder beitreten können."
            >
              <ShieldCheck size={14} /> {enforcingWhitelist ? 'AKTIVIERE...' : 'WHITELIST JETZT ERZWINGEN (ON)'}
            </button>

            <button
              type="button"
              onClick={handleInstallDiscordSrv}
              disabled={installingSrv}
              className="mc-btn mc-btn-purple"
              style={{ flex: 1, padding: '7px 10px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              title="Installiert das bekannte DiscordSRV-Plugin von Modrinth auf den Servern und verknüpft automatisch deinen Bot-Token für In-Game Chat."
            >
              <Sparkles size={14} /> {installingSrv ? 'INSTALLIERE...' : 'DISCORDSRV (CHAT-MOD) INSTALLIEREN'}
            </button>
          </div>
        </div>
      </div>

      {/* Linked Players Table & OAuth Simulator */}
      <div className="mc-panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="mc-title" style={{ fontSize: '0.95rem', color: '#fff' }}>
              3. VERIFIZIERTE MINECRAFT SPIELER ({linkedPlayers.length})
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
              Spieler, die ihren Minecraft-Account erfolgreich mit Discord OAuth2 gekoppelt haben
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowManualModal(true)}
              className="mc-btn mc-btn-gold"
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            >
              <Plus size={14} /> MANUELL KOPPELN
            </button>
          </div>
        </div>

        {/* Players List Table */}
        {linkedPlayers.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', background: '#0f1015', border: '2px dashed #2d303d', color: 'var(--mc-gray)' }}>
            <p style={{ fontSize: '0.8rem' }}>Noch keine Spieler über Discord OAuth2 verifiziert.</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--mc-dark-gray)', marginTop: '4px' }}>
              Verwende den Simulator unten oder lasse Spieler über die Waterfall-OAuth-URL beitreten.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#121319', borderBottom: '2px solid #373945', color: 'var(--mc-gray)' }}>
                  <th style={{ padding: '10px 14px' }}>MINECRAFT SPIELER</th>
                  <th style={{ padding: '10px 14px' }}>DISCORD ACCOUNT</th>
                  <th style={{ padding: '10px 14px' }}>DISCORD ID</th>
                  <th style={{ padding: '10px 14px' }}>VERIFIZIERT AM</th>
                  <th style={{ padding: '10px 14px' }}>STATUS</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>AKTION</th>
                </tr>
              </thead>
              <tbody>
                {linkedPlayers.map(link => (
                  <tr key={link.minecraftUsername} style={{ borderBottom: '1px solid #232530', background: 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          background: '#5c4033',
                          border: '1px solid #55aa55',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: '#fff'
                        }}>
                          {link.minecraftUsername.substring(0, 2).toUpperCase()}
                        </div>
                        <strong style={{ color: 'var(--mc-yellow)' }}>{link.minecraftUsername}</strong>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {link.discordAvatar && (
                          <img src={link.discordAvatar} alt="" style={{ width: '22px', height: '22px', borderRadius: '50%' }} />
                        )}
                        <span style={{ color: 'var(--mc-aqua)' }}>{link.discordTag}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }} className="font-mono">
                      <span style={{ color: 'var(--mc-gray)', fontSize: '0.75rem' }}>{link.discordId}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: 'var(--mc-gray)', fontSize: '0.75rem' }}>
                        {new Date(link.linkedAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span className="mc-badge mc-badge-overworld" style={{ fontSize: '0.65rem' }}>
                        WHITELISTED
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleUnlink(link.minecraftUsername)}
                        className="mc-btn mc-btn-red"
                        style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                        title="Entkoppeln"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* OAuth2 Simulator Box */}
        <div style={{
          marginTop: '20px',
          background: '#0d0f16',
          border: '2px solid #2e3347',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Sparkles size={18} color="var(--mc-aqua)" />
            <span className="mc-title" style={{ fontSize: '0.8rem', color: 'var(--mc-aqua)' }}>
              INGAME OAUTH2-LINK SIMULATOR & TEST
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginBottom: '12px' }}>
            Teste den OAuth2-Link, den ein Spieler auf dem Minecraft-Server im Chat anklickt:
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="mc-input"
              style={{ maxWidth: '300px' }}
              placeholder="Minecraft Spielername (z.B. Steve)"
              value={testPlayerName}
              onChange={e => setTestPlayerName(e.target.value)}
            />
            <button
              onClick={handleSimulateOAuth}
              disabled={simulating || !testPlayerName.trim()}
              className="mc-btn mc-btn-blue"
              style={{ padding: '8px 16px' }}
            >
              OAUTH2 LINK GENERIEREN
            </button>
          </div>

          {simResult && (
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: '#0a1d29',
              border: '2px solid var(--mc-aqua)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--mc-gray)', display: 'block' }}>
                  GENERIERTER INGAME-LINK FÜR {simResult.player}:
                </span>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: '#fff', wordBreak: 'break-all' }}>
                  {simResult.url}
                </span>
              </div>
              <a
                href={simResult.url}
                target="_blank"
                rel="noreferrer"
                className="mc-btn mc-btn-green"
                style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                TESTEN <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 4. DISCORD ⬌ MINECRAFT ROLLEN-SYNCHRONISATION (LUCKPERMS) */}
      <div className="mc-panel" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Crown size={22} color="var(--mc-yellow)" />
              <h2 className="mc-subtitle" style={{ margin: 0, color: 'var(--mc-yellow)' }}>
                4. DISCORD ⬌ MINECRAFT ROLLEN-SYNCHRONISATION (LUCKPERMS)
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--mc-gray)' }}>
              Verteile Discord-Rollen automatisch auf Minecraft-Ränge (LuckPerms Groups) & vergebe Chat-Präfixe.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                if (guildInfo?.roles?.length > 0) {
                  const firstRole = guildInfo.roles[0];
                  setMappingForm({
                    ...emptyMapping,
                    discordRoleId: firstRole.id,
                    discordRoleName: firstRole.name,
                    discordRoleColor: firstRole.color
                  });
                } else {
                  setMappingForm(emptyMapping);
                }
                setShowMappingModal(true);
              }}
              className="mc-btn mc-btn-green"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> ROLLE VERKNÜPFEN
            </button>

            <button
              onClick={handleSyncRoles}
              disabled={syncingRoles || roleMappings.length === 0}
              className="mc-btn mc-btn-blue"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Aktualisiert die LuckPerms-Ränge aller verifizierten Spieler auf allen Cluster-Servern"
            >
              <RefreshCw size={16} className={syncingRoles ? 'animate-spin' : ''} />
              {syncingRoles ? 'SYNCHRONISIERE...' : 'ALLE ROLLEN JETZT SYNCHRONISIEREN'}
            </button>
          </div>
        </div>

        {/* Sync Info / Result Banner */}
        {syncResult && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            background: syncResult.success ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
            border: `2px solid ${syncResult.success ? 'var(--mc-green)' : 'var(--mc-red)'}`,
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: syncResult.details?.length ? '6px' : '0' }}>
              {syncResult.success ? <CheckCircle2 size={18} color="var(--mc-green)" /> : <AlertCircle size={18} color="var(--mc-red)" />}
              <strong style={{ fontSize: '0.85rem', color: syncResult.success ? 'var(--mc-green)' : 'var(--mc-red)' }}>
                {syncResult.message}
              </strong>
            </div>
            {syncResult.details?.length > 0 && (
              <ul style={{ margin: '4px 0 0 20px', padding: 0, fontSize: '0.75rem', color: 'var(--mc-gray)' }}>
                {syncResult.details.map((d, idx) => (
                  <li key={idx} className="font-mono">{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Explain Unified Role Permissions */}
        <div style={{
          background: 'rgba(85, 85, 255, 0.08)',
          border: '1px solid rgba(85, 85, 255, 0.3)',
          padding: '12px 14px',
          marginBottom: '16px',
          fontSize: '0.8rem',
          color: '#e0e0e0',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <ShieldCheck size={20} color="var(--mc-aqua)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--mc-aqua)' }}>Zentrale Discord-Rechteverwaltung (Web & Minecraft):</strong>
            <p style={{ margin: '4px 0 0 0', lineHeight: 1.4 }}>
              Wähle hier eine Discord-Rolle aus und konfiguriere exakt, was Mitglieder mit dieser Rolle tun dürfen:
              <br />
              • <strong>Auf der Webseite:</strong> Dashboard-Login, Server starten/stoppen, Live-Konsole, Backups/Welten, Plugins & Einstellungen.
              <br />
              • <strong>Auf dem Server:</strong> Whitelist-Beitritt, Vanilla-Operator (/op), LuckPerms-Rang & Chat-Präfix.
            </p>
          </div>
        </div>

        {/* Auto-Sync Banner & Interval Control (Every 5 minutes) */}
        <div style={{
          background: '#0d111b',
          border: '2px solid #28334a',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={20} color="var(--mc-green)" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '0.82rem', color: '#fff' }}>
                  AUTOMATISCHER ROLLEN-SYNC (ALLE {config?.autoSyncIntervalMinutes || 5} MINUTEN)
                </strong>
                <span className="mc-badge mc-badge-overworld" style={{ fontSize: '0.62rem' }}>
                  AKTIV (DAEMON)
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                {config?.lastRoleSyncAt ? (
                  <>Letzter Sync: <strong style={{ color: 'var(--mc-aqua)' }}>{new Date(config.lastRoleSyncAt).toLocaleTimeString()}</strong> {config.lastRoleSyncMessage ? `• ${config.lastRoleSyncMessage}` : ''}</>
                ) : (
                  'Der Hintergrunddienst synchronisiert automatisch alle 5 Minuten alle Discord-Rollen auf die Minecraft-Server.'
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--mc-gray)' }}>Intervall:</span>
            <select
              value={config?.autoSyncIntervalMinutes || 5}
              onChange={async (e) => {
                const newInt = Number(e.target.value) || 5;
                const updatedCfg = { ...config, autoSyncIntervalMinutes: newInt };
                setConfig(updatedCfg);
                try {
                  await fetch('/api/discord/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedCfg)
                  });
                  setMessage({ type: 'success', text: `Sync-Intervall auf alle ${newInt} Minuten eingestellt!` });
                } catch (err) {
                  setMessage({ type: 'error', text: err.message });
                }
              }}
              className="mc-input"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', background: '#12141a', color: '#fff' }}
            >
              <option value="1">Jede Minute (Test)</option>
              <option value="3">Alle 3 Minuten</option>
              <option value="5">Alle 5 Minuten (Standard)</option>
              <option value="10">Alle 10 Minuten</option>
              <option value="15">Alle 15 Minuten</option>
              <option value="30">Alle 30 Minuten</option>
            </select>
          </div>
        </div>

        {/* Role Mappings Table */}
        {roleMappings.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '30px 20px',
            background: '#12141a',
            border: '2px dashed #2e3347'
          }}>
            <Users size={32} color="var(--mc-gray)" style={{ margin: '0 auto 10px', display: 'block', opacity: 0.5 }} />
            <p style={{ color: 'var(--mc-gray)', fontSize: '0.85rem', margin: 0 }}>
              Noch keine Rollen-Verknüpfungen angelegt.
            </p>
            <p style={{ color: '#888', fontSize: '0.75rem', marginTop: '4px' }}>
              Klicke oben auf <strong>"ROLLE VERKNÜPFEN"</strong>, um Discord-Rollen Berechtigungen für das Dashboard und den Minecraft-Server zu erteilen.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '2px solid #2e3347' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#12141a', borderBottom: '2px solid #2e3347' }}>
                  <th style={{ padding: '10px 14px', color: 'var(--mc-yellow)', fontWeight: 600 }}>DISCORD ROLLE</th>
                  <th style={{ padding: '10px 14px', color: 'var(--mc-yellow)', fontWeight: 600 }}>WEBSEITE (DASHBOARD)</th>
                  <th style={{ padding: '10px 14px', color: 'var(--mc-yellow)', fontWeight: 600 }}>SERVER (MINECRAFT)</th>
                  <th style={{ padding: '10px 14px', color: 'var(--mc-yellow)', fontWeight: 600 }}>WHITELIST</th>
                  <th style={{ padding: '10px 14px', color: 'var(--mc-yellow)', fontWeight: 600 }}>PRIO</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--mc-yellow)', fontWeight: 600 }}>AKTION</th>
                </tr>
              </thead>
              <tbody>
                {roleMappings.map((m) => {
                  const wp = m.webPermissions || {};
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1f2330', background: '#0e1017' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: m.discordRoleColor ? `#${m.discordRoleColor.toString(16).padStart(6, '0')}` : 'var(--mc-aqua)'
                          }} />
                          <strong style={{ color: '#fff' }}>@{m.discordRoleName || m.discordRoleId}</strong>
                          <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--mc-gray)' }}>({m.discordRoleId})</span>
                        </div>
                      </td>
                      
                      {/* Web Permissions Column */}
                      <td style={{ padding: '10px 14px' }}>
                        {wp.isSuperAdmin ? (
                          <span className="mc-badge mc-badge-gold" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Crown size={12} /> SUPER-ADMIN (VOLL)
                          </span>
                        ) : wp.allowDashboardLogin ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {wp.canControlCluster && <span className="mc-badge mc-badge-overworld" style={{ fontSize: '0.62rem' }}>⚡ CLUSTER</span>}
                            {wp.canManageNodes && <span className="mc-badge mc-badge-diamond" style={{ fontSize: '0.62rem' }}>🖥️ SERVER</span>}
                            {wp.canAccessConsole && <span className="mc-badge mc-badge-proxy" style={{ fontSize: '0.62rem' }}>📟 KONSOLE</span>}
                            {wp.canManageWorlds && <span className="mc-badge mc-badge-gold" style={{ fontSize: '0.62rem' }}>🌍 WELTEN</span>}
                            {wp.canManagePlugins && <span className="mc-badge mc-badge-nether" style={{ fontSize: '0.62rem' }}>📦 PLUGINS</span>}
                            {wp.canManageDiscord && <span className="mc-badge mc-badge-purple" style={{ fontSize: '0.62rem' }}>🛡️ DISCORD</span>}
                            {!wp.canControlCluster && !wp.canManageNodes && !wp.canAccessConsole && !wp.canManageWorlds && !wp.canManagePlugins && !wp.canManageDiscord && (
                              <span className="mc-badge mc-badge-overworld" style={{ fontSize: '0.62rem' }}>NUR LOGIN</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--mc-gray)', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Lock size={12} /> Kein Web-Zugriff
                          </span>
                        )}
                      </td>

                      {/* Minecraft Server In-Game Column */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {m.isOperator && (
                            <span className="mc-badge mc-badge-red" style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <Crown size={11} /> OP
                            </span>
                          )}
                          <span className="mc-badge mc-badge-diamond" style={{ fontSize: '0.72rem', textTransform: 'lowercase' }}>
                            {m.minecraftGroup || 'default'}
                          </span>
                          {m.prefix && (
                            <span className="font-mono" style={{
                              background: '#1a1d26',
                              border: '1px solid #333',
                              padding: '1px 6px',
                              borderRadius: '3px',
                              color: 'var(--mc-yellow)',
                              fontSize: '0.72rem'
                            }}>
                              {m.prefix}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Whitelist Column */}
                      <td style={{ padding: '10px 14px' }}>
                        {m.allowMinecraftJoin !== false ? (
                          <span className="mc-badge mc-badge-overworld" style={{ fontSize: '0.65rem' }}>
                            ✔ ERLAUBT
                          </span>
                        ) : (
                          <span className="mc-badge mc-badge-red" style={{ fontSize: '0.65rem' }}>
                            ⛔ GESPERRT
                          </span>
                        )}
                      </td>

                      {/* Priority Column */}
                      <td style={{ padding: '10px 14px' }} className="font-mono">
                        <span style={{ color: 'var(--mc-aqua)', fontWeight: 700 }}>{m.priority}</span>
                      </td>

                      {/* Action Column */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handleEditRoleMapping(m)}
                            className="mc-btn mc-btn-blue"
                            style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                            title="Berechtigungen bearbeiten"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteRoleMapping(m.id)}
                            className="mc-btn mc-btn-red"
                            style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                            title="Verknüpfung löschen"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Link Modal */}
      {showManualModal && (
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
          <div className="mc-modal" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
            <h3 className="mc-title" style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '14px' }}>
              SPIELER MANUELL VERKNÜPFEN
            </h3>
            <form onSubmit={handleManualLink}>
              <div style={{ marginBottom: '12px' }}>
                <label className="mc-label">MINECRAFT SPIELERNAME</label>
                <input
                  type="text"
                  className="mc-input"
                  placeholder="z.B. Steve"
                  value={manualForm.minecraftUsername}
                  onChange={e => setManualForm({ ...manualForm, minecraftUsername: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label className="mc-label">DISCORD BENUTZER-ID (NUMMER)</label>
                <input
                  type="text"
                  className="mc-input font-mono"
                  placeholder="z.B. 293847291039485721"
                  value={manualForm.discordId}
                  onChange={e => setManualForm({ ...manualForm, discordId: e.target.value })}
                  required
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label className="mc-label">DISCORD TAG / NAME</label>
                <input
                  type="text"
                  className="mc-input"
                  placeholder="z.B. Steve#1234 oder steve_gamer"
                  value={manualForm.discordTag}
                  onChange={e => setManualForm({ ...manualForm, discordTag: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowManualModal(false)} className="mc-btn">
                  ABBRECHEN
                </button>
                <button type="submit" className="mc-btn mc-btn-green">
                  VERKNÜPFEN & WHITELISTEN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Role Mapping Modal */}
      {showMappingModal && (
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
          <div className="mc-modal" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="mc-title" style={{ fontSize: '1rem', color: '#fff', margin: 0 }}>
                  {mappingForm.id ? 'DISCORD-ROLLE BEARBEITEN' : 'DISCORD-ROLLE KONFIGURIEREN'}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--mc-gray)' }}>
                  Lege fest, was diese Discord-Rolle auf der Webseite und auf dem Minecraft-Server kann
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMappingModal(false)}
                className="mc-btn mc-btn-red"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoleMapping}>
              {/* Discord Role Select */}
              <div style={{ marginBottom: '16px', background: '#11131c', border: '2px solid #2e3347', padding: '14px' }}>
                <label className="mc-label" style={{ color: 'var(--mc-yellow)' }}>1. DISCORD ROLLE AUSWÄHLEN</label>
                {guildInfo?.roles?.length > 0 ? (
                  <select
                    className="mc-input"
                    value={mappingForm.discordRoleId}
                    onChange={(e) => {
                      const selectedRole = guildInfo.roles.find(r => r.id === e.target.value);
                      setMappingForm({
                        ...mappingForm,
                        discordRoleId: e.target.value,
                        discordRoleName: selectedRole?.name || '',
                        discordRoleColor: selectedRole?.color || 0
                      });
                    }}
                    style={{ width: '100%', background: '#12141a', color: '#fff', marginTop: '6px' }}
                  >
                    {guildInfo.roles.map(r => (
                      <option key={r.id} value={r.id}>
                        @{r.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="mc-input font-mono"
                    placeholder="Discord Role ID (z.B. 1234567890)"
                    value={mappingForm.discordRoleId}
                    onChange={(e) => setMappingForm({ ...mappingForm, discordRoleId: e.target.value, discordRoleName: 'Benutzerdefiniert' })}
                    style={{ marginTop: '6px' }}
                    required
                  />
                )}

                {/* Presets */}
                <div style={{ marginTop: '12px' }}>
                  <span className="mc-label" style={{ fontSize: '0.68rem', color: 'var(--mc-gray)' }}>SCHNELL-VORLAGEN ANWENDEN:</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => applyPreset('superadmin')}
                      className="mc-btn mc-btn-red"
                      style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                      title="Web-Vollzugriff + In-Game OP"
                    >
                      👑 SUPER-ADMIN
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('mod')}
                      className="mc-btn mc-btn-blue"
                      style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                      title="Web Konsole/Welten/Plugins + In-Game Mod"
                    >
                      🛡️ MODERATOR
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('builder')}
                      className="mc-btn mc-btn-green"
                      style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                      title="Web Welten + In-Game Builder"
                    >
                      🛠️ BUILDER
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('vip')}
                      className="mc-btn mc-btn-gold"
                      style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                      title="Kein Web-Login + In-Game VIP"
                    >
                      💎 VIP
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset('player')}
                      className="mc-btn"
                      style={{ padding: '4px 10px', fontSize: '0.7rem' }}
                      title="Nur Whitelist-Beitritt"
                    >
                      👥 SPIELER
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 1: WEB DASHBOARD BERECHTIGUNGEN */}
              <div style={{
                marginBottom: '16px',
                background: '#11131c',
                border: '2px solid #2e3347',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Globe size={18} color="var(--mc-aqua)" />
                  <span className="mc-title" style={{ fontSize: '0.85rem', color: 'var(--mc-aqua)', margin: 0 }}>
                    2. BERECHTIGUNGEN AUF DER WEBSEITE (DASHBOARD)
                  </span>
                </div>

                {/* Allow Dashboard Login Toggle */}
                <div 
                  onClick={() => setMappingForm({
                    ...mappingForm,
                    webPermissions: {
                      ...mappingForm.webPermissions,
                      allowDashboardLogin: !mappingForm.webPermissions?.allowDashboardLogin
                    }
                  })}
                  style={{
                    background: mappingForm.webPermissions?.allowDashboardLogin ? 'rgba(85, 255, 85, 0.1)' : '#0e1017',
                    border: `2px solid ${mappingForm.webPermissions?.allowDashboardLogin ? 'var(--mc-green)' : '#2e3347'}`,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!mappingForm.webPermissions?.allowDashboardLogin}
                    onChange={() => {}}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--mc-green)', cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: mappingForm.webPermissions?.allowDashboardLogin ? '#fff' : 'var(--mc-gray)' }}>
                      Darf sich im Web-Dashboard einloggen
                    </strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--mc-gray)' }}>
                      Erlaubt Mitgliedern dieser Discord-Rolle die Anmeldung am Management-Panel via Discord OAuth2.
                    </div>
                  </div>
                </div>

                {/* Sub-permissions if login is allowed */}
                {mappingForm.webPermissions?.allowDashboardLogin && (
                  <div style={{ paddingLeft: '8px', borderLeft: '2px solid var(--mc-green)' }}>
                    {/* Super Admin Toggle */}
                    <div
                      onClick={() => {
                        const nextSuper = !mappingForm.webPermissions?.isSuperAdmin;
                        setMappingForm({
                          ...mappingForm,
                          webPermissions: {
                            ...mappingForm.webPermissions,
                            isSuperAdmin: nextSuper,
                            canControlCluster: nextSuper ? true : mappingForm.webPermissions?.canControlCluster,
                            canManageNodes: nextSuper ? true : mappingForm.webPermissions?.canManageNodes,
                            canAccessConsole: nextSuper ? true : mappingForm.webPermissions?.canAccessConsole,
                            canManageWorlds: nextSuper ? true : mappingForm.webPermissions?.canManageWorlds,
                            canManagePlugins: nextSuper ? true : mappingForm.webPermissions?.canManagePlugins,
                            canManageDiscord: nextSuper ? true : mappingForm.webPermissions?.canManageDiscord
                          }
                        });
                      }}
                      style={{
                        background: mappingForm.webPermissions?.isSuperAdmin ? 'rgba(255, 170, 0, 0.15)' : '#0e1017',
                        border: `2px solid ${mappingForm.webPermissions?.isSuperAdmin ? 'var(--mc-gold)' : '#2e3347'}`,
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        marginBottom: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!mappingForm.webPermissions?.isSuperAdmin}
                        onChange={() => {}}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--mc-gold)', cursor: 'pointer' }}
                      />
                      <div>
                        <strong style={{ fontSize: '0.8rem', color: mappingForm.webPermissions?.isSuperAdmin ? 'var(--mc-gold)' : '#fff' }}>
                          👑 Vollzugriff (Super-Admin)
                        </strong>
                        <div style={{ fontSize: '0.68rem', color: 'var(--mc-gray)' }}>
                          Gewährt unbeschränkten Zugriff auf ALLE Bereiche, Server, Konsolen, Backups & Systemeinstellungen.
                        </div>
                      </div>
                    </div>

                    {/* Granular Toggles (if not super-admin) */}
                    {!mappingForm.webPermissions?.isSuperAdmin && (
                      <div>
                        <span className="mc-label" style={{ fontSize: '0.68rem', color: 'var(--mc-gray)', display: 'block', marginBottom: '8px' }}>
                          GRANULARE DASHBOARD-BERECHTIGUNGEN:
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                          {[
                            { key: 'canControlCluster', icon: '⚡', title: 'Cluster & Server steuern', desc: 'Server starten, stoppen und Proxy synchronisieren' },
                            { key: 'canManageNodes', icon: '🖥️', title: 'Server & SSH verwalten', desc: 'Server konfigurieren, Ports/IPs anpassen & deployen' },
                            { key: 'canAccessConsole', icon: '📟', title: 'Live-Konsole & Befehle', desc: 'Echtzeit-Logs einsehen und Konsolenbefehle senden' },
                            { key: 'canManageWorlds', icon: '🌍', title: 'Welten & Backups', desc: 'Welten als ZIP exportieren, hochladen oder zurücksetzen' },
                            { key: 'canManagePlugins', icon: '📦', title: 'Modrinth Plugins', desc: 'Plugins durchsuchen, installieren und entfernen' },
                            { key: 'canManageDiscord', icon: '🛡️', title: 'Discord verwalten', desc: 'Bot-Konfiguration und Rollen-Zuordnungen bearbeiten' },
                          ].map(item => {
                            const isChecked = !!mappingForm.webPermissions?.[item.key];
                            return (
                              <div
                                key={item.key}
                                onClick={() => setMappingForm({
                                  ...mappingForm,
                                  webPermissions: {
                                    ...mappingForm.webPermissions,
                                    [item.key]: !isChecked
                                  }
                                })}
                                style={{
                                  background: isChecked ? 'rgba(85, 255, 255, 0.1)' : '#0a0c12',
                                  border: `1px solid ${isChecked ? 'var(--mc-aqua)' : '#282b3a'}`,
                                  padding: '8px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  cursor: 'pointer'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  style={{ width: '15px', height: '15px', accentColor: 'var(--mc-aqua)', cursor: 'pointer' }}
                                />
                                <div>
                                  <div style={{ fontSize: '0.75rem', fontWeight: isChecked ? 'bold' : 'normal', color: isChecked ? '#fff' : 'var(--mc-gray)' }}>
                                    {item.icon} {item.title}
                                  </div>
                                  <div style={{ fontSize: '0.62rem', color: '#777' }}>
                                    {item.desc}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: MINECRAFT IN-GAME BERECHTIGUNGEN */}
              <div style={{
                marginBottom: '18px',
                background: '#11131c',
                border: '2px solid #2e3347',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldCheck size={18} color="var(--mc-yellow)" />
                  <span className="mc-title" style={{ fontSize: '0.85rem', color: 'var(--mc-yellow)', margin: 0 }}>
                    3. BERECHTIGUNGEN AUF DEM SERVER (MINECRAFT IN-GAME)
                  </span>
                </div>

                {/* Allow Join Toggle */}
                <div 
                  onClick={() => setMappingForm({ ...mappingForm, allowMinecraftJoin: mappingForm.allowMinecraftJoin === false ? true : false })}
                  style={{
                    background: mappingForm.allowMinecraftJoin !== false ? 'rgba(85, 255, 85, 0.1)' : 'rgba(255, 85, 85, 0.1)',
                    border: `2px solid ${mappingForm.allowMinecraftJoin !== false ? 'var(--mc-green)' : 'var(--mc-red)'}`,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    marginBottom: '10px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={mappingForm.allowMinecraftJoin !== false}
                    onChange={() => {}}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--mc-green)', cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: mappingForm.allowMinecraftJoin !== false ? '#fff' : 'var(--mc-red)' }}>
                      ✔ Server-Beitritt erlauben (Whitelist)
                    </strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--mc-gray)' }}>
                      {mappingForm.allowMinecraftJoin !== false 
                        ? 'Spieler mit dieser Rolle werden automatisch auf die Minecraft-Whitelist gesetzt.' 
                        : '⛔ Spieler mit dieser Rolle dürfen dem Server NICHT beitreten (werden gekickt & entwhitelisted).'}
                    </div>
                  </div>
                </div>

                {/* OP Toggle */}
                <div 
                  onClick={() => {
                    const nextOp = !mappingForm.isOperator;
                    setMappingForm({
                      ...mappingForm,
                      isOperator: nextOp,
                      minecraftGroup: nextOp && mappingForm.minecraftGroup === 'vip' ? 'op' : mappingForm.minecraftGroup
                    });
                  }}
                  style={{
                    background: mappingForm.isOperator ? 'rgba(255, 85, 85, 0.15)' : '#0e1017',
                    border: `2px solid ${mappingForm.isOperator ? 'var(--mc-red)' : '#2e3347'}`,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    marginBottom: '12px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!mappingForm.isOperator}
                    onChange={() => {}}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--mc-red)', cursor: 'pointer' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.8rem', color: mappingForm.isOperator ? 'var(--mc-red)' : '#fff' }}>
                      👑 Minecraft Operator (/op &#123;player&#125;)
                    </strong>
                    <div style={{ fontSize: '0.68rem', color: 'var(--mc-gray)' }}>
                      Gibt dem Spieler volle Operator-Rechte im Spiel (kann alle Vanilla-Befehle nutzen).
                    </div>
                  </div>
                </div>

                {/* In-game Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="mc-label">LUCKPERMS RANG / GRUPPE</label>
                    <input
                      type="text"
                      className="mc-input"
                      placeholder="z.B. admin, mod, builder, vip, default"
                      value={mappingForm.minecraftGroup}
                      onChange={(e) => setMappingForm({ ...mappingForm, minecraftGroup: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="mc-label">CHAT-PRÄFIX (MIT FARBCODES)</label>
                    <input
                      type="text"
                      className="mc-input font-mono"
                      placeholder="z.B. &c[Admin]  oder &9[Mod] "
                      value={mappingForm.prefix}
                      onChange={(e) => setMappingForm({ ...mappingForm, prefix: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mc-label">PRIORITÄT (HÖHERE ZAHL GEWINNT)</label>
                    <input
                      type="number"
                      className="mc-input"
                      value={mappingForm.priority}
                      onChange={(e) => setMappingForm({ ...mappingForm, priority: Number(e.target.value) || 10 })}
                    />
                  </div>

                  <div>
                    <label className="mc-label">EIGENER BEFEHL (OPTIONAL)</label>
                    <input
                      type="text"
                      className="mc-input font-mono"
                      placeholder="z.B. op {player} oder lp user {player} parent set admin"
                      value={mappingForm.customCommand}
                      onChange={(e) => setMappingForm({ ...mappingForm, customCommand: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowMappingModal(false)} className="mc-btn">
                  ABBRECHEN
                </button>
                <button type="submit" className="mc-btn mc-btn-green">
                  VERKNÜPFUNG SPEICHERN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
