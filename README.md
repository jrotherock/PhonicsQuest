# Phonics Quest

Phonics Quest is a playful, storybook-style phonics practice app for early readers. Children follow a Lantern Trail through sound awareness, short vowels, blending, spelling, tricky words, and decodable reading while grown-ups get an evidence-led progress view.

## Highlights

- Child-friendly quest hub with gentle rewards and optional audio
- Adaptive recommendations based on independent, accurate practice
- Review evidence for transfer, spelling, and retention
- Grown-up progress view protected by a four-digit learner PIN
- Shared family access gate with a secure HTTP-only browser cookie
- Anonymous browser profile IDs with PostgreSQL-backed progress
- Responsive web UI for desktop, tablet, and mobile use

## Project structure

- `artifacts/phonics-quest` — React/Vite web app
- `artifacts/api-server` — Express API server
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db` — PostgreSQL schema and Drizzle database package

## Run locally

Use pnpm from the repository root:

```bash
pnpm install
pnpm run typecheck
PORT=4173 BASE_PATH=/ pnpm run build
```

The app uses the API server workflow and requires the configured PostgreSQL connection plus these runtime secrets:

- `DATABASE_URL`
- `SESSION_SECRET`
- `FAMILY_ACCESS_CODE`

For development, run the API and web workflows configured for the project. The family access phrase is intentionally supplied through the workspace secrets flow rather than committed to source control.

## Test

The Phonics Quest browser regression suite uses the configured family access secret:

```bash
pnpm --filter @workspace/phonics-quest exec playwright test tests/learning-route.spec.ts
```

The suite covers the family gate, protected API behavior, unlock persistence, learning recommendations, reading readiness, and grown-up PIN flows.

## API code generation

When the OpenAPI contract changes, regenerate the typed React client and server schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Privacy boundary

Phonics Quest does not use accounts. The browser stores only an anonymous profile UUID. The family access phrase protects entry to the app, and the grown-up PIN protects the progress view for the current learner profile.