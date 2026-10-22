import React, { useState, useEffect } from 'react';
import { 
  Key, Shield, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, 
  Trash2, Plus, Sparkles, UserCheck, ShieldCheck, Copy, Check
} from 'lucide-react';
import { CommandBlockIcon, RedstoneTorchIcon, GrassBlockIcon } from './MinecraftIcons';

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

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [cfgRes, linksRes] = await Promise.all([
        fetch('/api/discord/config'),
        fetch('/api/discord/minecraft/links')
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyGuild = async (gId, bToken) => {
    setVerifying(true);
    try {
      const q = new URLSearchParams();
      if (gId) q.append('guildId', gId);
      if (bToken) q.append('botToken', bToken);

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
        verifyGuild(config.guildId, config.botToken);
      } else {
        setMessage({ type: 'error', text: 'Fehler beim Speichern.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
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
                onClick={() => verifyGuild(config.guildId, config.botToken)}
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
    </div>
  );
}
