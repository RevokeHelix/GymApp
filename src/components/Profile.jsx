import { useState, useEffect } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { getProfile, saveProfile, getWeightEntries, addWeightEntry, deleteWeightEntry } from '../lib/db'
import Loader from './Loader'

/* ── Statistical utilities ─────────────────────────── */

// Linear regression for arbitrary (x, y) pairs
function linReg(xs, ys) {
  const n = xs.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 }
  const sumX  = xs.reduce((s, x) => s + x, 0)
  const sumY  = ys.reduce((s, y) => s + y, 0)
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2)
  const intercept = (sumY - slope * sumX) / n
  const mean  = sumY / n
  const ssTot = ys.reduce((s, y) => s + (y - mean) ** 2, 0)
  const ssRes = xs.reduce((s, x, i) => s + (ys[i] - (slope * x + intercept)) ** 2, 0)
  const r2    = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
  return { slope, intercept, r2 }
}

function movingAvg(arr, w) {
  return arr.map((_, i) =>
    i < w - 1 ? null : arr.slice(i - w + 1, i + 1).reduce((s, v) => s + v, 0) / w
  )
}

/* ── Period filter ─────────────────────────────────── */

const WEIGHT_PERIODS = ['1M', '3M', '6M', '1Y', 'ALL']
function weightCutoff(p) {
  if (p === 'ALL') return null
  const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[p]
  return new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
}

/* ── Constants ─────────────────────────────────────── */

const GOALS = ['Build Muscle', 'Lose Fat', 'Increase Strength', 'Improve Endurance', 'Stay Active']

const TT = {
  background: 'var(--surface-3)',
  border: '1px solid var(--border-2)',
  borderRadius: 6,
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--mono)',
}

const CARD = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '18px 16px',
  marginBottom: 12,
}

const LABEL = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
  marginBottom: 14,
}

/* ── Shared form helpers ───────────────────────────── */

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
        fontFamily: 'var(--mono)', fontSize: 10,
        letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function focus(e) { e.target.style.borderColor = 'var(--accent)' }
function blur(e)  { e.target.style.borderColor = 'var(--border-2)' }

function shortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ── Weight Tracker sub-component ─────────────────── */

function WeightTracker() {
  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [date, setDate]         = useState(() => new Date().toISOString().split('T')[0])
  const [weight, setWeight]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [period, setPeriod]     = useState('ALL')

  async function load() {
    setEntries(await getWeightEntries())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!weight || isNaN(Number(weight))) return
    setSaving(true)
    await addWeightEntry(date, weight)
    setWeight('')
    await load()
    setSaving(false)
  }

  async function handleDelete(id) {
    await deleteWeightEntry(id)
    await load()
  }

  /* ── Derived stats ──────────────────────────────── */
  const cutoffDate = weightCutoff(period)
  const vis = cutoffDate ? entries.filter(e => e.date >= cutoffDate) : entries

  const n = vis.length

  const firstMs   = n > 0 ? new Date(vis[0].date).getTime() : 0
  const dayDeltas = vis.map(e => (new Date(e.date).getTime() - firstMs) / 86400000)
  const weights   = vis.map(e => Number(e.weight))

  const reg  = n >= 2 ? linReg(dayDeltas, weights) : null
  const slopePerWeek = reg ? reg.slope * 7 : 0

  const MA_W = Math.max(2, Math.min(3, Math.floor(n / 2)))
  const maVals = n >= 2 ? movingAvg(weights, MA_W) : []

  const current = n > 0 ? weights[n - 1] : null
  const start   = n > 0 ? weights[0] : null
  const change  = current !== null && start !== null ? current - start : null

  const chartData = vis.map((e, i) => ({
    d:     shortDate(e.date),
    kg:    Number(e.weight),
    ma:    maVals[i] != null ? parseFloat(maVals[i].toFixed(2)) : undefined,
    trend: reg ? parseFloat((reg.slope * dayDeltas[i] + reg.intercept).toFixed(2)) : undefined,
  }))

  const yMin = n > 0 ? Math.floor(Math.min(...weights) - 1) : 'auto'
  const yMax = n > 0 ? Math.ceil(Math.max(...weights) + 1)  : 'auto'

  return (
    <div style={CARD}>
      <div style={LABEL}>WEIGHT TRACKER</div>

      {/* Log entry form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 5 }}>
            DATE
          </div>
          <input
            type="date"
            style={{ ...inputStyle, fontSize: 13, padding: '9px 10px', width: 'auto', colorScheme: 'dark' }}
            value={date}
            onChange={e => setDate(e.target.value)}
            onFocus={focus} onBlur={blur}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 5 }}>
            WEIGHT — KG
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            style={{ ...inputStyle, fontSize: 15, fontFamily: 'var(--mono)', textAlign: 'center' }}
            placeholder="82.5"
            value={weight}
            onChange={e => setWeight(e.target.value)}
            onFocus={focus} onBlur={blur}
          />
        </div>
        <button
          type="submit"
          disabled={saving || !weight}
          style={{
            flexShrink: 0,
            padding: '10px 16px',
            background: 'var(--accent)',
            border: 'none', borderRadius: 8,
            color: '#000', fontFamily: 'var(--display)',
            fontSize: 15, letterSpacing: '0.06em',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving || !weight ? 0.5 : 1,
            alignSelf: 'flex-end',
          }}
        >
          LOG
        </button>
      </form>

      {loading && <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>}

      {!loading && n === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-dim)', fontSize: 13 }}>
          Log your first weigh-in above
        </div>
      )}

      {!loading && n >= 1 && (
        <>
          {/* Stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${n >= 2 ? 4 : 2}, 1fr)`,
            gap: 8,
            marginBottom: 16,
          }}>
            {[
              { label: 'CURRENT', value: `${current}kg`, accent: true },
              { label: 'START',   value: `${start}kg` },
              ...(n >= 2 ? [
                {
                  label: 'CHANGE',
                  value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}kg`,
                  color: change < 0 ? '#22c55e' : change > 0 ? '#ef4444' : 'var(--text)',
                },
                {
                  label: 'TREND',
                  value: `${slopePerWeek >= 0 ? '+' : ''}${slopePerWeek.toFixed(2)}kg/wk`,
                  color: slopePerWeek < 0 ? '#22c55e' : slopePerWeek > 0 ? '#ef4444' : 'var(--text)',
                },
              ] : []),
            ].map(s => (
              <div key={s.label} style={{
                background: 'var(--surface-3)',
                borderRadius: 8,
                padding: '10px 10px 8px',
              }}>
                <div style={{
                  fontFamily: 'var(--display)',
                  fontSize: 18,
                  color: s.color ?? (s.accent ? 'var(--accent)' : 'var(--text)'),
                  lineHeight: 1,
                }}>
                  {s.value}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 9,
                  color: 'var(--text-muted)', letterSpacing: '0.1em', marginTop: 4,
                }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Chart — only with 2+ entries */}
          {n >= 2 && (
            <>
              {/* Period picker */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                {WEIGHT_PERIODS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    style={{
                      flex: 1,
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      padding: '6px 0',
                      borderRadius: 6,
                      border: `1px solid ${period === p ? '#f97316' : 'var(--border)'}`,
                      background: period === p ? 'rgba(249,115,22,0.12)' : 'transparent',
                      color: period === p ? '#f97316' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div style={{
                display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10,
                fontFamily: 'var(--mono)', fontSize: 11,
              }}>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>R² </span>
                  <span style={{ color: 'var(--text)' }}>{reg.r2.toFixed(3)}</span>
                </span>
                <span>
                  <span style={{ color: 'var(--text-muted)' }}>SLOPE </span>
                  <span style={{ color: slopePerWeek <= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                    {slopePerWeek >= 0 ? '+' : ''}{slopePerWeek.toFixed(2)} kg/wk
                  </span>
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ComposedChart data={chartData} margin={{ left: -20, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="d"
                    tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                    axisLine={false} tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[yMin, yMax]}
                    tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip contentStyle={TT} cursor={{ stroke: 'var(--border-2)' }} />
                  <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', paddingTop: 8 }} />
                  <Line
                    type="monotone" dataKey="kg"
                    stroke="#f97316" strokeWidth={2}
                    dot={{ fill: '#f97316', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    name="weight (kg)"
                  />
                  {n >= MA_W * 2 && (
                    <Line
                      type="monotone" dataKey="ma"
                      stroke="#60a5fa" strokeWidth={2}
                      strokeDasharray="5 3" dot={false}
                      name={`${MA_W}-entry MA`}
                      connectNulls={false}
                    />
                  )}
                  <Line
                    type="monotone" dataKey="trend"
                    stroke="#a78bfa" strokeWidth={1.5}
                    strokeDasharray="2 5" dot={false}
                    name="regression"
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}

          {/* Recent entries list */}
          <div style={{ marginTop: 16 }}>
            <div style={{ ...LABEL, marginBottom: 8 }}>RECENT ENTRIES</div>
            {[...entries].reverse().slice(0, 7).map(e => (
              <div key={e.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
                    {e.weight} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11 }}>kg</span>
                  </span>
                  <button
                    onClick={() => handleDelete(e.id)}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-dim)', cursor: 'pointer',
                      fontSize: 14, padding: '2px 4px',
                      transition: 'color 0.15s',
                    }}
                    onMouseOver={ev => { ev.currentTarget.style.color = 'var(--red)' }}
                    onMouseOut={ev => { ev.currentTarget.style.color = 'var(--text-dim)' }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Main Profile component ────────────────────────── */

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

  const buildDate  = new Date(__BUILD_TIME__)
  const buildLabel = buildDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    + ' · ' + buildDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const bmiVal  = profile.weight && profile.height
    ? Number(profile.weight) / Math.pow(Number(profile.height) / 100, 2)
    : null
  const bmiData = bmiVal ? bmiCategory(bmiVal) : null

  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : null

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>

      {/* Avatar + name */}
      <div className="fade-up" style={{
        display: 'flex', alignItems: 'center', gap: 16,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '20px 18px', marginBottom: 12,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: initials ? 'var(--accent-dim)' : 'var(--surface-3)',
          border: `2px solid ${initials ? 'var(--accent)' : 'var(--border-2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {initials ? (
            <span style={{ fontFamily: 'var(--display)', fontSize: 24, color: 'var(--accent)', letterSpacing: '0.05em' }}>
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
            fontFamily: 'var(--display)', fontSize: 24,
            letterSpacing: '0.04em', color: 'var(--text)', lineHeight: 1.1,
          }}>
            {profile.name || 'ATHLETE'}
          </div>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.06em',
          }}>
            {profile.goal.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="fade-up delay-1" style={CARD}>
        <div style={LABEL}>PROFILE</div>

        <Field label="NAME">
          <input style={inputStyle} placeholder="Your name" value={profile.name}
            onChange={e => update('name', e.target.value)} onFocus={focus} onBlur={blur} />
        </Field>

        <Field label="AGE">
          <input type="number" inputMode="numeric" style={inputStyle} placeholder="Years"
            value={profile.age} onChange={e => update('age', e.target.value)} onFocus={focus} onBlur={blur} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="WEIGHT — KG">
            <input type="number" inputMode="decimal" style={inputStyle} placeholder="0"
              value={profile.weight} onChange={e => update('weight', e.target.value)} onFocus={focus} onBlur={blur} />
          </Field>
          <Field label="HEIGHT — CM">
            <input type="number" inputMode="decimal" style={inputStyle} placeholder="0"
              value={profile.height} onChange={e => update('height', e.target.value)} onFocus={focus} onBlur={blur} />
          </Field>
        </div>

        {bmiVal && (
          <div style={{
            background: 'var(--surface-3)', border: `1px solid ${bmiData.color}40`,
            borderRadius: 8, padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
          }}>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>BMI</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 28, color: bmiData.color, lineHeight: 1.1 }}>
                {bmiVal.toFixed(1)}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 16, letterSpacing: '0.06em', color: bmiData.color }}>
              {bmiData.label.toUpperCase()}
            </div>
          </div>
        )}

        <Field label="FITNESS GOAL">
          <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' }}
            value={profile.goal} onChange={e => update('goal', e.target.value)}
            onFocus={focus} onBlur={blur}>
            {GOALS.map(g => <option key={g} value={g} style={{ background: 'var(--surface)' }}>{g}</option>)}
          </select>
        </Field>

        <button
          onClick={handleSave}
          style={{
            width: '100%', padding: '14px 0',
            background: saved ? 'var(--green)' : 'var(--accent)',
            border: 'none', borderRadius: 8, color: '#000',
            fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.08em',
            cursor: 'pointer', transition: 'background 0.3s', marginTop: 4,
            boxShadow: saved ? '0 0 20px var(--green-glow)' : '0 0 20px var(--accent-glow)',
          }}
        >
          {saved ? '✓ SAVED' : 'SAVE PROFILE'}
        </button>
      </div>

      {/* Weight tracker */}
      <div className="fade-up delay-2">
        <WeightTracker />
      </div>

      <div style={{
        textAlign: 'center', marginTop: 8, marginBottom: 8,
        fontFamily: 'var(--mono)', fontSize: 10,
        color: 'var(--text-dim)', letterSpacing: '0.08em',
      }}>
        BUILD · {buildLabel}
      </div>
    </div>
  )
}
