import { useState } from 'react'
import { saveUserTemplate, genId } from '../lib/db'

const PRESET_EXERCISES = [
  'Bench Press','Squat','Deadlift','Overhead Press','Barbell Row',
  'Pull-ups','Dips','Bicep Curl','Tricep Pushdown','Leg Press',
  'Lunges','Lat Pulldown','Cable Row','Incline Press','Leg Curl',
  'Romanian Deadlift','Calf Raises','Face Pull','Lateral Raise','Hip Thrust',
]

const COLORS = ['#f97316','#3b82f6','#a855f7','#22c55e','#ef4444','#eab308']

const inp = (extra = {}) => ({
  background: 'var(--surface-3)',
  border: '1px solid var(--border-2)',
  borderRadius: 7,
  color: 'var(--text)',
  padding: '9px 12px',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s',
  width: '100%',
  ...extra,
})

function focus(e) { e.target.style.borderColor = 'var(--accent)' }
function blur(e)  { e.target.style.borderColor = 'var(--border-2)' }

export default function CreateTemplate({ initial = null, onSaved, onClose }) {
  const editing = !!initial
  const [name,      setName]      = useState(initial?.name     ?? '')
  const [program,   setProgram]   = useState(initial?.program  ?? 'Custom')
  const [focus_,    setFocus]     = useState(initial?.focus    ?? '')
  const [color,     setColor]     = useState(initial?.color    ?? '#f97316')
  const [exercises, setExercises] = useState(
    initial?.exercises ?? [{ id: genId(), name: '', sets: 3, reps: 10 }]
  )
  const [newEx,     setNewEx]     = useState('')
  const [showPre,   setShowPre]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  function addExercise(exName) {
    const n = (exName || newEx).trim()
    if (!n) return
    setExercises(list => [...list, { id: genId(), name: n, sets: 3, reps: 10 }])
    setNewEx('')
    setShowPre(false)
  }

  function removeExercise(id) {
    setExercises(list => list.filter(e => e.id !== id))
  }

  function updateEx(id, field, val) {
    setExercises(list => list.map(e => e.id === id ? { ...e, [field]: val } : e))
  }

  async function handleSave() {
    if (!name.trim()) { setError('Template name is required.'); return }
    if (exercises.filter(e => e.name.trim()).length === 0) {
      setError('Add at least one exercise.'); return
    }
    setSaving(true); setError('')
    try {
      await saveUserTemplate({
        id:       initial?.id,
        name:     name.trim(),
        program:  program.trim() || 'Custom',
        focus:    focus_.trim(),
        color,
        exercises: exercises
          .filter(e => e.name.trim())
          .map(e => ({ name: e.name.trim(), sets: Number(e.sets) || 3, reps: Number(e.reps) || 10 })),
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
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
          justifyContent: 'space-between',
          padding: '12px 18px 16px',
        }}>
          <div>
            <h2 style={{
              fontFamily: 'var(--display)', fontSize: 26,
              letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
            }}>
              {editing ? 'EDIT TEMPLATE' : 'CREATE TEMPLATE'}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--surface-3)', border: '1px solid var(--border-2)',
            borderRadius: '50%', width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16,
          }}>✕</button>
        </div>

        <div style={{ padding: '0 18px 40px' }}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <Label>TEMPLATE NAME</Label>
            <input style={inp()} placeholder="e.g. MY PUSH DAY"
              value={name} onChange={e => setName(e.target.value)}
              onFocus={focus} onBlur={blur}
            />
          </div>

          {/* Program + Focus */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <Label>PROGRAM</Label>
              <input style={inp()} placeholder="Custom"
                value={program} onChange={e => setProgram(e.target.value)}
                onFocus={focus} onBlur={blur}
              />
            </div>
            <div>
              <Label>FOCUS</Label>
              <input style={inp()} placeholder="Chest · Arms"
                value={focus_} onChange={e => setFocus(e.target.value)}
                onFocus={focus} onBlur={blur}
              />
            </div>
          </div>

          {/* Color */}
          <div style={{ marginBottom: 18 }}>
            <Label>COLOR</Label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent',
                  cursor: 'pointer', flexShrink: 0, transition: 'border-color 0.15s',
                }} />
              ))}
            </div>
          </div>

          {/* Exercises */}
          <Label>EXERCISES</Label>
          <div style={{ marginTop: 8, marginBottom: 12 }}>
            {exercises.map((ex, i) => (
              <div key={ex.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 52px 52px 28px',
                gap: 6,
                marginBottom: 6,
                alignItems: 'center',
              }}>
                <input
                  style={inp()}
                  placeholder={`Exercise ${i + 1}`}
                  value={ex.name}
                  onChange={e => updateEx(ex.id, 'name', e.target.value)}
                  onFocus={focus} onBlur={blur}
                />
                <input
                  type="number" inputMode="numeric"
                  style={inp({ textAlign: 'center', padding: '9px 6px' })}
                  placeholder="3"
                  value={ex.sets}
                  onChange={e => updateEx(ex.id, 'sets', e.target.value)}
                  onFocus={focus} onBlur={blur}
                  title="Sets"
                />
                <input
                  type="number" inputMode="numeric"
                  style={inp({ textAlign: 'center', padding: '9px 6px' })}
                  placeholder="10"
                  value={ex.reps}
                  onChange={e => updateEx(ex.id, 'reps', e.target.value)}
                  onFocus={focus} onBlur={blur}
                  title="Reps"
                />
                <button onClick={() => removeExercise(ex.id)} style={{
                  background: 'none', border: 'none',
                  color: 'var(--text-dim)', cursor: 'pointer', fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>
            ))}

            {/* Column labels */}
            {exercises.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 52px 52px 28px',
                gap: 6, marginTop: 2,
              }}>
                <div />
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '0.08em' }}>SETS</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '0.08em' }}>REPS</div>
                <div />
              </div>
            )}
          </div>

          {/* Add exercise */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={inp({ flex: 1 })}
              placeholder="Exercise name…"
              value={newEx}
              onChange={e => setNewEx(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addExercise()}
              onFocus={focus} onBlur={blur}
            />
            <button onClick={() => addExercise()} style={{
              padding: '9px 14px', background: 'var(--accent)', border: 'none',
              borderRadius: 7, color: '#000', fontFamily: 'var(--display)',
              fontSize: 14, letterSpacing: '0.06em', cursor: 'pointer', flexShrink: 0,
            }}>ADD</button>
          </div>

          <button onClick={() => setShowPre(p => !p)} style={{
            width: '100%', padding: '7px 0',
            background: 'transparent', border: '1px solid var(--border-2)',
            borderRadius: 7, color: 'var(--text-muted)',
            fontFamily: 'var(--display)', fontSize: 12,
            letterSpacing: '0.06em', cursor: 'pointer', marginBottom: 8,
          }}>
            {showPre ? 'HIDE' : 'QUICK EXERCISES'}
          </button>

          {showPre && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {PRESET_EXERCISES.map(n => (
                <button key={n} onClick={() => addExercise(n)} style={{
                  background: 'var(--surface-3)', border: '1px solid var(--border-2)',
                  borderRadius: 20, color: 'var(--text-muted)',
                  padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                }}>{n}</button>
              ))}
            </div>
          )}

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 7, padding: '9px 12px', fontSize: 13,
              color: 'var(--red)', marginBottom: 14,
            }}>{error}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: '14px 0',
              background: saving ? 'var(--surface-4)' : color,
              border: 'none', borderRadius: 8,
              color: '#000', fontFamily: 'var(--display)',
              fontSize: 18, letterSpacing: '0.08em',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {saving ? 'SAVING…' : editing ? 'SAVE CHANGES' : 'CREATE TEMPLATE'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 10,
      letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6,
    }}>
      {children}
    </div>
  )
}
