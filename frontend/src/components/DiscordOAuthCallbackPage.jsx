import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, ArrowLeft, Sparkles } from 'lucide-react';

export default function DiscordOAuthCallbackPage({ onBackToDashboard }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [inputPlayerName, setInputPlayerName] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const playerParam = params.get('player') || params.get('name') || params.get('spieler');

    // Case 1: No code present yet
    if (!code) {
      // If player name is provided as query param: auto-redirect to Discord OAuth!
      if (playerParam) {
        setLoading(true);
        fetch(`/api/discord/oauth/url?state=${encodeURIComponent(playerParam.trim())}`)
          .then(res => res.json())
          .then(data => {
            if (data.url) {
              window.location.href = data.url;
            } else {
              throw new Error('OAuth2-URL konnte nicht geladen werden.');
            }
          })
          .catch(err => {
            setError(err.message);
            setLoading(false);
          });
        return;
      }

      // No code and no player param: prompt player for their Minecraft username
      setLoading(false);
      setShowNamePrompt(true);
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;

    if (state === 'dashboard_login') {
      // Dashboard Admin Login Flow
      fetch('/api/auth/discord-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri })
      })
        .then(async res => {
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.message || 'Discord Dashboard-Anmeldung fehlgeschlagen.');
          }
          if (data.token) {
            localStorage.setItem('mc_session_token', data.token);
          }
          setResult({
            isDashboardLogin: true,
            username: data.username,
            avatarUrl: data.avatarUrl
          });
          setTimeout(() => {
            window.location.href = '/';
          }, 1200);
        })
        .catch(err => {
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    // Standard Minecraft In-Game Player Verification Flow
    fetch('/api/discord/oauth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        state,
        redirectUri
      })
    })
      .then(async res => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || errData.message || 'Verifikation fehlgeschlagen.');
        }
        return res.json();
      })
      .then(data => {
        setResult({
          profile: data,
          targetPlayer: state
        });
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleStartOAuthWithName = async (e) => {
    e.preventDefault();
    if (!inputPlayerName.trim()) return;
    setRedirecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/discord/oauth/url?state=${encodeURIComponent(inputPlayerName.trim())}`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('OAuth2-URL konnte nicht geladen werden.');
      }
    } catch (err) {
      setError(err.message);
      setRedirecting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="mc-panel" style={{
        maxWidth: '560px',
        width: '100%',
        padding: '32px',
        textAlign: 'center',
        border: '4px solid #3c3e4a'
      }}>
        {/* Logo */}
        <div style={{
          width: '84px',
          height: '84px',
          margin: '0 auto 20px',
          border: '3px solid var(--mc-blue)',
          boxShadow: '0 0 20px rgba(85, 85, 255, 0.4), inset 2px 2px 0 #000',
          overflow: 'hidden',
          background: '#0d0e12'
        }}>
          <img
            src="/logo.jpg"
            alt="Minecraft Discord Logo"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <h2 className="mc-title" style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '8px' }}>
          MINECRAFT DISCORD OAUTH2
        </h2>

        {loading && (
          <div style={{ padding: '30px 0' }}>
            <RefreshCw size={36} className="spin-anim" color="var(--mc-aqua)" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--mc-gray)', fontSize: '0.85rem' }}>
              Verifiziere Account mit Discord & prüfe Server-Mitgliedschaft...
            </p>
          </div>
        )}

        {!loading && showNamePrompt && !result && (
          <div style={{ margin: '10px 0 20px' }}>
            <div style={{
              background: '#12141c',
              border: '2px solid var(--mc-blue)',
              padding: '20px',
              textAlign: 'left'
            }}>
              <h3 className="mc-title" style={{ fontSize: '0.85rem', color: 'var(--mc-aqua)', marginBottom: '8px' }}>
                MINECRAFT SPIELER-VERIFIZIERUNG
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginBottom: '16px', lineHeight: 1.4 }}>
                Gib deinen genauen Minecraft-Spielernamen ein. Anschließend wirst du zu Discord weitergeleitet, um deinen Account für das Dimension-Cluster freizuschalten.
              </p>

              <form onSubmit={handleStartOAuthWithName}>
                <div style={{ marginBottom: '16px' }}>
                  <label className="mc-label" style={{ fontSize: '0.72rem', color: '#fff', marginBottom: '6px' }}>
                    DEIN MINECRAFT SPIELERNAME:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="z.B. Steve oder kruemmel2704"
                    value={inputPlayerName}
                    onChange={e => setInputPlayerName(e.target.value)}
                    className="mc-input"
                    style={{ fontSize: '0.9rem', padding: '10px 12px' }}
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={redirecting || !inputPlayerName.trim()}
                  className="mc-btn mc-btn-purple"
                  style={{ width: '100%', padding: '10px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Sparkles size={16} />
                  {redirecting ? 'LEITE ZU DISCORD WEITER...' : 'JETZT MIT DISCORD VERKNÜPFEN'}
                </button>
              </form>
            </div>
          </div>
        )}

        {!loading && error && (
          <div style={{
            background: '#2b1010',
            border: '2px solid var(--mc-red)',
            padding: '16px',
            margin: '20px 0',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--mc-red)', fontWeight: 700, fontSize: '0.85rem' }}>
              <AlertCircle size={18} />
              <span>VERIFIKATION FEHLGESCHLAGEN</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--mc-gray)', marginTop: '6px' }}>
              {error}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--mc-dark-gray)', marginTop: '8px' }}>
              Hinweis: Bist du Mitglied des verbundenen Discord-Servers und hast die geforderte Rolle?
            </p>
          </div>
        )}

        {!loading && result && (
          <div style={{ margin: '20px 0' }}>
            <div style={{
              background: '#0d2b15',
              border: '2px solid var(--mc-green)',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <CheckCircle2 size={36} color="var(--mc-green)" style={{ margin: '0 auto 10px' }} />
              <h3 className="mc-title" style={{ fontSize: '0.95rem', color: 'var(--mc-green)', marginBottom: '6px' }}>
                {result.isDashboardLogin ? 'LOGIN ERFOLGREICH!' : 'ERFOLGREICH VERIFIZIERT!'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#fff' }}>
                {result.isDashboardLogin 
                  ? `Willkommen im Dashboard, ${result.username}! Weiterleitung läuft...` 
                  : 'Dein Account wurde akzeptiert und freigeschaltet.'}
              </p>
            </div>

            <div className="mc-slot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '14px' }}>
              {result.targetPlayer && (
                <div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', display: 'block' }}>MINECRAFT ACCOUNT</span>
                  <strong style={{ color: 'var(--mc-yellow)', fontSize: '0.95rem' }}>{result.targetPlayer}</strong>
                </div>
              )}
              <div style={{ width: '2px', height: '30px', background: '#333' }} />
              <div>
                <span style={{ fontSize: '0.65rem', color: 'var(--mc-gray)', display: 'block' }}>DISCORD TAG</span>
                <strong style={{ color: 'var(--mc-aqua)', fontSize: '0.95rem' }}>
                  {result.profile?.globalName || result.profile?.username}
                </strong>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--mc-green)', marginTop: '16px' }}>
              Du kannst dieses Fenster jetzt schließen und den Minecraft-Server betreten!
            </p>
          </div>
        )}

        <div style={{ marginTop: '24px' }}>
          <button
            onClick={onBackToDashboard}
            className="mc-btn mc-btn-blue"
            style={{ padding: '8px 20px', fontSize: '0.8rem' }}
          >
            <ArrowLeft size={14} /> ZUM DASHBOARD
          </button>
        </div>
      </div>
    </div>
  );
}
