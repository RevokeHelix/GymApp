import { useState, useEffect, useCallback } from 'react'
import { getWorkouts, deleteWorkout } from '../lib/db'
import Loader from './Loader'

function workoutVolume(workout) {
  return workout.exercises.reduce((sum, e) =>
    sum + e.sets.reduce((s2, s) => s2 + s.reps * s.weight, 0), 0)
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase()
}

function formatYear(iso) {
  return new Date(iso).getFullYear()
}

export default function History() {
  const [workouts, setWorkouts] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setWorkouts(await getWorkouts())
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function handleDelete(id) {
    if (!confirm('Delete this workout?')) return
    await deleteWorkout(id)
    await load()
  }

  if (loading) return <Loader />

  if (workouts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{
          fontFamily: 'var(--display)',
          fontSize: 64,
          color: 'var(--surface-3)',
          lineHeight: 1,
          marginBottom: 16,
        }}>
          0
        </div>
        <div style={{
          fontFamily: 'var(--display)',
          fontSize: 22,
          letterSpacing: '0.06em',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}>
          NO SESSIONS YET
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          Log your first workout to see it here
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Count header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 18,
      }}>
        <span style={{
          fontFamily: 'var(--display)',
          fontSize: 42,
          color: 'var(--accent)',
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}>
          {workouts.length}
        </span>
        <span style={{
          fontFamily: 'var(--display)',
          fontSize: 18,
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
        }}>
          SESSION{workouts.length !== 1 ? 'S' : ''}
        </span>
      </div>

      {workouts.map((w, idx) => {
        const vol     = workoutVolume(w)
        const isOpen  = expanded === w.id
        const totalSets = w.exercises.reduce((n, e) => n + e.sets.length, 0)

        return (
          <div
            key={w.id}
            className={`fade-up delay-${Math.min(idx + 1, 5)}`}
            style={{
              background: 'var(--surface-2)',
              border: `1px solid ${isOpen ? 'var(--border-2)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              marginBottom: 10,
              overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}
          >
            {/* Card header — click to expand */}
            <div
              style={{ cursor: 'pointer', padding: '14px 14px 12px' }}
              onClick={() => setExpanded(isOpen ? null : w.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--display)',
                    fontSize: 20,
                    letterSpacing: '0.04em',
                    color: 'var(--text)',
                    lineHeight: 1.1,
                    marginBottom: 3,
                  }}>
                    {w.name}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                  }}>
                    {formatDate(w.date)}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(w.id) }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-dim)', cursor: 'pointer',
                      fontSize: 16, padding: '2px 6px',
                      transition: 'color 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.color = 'var(--red)' }}
                    onMouseOut={e => { e.currentTarget.style.color = 'var(--text-dim)' }}
                  >
                    🗑
                  </button>
                  <span style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 13,
                    color: 'var(--text-muted)',
                    transition: 'transform 0.2s',
                    display: 'inline-block',
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>
                    ▾
                  </span>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--display)',
                    fontSize: 18,
                    color: 'var(--text)',
                    lineHeight: 1,
                  }}>
                    {w.exercises.length}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.1em',
                    marginTop: 1,
                  }}>
                    EX
                  </div>
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--display)',
                    fontSize: 18,
                    color: 'var(--text)',
                    lineHeight: 1,
                  }}>
                    {totalSets}
                  </div>
                  <div style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.1em',
                    marginTop: 1,
                  }}>
                    SETS
                  </div>
                </div>
                {vol > 0 && (
                  <div>
                    <div style={{
                      fontFamily: 'var(--display)',
                      fontSize: 18,
                      color: 'var(--accent)',
                      lineHeight: 1,
                    }}>
                      {vol >= 1000 ? `${(vol / 1000).toFixed(1)}t` : `${vol}kg`}
                    </div>
                    <div style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.1em',
                      marginTop: 1,
                    }}>
                      VOL
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded exercise detail */}
            {isOpen && (
              <div style={{
                borderTop: '1px solid var(--border)',
                padding: '12px 14px 14px',
              }}>
                {w.exercises.map((ex, i) => (
                  <div key={i} style={{ marginBottom: i < w.exercises.length - 1 ? 12 : 0 }}>
                    <div style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--text)',
                      marginBottom: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span style={{
                        width: 4, height: 14,
                        background: 'var(--accent)',
                        borderRadius: 2,
                        display: 'inline-block',
                        flexShrink: 0,
                      }} />
                      {ex.name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ex.sets.map((s, j) => (
                        <span key={j} style={{
                          background: 'var(--surface-3)',
                          border: '1px solid var(--border-2)',
                          borderRadius: 5,
                          padding: '4px 11px',
                          fontFamily: 'var(--mono)',
                          fontSize: 12,
                          color: 'var(--text-muted)',
                        }}>
                          {s.weight}<span style={{ color: 'var(--text-dim)' }}>kg</span>
                          {' × '}
                          <span style={{ color: 'var(--text)' }}>{s.reps}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
