import React, { useState } from 'react';
import { X, Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { CommandBlockIcon } from './MinecraftIcons';

export default function NodeEditModal({ node, onSave, onClose }) {
  const [formData, setFormData] = useState({
    id: node?.id || '',
    name: node?.name || '',
    role: node?.role || 'Overworld',
    serverType: node?.serverType || 'Paper',
    host: node?.host || '127.0.0.1',
    sshPort: node?.sshPort || 22,
    sshUsername: node?.sshUsername || 'root',
    sshPassword: node?.sshPassword || '',
    sshPrivateKey: node?.sshPrivateKey || '',
    minecraftPort: node?.minecraftPort || 25565,
    memoryAllocationMb: node?.memoryAllocationMb || 4096,
    remoteDirectory: node?.remoteDirectory || '/opt/minecraft/server',
    minecraftVersion: node?.minecraftVersion || '1.21.1',
    motd: node?.motd || 'Ein Minecraft Dimensions-Server',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [testingSsh, setTestingSsh] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const roles = [
    { value: 'WaterfallProxy', label: 'Waterfall Proxy (Gateway)', defaultPort: 25565, defaultType: 'Waterfall' },
    { value: 'Lobby', label: 'Lobby / Hub Server', defaultPort: 25566, defaultType: 'Paper' },
    { value: 'Overworld', label: 'Overworld Dimension', defaultPort: 25567, defaultType: 'Paper' },
    { value: 'Nether', label: 'Nether Dimension', defaultPort: 25568, defaultType: 'Paper' },
    { value: 'End', label: 'The End Dimension', defaultPort: 25569, defaultType: 'Paper' },
    { value: 'Custom', label: 'Benutzerdefinierter Server', defaultPort: 25570, defaultType: 'Paper' }
  ];

  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    const rMeta = roles.find(r => r.value === selectedRole);
    setFormData(prev => ({
      ...prev,
      role: selectedRole,
      serverType: rMeta ? rMeta.defaultType : prev.serverType,
      minecraftPort: prev.minecraftPort === 25565 && rMeta ? rMeta.defaultPort : prev.minecraftPort,
      remoteDirectory: `/opt/minecraft/${selectedRole.toLowerCase()}`
    }));
  };

  const handleTestSsh = async () => {
    setTestingSsh(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/cluster/test-ssh-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Netzwerkfehler beim SSH-Test: ' + err.message
      });
    } finally {
      setTestingSsh(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      sshPort: parseInt(formData.sshPort, 10) || 22,
      minecraftPort: parseInt(formData.minecraftPort, 10) || 25565,
      memoryAllocationMb: parseInt(formData.memoryAllocationMb, 10) || 4096
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="mc-modal" style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #3c3e4a', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CommandBlockIcon size={28} />
            <div>
              <h2 className="mc-title" style={{ fontSize: '1rem', color: '#fff' }}>
                {node ? `SERVER BEARBEITEN: ${node.name}` : 'NEUEN SERVER HINZUFÜGEN'}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                SSH-Zugangsdaten und Minecraft-Instanzparameter konfigurieren
              </p>
            </div>
          </div>
          <button onClick={onClose} className="mc-btn mc-btn-red" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
            [X]
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* General Node Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <label className="mc-label">SERVER NAME</label>
              <input
                type="text"
                className="mc-input"
                placeholder="z.B. Overworld Survival"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="mc-label">SERVER-ROLLE / DIMENSION</label>
              <select
                className="mc-select"
                value={formData.role}
                onChange={handleRoleChange}
              >
                {roles.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mc-label">SERVER-SOFTWARE</label>
              <select
                className="mc-select"
                value={formData.serverType}
                onChange={e => setFormData({ ...formData, serverType: e.target.value })}
              >
                <option value="Waterfall">Waterfall Proxy</option>
                <option value="Paper">PaperMC (Empfohlen)</option>
                <option value="Purpur">Purpur</option>
              </select>
            </div>
          </div>

          {/* SSH Configuration Section */}
          <div style={{
            background: '#121318',
            border: '2px solid #383a47',
            padding: '16px',
            marginTop: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={16} color="var(--mc-aqua)" />
                <span className="mc-title" style={{ fontSize: '0.8rem', color: 'var(--mc-aqua)' }}>
                  SSH-STEUERUNGSDATEN (LINUX SERVER)
                </span>
              </div>
              <button
                type="button"
                onClick={handleTestSsh}
                disabled={testingSsh || !formData.host}
                className="mc-btn mc-btn-blue"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                <RefreshCw size={13} className={testingSsh ? 'spin-anim' : ''} />
                {testingSsh ? 'Prüfe...' : 'SSH TEST'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label className="mc-label">HOST / IP-ADRESSE</label>
                <input
                  type="text"
                  className="mc-input font-mono"
                  placeholder="z.B. 192.168.1.50 oder 45.12.89.10"
                  value={formData.host}
                  onChange={e => setFormData({ ...formData, host: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="mc-label">SSH PORT</label>
                <input
                  type="number"
                  className="mc-input font-mono"
                  value={formData.sshPort}
                  onChange={e => setFormData({ ...formData, sshPort: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="mc-label">SSH BENUTZER</label>
                <input
                  type="text"
                  className="mc-input font-mono"
                  placeholder="root"
                  value={formData.sshUsername}
                  onChange={e => setFormData({ ...formData, sshUsername: e.target.value })}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginTop: '12px' }}>
              <div>
                <label className="mc-label">SSH PASSWORT</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="mc-input font-mono"
                    placeholder="SSH Benutzerpasswort (optional falls Private Key)"
                    value={formData.sshPassword}
                    onChange={e => setFormData({ ...formData, sshPassword: e.target.value })}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--mc-gray)',
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mc-label">SSH PRIVATE KEY (OPTIONAL)</label>
                <textarea
                  className="mc-textarea font-mono"
                  rows={2}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                  value={formData.sshPrivateKey}
                  onChange={e => setFormData({ ...formData, sshPrivateKey: e.target.value })}
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
            </div>

            {/* Test Connection Output */}
            {testResult && (
              <div style={{
                marginTop: '12px',
                padding: '10px',
                background: testResult.success ? '#0d2b15' : '#3d0f0f',
                border: `2px solid ${testResult.success ? 'var(--mc-green)' : 'var(--mc-red)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: testResult.success ? 'var(--mc-green)' : 'var(--mc-red)', fontWeight: 700, fontSize: '0.8rem' }}>
                  {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{testResult.message}</span>
                </div>
                {testResult.success && (
                  <div style={{ marginTop: '6px', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--mc-gray)' }}>
                    <span>OS: {testResult.osInfo || 'Linux'}</span>
                    <span>Java: {testResult.javaVersion || 'Nicht erkannt'}</span>
                    <span>RAM frei: {testResult.memoryFreeMb}MB / {testResult.memoryTotalMb}MB</span>
                    <span>Disk frei: {testResult.diskFreeGb}GB</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Minecraft Instance Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label className="mc-label">MINECRAFT PORT</label>
              <input
                type="number"
                className="mc-input font-mono"
                value={formData.minecraftPort}
                onChange={e => setFormData({ ...formData, minecraftPort: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="mc-label">RAM ZUWEISUNG (MB)</label>
              <input
                type="number"
                step="512"
                className="mc-input font-mono"
                value={formData.memoryAllocationMb}
                onChange={e => setFormData({ ...formData, memoryAllocationMb: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="mc-label">MINECRAFT VERSION</label>
              <input
                type="text"
                className="mc-input font-mono"
                value={formData.minecraftVersion}
                onChange={e => setFormData({ ...formData, minecraftVersion: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label className="mc-label">INSTALLATIONSPFAD AUF REMOTE SERVER</label>
            <input
              type="text"
              className="mc-input font-mono"
              placeholder="/opt/minecraft/overworld"
              value={formData.remoteDirectory}
              onChange={e => setFormData({ ...formData, remoteDirectory: e.target.value })}
              required
            />
          </div>

          <div style={{ marginTop: '14px' }}>
            <label className="mc-label">MOTD (SERVER-BESCHREIBUNG)</label>
            <input
              type="text"
              className="mc-input"
              value={formData.motd}
              onChange={e => setFormData({ ...formData, motd: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '2px solid #3c3e4a', paddingTop: '16px' }}>
            <button type="button" onClick={onClose} className="mc-btn">
              ABBRECHEN
            </button>
            <button type="submit" className="mc-btn mc-btn-green">
              KNOTEN SPEICHERN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
