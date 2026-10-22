import React from 'react';
import { 
  WaterfallBeaconIcon, GrassBlockIcon, NetherPortalIcon, EyeOfEnderIcon, 
  LobbyCrownIcon, CommandBlockIcon, RedstoneTorchIcon 
} from './MinecraftIcons';
import { ShieldCheck, DownloadCloud } from 'lucide-react';

export default function ClusterTopology({ nodes, onSelectNode, onDeployCluster }) {
  const proxy = nodes.find(n => n.role === 'WaterfallProxy');
  const backendNodes = nodes.filter(n => n.role !== 'WaterfallProxy');

  const getRoleIcon = (role) => {
    switch (role) {
      case 'Lobby': return <LobbyCrownIcon size={28} />;
      case 'Overworld': return <GrassBlockIcon size={28} />;
      case 'Nether': return <NetherPortalIcon size={28} />;
      case 'End': return <EyeOfEnderIcon size={28} />;
      default: return <CommandBlockIcon size={28} />;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Lobby': return 'var(--dim-lobby)';
      case 'Overworld': return 'var(--dim-overworld)';
      case 'Nether': return 'var(--dim-nether)';
      case 'End': return 'var(--dim-end)';
      default: return 'var(--dim-proxy)';
    }
  };

  return (
    <div className="mc-panel" style={{ padding: '24px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <RedstoneTorchIcon size={24} />
            <h2 className="mc-title" style={{ fontSize: '1.1rem', color: 'var(--mc-white)' }}>
              CLUSTER NETZWERK-TOPOLOGIE
            </h2>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)' }}>
            Waterfall leitet Spieler automatisch zwischen den Dimensionen weiter (IP-Forwarding & BungeeCord Protocol aktiv)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{
            background: '#0d1a24',
            border: '2px solid var(--dim-proxy)',
            padding: '6px 12px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--dim-proxy)'
          }}>
            <ShieldCheck size={16} />
            <span>PROXY-FORWARDING: <strong>AKTIV</strong></span>
          </div>
          <button onClick={onDeployCluster} className="mc-btn mc-btn-green" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
            <DownloadCloud size={16} /> KOMPLETTES CLUSTER DEPLOYEN
          </button>
        </div>
      </div>

      {/* Minecraft Visual Topo Diagram */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', padding: '16px 0' }}>
        {/* Waterfall Proxy Beacon */}
        {proxy ? (
          <div
            onClick={() => onSelectNode(proxy)}
            className="mc-panel"
            style={{
              background: '#0c2738',
              border: '3px solid var(--dim-proxy)',
              borderTopColor: '#baffff',
              borderLeftColor: '#baffff',
              padding: '16px 28px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              zIndex: 2,
              boxShadow: '0 0 20px rgba(85, 255, 255, 0.25), 0 0 0 2px #000'
            }}
          >
            <div style={{
              width: '46px',
              height: '46px',
              background: '#081721',
              border: '2px solid var(--dim-proxy)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 2px 2px 0px #000'
            }}>
              <WaterfallBeaconIcon size={32} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="mc-title" style={{ fontSize: '0.95rem', color: '#fff' }}>
                  {proxy.name}
                </span>
                <span className={`mc-status-dot ${proxy.status === 'Online' ? 'mc-status-online' : 'mc-status-offline'}`} />
              </div>
              <div className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                ÖFFENTLICHER EINSTIEG: <strong style={{ color: 'var(--dim-proxy)' }}>{proxy.host}:{proxy.minecraftPort}</strong>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--mc-dark-gray)', marginTop: '2px' }}>
                SSH: {proxy.sshUsername}@{proxy.host} | RAM: {proxy.memoryAllocationMb}MB
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 20px', border: '2px solid var(--mc-red)', color: 'var(--mc-red)' }}>
            Kein Waterfall-Proxy konfiguriert!
          </div>
        )}

        {/* Vertical Redstone Wire from Proxy */}
        <div style={{
          width: '4px',
          height: '32px',
          background: 'var(--dim-proxy)',
          boxShadow: '0 0 8px var(--dim-proxy)'
        }} />

        {/* Horizontal Distribution Rail */}
        <div style={{
          width: '85%',
          maxWidth: '900px',
          height: '4px',
          background: '#ff5555',
          boxShadow: '0 0 8px #ff5555',
          position: 'relative'
        }} />

        {/* Backend Dimension Nodes Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`,
          gap: '16px',
          width: '100%',
          maxWidth: '1100px',
          marginTop: '20px'
        }}>
          {backendNodes.map(node => {
            const roleColor = getRoleColor(node.role);
            const isOnline = node.status === 'Online';
            return (
              <div
                key={node.id}
                onClick={() => onSelectNode(node)}
                className="mc-panel"
                style={{
                  background: '#15161c',
                  border: `3px solid ${isOnline ? roleColor : '#3c3e4a'}`,
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: '#0a0b0e',
                    border: '1px solid #2e303b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 2px 2px 0px #000'
                  }}>
                    {getRoleIcon(node.role)}
                  </div>
                  <span className={`mc-status-dot ${isOnline ? 'mc-status-online' : 'mc-status-offline'}`} />
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
                    {node.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: roleColor, fontWeight: 700, marginTop: '2px' }}>
                    {node.role.toUpperCase()}
                  </div>
                </div>

                <div className="mc-slot font-mono" style={{ fontSize: '0.75rem', color: 'var(--mc-gray)' }}>
                  <div>PORT: <strong style={{ color: 'var(--mc-yellow)' }}>:{node.minecraftPort}</strong></div>
                  <div>IP: {node.host}</div>
                </div>

                <div style={{ fontSize: '0.7rem', color: 'var(--mc-gray)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>RAM: {node.memoryAllocationMb}MB</span>
                  <span style={{ color: isOnline ? 'var(--mc-green)' : 'var(--mc-dark-gray)' }}>
                    {isOnline ? 'AKTIV' : 'OFFLINE'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
