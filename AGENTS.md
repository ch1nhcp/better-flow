# Betterflow working agreements

## Scope and source of truth

This repository is the Phase 1 foundation, not a completed product.
Read `README.md` for setup and implementation status.
Read `docs/contracts.md` before changing API, schema, graph data or markdown syntax.
That document is a checklist for the team to record decisions, not a completed design.
Leave business features for the interns unless the user explicitly asks to implement them.

## Structure

- `client/`: React, Vite, TypeScript, React Router and TanStack Query.
- `client/src/app/`: routing, layout and page shells.
- `client/src/features/<feature>/`: feature UI, API functions and types.
- `client/src/lib/`: reusable client infrastructure.
- `server/src/app.ts`: Express configuration and default app export, no listener.
- `server/src/index.ts`: local server listener and shutdown.
- `server/src/routes/`: HTTP routing.
- `server/src/middleware/`: shared request and error middleware.
- `server/src/db/`: PostgreSQL pool and future query modules.
- `server/db/migrations/`: numbered SQL migrations.
- `server/tests/`: backend integration and configuration tests.
- `e2e/`: browser smoke tests for the foundation.

## Implementation conventions

- Use strict TypeScript, avoid `any`, and type every PostgreSQL query result.
- Use named exports except entrypoints and framework configuration.
- Use PascalCase for component files and camelCase for functions and variables.
- Use kebab-case for other source filenames.
- Backend uses ESM with `.js` extensions in relative imports.
- Route every client API call through `client/src/lib/api.ts`.
- Use TanStack Query for remote data, do not duplicate server state in React contexts.
- Prefix backend routes with `/api`.
- Success uses `{ data: ... }`; errors use `{ error: { code, message } }`.
- Use `HttpError` for expected HTTP failures and return generic errors for unexpected failures.
- Validate untrusted inputs at API boundaries and enforce roadmap ownership in SQL.
- Use query parameters (`$1`, `$2`, etc.) for values, never concatenate user input into SQL.
- Keep runtime data in PostgreSQL, not process memory or local files.
- Do not log credentials, tokens, raw connection strings or request bodies.
- Import React Flow from `@xyflow/react`, never from the old `reactflow` package.
- Demo data and feature placeholders must be visibly identified.

## Frontend design system

Use the AI Labs preset in `design.md`, imported with `npx designdotmd add ai-labs`.
Treat the imported reference as source material, not a generated file to edit manually.
Shared CSS tokens live in `client/src/styles/tokens.css` and are loaded before application styles.
Use IBM Plex Sans for headings and body text and IBM Plex Mono for labels, metadata and code.
Use paper-white surfaces, thin neutral borders, flat colors and the preset radius and spacing tokens.
Reserve the green accent for one primary action per screen, without alternate accent colors or gradients.
Use dark text on green buttons to preserve contrast for small labels.
Keep all styling responsive and retain visible keyboard focus and reduced-motion support.

## Database and secrets

- PostgreSQL major version is 18; local database is `betterflow`, port 5432.
- Agree on the domain schema before adding the first domain migration.
- Use `NNN_snake_case.sql` filenames with unique ascending numbers.
- Never edit a migration that has been applied and merged; append a new migration.
- Runner owns transaction boundaries; migration files must not issue `BEGIN` or `COMMIT`.
- `.env.example` contains variable names with empty values only.
- Never commit `.env`, secrets or production data.
- Do not manually edit generated files, lockfiles or `CHANGELOG.md`.

## Verification and collaboration

- Run `npm run check` before review and `npm run test:e2e` when changing routing or visible UI.
- Start bug fixes by reproducing the issue through the product as closely as possible.
- Fix observed UI defects, lint errors, test failures and flakiness instead of ignoring them.
- Prefer quality, simplicity, robustness, scalability and maintainability in technical decisions.
- Write long Markdown with one full sentence per physical line.
- Never use the Unicode em dash character; use a plain dash.
- Never add an agent as a commit co-author automatically.
- Phase 1 uses `feature/<name>` from `develop`, with small PRs into `develop`.
- Do not push straight to `main` or `develop`; follow peer approval and mentor review.
- Never publish, deploy or contact collaborators unless the user asks.
