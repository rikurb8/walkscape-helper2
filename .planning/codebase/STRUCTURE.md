# Codebase Structure

**Analysis Date:** 2026-02-21

## Directory Layout

```text
walkscape-helper2/
├── src/                 # TypeScript source for CLI, scraper, and Mastra runtime
├── docs/                # Generated VitePress wiki docs and site config
├── data/raw/            # Generated raw MediaWiki parse payloads and structured table JSON
├── reports/             # Generated scrape/eval reports
├── .github/workflows/   # CI pipeline definitions
├── .planning/codebase/  # Codebase mapping documents for GSD workflows
├── dist/                # TypeScript build output (compiled JS)
├── .walkscape/          # Local user runtime context (guide profile JSON)
├── package.json         # Scripts, dependencies, and runtime tooling
└── tsconfig.json        # TypeScript compiler settings
```

## Directory Purposes

**`src/`:**

- Purpose: Primary application code.
- Contains: CLI wrappers, scraper pipeline, Mastra runtime/services/tools/workflows.
- Key files: `src/main.ts`, `src/cli/scrape-command.ts`, `src/scraper/index.ts`, `src/mastra/index.ts`.

**`src/cli/`:**

- Purpose: Scrape-command CLI orchestration and terminal presentation helpers.
- Contains: args/flags parsing, progress formatting, saved-doc preview, help text.
- Key files: `src/cli/scrape-command.ts`, `src/cli/scrape/collections.ts`, `src/cli/scrape/progress.ts`.

**`src/scraper/`:**

- Purpose: Remote wiki ingestion and deterministic artifact generation.
- Contains: MediaWiki API client, collection discovery, extraction, writers, contracts.
- Key files: `src/scraper/api.ts`, `src/scraper/collections.ts`, `src/scraper/extract.ts`, `src/scraper/writers.ts`, `src/scraper/types.ts`.

**`src/mastra/`:**

- Purpose: Local Q&A/planning runtime over scraped artifacts.
- Contains: runtime wiring, CLI commands, local data services, agent/tools/workflows, evals.
- Key files: `src/mastra/index.ts`, `src/mastra/wiki-workspace.ts`, `src/mastra/wiki-store.ts`, `src/mastra/skill-route-planner.ts`, `src/mastra/guide-context.ts`.

**`docs/`:**

- Purpose: Generated browsable wiki snapshot and VitePress site metadata.
- Contains: `docs/wiki/**/*.md`, `docs/index.md`, `docs/.vitepress/config.mts`.
- Key files: `docs/.vitepress/config.mts`, `docs/wiki/skills/index.md`.

**`data/raw/`:**

- Purpose: Generated machine-readable scrape artifacts used by search/planning.
- Contains: `*_parse.json` payloads and `*_structured.json` table extracts under per-collection subdirs.
- Key files: `data/raw/skills/*.json`, `data/raw/activities/*.json`.

**`reports/`:**

- Purpose: Run metadata and scrape/eval summaries.
- Contains: scrape reports and phase reports.
- Key files: `reports/scrape_report.json`, `reports/skills_scrape_report.json`.

## Key File Locations

**Entry Points:**

- `src/main.ts`: scrape CLI bootstrap and top-level error path.
- `src/mastra/wiki.ts`: wiki Q&A command entrypoint.
- `src/mastra/guide.ts`: guide profile and context-aware Q&A command entrypoint.
- `src/mastra/ask.ts`: route-planner-only command entrypoint.
- `src/mastra/search.ts`: local wiki BM25 search command entrypoint.

**Configuration:**

- `package.json`: scripts and dependency graph.
- `tsconfig.json`: TypeScript strict NodeNext compiler configuration.
- `docs/.vitepress/config.mts`: docs nav/sidebar generation from `docs/wiki/`.
- `.github/workflows/ci.yml`: CI setup and `task ci` execution.
- `Taskfile.yml`: local quality/build task runner aliases.

**Core Logic:**

- `src/scraper/index.ts`: scrape orchestration contract (`runScrape`, `printScrapeSummary`).
- `src/scraper/collections.ts`: collection/page discovery and fetch orchestration.
- `src/scraper/writers.ts`: output write pipeline + incremental logic + report emission.
- `src/mastra/index.ts`: runtime orchestration and question routing.
- `src/mastra/workflows/answer-skill-question-workflow.ts`: deterministic progression flow.

**Testing:**

- `src/mastra/guide-context.test.ts`: guide-context parser and integration-like behavior checks.
- `src/mastra/evals/fishing-30-55.eval.test.ts`: eval contract test for route quality.

## Naming Conventions

**Files:**

- Use lowercase kebab-case for most source files: `src/cli/scrape-command.ts`, `src/mastra/skill-route-planner.ts`.
- Keep CLI command files named after command intent: `src/mastra/wiki.ts`, `src/mastra/guide.ts`, `src/mastra/ask.ts`.
- Use suffix-based semantics for test/eval and helper categories: `*.test.ts`, `*.eval.ts`, `*-tool.ts`, `*-workflow.ts`.

**Directories:**

- Organize by domain boundary first, then sub-capability: `src/scraper/`, `src/mastra/tools/`, `src/mastra/workflows/`, `src/cli/scrape/`.
- Mirror generated output directories to collection slugs: `docs/wiki/skills/`, `data/raw/skills/`, `data/raw/activities/`.

## Where to Add New Code

**New Feature:**

- Primary code: add under domain module in `src/scraper/` (ingestion/output features) or `src/mastra/` (Q&A/planning features).
- Tests: add co-located node:test files as `*.test.ts` near changed module (for example `src/mastra/<feature>.test.ts`).

**New Component/Module:**

- Implementation: place by role under `src/mastra/tools/` (tool adapters), `src/mastra/workflows/` (multi-step typed flows), `src/cli/scrape/` (scrape CLI helpers), or `src/scraper/` (pipeline stages).

**Utilities:**

- Shared scraper helpers: extend `src/scraper/utils.ts`.
- Cross-command output helpers: extend `src/cli-output.ts`.
- Mastra-specific helper utilities: keep inside `src/mastra/` near the consumer instead of globalizing.

## Special Directories

**`dist/`:**

- Purpose: Compiled output from `pnpm build` (`tsc -p tsconfig.json`).
- Generated: Yes.
- Committed: Yes (currently present in repository root).

**`docs/wiki/`:**

- Purpose: Generated markdown wiki snapshot consumed by docs site and local tooling.
- Generated: Yes (written by `src/scraper/writers.ts`).
- Committed: Yes.

**`data/raw/`:**

- Purpose: Generated raw/structured scrape data consumed by `src/mastra/wiki-workspace.ts` and `src/mastra/wiki-store.ts`.
- Generated: Yes.
- Committed: Yes.

**`.walkscape/`:**

- Purpose: Local runtime profile state for guide context (`.walkscape/guide-context.json`).
- Generated: Yes (written by `src/mastra/guide-context.ts`).
- Committed: No (workspace-local user state).

---

_Structure analysis: 2026-02-21_
