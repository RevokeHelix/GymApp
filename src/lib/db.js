import { supabase } from './supabase'

/* ── helpers ──────────────────────────────────── */
export function genId() {
  return crypto.randomUUID()
}

async function uid() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/* ── profile ──────────────────────────────────── */
const DEFAULT_PROFILE = { name: '', weight: '', height: '', age: '', goal: 'Build Muscle' }

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DEFAULT_PROFILE

  const { data } = await supabase
    .from('profiles')
    .select('name, weight, height, age, goal')
    .eq('id', user.id)
    .maybeSingle()

  if (data) {
    return {
      name:   data.name   ?? '',
      weight: data.weight ?? '',
      height: data.height ?? '',
      age:    data.age    ?? '',
      goal:   data.goal   ?? 'Build Muscle',
    }
  }

  // No profile row yet (trigger not used) — create it now
  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name      || ''
  await supabase.from('profiles').upsert({
    id:   user.id,
    name: displayName,
    goal: 'Build Muscle',
  })
  return { ...DEFAULT_PROFILE, name: displayName }
}

export async function saveProfile(profile) {
  const id = await uid()
  if (!id) return
  await supabase.from('profiles').upsert({
    id,
    name:       profile.name   || null,
    weight:     profile.weight ? Number(profile.weight) : null,
    height:     profile.height ? Number(profile.height) : null,
    age:        profile.age    ? Number(profile.age)    : null,
    goal:       profile.goal   || 'Build Muscle',
    updated_at: new Date().toISOString(),
  })
}

/* ── workouts ─────────────────────────────────── */
export async function getWorkouts() {
  const id = await uid()
  if (!id) return []
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, date, exercises')
    .eq('user_id', id)
    .order('date', { ascending: false })
  if (error) { console.error(error); return [] }
  return (data ?? []).map(w => ({
    id:        w.id,
    name:      w.name,
    date:      w.date,
    exercises: w.exercises ?? [],
  }))
}

export async function saveWorkout(workout) {
  const id = await uid()
  if (!id) return
  await supabase.from('workouts').upsert({
    id:        workout.id,
    user_id:   id,
    name:      workout.name,
    date:      workout.date,
    exercises: workout.exercises,
  })
}

export async function deleteWorkout(workoutId) {
  await supabase.from('workouts').delete().eq('id', workoutId)
}

/* ── weight entries ───────────────────────────── */
export async function getWeightEntries() {
  const id = await uid()
  if (!id) return []
  const { data, error } = await supabase
    .from('weight_entries')
    .select('id, date, weight')
    .eq('user_id', id)
    .order('date', { ascending: true })
  if (error) { console.error(error); return [] }
  return data ?? []
}

export async function addWeightEntry(date, weight) {
  const id = await uid()
  if (!id) return
  await supabase.from('weight_entries').upsert(
    { user_id: id, date, weight: Number(weight) },
    { onConflict: 'user_id,date' }
  )
}

export async function deleteWeightEntry(entryId) {
  await supabase.from('weight_entries').delete().eq('id', entryId)
}

/* ── user templates ───────────────────────────── */
export async function getUserTemplates() {
  const id = await uid()
  if (!id) return []
  const { data, error } = await supabase
    .from('user_templates')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return data ?? []
}

export async function saveUserTemplate(tmpl) {
  const id = await uid()
  if (!id) return
  if (tmpl.id) {
    await supabase.from('user_templates').update({
      name:      tmpl.name,
      program:   tmpl.program,
      focus:     tmpl.focus,
      color:     tmpl.color,
      exercises: tmpl.exercises,
    }).eq('id', tmpl.id)
  } else {
    await supabase.from('user_templates').insert({
      user_id:   id,
      name:      tmpl.name,
      program:   tmpl.program  || 'Custom',
      focus:     tmpl.focus    || '',
      color:     tmpl.color    || '#f97316',
      exercises: tmpl.exercises ?? [],
    })
  }
}

export async function deleteUserTemplate(tmplId) {
  await supabase.from('user_templates').delete().eq('id', tmplId)
}
