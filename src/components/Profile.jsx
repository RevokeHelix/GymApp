import { useState, useEffect } from 'react'
import { getProfile, saveProfile } from '../lib/db'
import Loader from './Loader'

const GOALS = [
  'Build Muscle',
  'Lose Fat',
  'Increase Strength',
  'Improve Endurance',
  'Stay Active',
]

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: '#3b82f6' }
  if (bmi < 25)   return { label: 'Normal',      color: 'var(--green)' }
  if (bmi < 30)   return { label: 'Overweight',  color: 'var(--accent)' }
  return               { label: 'Obese',         color: 'var(--red)' }
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        color: 'var(--text-muted)',
        marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border-2)',
  borderRadius: 8,
  color: 'var(--text)',
  padding: '10px 13px',
  fontSize: 15,
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s',
}

export default function Profile() {
  const [profile, setProfile] = useState({ name: '', weight: '', height: '', age: '', goal: 'Build Muscle' })
  const [saved, setSaved]     = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfile().then(data => { setProfile(data); setLoading(false) })
  }, [])

  function update(field, value) { setProfile(p => ({ ...p, [field]: value })) }

  async function handleSave() {
    await saveProfile(profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Loader />

  const buildDate = new Date(__BUILD_TIME__)
  const buildLabel = buildDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + buildDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const bmiVal = profile.weight && profile.height
    ? Number(profile.weight) / Math.pow(Number(profile.height) / 100, 2)
    : null
  const bmiData = bmiVal ? bmiCategory(bmiVal) : null

  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : null

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Avatar + name hero */}
      <div className="fade-up" style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '20px 18px',
        marginBottom: 14,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: initials ? 'var(--accent-dim)' : 'var(--surface-3)',
          border: `2px solid ${initials ? 'var(--accent)' : 'var(--border-2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {initials ? (
            <span style={{
              fontFamily: 'var(--display)',
              fontSize: 24,
              color: 'var(--accent)',
              letterSpacing: '0.05em',
            }}>
              {initials}
            </span>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          )}
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--display)',
            fontSize: 24,
            letterSpacing: '0.04em',
            color: 'var(--text)',
            lineHeight: 1.1,
          }}>
            {profile.name || 'ATHLETE'}
          </div>
          <div style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            marginTop: 3,
            letterSpacing: '0.06em',
          }}>
            {profile.goal.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="fade-up delay-1" style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '18px 16px 20px',
        marginBottom: 10,
      }}>
        <Field label="NAME">
          <input
            style={inputStyle}
            placeholder="Your name"
            value={profile.name}
            onChange={e => update('name', e.target.value)}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
          />
        </Field>

        <Field label="AGE">
          <input
            type="number"
            inputMode="numeric"
            style={inputStyle}
            placeholder="Years"
            value={profile.age}
            onChange={e => update('age', e.target.value)}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="WEIGHT — KG">
            <input
              type="number"
              inputMode="decimal"
              style={inputStyle}
              placeholder="0"
              value={profile.weight}
              onChange={e => update('weight', e.target.value)}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
            />
          </Field>
          <Field label="HEIGHT — CM">
            <input
              type="number"
              inputMode="decimal"
              style={inputStyle}
              placeholder="0"
              value={profile.height}
              onChange={e => update('height', e.target.value)}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
            />
          </Field>
        </div>

        {/* BMI readout */}
        {bmiVal && (
          <div style={{
            background: 'var(--surface-3)',
            border: `1px solid ${bmiData.color}40`,
            borderRadius: 8,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                BMI
              </div>
              <div style={{
                fontFamily: 'var(--display)',
                fontSize: 28,
                color: bmiData.color,
                lineHeight: 1.1,
                letterSpacing: '0.02em',
              }}>
                {bmiVal.toFixed(1)}
              </div>
            </div>
            <div style={{
              fontFamily: 'var(--display)',
              fontSize: 16,
              letterSpacing: '0.06em',
              color: bmiData.color,
            }}>
              {bmiData.label.toUpperCase()}
            </div>
          </div>
        )}

        <Field label="FITNESS GOAL">
          <select
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
            value={profile.goal}
            onChange={e => update('goal', e.target.value)}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-2)' }}
          >
            {GOALS.map(g => <option key={g} value={g} style={{ background: 'var(--surface)' }}>{g}</option>)}
          </select>
        </Field>

        <button
          onClick={handleSave}
          style={{
            width: '100%',
            padding: '14px 0',
            background: saved ? 'var(--green)' : 'var(--accent)',
            border: 'none',
            borderRadius: 8,
            color: '#000',
            fontFamily: 'var(--display)',
            fontSize: 18,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'background 0.3s',
            marginTop: 4,
            boxShadow: saved
              ? '0 0 20px var(--green-glow)'
              : '0 0 20px var(--accent-glow)',
          }}
        >
          {saved ? '✓ SAVED' : 'SAVE PROFILE'}
        </button>
      </div>

      <div style={{
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 8,
        fontFamily: 'var(--mono)',
        fontSize: 10,
        color: 'var(--text-dim)',
        letterSpacing: '0.08em',
      }}>
        BUILD · {buildLabel}
      </div>
    </div>
  )
}
