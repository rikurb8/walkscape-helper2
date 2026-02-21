# External Integrations

**Analysis Date:** 2026-02-21

## APIs & External Services

**Content Source (Wiki):**

- WalkScape MediaWiki API - scraped source data for sections/pages.
  - SDK/Client: native `fetch` + `URLSearchParams` in `src/scraper/api.ts`.
  - Auth: none detected (public endpoint `https://wiki.walkscape.app/api.php` in `src/scraper/api.ts`).

**LLM Provider:**

- OpenAI models through Mastra agent runtime - optional answer generation/formatting for wiki and progression responses.
  - SDK/Client: Mastra agent stack (`@mastra/core`, `@mastra/memory`) in `src/mastra/agents/wiki-coach-agent.ts` and `src/mastra/index.ts`.
  - Auth: `OPENAI_API_KEY` environment variable checked in `src/mastra/index.ts`.

## Data Storage

**Databases:**

- Local LibSQL/SQLite file store.
  - Connection: local file URL `file:./mastra.db` configured in `src/mastra/index.ts`.
  - Client: `@mastra/libsql` (`LibSQLStore`) in `src/mastra/index.ts`.

**File Storage:**

- Local filesystem only.
  - Scraped docs/raw/report artifacts in `docs/wiki/`, `data/raw/`, and `reports/` written by `src/scraper/writers.ts`.
  - User profile context in `.walkscape/guide-context.json` handled by `src/mastra/guide-context.ts`.

**Caching:**

- In-memory runtime cache only.
  - Fetch dedupe cache (`Map`) during scrape collection in `src/scraper/collections.ts`.
  - Workspace initialization promise cache in `src/mastra/wiki-workspace.ts`.

## Authentication & Identity

**Auth Provider:**

- OpenAI API key for optional LLM calls.
  - Implementation: environment-variable gate (`process.env.OPENAI_API_KEY`) before agent generation in `src/mastra/index.ts`.

## Monitoring & Observability

**Error Tracking:**

- None detected (no third-party error tracking SDK imports in `src/**/*.ts`).

**Logs:**

- Console-based CLI output and command error rendering via `src/cli-output.ts`, `src/main.ts`, and command modules in `src/mastra/*.ts`.
- Scrape run metadata persisted as JSON report (`reports/scrape_report.json`) from `src/scraper/writers.ts`.

## CI/CD & Deployment

**Hosting:**

- Not applicable for hosted runtime; project operates as local CLI and local docs build (`README.md`, `package.json`).

**CI Pipeline:**

- GitHub Actions CI in `.github/workflows/ci.yml` (checkout, pnpm setup, Node 22, `task ci`).

## Environment Configuration

**Required env vars:**

- `OPENAI_API_KEY` for AI-generated answers in `src/mastra/index.ts`.
- No required env vars detected for scraper access to `https://wiki.walkscape.app/api.php` in `src/scraper/api.ts`.

**Secrets location:**

- Environment variables from shell/CI process (`process.env` usage in `src/mastra/index.ts`).
- No tracked `.env*` files detected at repository root.

## Webhooks & Callbacks

**Incoming:**

- None detected (no HTTP server endpoints or webhook handlers in `src/**/*.ts`).

**Outgoing:**

- MediaWiki API HTTP requests from `src/scraper/api.ts`.
- OpenAI model generation calls initiated through Mastra agent in `src/mastra/index.ts` and `src/mastra/agents/wiki-coach-agent.ts`.

---

_Integration audit: 2026-02-21_
