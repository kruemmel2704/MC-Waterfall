import React, { useState } from 'react';
import { Lock, User, AlertCircle, RefreshCw, LogIn } from 'lucide-react';

export default function LoginPage({ authStatus, onLoginSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLocalLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Bitte Benutzername und Passwort eingeben.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Anmeldung fehlgeschlagen.');
      }

      if (data.token) {
        localStorage.setItem('mc_session_token', data.token);
      }

      onLoginSuccess?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscordLogin = () => {
    if (!authStatus?.discordClientId) {
      setError('Discord Client ID ist nicht im System konfiguriert.');
      return;
    }

    const redirectUri = window.location.origin + '/auth/discord';
    const state = 'dashboard_login';
    const scope = encodeURIComponent('identify guilds guilds.members.read');
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${authStatus.discordClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}`;

    window.location.href = discordUrl;
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'radial-gradient(circle at 50% 25%, #1c1e28 0%, #0d0e13 100%)'
    }}>
      <div className="mc-panel" style={{
        maxWidth: '460px',
        width: '100%',
        padding: '36px',
        border: '4px solid #3c3e4a',
        boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
        textAlign: 'center'
      }}>
        {/* Server Brand & Logo */}
        <div style={{
          width: '74px',
          height: '74px',
          margin: '0 auto 16px',
          background: '#0d0e12',
          border: '3px solid var(--mc-blue)',
          boxShadow: '0 0 20px rgba(85,85,255,0.4)',
          overflow: 'hidden'
        }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <h1 className="mc-title" style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '4px' }}>
          {authStatus?.serverName?.toUpperCase() || 'MINECRAFT CLUSTER'}
        </h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginBottom: '24px' }}>
          Bitte melde dich an, um auf das Management-Dashboard zuzugreifen
        </p>

        {error && (
          <div style={{
            background: '#3d1212',
            border: '2px solid var(--mc-red)',
            padding: '10px 14px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#fff',
            fontSize: '0.75rem',
            textAlign: 'left'
          }}>
            <AlertCircle size={16} color="var(--mc-red)" />
            <span>{error}</span>
          </div>
        )}

        {/* Local Admin Login Form */}
        <form onSubmit={handleLocalLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
              BENUTZERNAME:
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} color="var(--mc-gray)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mc-input"
                style={{ width: '100%', paddingLeft: '38px' }}
                placeholder="admin"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--mc-gray)', marginBottom: '4px', fontFamily: 'var(--mc-font)' }}>
              PASSWORT:
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--mc-gray)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mc-input"
                style={{ width: '100%', paddingLeft: '38px' }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mc-btn mc-btn-green"
            style={{ width: '100%', padding: '10px', fontSize: '0.85rem', marginTop: '6px', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="spin-anim" /> ANMELDEN...
              </>
            ) : (
              <>
                <LogIn size={14} /> ANMELDEN
              </>
            )}
          </button>
        </form>

        {/* Optional Discord Login */}
        {authStatus?.discordOAuthEnabled && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '16px 0',
              color: 'var(--mc-gray)',
              fontSize: '0.65rem',
              fontFamily: 'var(--mc-font)'
            }}>
              <div style={{ flex: 1, height: '1px', background: '#282a35' }} />
              <span>ODER MIT DISCORD</span>
              <div style={{ flex: 1, height: '1px', background: '#282a35' }} />
            </div>

            <button
              onClick={handleDiscordLogin}
              type="button"
              className="mc-btn mc-btn-purple"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '0.8rem',
                justifyContent: 'center',
                background: '#5865F2',
                border: '2px solid #4752C4'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>MIT DISCORD ANMELDEN</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
