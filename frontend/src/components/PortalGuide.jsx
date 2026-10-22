import React, { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Code2 } from 'lucide-react';
import { NetherPortalIcon, EyeOfEnderIcon, GrassBlockIcon, RedstoneTorchIcon } from './MinecraftIcons';

export default function PortalGuide() {
  const [guideData, setGuideData] = useState(null);
  const [configPreview, setConfigPreview] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/portalguide')
      .then(res => res.json())
      .then(data => setGuideData(data))
      .catch(() => {});

    fetch('/api/deployment/preview-waterfall-config')
      .then(res => res.json())
      .then(data => setConfigPreview(data.config))
      .catch(() => {});
  }, []);

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(configPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div className="mc-panel" style={{ padding: '24px', borderLeft: '6px solid var(--dim-end)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <NetherPortalIcon size={32} />
          <h2 className="mc-title" style={{ fontSize: '1.15rem', color: '#fff' }}>
            DIMENSIONS-SYNCHRONISATION & PORTAL-VERKNÜPFUNG
          </h2>
        </div>
        <p style={{ color: 'var(--mc-gray)', fontSize: '0.8rem', maxWidth: '850px', lineHeight: '1.6' }}>
          In diesem Cluster läuft jede Dimension (Overworld, Nether, The End) als eigenständiger, dedizierter Paper-Prozess auf voller Server-Leistung. Hier erfährst du, wie Spieler nahtlos mit Portalen und gemeinsamen Inventaren zwischen den Servern reisen.
        </p>
      </div>

      {/* Guide Steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {guideData?.steps?.map((step, idx) => (
          <div key={idx} className="mc-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <RedstoneTorchIcon size={18} />
                <h3 className="mc-title" style={{ fontSize: '0.85rem', color: 'var(--mc-yellow)' }}>
                  {step.title}
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginBottom: '14px', lineHeight: '1.6' }}>
                {step.description}
              </p>
              
              <div className="mc-slot" style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', display: 'block', marginBottom: '4px' }}>
                  ANLEITUNG:
                </span>
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--mc-aqua)' }}>
                  {step.instructions}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #282a35', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--mc-gray)' }}>
                Plugin: <strong style={{ color: '#fff' }}>{step.recommendedPlugin}</strong>
              </span>
              {step.downloadUrl && (
                <a
                  href={step.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mc-btn"
                  style={{ padding: '4px 10px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  Download <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Waterfall Config Preview */}
      <div className="mc-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code2 size={20} color="var(--mc-aqua)" />
            <div>
              <h3 className="mc-title" style={{ fontSize: '0.95rem', color: '#fff' }}>
                WATERFALL CONFIG.YML (AUTOMATISCH GENERIERT)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                Wird automatisch auf den Proxy übertragen und enthält alle registrierten Dimensions-Knoten
              </p>
            </div>
          </div>

          <button onClick={handleCopyConfig} className="mc-btn mc-btn-blue" style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
            {copied ? <Check size={14} color="var(--mc-green)" /> : <Copy size={14} />}
            {copied ? 'KOPIERT!' : 'CONFIG KOPIEREN'}
          </button>
        </div>

        <div className="mc-terminal" style={{ padding: '14px', maxHeight: '300px', overflowY: 'auto' }}>
          <pre className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--mc-aqua)', lineHeight: '1.5', margin: 0 }}>
            {configPreview || 'Lade Konfiguration...'}
          </pre>
        </div>
      </div>
    </div>
  );
}
