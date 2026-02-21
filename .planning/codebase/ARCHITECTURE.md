# Architecture

**Analysis Date:** 2026-02-21

## Pattern Overview

**Overall:** Layered CLI + pipeline architecture with two domain subsystems (scraper ingestion and local Q&A/planning).

**Key Characteristics:**

- Thin command entrypoints route into domain orchestration (`src/main.ts`, `src/mastra/wiki.ts`, `src/mastra/guide.ts`, `src/mastra/ask.ts`, `src/mastra/search.ts`).
- Scraper subsystem is a deterministic collect -> transform -> write pipeline (`src/scraper/index.ts`, `src/scraper/collections.ts`, `src/scraper/extract.ts`, `src/scraper/writers.ts`).
- Mastra subsystem composes local retrieval/planning services with optional AI formatting (`src/mastra/index.ts`, `src/mastra/wiki-workspace.ts`, `src/mastra/skill-route-planner.ts`, `src/mastra/agents/wiki-coach-agent.ts`).

## Layers

**CLI Entrypoint Layer:**

- Purpose: Parse user intent, choose mode (`--json` vs human), and render terminal output.
- Location: `src/main.ts`, `src/cli/scrape-command.ts`, `src/mastra/wiki.ts`, `src/mastra/guide.ts`, `src/mastra/ask.ts`, `src/mastra/search.ts`.
- Contains: argv parsing, usage validation, output rendering, top-level error printing.
- Depends on: Domain APIs in `src/scraper/index.ts` and `src/mastra/index.ts`, plus helpers in `src/cli-output.ts`.
- Used by: `pnpm scrape`, `pnpm wiki`, `pnpm guide`, `pnpm ask`, `pnpm wiki:search` from `package.json`.

**Scraper Domain Layer:**

- Purpose: Build local wiki artifacts from remote MediaWiki pages.
- Location: `src/scraper/index.ts`, `src/scraper/types.ts`, `src/scraper/collections.ts`, `src/scraper/api.ts`, `src/scraper/extract.ts`, `src/scraper/link-rewrite.ts`, `src/scraper/writers.ts`, `src/scraper/utils.ts`.
- Contains: collection discovery, rate-limited fetches, HTML/table extraction, markdown/link normalization, incremental writes, report generation.
- Depends on: MediaWiki HTTP endpoint in `src/scraper/api.ts`, filesystem writes in `src/scraper/writers.ts`.
- Used by: CLI orchestration in `src/cli/scrape-command.ts` and downstream consumers reading `data/raw/`, `docs/wiki/`, and `reports/scrape_report.json`.

**Mastra Orchestration Layer:**

- Purpose: Coordinate workflows, agent/tool runtime, and question routing.
- Location: `src/mastra/index.ts`, `src/mastra/workflows/answer-skill-question-workflow.ts`, `src/mastra/agents/wiki-coach-agent.ts`.
- Contains: Mastra runtime setup, progression/wikified question dispatch, workflow run lifecycle, AI usage collection.
- Depends on: Retrieval/planning services in `src/mastra/wiki-workspace.ts`, `src/mastra/wiki-store.ts`, `src/mastra/skill-route-planner.ts`.
- Used by: Mastra CLI commands `src/mastra/wiki.ts`, `src/mastra/guide.ts`, `src/mastra/ask.ts`, evals in `src/mastra/evals/fishing-30-55.eval.ts`.

**Local Data Services Layer:**

- Purpose: Serve deterministic local data access for search and route planning.
- Location: `src/mastra/wiki-workspace.ts`, `src/mastra/wiki-store.ts`, `src/mastra/skill-route-planner.ts`, `src/mastra/guide-context.ts`.
- Contains: BM25 indexing/search over local artifacts, skill activity parsing, route segmentation logic, persisted player context.
- Depends on: Generated artifacts in `data/raw/` and local context file `.walkscape/guide-context.json` (managed by `src/mastra/guide-context.ts`).
- Used by: Mastra orchestration in `src/mastra/index.ts` and tools in `src/mastra/tools/*.ts`.

## Data Flow

**Scrape Pipeline Flow:**

1. `src/main.ts` forwards CLI args into `runScrapeCommandCli()` in `src/cli/scrape-command.ts`.
2. `src/cli/scrape-command.ts` parses collections/flags and calls `runScrape()` in `src/scraper/index.ts`.
3. `src/scraper/collections.ts` discovers pages and fetches parsed HTML via `fetchParsedPage()` in `src/scraper/api.ts` (rate-limited).
4. `src/scraper/extract.ts` converts HTML into normalized markdown + structured table payloads.
5. `src/scraper/writers.ts` rewrites internal links, writes deterministic outputs to `docs/wiki/` and `data/raw/`, then writes `reports/scrape_report.json`.

**Q&A / Planning Flow:**

1. `src/mastra/wiki.ts`, `src/mastra/guide.ts`, or `src/mastra/ask.ts` collects question text and calls functions in `src/mastra/index.ts`.
2. `src/mastra/index.ts` routes to progression workflow (`runLocalSkillQuestion`) or retrieval flow (`runLocalWikiQuestion`).
3. Progression path runs `answerSkillQuestionWorkflow` in `src/mastra/workflows/answer-skill-question-workflow.ts`, which calls `buildSkillRoutePlan()` in `src/mastra/skill-route-planner.ts`.
4. Wiki retrieval path queries local BM25 search via `searchLocalWiki()` in `src/mastra/wiki-workspace.ts` over indexed files from `data/raw/**/*_parse.json`.
5. If `OPENAI_API_KEY` exists, `src/mastra/index.ts` asks `wikiCoachAgent` in `src/mastra/agents/wiki-coach-agent.ts` to format grounded answers; otherwise it returns deterministic fallback/structured outputs.

**State Management:**

- Scrape run state is ephemeral and passed through function parameters/events (`src/scraper/types.ts`).
- Search workspace is a lazy singleton initialized once per process in `src/mastra/wiki-workspace.ts` (`workspaceInitPromise`).
- Guide profile state is persisted in JSON and normalized on load/save in `src/mastra/guide-context.ts`.

## Key Abstractions

**CollectionResult / PageRecord Contracts:**

- Purpose: Represent discovered pages and normalized scrape units across collect/write phases.
- Examples: `src/scraper/types.ts`, created in `src/scraper/collections.ts`, consumed in `src/scraper/writers.ts`.
- Pattern: Typed pipeline DTOs passed between pure-ish orchestration stages.

**Answer Skill Workflow:**

- Purpose: Enforce parse -> plan -> format steps with typed IO validation.
- Examples: `src/mastra/workflows/answer-skill-question-workflow.ts`.
- Pattern: Step-based workflow with zod schemas and deterministic planning core.

**Tool Facades over Local Services:**

- Purpose: Expose internal services to agent/workflow runtime through narrow, validated interfaces.
- Examples: `src/mastra/tools/wiki-skill-data-tool.ts`, `src/mastra/tools/skill-route-planner-tool.ts`, `src/mastra/tools/wiki-workspace-search-tool.ts`.
- Pattern: `createTool` wrappers with explicit input/output schemas.

## Entry Points

**Scrape CLI Entrypoint:**

- Location: `src/main.ts`.
- Triggers: `pnpm scrape` script in `package.json`.
- Responsibilities: Detect `--json`, run scrape command CLI, centralize top-level error handling.

**Scrape Command Module:**

- Location: `src/cli/scrape-command.ts`.
- Triggers: Called by `src/main.ts`.
- Responsibilities: Parse flags/args, handle TTY progress UX, invoke `runScrape()`, shape human/JSON output.

**Mastra Runtime Entrypoint:**

- Location: `src/mastra/index.ts`.
- Triggers: Imported by `src/mastra/wiki.ts`, `src/mastra/guide.ts`, `src/mastra/ask.ts`, and eval modules.
- Responsibilities: Configure Mastra runtime, expose `runLocalWikiQuestion()` and `runLocalSkillQuestion()` APIs.

**Question Command Entrypoints:**

- Location: `src/mastra/wiki.ts`, `src/mastra/guide.ts`, `src/mastra/ask.ts`, `src/mastra/search.ts`.
- Triggers: Scripts `pnpm wiki`, `pnpm guide`, `pnpm ask`, `pnpm wiki:search` in `package.json`.
- Responsibilities: Validate user input, call runtime APIs, print human or machine-readable output.

## Error Handling

**Strategy:** Fail fast on invalid inputs/missing data, convert unknown errors into CLI-safe messages at command boundaries.

**Patterns:**

- Command wrappers catch `unknown` and format output via `printCommandError()` in `src/cli-output.ts`.
- Domain layers throw descriptive `Error` messages for parse/fetch/data issues (`src/scraper/api.ts`, `src/scraper/collections.ts`, `src/mastra/workflows/answer-skill-question-workflow.ts`, `src/mastra/skill-route-planner.ts`).
- Fallback behavior is explicit for optional AI paths (`src/mastra/index.ts`: return no-answer/null and either fall back to search or throw API-key guidance).

## Cross-Cutting Concerns

**Logging:** Primarily CLI console output and progress events in `src/cli/scrape-command.ts`, `src/scraper/index.ts`, and `src/mastra/*` command files.
**Validation:** Argument and payload validation is split between CLI checks (`src/cli/scrape/collections.ts`, `src/mastra/guide.ts`) and zod workflow/tool schemas (`src/mastra/workflows/answer-skill-question-workflow.ts`, `src/mastra/tools/*.ts`).
**Authentication:** External auth is environment-based for AI only (`OPENAI_API_KEY` gate checks in `src/mastra/index.ts`); wiki scraping currently uses public MediaWiki endpoints in `src/scraper/api.ts`.

---

_Architecture analysis: 2026-02-21_
