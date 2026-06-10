import { useState } from 'react'
import { saveWorkout, genId } from '../lib/db'
import Templates from './Templates'

const PRESET_EXERCISES = [
  'Bench Press','Squat','Deadlift','Overhead Press','Barbell Row',
  'Pull-ups','Dips','Bicep Curl','Tricep Pushdown','Leg Press',
  'Lunges','Lat Pulldown','Cable Row','Incline Press','Leg Curl',
  'Romanian Deadlift','Calf Raises','Face Pull','Lateral Raise','Hip Thrust',
]

export default function WorkoutLogger() {
  const [workoutName, setWorkoutName]   = useState('')
  const [workoutDate, setWorkoutDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [exercises, setExercises]       = useState([])
  const [newExName, setNewExName]       = useState('')
  const [showPresets, setShowPresets]   = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [saved, setSaved]               = useState(false)

  /* ── exercise / set helpers ─────────────────────── */
  function addExercise(name) {
    const n = (name || newExName).trim()
    if (!n) return
    setExercises(ex => [...ex, { id: genId(), name: n, sets: [{ reps: '', weight: '' }] }])
    setNewExName('')
    setShowPresets(false)
  }

  function removeExercise(id) {
    setExercises(ex => ex.filter(e => e.id !== id))
  }

  function addSet(exId) {
    setExercises(ex => ex.map(e =>
      e.id === exId ? { ...e, sets: [...e.sets, { reps: '', weight: '' }] } : e
    ))
  }

  function removeSet(exId, idx) {
    setExercises(ex => ex.map(e =>
      e.id === exId ? { ...e, sets: e.sets.filter((_, i) => i !== idx) } : e
    ))
  }

  function updateSet(exId, idx, field, value) {
    setExercises(ex => ex.map(e =>
      e.id === exId
        ? { ...e, sets: e.sets.map((s, i) => i === idx ? { ...s, [field]: value } : s) }
        : e
    ))
  }

  /* ── template loading ───────────────────────────── */
  function handleLoadTemplate(tmpl) {
    setWorkoutName(tmpl.name)
    setExercises(tmpl.exercises.map(ex => ({
      id: genId(),
      name: ex.name,
      sets: Array.from({ length: ex.sets }, () => ({ reps: String(ex.reps), weight: '' })),
    })))
  }

  /* ── save ───────────────────────────────────────── */
  async function handleSave() {
    if (!workoutName.trim() && exercises.length === 0) return
    const workout = {
      id: genId(),
      date: new Date(workoutDate + 'T12:00:00').toISOString(),
      name: workoutName.trim() || 'Workout',
      exercises: exercises.map(e => ({
        name: e.name,
        sets: e.sets
          .filter(s => s.reps !== '' || s.weight !== '')
          .map(s => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 })),
      })).filter(e => e.sets.length > 0),
    }
    await saveWorkout(workout)
    setWorkoutName('')
    setWorkoutDate(new Date().toISOString().split('T')[0])
    setExercises([])
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const totalVolume = exercises.reduce((sum, e) =>
    sum + e.sets.reduce((s2, s) => s2 + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0), 0)

  /* ── render ─────────────────────────────────────── */
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* Workout header card */}
      <div className="fade-up" style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
          }}>
            SESSION NAME
          </span>
          <button
            onClick={() => setShowTemplates(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              padding: '4px 11px',
              color: 'var(--accent)',
              fontFamily: 'var(--display)',
              fontSize: 13,
              letterSpacing: '0.06em',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 14 }}>⚡</span> TEMPLATES
          </button>
        </div>
        <input
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-2)',
            borderRadius: 8,
            color: 'var(--text)',
            padding: '10px 14px',
            fontSize: 16,
            fontWeight: 600,
            width: '100%',
            outline: 'none',
          }}
          placeholder="Push Day, Leg Day, Full Body…"
          value={workoutName}
          onChange={e => setWorkoutName(e.target.value)}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
        />

        <div style={{ marginTop: 10 }}>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--text-muted)',
            marginBottom: 6,
          }}>
            DATE
          </div>
          <input
            type="date"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              borderRadius: 8,
              color: 'var(--text)',
              padding: '9px 14px',
              fontSize: 14,
              fontFamily: 'var(--mono)',
              width: '100%',
              outline: 'none',
              colorScheme: 'dark',
            }}
            value={workoutDate}
            onChange={e => setWorkoutDate(e.target.value)}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
          />
        </div>
      </div>

      {/* Exercise cards */}
      {exercises.map((ex, exIdx) => (
        <div
          key={ex.id}
          className="fade-up"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: 'var(--radius)',
            padding: '14px 14px 12px',
            marginBottom: 10,
          }}
        >
          {/* Exercise header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{ex.name}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                {ex.sets.length} SET{ex.sets.length !== 1 ? 'S' : ''}
              </div>
            </div>
            <button
              onClick={() => removeExercise(ex.id)}
              style={{
                background: 'var(--surface-3)',
                border: '1px solid var(--border-2)',
                borderRadius: 6,
                color: 'var(--text-muted)',
                width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 1fr 28px',
            gap: 6,
            marginBottom: 6,
          }}>
            {['SET', 'KG', 'REPS', ''].map((h, i) => (
              <div key={i} style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}>{h}</div>
            ))}
          </div>

          {/* Set rows */}
          {ex.sets.map((set, i) => {
            const hasData = set.weight !== '' && set.reps !== ''
            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr 1fr 28px',
                gap: 6,
                marginBottom: 6,
                alignItems: 'center',
              }}>
                <div style={{
                  textAlign: 'center',
                  fontFamily: 'var(--mono)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: hasData ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {i + 1}
                </div>
                {['weight', 'reps'].map(field => (
                  <input
                    key={field}
                    type="number"
                    inputMode={field === 'weight' ? 'decimal' : 'numeric'}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-2)',
                      borderRadius: 6,
                      color: 'var(--text)',
                      padding: '8px 6px',
                      fontSize: 15,
                      fontFamily: 'var(--mono)',
                      textAlign: 'center',
                      width: '100%',
                      outline: 'none',
                      transition: 'border-color 0.15s',
                    }}
                    placeholder="—"
                    value={field === 'weight' ? set.weight : set.reps}
                    onChange={e => updateSet(ex.id, i, field, e.target.value)}
                    onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
                  />
                ))}
                <button
                  onClick={() => removeSet(ex.id, i)}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--text-dim)', cursor: 'pointer', fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28,
                  }}
                >
                  ✕
                </button>
              </div>
            )
          })}

          <button
            onClick={() => addSet(ex.id)}
            style={{
              marginTop: 4,
              width: '100%',
              padding: '7px 0',
              background: 'var(--surface-3)',
              border: '1px dashed var(--border-2)',
              borderRadius: 6,
              color: 'var(--text-muted)',
              fontFamily: 'var(--display)',
              fontSize: 13,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseOver={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
            onMouseOut={e => {
              e.currentTarget.style.borderColor = 'var(--border-2)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            + ADD SET
          </button>
        </div>
      ))}

      {/* Add exercise card */}
      <div className="fade-up" style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
        marginBottom: 12,
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--text-muted)',
          marginBottom: 10,
        }}>
          ADD EXERCISE
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            style={{
              flex: 1,
              background: 'var(--surface)',
              border: '1px solid var(--border-2)',
              borderRadius: 8,
              color: 'var(--text)',
              padding: '9px 13px',
              fontSize: 14,
              outline: 'none',
            }}
            placeholder="Exercise name…"
            value={newExName}
            onChange={e => setNewExName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addExercise()}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
          />
          <button
            onClick={() => addExercise()}
            style={{
              padding: '9px 18px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: '#000',
              fontFamily: 'var(--display)',
              fontSize: 15,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ADD
          </button>
        </div>

        <button
          onClick={() => setShowPresets(p => !p)}
          style={{
            width: '100%',
            padding: '7px 0',
            background: 'transparent',
            border: '1px solid var(--border-2)',
            borderRadius: 7,
            color: 'var(--text-muted)',
            fontFamily: 'var(--display)',
            fontSize: 13,
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          {showPresets ? 'HIDE EXERCISES' : 'QUICK EXERCISES'}
        </button>

        {showPresets && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESET_EXERCISES.map(name => (
              <button
                key={name}
                onClick={() => addExercise(name)}
                style={{
                  background: 'var(--surface-3)',
                  border: '1px solid var(--border-2)',
                  borderRadius: 20,
                  color: 'var(--text-muted)',
                  padding: '5px 13px',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'border-color 0.12s, color 0.12s',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.color = 'var(--accent)'
                }}
                onMouseOut={e => {
                  e.currentTarget.style.borderColor = 'var(--border-2)'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Volume readout */}
      {totalVolume > 0 && (
        <div className="fade-up" style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 12,
          padding: '8px 0',
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            TOTAL VOLUME
          </span>
          <span style={{
            fontFamily: 'var(--display)',
            fontSize: 28,
            color: 'var(--accent)',
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}>
            {totalVolume.toLocaleString()}
          </span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>KG</span>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        style={{
          width: '100%',
          padding: '16px 0',
          background: saved ? 'var(--green)' : 'var(--accent)',
          border: 'none',
          borderRadius: 'var(--radius)',
          color: '#000',
          fontFamily: 'var(--display)',
          fontSize: 20,
          letterSpacing: '0.08em',
          cursor: 'pointer',
          transition: 'background 0.35s',
          marginBottom: 16,
          boxShadow: saved
            ? '0 0 24px var(--green-glow)'
            : '0 0 24px var(--accent-glow)',
        }}
      >
        {saved ? '✓ SESSION SAVED' : 'SAVE SESSION'}
      </button>

      {/* Templates sheet */}
      {showTemplates && (
        <Templates
          onLoad={handleLoadTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  )
}
