import React, { useState } from 'react';
import { 
  Shield, Server, HardDrive, Key, CheckCircle2, AlertCircle, 
  ArrowRight, ArrowLeft, Sparkles, RefreshCw, Lock, User
} from 'lucide-react';
import { GrassBlockIcon, WaterfallBeaconIcon, CommandBlockIcon, NetherPortalIcon } from './MinecraftIcons';

export default function SetupWizardPage({ onSetupCompleted }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Admin
    adminUsername: 'admin',
    adminPassword: '',
    adminPasswordRepeat: '',

    // Step 2: Architecture & Name
    serverName: 'Dimensional Waterfall Cluster',
    architecture: 'DimensionalCluster', // 'DimensionalCluster' | 'SingleServer'

    // Step 3: SSH & Network (Cluster)
    clusterMasterHost: '127.0.0.1',
    clusterSshPort: 22,
    clusterSshUsername: 'root',
    clusterSshPassword: '',
    clusterProxyPort: 25565,

    // Step 3: SSH & Network (Single Server)
    singleHost: '127.0.0.1',
    singleSshPort: 22,
    singleSshUsername: 'root',
    singleSshPassword: '',
    singleMinecraftPort: 25565,
    singleMemoryMb: 6144,
    singleMinecraftVersion: '1.21.1',

    // Step 4: Discord OAuth
    enableDiscord: false,
    discordClientId: '',
    discordClientSecret: '',
    discordGuildId: ''
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.adminUsername.trim()) {
        setError('Bitte einen Admin-Benutzernamen eingeben.');
        return false;
      }
      if (!formData.adminPassword || formData.adminPassword.length < 4) {
        setError('Das Admin-Passwort muss mindestens 4 Zeichen lang sein.');
        return false;
      }
      if (formData.adminPassword !== formData.adminPasswordRepeat) {
        setError('Die Passwörter stimmen nicht überein.');
        return false;
      }
    } else if (step === 2) {
      if (!formData.serverName.trim()) {
        setError('Bitte einen Namen für das Netzwerk / den Server vergeben.');
        return false;
      }
    } else if (step === 3) {
      if (formData.architecture === 'DimensionalCluster') {
        if (!formData.clusterMasterHost.trim()) {
          setError('Bitte die Host-IP für die Server angeben.');
          return false;
        }
      } else {
        if (!formData.singleHost.trim()) {
          setError('Bitte die Host-IP für den Server angeben.');
          return false;
        }
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const submitSetup = async () => {
    setLoading(true);
    setError(null);

    const payload = {
      adminUsername: formData.adminUsername.trim(),
      adminPassword: formData.adminPassword,
      serverName: formData.serverName.trim(),
      architecture: formData.architecture,
      enableDiscord: formData.enableDiscord,
      discordClientId: formData.enableDiscord ? formData.discordClientId.trim() : null,
      discordClientSecret: formData.enableDiscord ? formData.discordClientSecret.trim() : null,
      discordGuildId: formData.enableDiscord ? formData.discordGuildId.trim() : null
    };

    if (formData.architecture === 'DimensionalCluster') {
      payload.cluster = {
        allNodesOnSameHost: true,
        masterHost: formData.clusterMasterHost.trim(),
        masterSshPort: Number(formData.clusterSshPort) || 22,
        masterSshUsername: formData.clusterSshUsername.trim() || 'root',
        masterSshPassword: formData.clusterSshPassword || null,
        proxyPublicPort: Number(formData.clusterProxyPort) || 25565
      };
    } else {
      payload.singleServer = {
        host: formData.singleHost.trim(),
        sshPort: Number(formData.singleSshPort) || 22,
        sshUsername: formData.singleSshUsername.trim() || 'root',
        sshPassword: formData.singleSshPassword || null,
        minecraftPort: Number(formData.singleMinecraftPort) || 25565,
        memoryMb: Number(formData.singleMemoryMb) || 6144,
        minecraftVersion: formData.singleMinecraftVersion.trim() || '1.21.1'
      };
    }

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Setup konnte nicht gespeichert werden.');
      }

      if (data.token) {
        localStorage.setItem('mc_session_token', data.token);
      }

      // Notify parent to transition to main dashboard
      onSetupCompleted?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(circle at 50% 20%, #1c1e28 0%, #0d0e13 100%)'
    }}>
      <div className="mc-panel" style={{
        maxWidth: '780px',
        width: '100%',
        padding: '32px',
        border: '4px solid #3c3e4a',
        boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '3px solid #282a35', paddingBottom: '20px', marginBottom: '24px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            background: '#0d0e12',
            border: '2px solid var(--mc-blue)',
            boxShadow: '0 0 16px rgba(85,85,255,0.4)',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="mc-title" style={{ fontSize: '1.2rem', color: '#fff' }}>SYSTEM SETUP-ASSISTENT</h1>
              <span className="mc-badge mc-badge-proxy" style={{ fontSize: '0.65rem' }}>SCHRITT {step} VON 5</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '4px' }}>
              Erstkonfiguration für dein Minecraft Server-Netzwerk & Dashboard-Zugang
            </p>
          </div>
        </div>

        {/* Step Navigation Pills */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { num: 1, label: 'Admin-Konto' },
            { num: 2, label: 'Architektur & Name' },
            { num: 3, label: 'Server-IPs & SSH' },
            { num: 4, label: 'Discord OAuth' },
            { num: 5, label: 'Zusammenfassung' },
          ].map(s => (
            <div
              key={s.num}
              style={{
                flex: 1,
                padding: '8px 10px',
                textAlign: 'center',
                background: step === s.num ? '#1c2230' : step > s.num ? '#112217' : '#14151c',
                border: `2px solid ${step === s.num ? 'var(--mc-blue)' : step > s.num ? 'var(--mc-green)' : '#282a35'}`,
                color: step === s.num ? '#fff' : step > s.num ? 'var(--mc-green)' : 'var(--mc-gray)',
                fontSize: '0.68rem',
                fontFamily: 'var(--mc-font)',
                whiteSpace: 'nowrap'
              }}
            >
              {step > s.num ? '✓ ' : `${s.num}. `}{s.label}
            </div>
          ))}
        </div>

        {/* Error Notice */}
        {error && (
          <div style={{
            background: '#3d1212',
            border: '2px solid var(--mc-red)',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#fff',
            fontSize: '0.78rem'
          }}>
            <AlertCircle size={18} color="var(--mc-red)" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Admin Account */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="mc-title" style={{ fontSize: '0.95rem', color: 'var(--mc-aqua)' }}>
              1. SEITEN-ADMINISTRATOR ERSTELLEN
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#ccc', lineHeight: '1.5' }}>
              Lege den primären Administrator-Zugang für das Web-Dashboard fest. Diese Anmeldedaten schützen dein Dashboard vor unberechtigtem Zugriff.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '6px', fontFamily: 'var(--mc-font)' }}>
                ADMIN-BENUTZERNAME:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="var(--mc-gray)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  value={formData.adminUsername}
                  onChange={(e) => updateField('adminUsername', e.target.value)}
                  className="mc-input"
                  style={{ width: '100%', paddingLeft: '38px' }}
                  placeholder="admin"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '6px', fontFamily: 'var(--mc-font)' }}>
                ADMIN-PASSWORT:
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--mc-gray)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="password"
                  value={formData.adminPassword}
                  onChange={(e) => updateField('adminPassword', e.target.value)}
                  className="mc-input"
                  style={{ width: '100%', paddingLeft: '38px' }}
                  placeholder="Sicheres Passwort"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '6px', fontFamily: 'var(--mc-font)' }}>
                PASSWORT WIEDERHOLEN:
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="var(--mc-gray)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="password"
                  value={formData.adminPasswordRepeat}
                  onChange={(e) => updateField('adminPasswordRepeat', e.target.value)}
                  className="mc-input"
                  style={{ width: '100%', paddingLeft: '38px' }}
                  placeholder="Passwort erneut eingeben"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Architecture & Server Name */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <h3 className="mc-title" style={{ fontSize: '0.95rem', color: 'var(--mc-aqua)' }}>
              2. SERVER-NAME & FUNKTIONSWEISE WÄHLEN
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#ccc', lineHeight: '1.5' }}>
              Wie soll dein Minecraft-Netzwerk aufgebaut sein? Wähle zwischen einem Multi-Server-Cluster oder einem einzelnen Server.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '6px', fontFamily: 'var(--mc-font)' }}>
                SERVER- / CLUSTER-NAME:
              </label>
              <input
                type="text"
                value={formData.serverName}
                onChange={(e) => updateField('serverName', e.target.value)}
                className="mc-input"
                style={{ width: '100%' }}
                placeholder="Mein Minecraft Netzwerk"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '8px' }}>
              {/* Option A: Dimensional Cluster */}
              <div
                onClick={() => updateField('architecture', 'DimensionalCluster')}
                className="mc-card"
                style={{
                  padding: '18px',
                  cursor: 'pointer',
                  border: `3px solid ${formData.architecture === 'DimensionalCluster' ? 'var(--mc-blue)' : '#282a35'}`,
                  background: formData.architecture === 'DimensionalCluster' ? '#161924' : '#12141a',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <WaterfallBeaconIcon size={24} />
                  <h4 style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>
                    DIMENSIONAL CLUSTER
                  </h4>
                </div>
                <span className="mc-badge mc-badge-proxy" style={{ fontSize: '0.62rem', marginBottom: '8px', display: 'inline-block' }}>
                  EMPFOHLEN (MULTI-CORE)
                </span>
                <p style={{ fontSize: '0.72rem', color: '#bbb', lineHeight: '1.4' }}>
                  Waterfall Proxy leitet Spieler nahtlos zwischen Lobby, Overworld, Nether und End weiter. Jeder Server läuft auf eigenen CPU-Kernen.
                </p>
              </div>

              {/* Option B: Single Server */}
              <div
                onClick={() => updateField('architecture', 'SingleServer')}
                className="mc-card"
                style={{
                  padding: '18px',
                  cursor: 'pointer',
                  border: `3px solid ${formData.architecture === 'SingleServer' ? 'var(--mc-green)' : '#282a35'}`,
                  background: formData.architecture === 'SingleServer' ? '#112217' : '#12141a',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <GrassBlockIcon size={24} />
                  <h4 style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>
                    EINZELNER SERVER
                  </h4>
                </div>
                <span className="mc-badge mc-badge-overworld" style={{ fontSize: '0.62rem', marginBottom: '8px', display: 'inline-block' }}>
                  SINGLE PAPER-SERVER
                </span>
                <p style={{ fontSize: '0.72rem', color: '#bbb', lineHeight: '1.4' }}>
                  Ein einzelner Standalone-PaperMC-Server für alle Welten. Ideal für kleine private Server ohne Proxy-Netzwerk.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Server IPs & SSH */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="mc-title" style={{ fontSize: '0.95rem', color: 'var(--mc-aqua)' }}>
              3. HOST-IP & SSH-ZUGANGSDATEN
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#ccc', lineHeight: '1.5' }}>
              Gib die IP-Adresse und Zugangsdaten deines Linux-Servers (z. B. Debian, Ubuntu) ein, auf dem die Minecraft-Instanzen ausgeführt werden sollen.
            </p>

            {formData.architecture === 'DimensionalCluster' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#14161f', border: '2px solid #282a35', padding: '12px 16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--mc-aqua)', fontWeight: 'bold' }}>
                    Cluster-Architektur (5 Instanzen):
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginTop: '8px', textAlign: 'center', fontSize: '0.65rem' }}>
                    <div className="mc-slot">Proxy (Port {formData.clusterProxyPort})</div>
                    <div className="mc-slot">Lobby (Port {Number(formData.clusterProxyPort) + 1})</div>
                    <div className="mc-slot">Overworld (Port {Number(formData.clusterProxyPort) + 2})</div>
                    <div className="mc-slot">Nether (Port {Number(formData.clusterProxyPort) + 3})</div>
                    <div className="mc-slot">End (Port {Number(formData.clusterProxyPort) + 4})</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      SERVER-IP / HOSTNAME:
                    </label>
                    <input
                      type="text"
                      value={formData.clusterMasterHost}
                      onChange={(e) => updateField('clusterMasterHost', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                      placeholder="z.B. 192.168.24.159"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      SSH-PORT:
                    </label>
                    <input
                      type="number"
                      value={formData.clusterSshPort}
                      onChange={(e) => updateField('clusterSshPort', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      SSH-BENUTZERNAME:
                    </label>
                    <input
                      type="text"
                      value={formData.clusterSshUsername}
                      onChange={(e) => updateField('clusterSshUsername', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                      placeholder="root"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      SSH-PASSWORT:
                    </label>
                    <input
                      type="password"
                      value={formData.clusterSshPassword}
                      onChange={(e) => updateField('clusterSshPassword', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                      placeholder="SSH Passwort (oder leer für Key)"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Single Server Mode */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      SERVER-IP / HOST:
                    </label>
                    <input
                      type="text"
                      value={formData.singleHost}
                      onChange={(e) => updateField('singleHost', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                      placeholder="z.B. 192.168.24.159"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      SSH-PORT:
                    </label>
                    <input
                      type="number"
                      value={formData.singleSshPort}
                      onChange={(e) => updateField('singleSshPort', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      SSH-BENUTZERNAME:
                    </label>
                    <input
                      type="text"
                      value={formData.singleSshUsername}
                      onChange={(e) => updateField('singleSshUsername', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                      placeholder="root"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      SSH-PASSWORT:
                    </label>
                    <input
                      type="password"
                      value={formData.singleSshPassword}
                      onChange={(e) => updateField('singleSshPassword', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                      placeholder="SSH Passwort"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      MINECRAFT PORT:
                    </label>
                    <input
                      type="number"
                      value={formData.singleMinecraftPort}
                      onChange={(e) => updateField('singleMinecraftPort', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                      RAM-ZUWEISUNG (MB):
                    </label>
                    <input
                      type="number"
                      value={formData.singleMemoryMb}
                      onChange={(e) => updateField('singleMemoryMb', e.target.value)}
                      className="mc-input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Discord OAuth (Optional) */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="mc-title" style={{ fontSize: '0.95rem', color: 'var(--mc-aqua)' }}>
              4. DISCORD OAUTH2 INTEGRATION (OPTIONAL)
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#ccc', lineHeight: '1.5' }}>
              Möchtest du die Discord-Authentifizierung für den Dashboard-Login und die In-Game-Spielerverifikation aktivieren? Dies kann auch jederzeit später eingerichtet werden.
            </p>

            <div style={{
              background: '#141620',
              border: `2px solid ${formData.enableDiscord ? 'var(--mc-purple)' : '#282a35'}`,
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onClick={() => updateField('enableDiscord', !formData.enableDiscord)}
            >
              <div>
                <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold' }}>
                  Discord OAuth2 aktivieren
                </span>
                <p style={{ fontSize: '0.72rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                  Erlaubt „Mit Discord anmelden“ im Dashboard und bindet Spieler an ihren Discord-Account
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.enableDiscord}
                onChange={(e) => updateField('enableDiscord', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            {formData.enableDiscord && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                    DISCORD CLIENT-ID:
                  </label>
                  <input
                    type="text"
                    value={formData.discordClientId}
                    onChange={(e) => updateField('discordClientId', e.target.value)}
                    className="mc-input"
                    style={{ width: '100%' }}
                    placeholder="z.B. 123456789012345678"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                    DISCORD CLIENT-SECRET:
                  </label>
                  <input
                    type="password"
                    value={formData.discordClientSecret}
                    onChange={(e) => updateField('discordClientSecret', e.target.value)}
                    className="mc-input"
                    style={{ width: '100%' }}
                    placeholder="Dein Client Secret"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
                    DISCORD SERVER-ID (GUILD ID):
                  </label>
                  <input
                    type="text"
                    value={formData.discordGuildId}
                    onChange={(e) => updateField('discordGuildId', e.target.value)}
                    className="mc-input"
                    style={{ width: '100%' }}
                    placeholder="Optional: Guild ID"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Summary & Finish */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="mc-title" style={{ fontSize: '0.95rem', color: 'var(--mc-green)' }}>
              5. KONFIGURATION BESTÄTIGEN
            </h3>
            <p style={{ fontSize: '0.78rem', color: '#ccc', lineHeight: '1.5' }}>
              Bitte überprüfe deine Einstellungen. Nach dem Klick auf „Initialisieren“ wird das System eingerichtet und du wirst direkt eingeloggt.
            </p>

            <div className="mc-card" style={{ padding: '16px', background: '#12141a', border: '2px solid #282a35' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ color: 'var(--mc-gray)', display: 'block', fontSize: '0.68rem', fontFamily: 'var(--mc-font)' }}>SERVER-NAME:</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{formData.serverName}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--mc-gray)', display: 'block', fontSize: '0.68rem', fontFamily: 'var(--mc-font)' }}>ARCHITEKTUR:</span>
                  <span style={{ color: 'var(--mc-aqua)', fontWeight: 'bold' }}>
                    {formData.architecture === 'DimensionalCluster' ? 'Waterfall Cluster (5 Nodes)' : 'Single Paper Server'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--mc-gray)', display: 'block', fontSize: '0.68rem', fontFamily: 'var(--mc-font)' }}>ADMIN-BENUTZER:</span>
                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{formData.adminUsername}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--mc-gray)', display: 'block', fontSize: '0.68rem', fontFamily: 'var(--mc-font)' }}>ZIEL-HOST:</span>
                  <span style={{ color: '#fff', fontFamily: 'var(--mc-font-mono)' }}>
                    {formData.architecture === 'DimensionalCluster' ? formData.clusterMasterHost : formData.singleHost}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--mc-gray)', display: 'block', fontSize: '0.68rem', fontFamily: 'var(--mc-font)' }}>DISCORD OAUTH:</span>
                  <span style={{ color: formData.enableDiscord ? 'var(--mc-purple)' : 'var(--mc-gray)' }}>
                    {formData.enableDiscord ? 'Aktiviert' : 'Deaktiviert (Später möglich)'}
                  </span>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.72rem', color: 'var(--mc-gold)', marginTop: '4px' }}>
              ✦ Alle Einstellungen (inkl. IPs, Passwörter und Discord) können jederzeit im Dashboard unter „Einstellungen“ geändert werden.
            </p>
          </div>
        )}

        {/* Action Buttons Deck */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', borderTop: '2px solid #282a35', paddingTop: '18px' }}>
          {step > 1 ? (
            <button
              onClick={prevStep}
              className="mc-btn"
              disabled={loading}
              style={{ padding: '8px 18px', fontSize: '0.8rem' }}
            >
              <ArrowLeft size={14} /> ZURÜCK
            </button>
          ) : <div />}

          {step < 5 ? (
            <button
              onClick={nextStep}
              className="mc-btn mc-btn-blue"
              style={{ padding: '8px 24px', fontSize: '0.8rem' }}
            >
              WEITER <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={submitSetup}
              disabled={loading}
              className="mc-btn mc-btn-green"
              style={{ padding: '10px 28px', fontSize: '0.85rem' }}
            >
              {loading ? (
                <>
                  <RefreshCw size={15} className="spin-anim" /> INITIALISIERE SYSTEM...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> SETUP ABSCHLIESSEN
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
