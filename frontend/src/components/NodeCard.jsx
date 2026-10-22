import React, { useState } from 'react';
import { 
  Play, Square, RotateCw, Terminal, Edit3, Trash2, Key, DownloadCloud,
  CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';

import { 
  GrassBlockIcon, NetherPortalIcon, EyeOfEnderIcon, WaterfallBeaconIcon, 
  LobbyCrownIcon, CommandBlockIcon 
} from './MinecraftIcons';

export default function NodeCard({ 
  node, 
  onEdit, 
  onDelete, 
  onStart, 
  onStop, 
  onRestart, 
  onOpenConsole,
  onDeploy
}) {
  const [testingSsh, setTestingSsh] = useState(false);
  const [sshPopover, setSshPopover] = useState(null);

  const getRoleIcon = (role) => {
    switch (role) {
      case 'WaterfallProxy': return <WaterfallBeaconIcon size={26} />;
      case 'Lobby': return <LobbyCrownIcon size={26} />;
      case 'Overworld': return <GrassBlockIcon size={26} />;
      case 'Nether': return <NetherPortalIcon size={26} />;
      case 'End': return <EyeOfEnderIcon size={26} />;
      default: return <CommandBlockIcon size={26} />;
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'WaterfallProxy': return 'mc-badge-proxy';
      case 'Lobby': return 'mc-badge-lobby';
      case 'Overworld': return 'mc-badge-overworld';
      case 'Nether': return 'mc-badge-nether';
      case 'End': return 'mc-badge-end';
      default: return 'mc-badge-proxy';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Online': return 'mc-status-online';
      case 'Starting':
      case 'Deploying': return 'mc-status-starting';
      case 'Error': return 'mc-status-error';
      default: return 'mc-status-offline';
    }
  };

  const getBorderColor = (role) => {
    switch (role) {
      case 'WaterfallProxy': return 'var(--dim-proxy)';
      case 'Lobby': return 'var(--dim-lobby)';
      case 'Overworld': return 'var(--dim-overworld)';
      case 'Nether': return 'var(--dim-nether)';
      case 'End': return 'var(--dim-end)';
      default: return '#55ffff';
    }
  };

  const handleTestSsh = async () => {
    setTestingSsh(true);
    setSshPopover(null);
    try {
      const res = await fetch(`/api/cluster/node/${node.id}/test-ssh`, { method: 'POST' });
      const data = await res.json();
      setSshPopover(data);
    } catch (err) {
      setSshPopover({ success: false, message: 'SSH-Fehler: ' + err.message });
    } finally {
      setTestingSsh(false);
    }
  };

  const isOnline = node.status === 'Online';
  const isStarting = node.status === 'Starting' || node.status === 'Deploying';

  return (
    <div className="mc-panel" style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      position: 'relative'
    }}>
      {/* Dimension Top Bar Accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: getBorderColor(node.role)
      }} />

      {/* Header Info */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: '#0d0e12',
              border: '2px solid #3c3e4a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 2px 2px 0px #000'
            }}>
              {getRoleIcon(node.role)}
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '4px' }}>
                {node.name}
              </h3>
              <span className={`mc-badge ${getRoleBadgeClass(node.role)}`}>
                {node.role} • {node.serverType}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0a0b0e', padding: '4px 8px', border: '1px solid #292a33' }}>
            <span className={`mc-status-dot ${getStatusClass(node.status)}`} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isOnline ? 'var(--mc-green)' : isStarting ? 'var(--mc-yellow)' : 'var(--mc-gray)' }}>
              {node.status === 'Online' ? 'ONLINE' : node.status === 'Starting' ? 'STARTET' : node.status === 'Deploying' ? 'DEPLOY' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Minecraft Item Slots for Server Meta */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '14px'
        }}>
          <div className="mc-slot">
            <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', display: 'block' }}>SSH HOST</span>
            <span className="font-mono" style={{ color: 'var(--mc-aqua)', fontSize: '0.75rem', fontWeight: 600 }}>
              {node.sshUsername}@{node.host}
            </span>
          </div>
          <div className="mc-slot">
            <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', display: 'block' }}>MC PORT</span>
            <span className="font-mono" style={{ color: 'var(--mc-gold)', fontSize: '0.75rem', fontWeight: 700 }}>
              :{node.minecraftPort}
            </span>
          </div>
          <div className="mc-slot">
            <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', display: 'block' }}>RAM ZUWEISUNG</span>
            <span className="font-mono" style={{ color: 'var(--mc-white)', fontSize: '0.75rem' }}>
              {node.memoryAllocationMb >= 1024 ? `${(node.memoryAllocationMb / 1024).toFixed(1)} GB` : `${node.memoryAllocationMb} MB`}
            </span>
          </div>
          <div className="mc-slot">
            <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', display: 'block' }}>AUSLASTUNG</span>
            <span className="font-mono" style={{ color: isOnline ? 'var(--mc-green)' : 'var(--mc-dark-gray)', fontSize: '0.75rem' }}>
              {isOnline ? `${node.cpuPercent.toFixed(0)}% CPU` : 'Inaktiv'}
            </span>
          </div>
        </div>

        {/* SSH Popover Output */}
        {sshPopover && (
          <div style={{
            marginBottom: '12px',
            padding: '8px 10px',
            background: sshPopover.success ? '#0d2b15' : '#3d0f0f',
            border: `2px solid ${sshPopover.success ? 'var(--mc-green)' : 'var(--mc-red)'}`,
            fontSize: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: sshPopover.success ? 'var(--mc-green)' : 'var(--mc-red)' }}>
                {sshPopover.message}
              </span>
              <button onClick={() => setSshPopover(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'var(--mc-font)' }}>
                [X]
              </button>
            </div>
            {sshPopover.success && (
              <div style={{ marginTop: '4px', color: 'var(--mc-gray)', fontSize: '0.7rem' }}>
                OS: {sshPopover.osInfo || 'Linux'} | Java: {sshPopover.javaVersion || 'Nein'} | RAM frei: {sshPopover.memoryFreeMb}MB
              </div>
            )}
          </div>
        )}
      </div>

      {/* Minecraft Action Buttons */}
      <div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          {isOnline ? (
            <button
              onClick={() => onStop(node.id)}
              className="mc-btn mc-btn-red"
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem' }}
            >
              <Square size={13} /> STOPP
            </button>
          ) : (
            <button
              onClick={() => onStart(node.id)}
              className="mc-btn mc-btn-green"
              disabled={isStarting}
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem' }}
            >
              <Play size={13} /> START
            </button>
          )}

          <button
            onClick={() => onRestart(node.id)}
            className="mc-btn"
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            title="Neustarten"
          >
            <RotateCw size={13} />
          </button>

          <button
            onClick={() => onOpenConsole(node.id)}
            className="mc-btn mc-btn-blue"
            style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem' }}
          >
            <Terminal size={13} /> KONSOLE
          </button>
        </div>

        {/* Secondary Toolbar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '2px solid #20222a',
          paddingTop: '8px'
        }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={handleTestSsh}
              disabled={testingSsh}
              className="mc-btn"
              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
              title="SSH-Verbindung testen"
            >
              <Key size={12} className={testingSsh ? 'spin-anim' : ''} /> SSH Test
            </button>
            <button
              onClick={() => onDeploy(node.id)}
              className="mc-btn"
              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
              title="Server-Jar & Configs deployen"
            >
              <DownloadCloud size={12} /> Deploy
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => onEdit(node)}
              className="mc-btn"
              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
              title="Bearbeiten"
            >
              <Edit3 size={12} />
            </button>
            {node.role === 'Custom' && (
              <button
                onClick={() => onDelete(node.id)}
                className="mc-btn mc-btn-red"
                style={{ padding: '4px 8px', fontSize: '0.7rem' }}
                title="Löschen"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
