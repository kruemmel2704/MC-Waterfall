import React, { useState, useEffect } from 'react';
import { 
  Settings, Shield, Lock, User, CheckCircle2, AlertCircle, 
  RotateCcw, Save, LogOut, ExternalLink, RefreshCw
} from 'lucide-react';
import { WaterfallBeaconIcon, GrassBlockIcon } from './MinecraftIcons';

export default function SettingsTab({ authStatus, onLogout, onOpenSetup, onToast }) {
  const [loading, setLoading] = useState(false);
  const [serverName, setServerName] = useState(authStatus?.serverName || '');
  const [architecture, setArchitecture] = useState(authStatus?.architecture || 'DimensionalCluster');
  const [discordEnabled, setDiscordEnabled] = useState(authStatus?.discordOAuthEnabled || false);

  // Password change state
  const [newAdminUser, setNewAdminUser] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordRepeat, setNewPasswordRepeat] = useState('');

  useEffect(() => {
    if (authStatus) {
      setServerName(authStatus.serverName || '');
      setArchitecture(authStatus.architecture || 'DimensionalCluster');
      setDiscordEnabled(authStatus.discordOAuthEnabled || false);
      setNewAdminUser(authStatus.username || 'admin');
    }
  }, [authStatus]);

  const handleSaveGeneral = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverName: serverName.trim(),
          architecture: architecture,
          discordOAuthEnabled: discordEnabled
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Einstellungen konnten nicht gespeichert werden.');
      }

      onToast?.({ type: 'success', message: 'Einstellungen erfolgreich aktualisiert!' });
    } catch (err) {
      onToast?.({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      onToast?.({ type: 'error', message: 'Bitte gib das aktuelle Passwort ein.' });
      return;
    }
    if (newPassword && newPassword.length < 4) {
      onToast?.({ type: 'error', message: 'Das neue Passwort muss mindestens 4 Zeichen lang sein.' });
      return;
    }
    if (newPassword !== newPasswordRepeat) {
      onToast?.({ type: 'error', message: 'Die neuen Passwörter stimmen nicht überein.' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newAdminUsername: newAdminUser.trim(),
          currentPassword,
          newPassword: newPassword || null
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Passwort-Aktualisierung fehlgeschlagen.');
      }

      onToast?.({ type: 'success', message: 'Administrator-Konto erfolgreich aktualisiert!' });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordRepeat('');
    } catch (err) {
      onToast?.({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div className="mc-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: '#0e111a',
              border: '2px solid var(--mc-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(85,85,255,0.3)'
            }}>
              <Settings size={26} color="var(--mc-blue)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 className="mc-title" style={{ fontSize: '1rem', color: '#fff' }}>SYSTEM- & ADMIN-EINSTELLUNGEN</h2>
                <span className="mc-badge mc-badge-proxy" style={{ fontSize: '0.65rem' }}>
                  ADMIN-PANEL
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '4px' }}>
                Passe Server-Namen, Zugangsdaten, Discord OAuth und Architektur jederzeit im laufenden Betrieb an
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="mc-btn mc-btn-red"
            style={{ padding: '8px 16px', fontSize: '0.78rem' }}
          >
            <LogOut size={14} /> ABMELDEN
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Card 1: General & Architecture Settings */}
        <div className="mc-card" style={{ padding: '20px' }}>
          <h3 className="mc-title" style={{ fontSize: '0.9rem', color: 'var(--mc-aqua)', marginBottom: '14px' }}>
            1. SERVER- & NETZWERK-BASIS
          </h3>

          <form onSubmit={handleSaveGeneral} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                SERVER- / CLUSTER-NAME:
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                className="mc-input"
                style={{ width: '100%' }}
                placeholder="Mein Minecraft Netzwerk"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '6px', fontFamily: 'var(--mc-font)' }}>
                SERVER-ARCHITEKTUR:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div
                  onClick={() => setArchitecture('DimensionalCluster')}
                  style={{
                    padding: '12px',
                    border: `2px solid ${architecture === 'DimensionalCluster' ? 'var(--mc-blue)' : '#282a35'}`,
                    background: architecture === 'DimensionalCluster' ? '#161924' : '#12141a',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <WaterfallBeaconIcon size={16} />
                    <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }}>CLUSTER</span>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)' }}>Waterfall + 4 Welten</span>
                </div>

                <div
                  onClick={() => setArchitecture('SingleServer')}
                  style={{
                    padding: '12px',
                    border: `2px solid ${architecture === 'SingleServer' ? 'var(--mc-green)' : '#282a35'}`,
                    background: architecture === 'SingleServer' ? '#112217' : '#12141a',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <GrassBlockIcon size={16} />
                    <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }}>SINGLE SERVER</span>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)' }}>1 Paper Instanz</span>
                </div>
              </div>
            </div>

            <div style={{
              background: '#141620',
              border: `2px solid ${discordEnabled ? 'var(--mc-purple)' : '#282a35'}`,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => setDiscordEnabled(!discordEnabled)}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 'bold' }}>
                  Discord OAuth Dashboard-Login
                </span>
                <p style={{ fontSize: '0.68rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                  Erlaubt die Anmeldung am Dashboard über deinen Discord-Account
                </p>
              </div>
              <input
                type="checkbox"
                checked={discordEnabled}
                onChange={(e) => setDiscordEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mc-btn mc-btn-green"
              style={{ padding: '8px 16px', fontSize: '0.78rem', justifyContent: 'center', marginTop: '6px' }}
            >
              {loading ? <RefreshCw size={13} className="spin-anim" /> : <Save size={13} />} EINSTELLUNGEN SPEICHERN
            </button>
          </form>
        </div>

        {/* Card 2: Admin Password & Account */}
        <div className="mc-card" style={{ padding: '20px' }}>
          <h3 className="mc-title" style={{ fontSize: '0.9rem', color: 'var(--mc-aqua)', marginBottom: '14px' }}>
            2. ADMINISTRATOR-ZUGANG ÄNDERN
          </h3>

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                ADMIN-BENUTZERNAME:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} color="var(--mc-gray)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  value={newAdminUser}
                  onChange={(e) => setNewAdminUser(e.target.value)}
                  className="mc-input"
                  style={{ width: '100%', paddingLeft: '34px', fontSize: '0.8rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                AKTUELLES PASSWORT:
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--mc-gray)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mc-input"
                  style={{ width: '100%', paddingLeft: '34px', fontSize: '0.8rem' }}
                  placeholder="Zur Bestätigung erforderlich"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                NEUES PASSWORT:
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--mc-gray)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mc-input"
                  style={{ width: '100%', paddingLeft: '34px', fontSize: '0.8rem' }}
                  placeholder="Neues Passwort (leer lassen für keine Änderung)"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                NEUES PASSWORT WIEDERHOLEN:
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--mc-gray)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="password"
                  value={newPasswordRepeat}
                  onChange={(e) => setNewPasswordRepeat(e.target.value)}
                  className="mc-input"
                  style={{ width: '100%', paddingLeft: '34px', fontSize: '0.8rem' }}
                  placeholder="Neues Passwort wiederholen"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mc-btn mc-btn-gold"
              style={{ padding: '8px 16px', fontSize: '0.78rem', justifyContent: 'center', marginTop: '6px' }}
            >
              <Shield size={13} /> ZUGANGSDATEN AKTUALISIEREN
            </button>
          </form>
        </div>
      </div>

      {/* Card 3: Setup Re-Run Wizard */}
      <div className="mc-card" style={{ padding: '20px', border: '2px solid #3c3e4c', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h4 style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>
            SETUP-ASSISTENTEN ERNEUT DURCHLAUFEN (/setup)
          </h4>
          <p style={{ fontSize: '0.72rem', color: 'var(--mc-gray)', marginTop: '4px' }}>
            Möchtest du das Cluster von Grund auf neu konfigurieren, Server-IPs austauschen oder zwischen Single-Server und Cluster wechseln?
          </p>
        </div>

        <button
          onClick={onOpenSetup}
          className="mc-btn mc-btn-blue"
          style={{ padding: '8px 18px', fontSize: '0.78rem' }}
        >
          <RotateCcw size={14} /> SETUP-ASSISTENT ÖFFNEN
        </button>
      </div>
    </div>
  );
}
