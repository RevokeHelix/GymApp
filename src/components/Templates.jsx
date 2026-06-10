import { useState, useEffect } from 'react'
import { TEMPLATES, PROGRAMS } from '../data/templates'
import { getUserTemplates, deleteUserTemplate } from '../lib/db'
import CreateTemplate from './CreateTemplate'

export default function Templates({ onLoad, onClose }) {
  const [filter,        setFilter]        = useState('All')
  const [loaded,        setLoaded]        = useState(null)
  const [userTmpls,     setUserTmpls]     = useState([])
  const [showCreate,    setShowCreate]    = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    loadUser()
    return () => { document.body.style.overflow = '' }
  }, [])

  async function loadUser() {
    setUserTmpls(await getUserTemplates())
  }

  async function handleDeleteUser(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this template?')) return
    await deleteUserTemplate(id)
    await loadUser()
  }

  function handleLoad(tmpl) {
    setLoaded(tmpl.id)
    setTimeout(() => { onLoad(tmpl); onClose() }, 320)
  }

  const builtIn = filter === 'All' ? TEMPLATES : TEMPLATES.filter(t => t.program === filter)
  const myFiltered = filter === 'All' || filter === 'Custom'
    ? userTmpls
    : userTmpls.filter(t => t.program === filter)

  if (showCreate || editTarget) {
    return (
      <CreateTemplate
        initial={editTarget}
        onSaved={loadUser}
        onClose={() => { setShowCreate(false); setEditTarget(null) }}
      />
    )
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet-panel" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ padding: '12px 0 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border-2)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '12px 18px 4px',
        }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--display)', fontSize: 28,
              letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
            }}>TEMPLATES</h2>
            <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {TEMPLATES.length + userTmpls.length} TOTAL
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowCreate(true)} style={{
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              borderRadius: 8, padding: '6px 14px', color: 'var(--accent)',
              fontFamily: 'var(--display)', fontSize: 13, letterSpacing: '0.06em', cursor: 'pointer',
            }}>+ CREATE</button>
            <button onClick={onClose} style={{
              background: 'var(--surface-3)', border: '1px solid var(--border-2)',
              borderRadius: '50%', width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16,
            }}>✕</button>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{
          overflowX: 'auto', display: 'flex', gap: 6,
          padding: '12px 18px', scrollbarWidth: 'none', flexShrink: 0,
        }}>
          {[...PROGRAMS, ...(userTmpls.length ? ['Custom'] : [])].filter((v, i, a) => a.indexOf(v) === i).map(p => {
            const active = filter === p
            return (
              <button key={p} onClick={() => setFilter(p)} style={{
                flexShrink: 0, padding: '5px 14px', borderRadius: 20,
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border-2)'}`,
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                fontFamily: 'var(--display)', fontSize: 13, letterSpacing: '0.06em',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>{p}</button>
            )
          })}
        </div>

        <div style={{ padding: '0 14px 40px' }}>
          {/* My templates */}
          {myFiltered.length > 0 && (
            <>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
                color: 'var(--accent)', marginBottom: 10, marginTop: 2,
              }}>MY TEMPLATES</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                {myFiltered.map((tmpl, i) => (
                  <TemplateCard
                    key={tmpl.id} tmpl={tmpl} loaded={loaded} i={i}
                    onLoad={handleLoad}
                    extra={
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <button onClick={e => { e.stopPropagation(); setEditTarget(tmpl) }} style={{
                          flex: 1, padding: '5px 0', background: 'var(--surface-3)',
                          border: '1px solid var(--border-2)', borderRadius: 5,
                          color: 'var(--text-muted)', fontSize: 11,
                          fontFamily: 'var(--display)', letterSpacing: '0.04em', cursor: 'pointer',
                        }}>EDIT</button>
                        <button onClick={e => handleDeleteUser(tmpl.id, e)} style={{
                          padding: '5px 10px', background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 5,
                          color: 'var(--red)', fontSize: 11, cursor: 'pointer',
                        }}>🗑</button>
                      </div>
                    }
                  />
                ))}
              </div>
            </>
          )}

          {/* Built-in templates */}
          {builtIn.length > 0 && (
            <>
              {myFiltered.length > 0 && (
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em',
                  color: 'var(--text-muted)', marginBottom: 10,
                }}>BUILT-IN</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {builtIn.map((tmpl, i) => (
                  <TemplateCard key={tmpl.id} tmpl={tmpl} loaded={loaded} i={i} onLoad={handleLoad} />
                ))}
              </div>
            </>
          )}

          {myFiltered.length === 0 && builtIn.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.06em' }}>
                NO TEMPLATES
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TemplateCard({ tmpl, loaded, i, onLoad, extra }) {
  const isLoaded = loaded === tmpl.id
  return (
    <div
      className={`fade-up delay-${Math.min(i + 1, 5)}`}
      style={{
        background: 'var(--surface-2)',
        border: `1px solid ${isLoaded ? tmpl.color : 'var(--border)'}`,
        borderTop: `3px solid ${tmpl.color}`,
        borderRadius: 'var(--radius)',
        padding: '14px 14px 12px',
        transition: 'border-color 0.2s, transform 0.15s',
        transform: isLoaded ? 'scale(0.97)' : 'scale(1)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{
        display: 'inline-block',
        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
        color: tmpl.color,
        background: `${tmpl.color}18`, border: `1px solid ${tmpl.color}40`,
        borderRadius: 4, padding: '2px 7px', marginBottom: 8,
      }}>
        {tmpl.program}
      </div>

      <div style={{
        fontFamily: 'var(--display)', fontSize: 22, letterSpacing: '0.04em',
        color: 'var(--text)', lineHeight: 1.05, marginBottom: 4,
      }}>
        {tmpl.name}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
        {tmpl.focus}
      </div>

      <div style={{ flex: 1, marginBottom: 12 }}>
        {(tmpl.exercises ?? []).slice(0, 3).map((ex, j) => (
          <div key={j} style={{
            fontSize: 12, color: 'var(--text-muted)',
            display: 'flex', justifyContent: 'space-between',
            padding: '2px 0',
            borderBottom: j < 2 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{ex.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{ex.sets}×{ex.reps}</span>
          </div>
        ))}
        {(tmpl.exercises ?? []).length > 3 && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--mono)' }}>
            +{tmpl.exercises.length - 3} more
          </div>
        )}
      </div>

      {extra}

      <button onClick={() => onLoad(tmpl)} style={{
        width: '100%', padding: '8px 0',
        background: isLoaded ? 'var(--green)' : tmpl.color,
        border: 'none', borderRadius: 6, color: '#000',
        fontFamily: 'var(--display)', fontSize: 15, letterSpacing: '0.06em',
        cursor: 'pointer', transition: 'background 0.2s',
      }}>
        {isLoaded ? 'LOADED ✓' : 'LOAD'}
      </button>
    </div>
  )
}
