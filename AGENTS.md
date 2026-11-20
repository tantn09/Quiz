# Repository Guidelines

## Project Structure

- `quiz-fe/app` contains Next.js App Router pages for admins, teachers, and students. Put reusable controls in `quiz-fe/components/ui` and feature-specific code in `quiz-fe/features`. Follow `quiz-fe/DESIGN_SYSTEM.md` for shared tokens, layouts, and interaction patterns.
- `quiz-be/src/routes` contains Fastify endpoints. Drizzle schema code lives in `quiz-be/src/db`, and SQL migrations live in `quiz-be/drizzle`.
- `infra`, `release`, and `docs` contain deployment configuration and guides. Runtime prompt images use `quiz-be/uploads` locally or the configured asset directory in deployed environments.

## Development Commands

Use Node.js 22+, pnpm 10, and Docker Compose. Copy `.env.example` to `.env` before starting locally.

- `pnpm install` installs workspace dependencies.
- `pnpm dev` starts PostgreSQL, applies migrations, seeds an admin, and runs the frontend on port 3000 and API on port 4100.
- `pnpm --filter @quiz/web dev` or `pnpm --filter @quiz/api dev` runs one service.
- `pnpm typecheck` checks both TypeScript packages. `pnpm build` builds both for production.
- `pnpm db:generate` creates schema migrations. Review the generated SQL and apply it locally with `pnpm db:migrate`. Add a new migration for changes to an already deployed schema.

## Coding and Verification

Use TypeScript with two-space indentation. Use PascalCase for React components, camelCase for functions and variables, and kebab-case for component and feature filenames. Reuse shared UI controls and preserve Vietnamese and English labels through `useTranslation`. Keep role and ownership checks on the API.

The workspace declares no test runner, coverage threshold, or lint/format script. Run type checking and verify affected workflows locally. For UI changes, check desktop, mobile, and keyboard navigation. For API or data changes, verify role boundaries and failure cases against a disposable PostgreSQL database.

## Commits and Pull Requests

Use short, descriptive commit subjects. Recent commits commonly use `feat:` and `fix:` prefixes. Explain what changed, how you verified it, and any migration or configuration steps in the PR. Link the issue when available and include screenshots for visible UI changes. Keep secrets and local `.env` files out of Git.
