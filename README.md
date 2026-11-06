# Betterflow

A foundation for an internal learning and onboarding roadmap tool, based on the Phase 1 project brief.
This repository provides the development setup so the team can work on features independently.

## Current scope

Included:

- npm workspaces for `client/` and `server/`, with a shared lockfile.
- React, Vite, strict TypeScript, React Router and TanStack Query.
- A responsive starter page and a 404 page.
- An API client, route error boundary and frontend/backend connection status.
- Express 5, CORS, Helmet, JSON payload limits, consistent errors and graceful shutdown.
- A PostgreSQL connection pool, version 18 checks and a migration runner with transactions, checksums and an advisory lock.
- ESLint, Prettier, Vitest, Playwright and GitHub Actions.
- Dependencies from the brief: `@xyflow/react`, `html-to-image`, `@dagrejs/dagre`, `pg`, `bcrypt` and `jsonwebtoken`.

Not implemented yet: registration/login, JWT middleware, roadmap CRUD, node editing and connections, persistence, sharing, markdown parsing, automatic layout and file exports.
There is no domain schema, demo account or mock data stored on the backend.
The interns will implement these features as separate tasks.
The checklist of contracts the team needs to agree on is in [docs/contracts.md](docs/contracts.md).

## Frontend design system

The frontend uses the **AI Labs** preset, imported with `npx designdotmd add ai-labs` and preserved in [design.md](design.md).
Shared CSS tokens in `client/src/styles/tokens.css` define colors, typography, spacing and border radii.
IBM Plex Sans and IBM Plex Mono are bundled locally, so opening the app does not require an external font service.
Use paper-white backgrounds, thin borders, flat colors and one green primary action per screen.
Green buttons use dark text to maintain contrast at small font sizes.
Reuse these tokens when building the Phase 1 screens.

## Requirements

- Node.js 24.x and npm 11 or later (`.nvmrc` specifies Node 24).
- The latest PostgreSQL 18.x release and the `psql` CLI when working with the database.
- Git.

The frontend and API liveness endpoint work without a configured database.
The `db:*` commands and readiness endpoint require a running PostgreSQL instance.

The toolchain overrides `minimatch` to version `>=11.0.1` to avoid [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) in ESLint dependencies.
Remove the override once the parent dependencies use a patched version.

## Getting started

Run these commands from the repository root:

```sh
nvm use
npm ci
cp client/.env.example client/.env
cp server/.env.example server/.env
npm run dev
```

- Frontend: `http://127.0.0.1:5173`.
- API: `http://localhost:3001/api/health`.
- Vite proxies `/api/*` to the local backend, so `VITE_API_URL` can remain blank during development.
- Blank values from `.env.example` use local defaults, except database and secret variables, which have no defaults.
- If port 5173 is occupied, Vite exits with an error instead of switching ports silently.

Do not commit the `.env` files you create.
They are already covered by `.gitignore`.

## Local database

Install PostgreSQL 18 and start its service using the instructions for your operating system.
Check the CLI and create the database using your local PostgreSQL account:

```sh
psql --version
createdb betterflow
psql -d betterflow -c 'SELECT version();'
```

Set `DATABASE_URL` in `server/.env` using your actual local credentials:

```dotenv
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/betterflow
```

Run from the repository root:

```sh
npm run db:check
npm run db:migrate
curl http://localhost:3001/api/health/ready
```

There are no domain migrations yet; the runner only creates the `schema_migrations` tracking table.
Once the team agrees on the schema, add SQL files following the [migration conventions](server/db/migrations/README.md).
Use a direct database connection for migrations, especially with Neon, so the advisory lock stays on the same session.
Do not run migrations automatically during API startup or inside serverless requests.
`server/db/seed.sql` is reserved for local development fixtures after the schema is approved.

## Environment variables

| File          | Variable         | Local default / purpose                                              |
| ------------- | ---------------- | -------------------------------------------------------------------- |
| `client/.env` | `VITE_API_URL`   | `/api`; use the full backend URL ending in `/api` when deployed      |
| `server/.env` | `NODE_ENV`       | `development`; production requires a database URL and JWT secret     |
| `server/.env` | `PORT`           | `3001`                                                               |
| `server/.env` | `CLIENT_ORIGIN`  | `http://localhost:5173`; set the exact frontend origin when deployed |
| `server/.env` | `DATABASE_URL`   | No default; local PostgreSQL 18 or Neon connection string            |
| `server/.env` | `JWT_SECRET`     | No default; at least 32 characters, reserved for authentication      |
| `server/.env` | `JWT_EXPIRES_IN` | `1d`; unused until authentication is implemented                     |

`CLIENT_ORIGIN` accepts one origin, not a comma-separated list.
When calling the API directly from a local browser at `127.0.0.1`, set `CLIENT_ORIGIN=http://127.0.0.1:5173` if you bypass the Vite proxy.
Do not put secrets in `VITE_*` variables because Vite includes them in the browser bundle.
To generate a local signing secret for the authentication feature, run:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

## Development commands

| Command at repository root | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `npm run dev`              | Run the frontend and backend together                            |
| `npm run typecheck`        | Check types in both workspaces and browser tests                 |
| `npm run lint`             | Run ESLint with no warnings allowed                              |
| `npm run format`           | Format files with Prettier                                       |
| `npm run format:check`     | Check formatting                                                 |
| `npm test`                 | Run HTTP API and configuration tests without a database          |
| `npm run build`            | Build the frontend to `client/dist` and backend to `server/dist` |
| `npm run check`            | Run formatting checks, lint, type checks, tests and builds       |
| `npm run test:e2e`         | Run desktop and mobile browser smoke tests                       |

Install the browser once before running E2E tests:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts the frontend and backend when development servers are not already running.
Smoke tests cover the API through the Vite proxy, routing, URL reloads, horizontal overflow and local font loading.
API tests mock the database layer to run independently; they do not replace tests against a real PostgreSQL instance.
To check production builds locally, run `npm run start -w server` and `npm run preview -w client` in separate terminals.
Set `VITE_API_URL=http://localhost:3001/api` before building the frontend because preview does not use the development proxy.
When opening preview at `http://127.0.0.1:4173`, configure the backend with `CLIENT_ORIGIN=http://127.0.0.1:4173`.

## Project structure

```text
betterflow/
├── client/
│   ├── src/
│   │   ├── app/                # Router, layout, page shells
│   │   ├── features/           # Currently only the system health API
│   │   ├── lib/                # API client, query client
│   │   └── styles/             # Shared design tokens
│   └── vercel.json             # SPA fallback
├── server/
│   ├── src/
│   │   ├── app.ts              # Express app without a listener
│   │   ├── index.ts            # Local listener
│   │   ├── config/             # Environment validation
│   │   ├── db/                 # PostgreSQL pool
│   │   ├── middleware/         # Error handler
│   │   └── routes/             # Health endpoints
│   ├── db/
│   │   ├── migrations/         # Numbered SQL files; no domain schema yet
│   │   ├── migrate.ts
│   │   └── seed.sql
│   └── tests/
├── docs/contracts.md           # Checklist for team design decisions
├── e2e/
├── .github/workflows/ci.yml
├── design.md                   # Imported AI Labs design reference
└── AGENTS.md
```

## Implemented API endpoints

| Method | Endpoint            | Response                                                                                               |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/api/health`       | `200`, `{ "data": { "status": "ok", "service": "betterflow-api" } }`                                   |
| GET    | `/api/health/ready` | `200` when PostgreSQL 18 is ready; `503` if unconfigured, unavailable or using the wrong major version |

Successful JSON responses use the `{ data: ... }` envelope.
Errors use `{ error: { code, message } }` without exposing stack traces or connection strings.
Unimplemented endpoints return `404 NOT_FOUND` rather than mock responses.
The API status shown in the UI reflects liveness, not database readiness.

## Team workflow

Read `AGENTS.md` and agree on the items in `docs/contracts.md` before implementing features.
The brief proposes these responsibilities: Quang handles authentication, APIs and sharing; Thắng handles the canvas, roadmap list, shared view and PNG export; Huy handles markdown, automatic layout and markdown export.
Create `develop` and `feature/<feature-name>` branches following the team's Gitflow workflow.
Keep each PR small and include test instructions and screenshots for UI changes.
Require at least one peer approval, followed by mentor review, before merging.
The repository includes a PR template and CI; a repository administrator still needs to configure branch protection and GitHub Projects on GitHub.

## Deployment preparation

This scaffold has not been deployed.
When deploying the product, create two Vercel projects from the same repository with Root Directory set to `client` and `server`, respectively.
Allow files outside the Root Directory because both workspaces extend `tsconfig.base.json` at the repository root.
Keep npm workspace detection and the lockfile at the repository root.

- Frontend: use the Vite framework, build command `npm run build` and output directory `dist`; set `VITE_API_URL=https://<backend-domain>/api` before building.
- Backend: use the Express framework with `server/src/app.ts` exporting the default app; do not use `dist/index.js` as the serverless handler.
- Production backend: set `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` and `JWT_EXPIRES_IN` in the Vercel dashboard.
- Neon: choose PostgreSQL 18 and use a pooled connection string for the API runtime, preserving Neon's TLS settings.
- Migrations: run outside requests using a direct connection string before rolling out the new API version.
- CORS: `CLIENT_ORIGIN` must match the frontend origin without a trailing `/`.
- After deployment, check URL reloads, liveness and readiness.

References: [Vite](https://vite.dev/guide/), [React Flow](https://reactflow.dev/learn), [Express on Vercel](https://vercel.com/docs/frameworks/backend/express).
