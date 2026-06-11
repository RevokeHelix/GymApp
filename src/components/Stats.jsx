import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { getWorkouts } from '../lib/db'
import Loader from './Loader'

const PERIODS = ['1W', '1M', '3M', '1Y', 'ALL']
function periodCutoff(p) {
  if (p === 'ALL') return null
  const days = { '1W': 7, '1M': 30, '3M': 90, '1Y': 365 }[p]
  return new Date(Date.now() - days * 86400000)
}

/* ═══════════════════════════════════════════════════
   STATISTICAL UTILITIES
   ═══════════════════════════════════════════════════ */

// Least-squares linear regression — y = mx + b
// Returns { slope, intercept, r2 }
function linearRegression(ys) {
  const n = ys.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 }
  const sumX  = (n * (n - 1)) / 2
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  const sumY  = ys.reduce((s, y) => s + y, 0)
  const sumXY = ys.reduce((s, y, i) => s + i * y, 0)
  const slope     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2)
  const intercept = (sumY - slope * sumX) / n
  const mean   = sumY / n
  const ssTot  = ys.reduce((s, y) => s + (y - mean) ** 2, 0)
  const ssRes  = ys.reduce((s, y, i) => s + (y - (slope * i + intercept)) ** 2, 0)
  const r2     = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
  return { slope, intercept, r2 }
}

// Simple N-period moving average; returns null for first (window-1) indices
function movingAvg(arr, w) {
  return arr.map((_, i) =>
    i < w - 1
      ? null
      : arr.slice(i - w + 1, i + 1).reduce((s, v) => s + v, 0) / w
  )
}

// Brzycki 1-rep max estimate: weight × 36 / (37 − reps)
function brzycki(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  if (reps >= 37) return Math.round(weight * 0.5)
  return Math.round(weight * (36 / (37 - reps)))
}

// Highest estimated 1RM across a set of sets
function bestOneRM(sets) {
  return sets.reduce((best, s) => {
    const est = brzycki(Number(s.weight) || 0, Number(s.reps) || 0)
    return est > best ? est : best
  }, 0)
}

// Population mean and standard deviation
function meanStd(arr) {
  if (arr.length === 0) return { mean: 0, std: 0 }
  const mean     = arr.reduce((s, v) => s + v, 0) / arr.length
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length
  return { mean, std: Math.sqrt(variance) }
}

// Consistency score = 1 − (σ / μ), clamped [0, 1]
// A value of 1 means perfectly consistent weekly session count.
function consistencyScore(weekCounts) {
  if (weekCounts.length < 2) return 1
  const { mean, std } = meanStd(weekCounts)
  if (mean === 0) return 0
  return Math.max(0, Math.min(1, 1 - std / mean))
}

// Total lifted volume for one workout
function workoutVolume(w) {
  return w.exercises.reduce((sum, e) => {
    if (!Array.isArray(e.sets)) return sum
    return sum + e.sets.reduce((s2, s) => s2 + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0)
  }, 0)
}

/* ═══════════════════════════════════════════════════
   FORMATTING HELPERS
   ═══════════════════════════════════════════════════ */

function shortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isoWeekKey(iso) {
  const d    = new Date(iso)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  const wk   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${d.getFullYear()}-${String(wk).padStart(2, '0')}`
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* ═══════════════════════════════════════════════════
   RECOMMENDATION ENGINE
   ═══════════════════════════════════════════════════ */

function buildRecommendations({ consistency, reg, overloadData, avgWeeklySessions, weekGrowthPct, avgVol, stdVol, workoutCount }) {
  const recs = []

  // Need at least a few sessions for meaningful recommendations
  if (workoutCount < 4) {
    recs.push({ type: 'info', heading: 'Keep Going', body: `${workoutCount} session${workoutCount === 1 ? '' : 's'} logged. Complete at least 4 to unlock trend analysis.` })
    return recs
  }

  // Consistency
  if (consistency < 0.5) {
    recs.push({ type: 'warn', heading: 'Inconsistent Schedule', body: `Consistency score: ${(consistency * 100).toFixed(0)}%. High week-to-week variance. A fixed 3-day schedule will compound results faster than sporadic high-volume weeks.` })
  } else if (consistency >= 0.85) {
    recs.push({ type: 'good', heading: 'Elite Consistency', body: `${(consistency * 100).toFixed(0)}% consistency score — you show up. That's the single strongest predictor of long-term progress.` })
  }

  // Volume trend
  if (reg.slope < -80 && reg.r2 > 0.25) {
    recs.push({ type: 'warn', heading: 'Volume Declining', body: `Linear regression shows −${Math.abs(reg.slope).toFixed(0)} kg/session slope (R²=${reg.r2.toFixed(2)}). Sustained volume drops reduce hypertrophic stimulus. Add 1–2 sets per major lift.` })
  } else if (reg.slope > 100 && reg.r2 > 0.25) {
    recs.push({ type: 'good', heading: 'Volume Ramping Up', body: `+${reg.slope.toFixed(0)} kg/session slope with R²=${reg.r2.toFixed(2)} fit. Strong progressive overload. Monitor sleep and recovery — don't let fatigue outpace adaptation.` })
  }

  // Recent week change
  if (weekGrowthPct !== null) {
    const pct = parseFloat(weekGrowthPct)
    if (pct < -20) {
      recs.push({ type: 'warn', heading: 'Volume Drop This Week', body: `Weekly volume fell ${Math.abs(pct).toFixed(1)}% vs last week. Intentional deload? If not, check recovery and lifestyle stress.` })
    } else if (pct > 30) {
      recs.push({ type: 'info', heading: 'Volume Spike This Week', body: `+${pct.toFixed(1)}% weekly jump. Rapid spikes increase injury risk. Cap progressive overload at 5–10%/week for sustained adaptation.` })
    }
  }

  // Progressive overload per exercise
  const stagnating = overloadData.filter(e => Math.abs(e.slope) < 0.3 && e.sessions >= 4)
  if (stagnating.length > 0) {
    recs.push({ type: 'info', heading: 'Plateau Detected', body: `${stagnating.map(e => e.name).join(', ')} ${stagnating.length === 1 ? 'shows' : 'show'} near-zero weight progression over ${stagnating[0].sessions} sessions. Try microloading (+1.25 kg), rep PRs, or a technique variation to restart adaptation.` })
  }

  const declining = overloadData.filter(e => e.slope < -0.6 && e.sessions >= 4)
  if (declining.length > 0) {
    recs.push({ type: 'warn', heading: 'Strength Regression', body: `${declining.map(e => e.name).join(', ')} trending down in peak weight. Possible causes: accumulated fatigue, poor recovery, or form issues. Consider a planned deload week.` })
  }

  // Frequency
  if (avgWeeklySessions < 2.5 && workoutCount >= 6) {
    recs.push({ type: 'info', heading: 'Low Frequency', body: `Averaging ${avgWeeklySessions.toFixed(1)} sessions/week. Research consistently shows 3+ weekly sessions per muscle group maximises hypertrophy. Spreading volume across more days also reduces per-session fatigue.` })
  }

  // Variability (high CV)
  const cv = avgVol > 0 ? stdVol / avgVol : 0
  if (cv > 0.45 && workoutCount >= 6) {
    recs.push({ type: 'info', heading: 'Erratic Session Volume', body: `Coefficient of variation: ${(cv * 100).toFixed(0)}%. Your sessions vary widely in total volume. More structured mesocycles (e.g., 4-week build → 1-week deload) reduce noise and improve progression tracking.` })
  }

  if (recs.length === 0) {
    recs.push({ type: 'good', heading: 'On Track', body: 'Stats look healthy — consistent frequency, stable volume trend, and progressive overload detected on key lifts.' })
  }

  return recs
}

/* ═══════════════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════════════ */

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
  padding: '16px 14px',
  marginBottom: 12,
}

const SECTION_LABEL = {
  fontFamily: 'var(--mono)',
  fontSize: 10,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
  marginBottom: 14,
}

const STAT_ROW = {
  display: 'flex',
  gap: 14,
  flexWrap: 'wrap',
  marginBottom: 10,
}

const MINI_STAT = {
  fontFamily: 'var(--mono)',
  fontSize: 11,
}

/* ═══════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════ */

function StatCard({ value, label, sub, accent, idx }) {
  return (
    <div
      className={`fade-up delay-${Math.min(idx, 5)}`}
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{
        fontFamily: 'var(--display)',
        fontSize: 44,
        color: accent ? 'var(--accent)' : 'var(--text)',
        lineHeight: 1,
        letterSpacing: '0.02em',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
          {sub}
        </div>
      )}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--text-muted)', marginTop: 8 }}>
        {label}
      </div>
    </div>
  )
}

function PeriodPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      {PERIODS.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            flex: 1,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            letterSpacing: '0.08em',
            padding: '7px 0',
            borderRadius: 6,
            border: `1px solid ${value === p ? '#f97316' : 'var(--border)'}`,
            background: value === p ? 'rgba(249,115,22,0.12)' : 'transparent',
            color: value === p ? '#f97316' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.12s',
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

function TrendBadge({ slope, threshold = 0.3 }) {
  if (slope > threshold)  return <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 18 }}>↑</span>
  if (slope < -threshold) return <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>↓</span>
  return <span style={{ color: '#eab308', fontWeight: 700, fontSize: 18 }}>→</span>
}

function RecommendationCard({ recs }) {
  const COLOR = { good: '#22c55e', warn: '#f97316', info: '#60a5fa' }
  const BG    = { good: 'rgba(34,197,94,0.07)', warn: 'rgba(249,115,22,0.07)', info: 'rgba(96,165,250,0.07)' }

  return (
    <div className="fade-up delay-2" style={{ marginBottom: 14 }}>
      <div style={SECTION_LABEL}>ANALYSIS &amp; RECOMMENDATIONS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recs.map((r, i) => (
          <div key={i} style={{
            background: BG[r.type],
            border: `1px solid ${COLOR[r.type]}30`,
            borderLeft: `3px solid ${COLOR[r.type]}`,
            borderRadius: 8,
            padding: '10px 12px',
          }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: COLOR[r.type], marginBottom: 4 }}>
              {r.heading.toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>{r.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   MAIN STATS COMPONENT
   ═══════════════════════════════════════════════════ */

export default function Stats() {
  const [workouts, setWorkouts]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [selectedEx, setSelectedEx] = useState(null)
  const [period, setPeriod]         = useState('ALL')

  useEffect(() => {
    getWorkouts().then(data => { setWorkouts(data); setLoading(false) })
  }, [])

  if (loading) return <Loader />

  if (workouts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: 64, color: 'var(--surface-3)', lineHeight: 1, marginBottom: 16 }}>0</div>
        <div style={{ fontFamily: 'var(--display)', fontSize: 22, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>NO DATA YET</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Complete some workouts to see your stats</div>
      </div>
    )
  }

  /* ── Sort chronologically, then filter by period ─── */
  const chrono   = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date))
  const cutoff   = periodCutoff(period)
  const filtered = cutoff ? chrono.filter(w => new Date(w.date) >= cutoff) : chrono

  /* ── Global aggregates ───────────────────────────── */
  const totalWorkouts  = filtered.length
  const totalVolume    = filtered.reduce((s, w) => s + workoutVolume(w), 0)
  const totalSets      = filtered.reduce((s, w) => s + w.exercises.reduce((s2, e) => s2 + (Array.isArray(e.sets) ? e.sets.length : 0), 0), 0)

  const volumes = filtered.map(workoutVolume)
  const { mean: avgVol, std: stdVol } = meanStd(volumes)

  /* ── Linear regression on session volume ─────────── */
  const reg  = linearRegression(volumes)
  const MA_W = Math.max(2, Math.min(4, Math.floor(volumes.length / 2)))
  const maVals  = movingAvg(volumes, MA_W)
  const nextPred = Math.max(0, reg.slope * volumes.length + reg.intercept)

  const volumeChartData = [
    ...filtered.map((w, i) => ({
      d:     shortDate(w.date),
      vol:   volumes[i],
      ma:    maVals[i] !== null ? Math.round(maVals[i]) : undefined,
      trend: Math.round(reg.slope * i + reg.intercept),
    })),
    { d: 'NEXT', vol: undefined, ma: undefined, trend: Math.round(nextPred), isPred: true },
  ]

  /* ── Sessions per week ───────────────────────────── */
  const weekSessionMap = {}
  filtered.forEach(w => {
    const k = isoWeekKey(w.date)
    weekSessionMap[k] = (weekSessionMap[k] || 0) + 1
  })
  const weekData = Object.entries(weekSessionMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, count]) => ({ week: `W${k.split('-')[1]}`, count }))

  const weekCounts = weekData.map(d => d.count)
  const { mean: avgWeeklySessions } = meanStd(weekCounts)
  const consistency = consistencyScore(weekCounts)

  /* ── Weekly volume ───────────────────────────────── */
  const weekVolMap = {}
  filtered.forEach(w => {
    const k = isoWeekKey(w.date)
    weekVolMap[k] = (weekVolMap[k] || 0) + workoutVolume(w)
  })
  const weekVolData = Object.entries(weekVolMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, vol]) => ({ week: `W${k.split('-')[1]}`, vol }))

  const weekVolReg = linearRegression(weekVolData.map(d => d.vol))
  const weekGrowthPct =
    weekVolData.length > 1 && weekVolData[weekVolData.length - 2].vol > 0
      ? ((weekVolData.at(-1).vol - weekVolData.at(-2).vol) / weekVolData.at(-2).vol * 100).toFixed(1)
      : null

  /* ── Per-exercise statistics ─────────────────────── */
  const exStats = {}
  filtered.forEach(w => {
    w.exercises.forEach(e => {
      if (!Array.isArray(e.sets)) return
      if (!exStats[e.name]) {
        exStats[e.name] = { totalVol: 0, sessions: 0, maxWeight: 0, best1RM: 0, history: [] }
      }
      const vol  = e.sets.reduce((s, set) => s + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0)
      const maxW = e.sets.reduce((m, s) => Math.max(m, Number(s.weight) || 0), 0)
      const b1rm = bestOneRM(e.sets)
      const ex   = exStats[e.name]
      ex.totalVol   += vol
      ex.sessions   += 1
      ex.maxWeight   = Math.max(ex.maxWeight, maxW)
      ex.best1RM     = Math.max(ex.best1RM, b1rm)
      ex.history.push({ date: shortDate(w.date), maxW, vol, orm: b1rm })
    })
  })

  const topEx = Object.entries(exStats)
    .sort((a, b) => b[1].totalVol - a[1].totalVol)
    .slice(0, 8)

  const maxExVol = topEx[0]?.[1].totalVol || 1

  /* ── Progressive overload per exercise ──────────── */
  const overloadData = topEx.slice(0, 6).map(([name, stat]) => {
    const weights = stat.history.map(h => h.maxW)
    const r = linearRegression(weights)
    return { name, slope: r.slope, r2: r.r2, maxWeight: stat.maxWeight, best1RM: stat.best1RM, sessions: stat.sessions }
  })

  /* ── 1RM chart for selected exercise ─────────────── */
  const activeEx     = selectedEx ?? topEx[0]?.[0]
  const activeExData = activeEx ? exStats[activeEx] : null
  const ormData      = activeExData?.history ?? []
  const ormReg       = linearRegression(ormData.map(d => d.orm))
  const peak1RM      = activeExData?.best1RM ?? 0

  /* ── Volume by day of week ───────────────────────── */
  const dayVolAcc = [0, 0, 0, 0, 0, 0, 0]
  const dayCntAcc = [0, 0, 0, 0, 0, 0, 0]
  filtered.forEach(w => {
    const dow = new Date(w.date).getDay()
    dayVolAcc[dow] += workoutVolume(w)
    dayCntAcc[dow] += 1
  })
  const dayData = DAY_NAMES.map((day, i) => ({
    day,
    avg:      dayCntAcc[i] > 0 ? Math.round(dayVolAcc[i] / dayCntAcc[i]) : 0,
    sessions: dayCntAcc[i],
  }))
  const maxDayVol = Math.max(...dayData.map(d => d.avg), 1)

  /* ── Smart recommendations ───────────────────────── */
  const recs = buildRecommendations({
    consistency, reg, overloadData, avgWeeklySessions,
    weekGrowthPct, avgVol, stdVol, workoutCount: totalWorkouts,
  })

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* ─── Period picker ─── */}
      <PeriodPicker value={period} onChange={p => { setPeriod(p); setSelectedEx(null) }} />

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          No workouts in this period — try a longer range
        </div>
      )}

      {/* ─── Summary cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <StatCard idx={1} value={totalWorkouts}                          label="SESSIONS" />
        <StatCard idx={2} value={`${(totalVolume / 1000).toFixed(1)}t`}  label="TOTAL VOLUME" accent />
        <StatCard
          idx={3}
          value={`${(avgVol / 1000).toFixed(2)}t`}
          label="AVG / SESSION"
          sub={`σ = ${(stdVol / 1000).toFixed(2)}t`}
        />
        <StatCard
          idx={4}
          value={`${(consistency * 100).toFixed(0)}%`}
          label="CONSISTENCY"
          accent={consistency >= 0.7}
          sub={`${avgWeeklySessions.toFixed(1)} sessions/wk`}
        />
      </div>

      {/* ─── Recommendations ─── */}
      <RecommendationCard recs={recs} />

      {/* ─── Volume trend: regression + moving average ─── */}
      {volumeChartData.length > 2 && (
        <div className="fade-up delay-3" style={CARD}>
          <div style={SECTION_LABEL}>
            SESSION VOLUME — REGRESSION + {MA_W}-PERIOD MOVING AVERAGE
          </div>

          <div style={STAT_ROW}>
            <div style={MINI_STAT}>
              <span style={{ color: 'var(--text-muted)' }}>SLOPE </span>
              <span style={{ color: reg.slope >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {reg.slope >= 0 ? '+' : ''}{reg.slope.toFixed(0)} kg/session
              </span>
            </div>
            <div style={MINI_STAT}>
              <span style={{ color: 'var(--text-muted)' }}>R² </span>
              <span style={{ color: 'var(--text)' }}>{reg.r2.toFixed(3)}</span>
            </div>
            <div style={MINI_STAT}>
              <span style={{ color: 'var(--text-muted)' }}>NEXT PRED </span>
              <span style={{ color: '#a78bfa', fontWeight: 700 }}>
                {nextPred > 0 ? `${(nextPred / 1000).toFixed(2)}t` : '—'}
              </span>
            </div>
            <div style={MINI_STAT}>
              <span style={{ color: 'var(--text-muted)' }}>AVG±σ </span>
              <span style={{ color: 'var(--text)' }}>
                {(avgVol / 1000).toFixed(2)}±{(stdVol / 1000).toFixed(2)}t
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={190}>
            <ComposedChart data={volumeChartData} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="d"
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip contentStyle={TT} cursor={{ stroke: 'var(--border-2)' }} />
              <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', paddingTop: 8 }} />
              <Line
                type="monotone" dataKey="vol"
                stroke="#f97316" strokeWidth={2}
                dot={{ fill: '#f97316', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                name="volume (kg)"
                connectNulls={false}
              />
              <Line
                type="monotone" dataKey="ma"
                stroke="#60a5fa" strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                name={`${MA_W}-session MA`}
                connectNulls={false}
              />
              <Line
                type="monotone" dataKey="trend"
                stroke="#a78bfa" strokeWidth={1.5}
                strokeDasharray="2 5"
                dot={false}
                name="regression"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Advanced stat row ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <StatCard
          idx={3}
          value={weekGrowthPct !== null ? `${parseFloat(weekGrowthPct) > 0 ? '+' : ''}${weekGrowthPct}%` : '—'}
          label="WK/WK VOL ΔCHANGE"
          accent={weekGrowthPct !== null && parseFloat(weekGrowthPct) > 0}
        />
        <StatCard
          idx={4}
          value={totalSets}
          label="TOTAL SETS"
          sub={totalWorkouts > 0 ? `${(totalSets / totalWorkouts).toFixed(1)} sets/session` : undefined}
        />
      </div>

      {/* ─── Estimated 1RM progression ─── */}
      {topEx.length > 0 && ormData.length > 1 && (
        <div className="fade-up delay-4" style={CARD}>
          <div style={SECTION_LABEL}>ESTIMATED 1-REP MAX — BRZYCKI FORMULA</div>

          {/* Exercise selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {topEx.slice(0, 5).map(([name]) => (
              <button
                key={name}
                onClick={() => setSelectedEx(name)}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  padding: '4px 8px',
                  borderRadius: 4,
                  border: `1px solid ${activeEx === name ? '#f97316' : 'var(--border)'}`,
                  background: activeEx === name ? 'rgba(249,115,22,0.12)' : 'transparent',
                  color: activeEx === name ? '#f97316' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {name}
              </button>
            ))}
          </div>

          <div style={STAT_ROW}>
            <div style={MINI_STAT}>
              <span style={{ color: 'var(--text-muted)' }}>PEAK 1RM </span>
              <span style={{ color: '#f97316', fontWeight: 700 }}>{peak1RM} kg</span>
            </div>
            <div style={MINI_STAT}>
              <span style={{ color: 'var(--text-muted)' }}>TREND </span>
              <span style={{ color: ormReg.slope >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                {ormReg.slope >= 0 ? '+' : ''}{ormReg.slope.toFixed(1)} kg/session
              </span>
            </div>
            <div style={MINI_STAT}>
              <span style={{ color: 'var(--text-muted)' }}>R² </span>
              <span style={{ color: 'var(--text)' }}>{ormReg.r2.toFixed(3)}</span>
            </div>
            <div style={MINI_STAT}>
              <span style={{ color: 'var(--text-muted)' }}>SESSIONS </span>
              <span style={{ color: 'var(--text)' }}>{activeExData?.sessions ?? 0}</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={ormData} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip contentStyle={TT} cursor={{ stroke: 'var(--border-2)' }} />
              <Legend wrapperStyle={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.06em', paddingTop: 8 }} />
              {peak1RM > 0 && (
                <ReferenceLine
                  y={peak1RM}
                  stroke="#f97316"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: `PR ${peak1RM}kg`,
                    fill: '#f97316',
                    fontSize: 9,
                    fontFamily: 'var(--mono)',
                    position: 'insideTopRight',
                  }}
                />
              )}
              <Line
                type="monotone" dataKey="orm"
                stroke="#22c55e" strokeWidth={2}
                dot={{ fill: '#22c55e', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                name="Est. 1RM (kg)"
              />
              <Line
                type="monotone" dataKey="maxW"
                stroke="#f97316" strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                name="Max weight (kg)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Progressive overload table ─── */}
      {overloadData.length > 0 && (
        <div className="fade-up delay-4" style={CARD}>
          <div style={SECTION_LABEL}>PROGRESSIVE OVERLOAD ANALYSIS — SLOPE PER SESSION</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {overloadData.map((ex, i) => (
              <div
                key={ex.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 72px 48px 28px',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 0',
                  borderBottom: i < overloadData.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                    {ex.name}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)' }}>
                    {ex.sessions}× · max {ex.maxWeight}kg · ~1RM {ex.best1RM}kg
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textAlign: 'right' }}>
                  <div style={{ color: ex.slope >= 0.3 ? '#22c55e' : ex.slope < -0.3 ? '#ef4444' : '#eab308', fontWeight: 700 }}>
                    {ex.slope >= 0 ? '+' : ''}{ex.slope.toFixed(2)} kg
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9 }}>/ session</div>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--text-muted)', textAlign: 'right' }}>
                  R²<br />{ex.r2.toFixed(2)}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <TrendBadge slope={ex.slope} threshold={0.3} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Sessions per week ─── */}
      {weekData.length > 1 && (
        <div className="fade-up delay-5" style={CARD}>
          <div style={SECTION_LABEL}>SESSIONS / WEEK{period !== 'ALL' ? ` — ${period}` : ''}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>CONSISTENCY </span>
            <span style={{ color: consistency >= 0.7 ? '#22c55e' : consistency >= 0.5 ? '#eab308' : '#ef4444', fontWeight: 700 }}>
              {(consistency * 100).toFixed(0)}%
            </span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 12 }}>AVG </span>
            <span style={{ color: 'var(--text)' }}>{avgWeeklySessions.toFixed(1)}/wk</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weekData} margin={{ left: -24, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip contentStyle={TT} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <ReferenceLine
                y={avgWeeklySessions}
                stroke="#60a5fa"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} name="sessions">
                {weekData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.count >= Math.round(avgWeeklySessions) ? '#f97316' : 'rgba(249,115,22,0.3)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Weekly total volume ─── */}
      {weekVolData.length > 1 && (
        <div className="fade-up delay-5" style={CARD}>
          <div style={SECTION_LABEL}>WEEKLY TOTAL VOLUME</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginBottom: 10 }}>
            <span style={{ color: 'var(--text-muted)' }}>TREND </span>
            <span style={{ color: weekVolReg.slope >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
              {weekVolReg.slope >= 0 ? '+' : ''}{(weekVolReg.slope / 1000).toFixed(2)}t/week
            </span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 12 }}>R² </span>
            <span style={{ color: 'var(--text)' }}>{weekVolReg.r2.toFixed(3)}</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weekVolData} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={TT}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                formatter={v => [`${(v / 1000).toFixed(2)}t`, 'volume']}
              />
              <Bar dataKey="vol" fill="#f97316" radius={[3, 3, 0, 0]} name="volume (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Volume by day of week ─── */}
      {filtered.length >= 5 && (
        <div className="fade-up delay-5" style={CARD}>
          <div style={SECTION_LABEL}>AVG VOLUME BY DAY OF WEEK</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={dayData} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'var(--mono)' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={TT}
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                formatter={(v, _n, p) => [
                  `${(v / 1000).toFixed(2)}t avg`,
                  `${p.payload.sessions} session${p.payload.sessions === 1 ? '' : 's'}`,
                ]}
              />
              <Bar dataKey="avg" radius={[3, 3, 0, 0]} name="avg volume">
                {dayData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.avg > 0
                      ? `rgba(249,115,22,${(0.25 + 0.75 * entry.avg / maxDayVol).toFixed(2)})`
                      : 'rgba(255,255,255,0.04)'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── Top lifts by volume (with 1RM) ─── */}
      {topEx.length > 0 && (
        <div className="fade-up delay-5" style={{ ...CARD, marginBottom: 16 }}>
          <div style={SECTION_LABEL}>TOP LIFTS BY CUMULATIVE VOLUME</div>
          {topEx.slice(0, 6).map(([name, stat], i) => {
            const pct = Math.round((stat.totalVol / maxExVol) * 100)
            return (
              <div key={name} style={{ marginBottom: i < topEx.length - 1 ? 14 : 0 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 5,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                      ~1RM {stat.best1RM}kg
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#f97316' }}>
                      {(stat.totalVol / 1000).toFixed(1)}t
                    </span>
                  </div>
                </div>
                <div style={{ background: 'var(--surface-3)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: i === 0
                      ? '#f97316'
                      : `rgba(249,115,22,${(1 - i * 0.12).toFixed(2)})`,
                    borderRadius: 3,
                    animation: 'barGrow 0.8s ease both',
                    animationDelay: `${i * 0.1}s`,
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
