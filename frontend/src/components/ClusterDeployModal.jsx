import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { DownloadCloud, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { CommandBlockIcon, RedstoneTorchIcon } from './MinecraftIcons';

export default function ClusterDeployModal({ node, isFullCluster, onClose, onCompleted }) {
  const [installJava, setInstallJava] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('idle');
  const logBoxRef = useRef(null);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/cluster')
      .withAutomaticReconnect()
      .build();

    connection.on('DeploymentProgress', (log) => {
      setLogs(prev => [...prev, log]);
      if (log.step === 'Bereitstellung abgeschlossen' && log.success) {
        setStatus('success');
        setDeploying(false);
        onCompleted?.();
      }
    });

    connection.on('DeploymentCompleted', (data) => {
      if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
        setLogs(data.logs);
      }
      setStatus(data.success ? 'success' : 'error');
      setDeploying(false);
      onCompleted?.();
    });

    connection.start().catch(() => {});

    return () => {
      connection.stop();
    };
  }, []);

  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logs]);

  const startDeployment = async () => {
    setDeploying(true);
    setStatus('running');
    setLogs([]);

    try {
      const url = isFullCluster 
        ? '/api/deployment/deploy-cluster' 
        : `/api/deployment/deploy-node/${node.id}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installJavaIfMissing: installJava })
      });

      if (!res.ok) {
        throw new Error('Bereitstellungsschnittstelle antwortete mit Status ' + res.status);
      }

      const resultLogs = await res.json();
      setLogs(resultLogs);

      const hasError = resultLogs.some(l => !l.success);
      setStatus(hasError ? 'error' : 'success');
      onCompleted?.();
      setDeploying(false);
    } catch (err) {
      if (err.message && err.message.includes('504')) {
        setLogs(prev => [
          ...prev,
          { 
            step: 'Hinweis (Gateway-Timeout)', 
            success: true, 
            output: 'Der Webserver hat ein temporäres HTTP-Timeout (504) gemeldet. Die Installation & Downloads laufen jedoch über SSH im Hintergrund weiter. Bitte beobachte die Live-Ausgabe oben...', 
            timestamp: new Date().toISOString() 
          }
        ]);
      } else {
        setStatus('error');
        setLogs(prev => [
          ...prev,
          { step: 'Kritischer Fehler', success: false, output: err.message, timestamp: new Date().toISOString() }
        ]);
        setDeploying(false);
      }
    }
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
      <div className="mc-modal" style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #3c3e4a', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CommandBlockIcon size={28} />
            <div>
              <h2 className="mc-title" style={{ fontSize: '1rem', color: '#fff' }}>
                {isFullCluster ? 'KOMPLETTES CLUSTER BEREITSTELLEN' : `SERVER BEREITSTELLEN: ${node?.name}`}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
                Automatische SSH-Provisionierung von Java, Server-Jars, Configs und Startskripten
              </p>
            </div>
          </div>
          {!deploying && (
            <button onClick={onClose} className="mc-btn mc-btn-red" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
              [X]
            </button>
          )}
        </div>

        {/* Options */}
        {status === 'idle' && (
          <div>
            <div style={{
              background: '#121318',
              border: '2px solid #383a47',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <RedstoneTorchIcon size={18} />
                <h4 className="mc-title" style={{ fontSize: '0.8rem', color: 'var(--mc-yellow)' }}>
                  Auszuführende Schritte auf den Linux-Zielservern:
                </h4>
              </div>
              <ul style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', lineHeight: '1.7', paddingLeft: '20px' }}>
                <li>SSH-Verbindung verifizieren und Root/Sudo Berechtigungen prüfen</li>
                <li>OpenJDK 21 prüfen & bei Bedarf via apt/dnf automatisch installieren</li>
                <li>Screen-Dienst für Hintergrundprozesse bereitstellen</li>
                <li>Aktuelle Waterfall- & PaperMC-Jars herunterladen</li>
                <li>Minecraft EULA akzeptieren und Ports konfigurieren</li>
                <li>Waterfall config.yml & spigot.yml (BungeeCord=true) synchronisieren</li>
                <li>Start- & Stoppskripte anlegen und Server im Hintergrund starten</li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <input
                type="checkbox"
                id="installJava"
                checked={installJava}
                onChange={e => setInstallJava(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--mc-green)' }}
              />
              <label htmlFor="installJava" className="mc-label" style={{ fontSize: '0.8rem', cursor: 'pointer', margin: 0, color: '#fff' }}>
                OpenJDK 21 automatisch via Paketmanager installieren, falls nicht vorhanden
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={onClose} className="mc-btn">
                ABBRECHEN
              </button>
              <button onClick={startDeployment} className="mc-btn mc-btn-green" style={{ padding: '8px 20px' }}>
                <DownloadCloud size={16} /> JETZT DEPLOYEN
              </button>
            </div>
          </div>
        )}

        {/* Live Deployment Progress */}
        {(status === 'running' || status === 'success' || status === 'error') && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {status === 'running' && <RefreshCw size={18} color="var(--mc-aqua)" className="spin-anim" />}
                {status === 'success' && <CheckCircle2 size={18} color="var(--mc-green)" />}
                {status === 'error' && <AlertCircle size={18} color="var(--mc-red)" />}
                <span className="mc-title" style={{
                  fontSize: '0.8rem',
                  color: status === 'running' ? 'var(--mc-aqua)' : status === 'success' ? 'var(--mc-green)' : 'var(--mc-red)'
                }}>
                  {status === 'running' ? 'PROVISIONIERUNG LÄUFT VIA SSH...' :
                   status === 'success' ? 'BEREITSTELLUNG ERFOLGREICH!' :
                   'BEREITSTELLUNG FEHLGESCHLAGEN'}
                </span>
              </div>
              <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--mc-gray)' }}>
                {logs.length} Schritte
              </span>
            </div>

            {/* Terminal Log Container */}
            <div
              ref={logBoxRef}
              className="mc-terminal"
              style={{
                padding: '14px',
                height: '320px',
                overflowY: 'auto',
                fontFamily: 'var(--mc-font-mono)',
                fontSize: '0.8rem',
                lineHeight: '1.5',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {logs.map((l, idx) => (
                <div key={idx} style={{
                  borderLeft: `3px solid ${l.success ? 'var(--mc-green)' : 'var(--mc-red)'}`,
                  paddingLeft: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  paddingTop: '4px',
                  paddingBottom: '4px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: l.success ? 'var(--mc-aqua)' : 'var(--mc-red)' }}>
                    <strong>[{l.step}]</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--mc-dark-gray)' }}>
                      {new Date(l.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ color: '#ffffff', whiteSpace: 'pre-wrap', marginTop: '2px' }}>
                    {l.output}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={onClose}
                disabled={deploying}
                className="mc-btn mc-btn-green"
                style={{ padding: '8px 24px' }}
              >
                {deploying ? 'BITTE WARTEN...' : 'SCHLIESSEN'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
