import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inp = (extra = {}) => ({
  width: '100%',
  background: 'var(--surface-3)',
  border: '1px solid var(--border-2)',
  borderRadius: 8,
  color: 'var(--text)',
  padding: '12px 14px',
  fontSize: 15,
  outline: 'none',
  transition: 'border-color 0.15s',
  ...extra,
})

export default function Auth() {
  const [mode, setMode]       = useState('signin')   // 'signin' | 'signup'
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')

  function focus(e)  { e.target.style.borderColor = 'var(--accent)' }
  function blur(e)   { e.target.style.borderColor = 'var(--border-2)' }

  async function handleEmail(e) {
    e.preventDefault()
    setError(''); setNotice(''); setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice('Check your email to confirm your account.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100svh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          fontFamily: 'var(--display)',
          fontSize: 56,
          letterSpacing: '0.08em',
          color: 'var(--text)',
          lineHeight: 1,
        }}>
          FORGE
        </div>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          letterSpacing: '0.2em',
          color: 'var(--accent)',
          marginTop: 4,
        }}>
          TRACK EVERY REP
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '28px 24px',
      }}>
        {/* Mode toggle */}
        <div style={{
          display: 'flex',
          background: 'var(--surface-3)',
          borderRadius: 8,
          padding: 3,
          marginBottom: 24,
        }}>
          {['signin', 'signup'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setNotice('') }}
              style={{
                flex: 1,
                padding: '8px 0',
                background: mode === m ? 'var(--surface)' : 'transparent',
                border: mode === m ? '1px solid var(--border-2)' : '1px solid transparent',
                borderRadius: 6,
                color: mode === m ? 'var(--text)' : 'var(--text-muted)',
                fontFamily: 'var(--display)',
                fontSize: 15,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {m === 'signin' ? 'SIGN IN' : 'SIGN UP'}
            </button>
          ))}
        </div>

        <form onSubmit={handleEmail}>
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              letterSpacing: '0.12em', color: 'var(--text-muted)',
              marginBottom: 6,
            }}>EMAIL</div>
            <input
              type="email"
              required
              style={inp()}
              placeholder="athlete@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onFocus={focus} onBlur={blur}
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 10,
              letterSpacing: '0.12em', color: 'var(--text-muted)',
              marginBottom: 6,
            }}>PASSWORD</div>
            <input
              type="password"
              required
              minLength={6}
              style={inp()}
              placeholder="••••••••"
              value={password}
              onChange={e => setPass(e.target.value)}
              onFocus={focus} onBlur={blur}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 7,
              padding: '9px 12px',
              fontSize: 13,
              color: 'var(--red)',
              marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          {notice && (
            <div style={{
              background: 'var(--green-glow)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 7,
              padding: '9px 12px',
              fontSize: 13,
              color: 'var(--green)',
              marginBottom: 14,
            }}>
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px 0',
              background: loading ? 'var(--surface-4)' : 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: loading ? 'var(--text-muted)' : '#000',
              fontFamily: 'var(--display)',
              fontSize: 18,
              letterSpacing: '0.08em',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              boxShadow: loading ? 'none' : '0 0 20px var(--accent-glow)',
            }}
          >
            {loading ? '...' : mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
          </button>
        </form>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 12, margin: '18px 0',
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 0',
            background: 'var(--surface-3)',
            border: '1px solid var(--border-2)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            transition: 'border-color 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.background = 'var(--surface-4)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
        >
          {/* Google logo */}
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
      </div>

      <div style={{
        marginTop: 24,
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--text-dim)',
        textAlign: 'center',
        letterSpacing: '0.04em',
      }}>
        YOUR DATA SYNCS ACROSS ALL DEVICES
      </div>
    </div>
  )
}
