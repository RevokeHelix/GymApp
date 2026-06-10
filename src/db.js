import localforage from 'localforage'

const db = localforage.createInstance({ name: 'gymtracker' })

export async function getProfile() {
  return (await db.getItem('profile')) || { name: '', weight: '', height: '', age: '', goal: 'Build Muscle' }
}

export async function saveProfile(profile) {
  await db.setItem('profile', profile)
}

export async function getWorkouts() {
  return (await db.getItem('workouts')) || []
}

export async function saveWorkout(workout) {
  const workouts = await getWorkouts()
  const idx = workouts.findIndex(w => w.id === workout.id)
  if (idx >= 0) workouts[idx] = workout
  else workouts.unshift(workout)
  await db.setItem('workouts', workouts)
}

export async function deleteWorkout(id) {
  const workouts = await getWorkouts()
  await db.setItem('workouts', workouts.filter(w => w.id !== id))
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
