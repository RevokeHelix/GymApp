import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import WorkoutLogger from './components/WorkoutLogger'
import Profile from './components/Profile'
import Stats from './components/Stats'
import History from './components/History'

const NAV = [
  {
    id: 'logger', label: 'LOG',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--accent)' : 'var(--text-muted)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
        <path d="M9 12h6M9 8h4M9 16h3"/>
      </svg>
    ),
  },
  {
    id: 'history', label: 'HISTORY',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--accent)' : 'var(--text-muted)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <polyline points="12 7 12 12 15 15"/>
      </svg>
    ),
  },
  {
    id: 'stats', label: 'STATS',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--accent)' : 'var(--text-muted)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
  },
  {
    id: 'profile', label: 'PROFILE',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? 'var(--accent)' : 'var(--text-muted)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
]

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100svh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        fontFamily: 'var(--display)', fontSize: 48,
        letterSpacing: '0.08em', color: 'var(--text)', lineHeight: 1,
      }}>GYMSTOCK</div>
      <div style={{
        width: 32, height: 3, background: 'var(--surface-3)',
        borderRadius: 2, overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--accent)',
          animation: 'shimmerBar 1s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes shimmerBar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('logger')

  if (loading) return <LoadingScreen />
  if (!user)   return <Auth />

  const displayName = user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.email?.split('@')[0]
    || 'ATHLETE'

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100svh', maxWidth: 640,
      margin: '0 auto', width: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        padding: '13px 16px 11px',
        paddingTop: 'calc(13px + env(safe-area-inset-top))',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{
            fontFamily: 'var(--display)', fontSize: 24,
            letterSpacing: '0.04em', color: 'var(--text)', lineHeight: 1,
          }}>GYM</span>
          <span style={{
            fontFamily: 'var(--mono)', fontSize: 10,
            color: 'var(--accent)', letterSpacing: '0.12em',
          }}>STOCK</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11,
            color: 'var(--text-muted)', letterSpacing: '0.04em',
            maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {displayName.toUpperCase()}
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'var(--surface-3)',
              border: '1px solid var(--border-2)',
              borderRadius: 6, padding: '4px 10px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--mono)', fontSize: 10,
              letterSpacing: '0.08em', cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            OUT
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{
        flex: 1, overflow: 'auto',
        padding: '16px 16px 8px',
        paddingBottom: 'calc(60px + env(safe-area-inset-bottom))',
      }}>
        {activeTab === 'logger'  && <WorkoutLogger />}
        {activeTab === 'history' && <History />}
        {activeTab === 'stats'   && <Stats />}
        {activeTab === 'profile' && <Profile />}
      </main>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0,
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 640,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
        zIndex: 100,
      }}>
        {NAV.map(tab => {
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: '10px 0 8px',
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, position: 'relative',
            }}>
              {active && (
                <span style={{
                  position: 'absolute', top: 0, left: '50%',
                  transform: 'translateX(-50%)',
                  width: 24, height: 2,
                  background: 'var(--accent)',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              {tab.icon(active)}
              <span style={{
                fontFamily: 'var(--display)', fontSize: 10,
                letterSpacing: '0.1em',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                lineHeight: 1,
              }}>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
