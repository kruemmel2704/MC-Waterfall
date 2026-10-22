import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { Send, Trash2, ArrowDownCircle } from 'lucide-react';
import { CommandBlockIcon } from './MinecraftIcons';

export default function LiveConsole({ nodes, activeNodeId, onSelectNode }) {
  const [activeId, setActiveId] = useState(activeNodeId || (nodes[0]?.id || ''));
  const [logs, setLogs] = useState({});
  const [inputCmd, setInputCmd] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);

  const hubConnectionRef = useRef(null);
  const terminalBodyRef = useRef(null);

  const activeNode = nodes.find(n => n.id === activeId) || nodes[0];

  useEffect(() => {
    if (activeNodeId) {
      setActiveId(activeNodeId);
    }
  }, [activeNodeId]);

  // Connect to SignalR Hub
  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/cluster')
      .withAutomaticReconnect()
      .build();

    connection.on('ConsoleOutput', (nodeId, text) => {
      setLogs(prev => ({
        ...prev,
        [nodeId]: (prev[nodeId] || '') + text
      }));
    });

    connection.start()
      .then(() => {
        setConnected(true);
        if (activeId) {
          connection.invoke('JoinNodeConsole', activeId);
        }
      })
      .catch(err => {
        console.warn('SignalR Hub fallback:', err);
      });

    hubConnectionRef.current = connection;

    return () => {
      if (connection) {
        connection.stop();
      }
    };
  }, []);

  // On active node change, fetch latest logs and join room
  useEffect(() => {
    if (!activeId) return;

    fetch(`/api/cluster/node/${activeId}/logs?lines=80`)
      .then(res => res.json())
      .then(data => {
        if (data.logs) {
          setLogs(prev => ({
            ...prev,
            [activeId]: data.logs
          }));
        }
      })
      .catch(() => {});

    if (hubConnectionRef.current && hubConnectionRef.current.state === signalR.HubConnectionState.Connected) {
      hubConnectionRef.current.invoke('JoinNodeConsole', activeId);
    }
  }, [activeId]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && terminalBodyRef.current) {
      terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight;
    }
  }, [logs, activeId, autoScroll]);

  const handleSendCommand = async (cmdToSend) => {
    const cmd = cmdToSend || inputCmd;
    if (!cmd.trim() || !activeId) return;

    setHistory(prev => [cmd, ...prev]);
    setHistoryIdx(-1);
    setInputCmd('');

    setLogs(prev => ({
      ...prev,
      [activeId]: (prev[activeId] || '') + `\n> ${cmd}\n`
    }));

    try {
      if (hubConnectionRef.current && hubConnectionRef.current.state === signalR.HubConnectionState.Connected) {
        await hubConnectionRef.current.invoke('SendConsoleCommand', activeId, cmd);
      } else {
        await fetch(`/api/cluster/node/${activeId}/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeId: activeId, command: cmd })
        });
      }
    } catch (err) {
      setLogs(prev => ({
        ...prev,
        [activeId]: (prev[activeId] || '') + `[FEHLER]: ${err.message}\n`
      }));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSendCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIdx < history.length - 1) {
        const nextIdx = historyIdx + 1;
        setHistoryIdx(nextIdx);
        setInputCmd(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInputCmd(history[nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setInputCmd('');
      }
    }
  };

  const clearLogs = () => {
    setLogs(prev => ({ ...prev, [activeId]: '' }));
  };

  const renderLogLines = (text) => {
    if (!text) return <div style={{ color: 'var(--mc-dark-gray)' }}>Keine Konsolenausgabe vorhanden oder Server noch offline.</div>;
    
    return text.split('\n').map((line, idx) => {
      let lineClass = '';
      if (line.includes('ERROR') || line.includes('Exception') || line.includes('severe')) {
        lineClass = 'log-error';
      } else if (line.includes('WARN')) {
        lineClass = 'log-warn';
      } else if (line.includes('INFO')) {
        lineClass = 'log-info';
      } else if (line.startsWith('>')) {
        lineClass = 'log-cmd';
      }

      return (
        <div key={idx} className={lineClass} style={{ minHeight: '1.2em' }}>
          {line}
        </div>
      );
    });
  };

  return (
    <div className="mc-panel" style={{ padding: '24px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CommandBlockIcon size={28} />
          <div>
            <h2 className="mc-title" style={{ fontSize: '1.1rem', color: '#fff' }}>
              LIVE SERVER-KONSOLE & TERMINAL
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '2px' }}>
              Echtzeit-Befehlsausführung und SSH-Screen Logstream (Befehlsblock-Modus)
            </p>
          </div>
        </div>

        {/* Node Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {nodes.map(n => (
            <button
              key={n.id}
              onClick={() => {
                setActiveId(n.id);
                onSelectNode?.(n);
              }}
              className={`mc-btn ${activeId === n.id ? 'mc-btn-blue' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
            >
              <span className={`mc-status-dot ${n.status === 'Online' ? 'mc-status-online' : 'mc-status-offline'}`} style={{ width: '8px', height: '8px' }} />
              {n.name}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Window */}
      <div className="mc-terminal">
        {/* Terminal Header */}
        <div className="mc-terminal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--mc-gold)', fontWeight: 700 }}>
              [{activeNode ? activeNode.name.toUpperCase() : 'SERVER'}]
            </span>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--mc-gray)' }}>
              {activeNode ? `${activeNode.sshUsername}@${activeNode.host}:${activeNode.remoteDirectory}` : ''}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className="mc-btn"
              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
            >
              <ArrowDownCircle size={13} /> SCROLL: {autoScroll ? 'AN' : 'AUS'}
            </button>
            <button
              onClick={clearLogs}
              className="mc-btn"
              style={{ padding: '4px 8px', fontSize: '0.7rem' }}
            >
              <Trash2 size={13} /> LEEREN
            </button>
          </div>
        </div>

        {/* Terminal Output */}
        <div className="mc-terminal-body" ref={terminalBodyRef}>
          {renderLogLines(logs[activeId])}
        </div>

        {/* Command Shortcuts */}
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '6px 12px',
          background: '#15171f',
          borderTop: '2px solid #000',
          overflowX: 'auto'
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', alignSelf: 'center', marginRight: '6px' }}>
            SCHNELLBEFEHLE:
          </span>
          {['list', 'tps', 'whitelist list', 'version', 'help', 'say Hallo Cluster!'].map(cmd => (
            <button
              key={cmd}
              onClick={() => handleSendCommand(cmd)}
              className="mc-btn font-mono"
              style={{ padding: '3px 8px', fontSize: '0.7rem', whiteSpace: 'nowrap' }}
            >
              /{cmd}
            </button>
          ))}
          {activeNode?.role === 'WaterfallProxy' && (
            <button
              onClick={() => handleSendCommand('greload')}
              className="mc-btn mc-btn-blue font-mono"
              style={{ padding: '3px 8px', fontSize: '0.7rem' }}
            >
              /greload
            </button>
          )}
        </div>

        {/* Terminal Input Bar */}
        <div style={{
          display: 'flex',
          padding: '8px 12px',
          background: '#0d0e12',
          borderTop: '2px solid #20222a'
        }}>
          <span className="font-mono" style={{ color: 'var(--mc-green)', marginRight: '8px', fontWeight: 700, alignSelf: 'center' }}>
            /
          </span>
          <input
            type="text"
            className="mc-input"
            style={{ border: 'none', background: 'transparent' }}
            placeholder={`Befehl an ${activeNode?.name || 'Server'} senden...`}
            value={inputCmd}
            onChange={e => setInputCmd(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => handleSendCommand()}
            className="mc-btn mc-btn-green"
            style={{ padding: '6px 14px', fontSize: '0.75rem', marginLeft: '8px' }}
          >
            <Send size={13} /> SENDEN
          </button>
        </div>
      </div>
    </div>
  );
}
