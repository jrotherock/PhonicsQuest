# Phonics Quest

Phonics Quest turns foundational reading practice into a gentle storybook adventure for early readers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/phonics-quest/src/App.tsx` — quest hub, challenge flow, feedback, progress, and local persistence
- `artifacts/phonics-quest/src/index.css` — twilight storybook theme, responsive layout, and motion
- `artifacts/phonics-quest` — the runnable web app

## Architecture decisions

- The first playable slice is frontend-only so a child can practice immediately without accounts or setup.
- Practice progress is stored locally in the browser for continuity across refreshes.
- Phonics content is represented as small challenge data sets so new quests can be added without changing the game loop.

## Product

- Child-facing quest hub with short vowels, long vowels, syllable, and locked digraph paths
- Interactive challenge flow with hints, retry-friendly feedback, rewards, and completion states
- Grown-up progress view with streak, stars, mastered paths, practice rhythm, and caregiver guidance

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
