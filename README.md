# GymApp

A minimalist progressive web app for logging workouts and tracking strength progress over time.

![Stack](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![Stack](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase&logoColor=white)
![Stack](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white)
![Stack](https://img.shields.io/badge/PWA-installable-5a0fc8)

---

## Features

- **Workout Logger** — log exercises, sets, reps, and weight; load from templates; back-date any session
- **History** — expandable chronological log of every session
- **Statistics** — deep progress analytics including:
  - Linear regression on session volume (slope, R², next-session prediction)
  - Moving average overlay
  - Estimated 1-rep max (Brzycki formula) per exercise over time
  - Progressive overload analysis with trend classification (↑ / → / ↓)
  - Weekly volume trend with regression
  - Consistency score (1 − coefficient of variation)
  - Volume distribution by day of week
  - Smart recommendation engine
- **Templates** — built-in programs (PPL, StrongLifts 5×5, Upper/Lower, Full Body) plus custom templates
- **Profile** — name, body weight, height, age, and goal
- **PWA** — installable on mobile and desktop, works offline for the UI layer

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 4 |
| Charts | Recharts 2 |
| Backend / Auth | Supabase (PostgreSQL + Row Level Security) |
| PWA | vite-plugin-pwa / Workbox |
| Testing | Playwright |

## Getting Started

### 1. Clone

```bash
git clone https://github.com/RevokeHelix/GymApp.git
cd GymApp
npm install
```

### 2. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `supabase_schema.sql` in the Supabase SQL editor to create the required tables
3. Copy your project URL and anon key

### 3. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Database Schema

The full schema is in [`supabase_schema.sql`](./supabase_schema.sql). The three tables are:

- **`profiles`** — user settings (name, weight, height, age, goal)
- **`workouts`** — sessions with a JSONB `exercises` array: `[{ name, sets: [{ reps, weight }] }]`
- **`user_templates`** — custom workout templates

All tables use Supabase Row Level Security — users can only read and write their own rows.

## Project Structure

```
src/
├── components/
│   ├── WorkoutLogger.jsx   # Log a session (with date picker for back-logging)
│   ├── History.jsx         # Chronological workout list
│   ├── Stats.jsx           # Charts, regression, 1RM, recommendations
│   ├── Templates.jsx       # Browse and load templates
│   ├── CreateTemplate.jsx  # Create custom templates
│   ├── Profile.jsx         # User profile editor
│   └── Auth.jsx            # Supabase auth (email / OAuth)
├── lib/
│   ├── db.js               # Supabase queries (workouts, profiles, templates)
│   └── supabase.js         # Supabase client
├── context/
│   └── AuthContext.jsx     # Auth state provider
├── data/
│   └── templates.js        # Built-in program templates
├── App.jsx                 # Root + bottom-tab navigation
└── index.css               # Design tokens + global styles
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

## License

MIT
