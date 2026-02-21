# Coding Conventions

**Analysis Date:** 2026-02-21

## Naming Patterns

**Files:**

- Use lowercase kebab-case for source and test files (examples: `src/mastra/guide-context.ts`, `src/scraper/link-rewrite.ts`, `src/mastra/evals/fishing-30-55.eval.test.ts`).
- Keep domain groupings in path names (`src/scraper/*`, `src/mastra/*`, `src/cli/scrape/*`).

**Functions:**

- Use `camelCase` for functions and helpers (examples: `runScrape`, `parseCharacterExport`, `extractLevelRange`, `printCommandError`).
- Use verb-first names for actions (`loadGuideContext`, `saveGuideContext`, `buildSkillRoutePlan`, `searchLocalWiki`).

**Variables:**

- Use `camelCase` for local variables (`normalizedQuestion`, `writeStats`, `projectRoot` pattern as `PROJECT_ROOT` only for constants).
- Use boolean prefixes like `is*`/`has*` for predicates (`isJsonModeArgv`, `hasExplicitLevelRange`, `isErrnoException`).

**Types:**

- Use `PascalCase` for interfaces/types (`GuideContext`, `ScrapeRunResult`, `WikiSearchResult`, `EvalResult`).
- Use `UPPER_SNAKE_CASE` for top-level constants (`SUPPORTED_COLLECTIONS`, `SKILL_NAMES`, `REQUEST_INTERVAL_MS`).

## Code Style

**Formatting:**

- Use Prettier via `package.json` scripts (`format`, `format:check`) with project defaults; no `.prettierrc` file is detected.
- Apply 2-space indentation, semicolons, and double quotes consistently (examples across `src/main.ts`, `src/mastra/guide.ts`, `src/scraper/writers.ts`).
- Respect formatting exclusions in `.prettierignore` (`data/raw/`, `reports/`, build outputs).

**Linting:**

- Use ESLint flat config in `eslint.config.mjs` with TypeScript recommended rules.
- Keep `no-console` disabled for CLI-oriented modules (`src/mastra/*.ts`, `src/scraper/index.ts`, `src/cli/*`).
- Keep lint scope focused to TypeScript files (`files: ["**/*.ts"]`) and ignore generated/output directories (`dist/**`, `data/raw/**`, `reports/**`).

## Import Organization

**Order:**

1. Node built-ins with `node:` prefix (`src/mastra/guide-context.ts`, `src/scraper/writers.ts`, `src/mastra/evals/fishing-30-55.eval.test.ts`)
2. Third-party packages (`@mastra/*`, `@oclif/core`, `cheerio`, `zod`, `ora`)
3. Local project imports using relative paths and `.js` extensions (`src/cli/scrape-command.ts`, `src/mastra/index.ts`, `src/scraper/collections.ts`)

**Path Aliases:**

- Not detected; use relative imports only (for example `../cli-output.js`, `./types.js`, `../../scraper/types.js`).

## Error Handling

**Patterns:**

- Throw `Error` with actionable messages for invalid input and missing prerequisites (`src/mastra/search.ts`, `src/mastra/workflows/answer-skill-question-workflow.ts`, `src/mastra/wiki-workspace.ts`).
- In catch paths, accept `unknown` and narrow to message safely with `instanceof Error` or helper (`src/cli-output.ts`, `src/scraper/collections.ts`, `src/mastra/guide-context.ts`).
- Use fail-fast guards and early returns before deeper execution (`src/mastra/index.ts`, `src/mastra/guide.ts`, `src/cli/scrape-command.ts`).

## Logging

**Framework:** console

**Patterns:**

- Use `console.log` for human CLI output (`src/mastra/ask.ts`, `src/mastra/wiki.ts`, `src/mastra/guide.ts`, `src/scraper/index.ts`).
- Use structured JSON output via `printJson` when `--json` is enabled (`src/cli-output.ts`, `src/cli/scrape-command.ts`, `src/mastra/evals/fishing-30-55.eval.ts`).
- Use `process.stderr.write` for command errors through a shared utility (`src/cli-output.ts`).

## Comments

**When to Comment:**

- Keep comments sparse and only for intent that is not obvious from code.
- Prefer short contextual comments in tests for conditional skips and fixtures (`src/mastra/guide-context.test.ts`, `src/mastra/evals/fishing-30-55.eval.test.ts`).

**JSDoc/TSDoc:**

- Not detected in `src/**/*.ts`; prefer expressive types and names over docblocks.

## Function Design

**Size:**

- Keep command entrypoints small and delegate work to helpers (`src/main.ts`, `src/mastra/ask.ts`, `src/mastra/search.ts`).
- Allow larger domain modules when they encapsulate one workflow/parser concern (`src/scraper/collections.ts`, `src/scraper/extract.ts`, `src/mastra/guide-context.ts`).

**Parameters:**

- Prefer typed object parameters for multi-option flows (`runScrape(options)`, `buildCollection(input)`, `createStep({ inputSchema, outputSchema, execute })`).
- Use optional options objects for extensibility (`searchLocalWiki(query, options?)`, `runLocalSkillQuestion(question, options?)`).

**Return Values:**

- Return typed object payloads instead of tuples (`ScrapeRunResult`, `GuideAskResult`, `EvalResult`).
- Use `null` only where absence is expected and explicitly handled (`tryAnswerWithWikiCoach`, `extractTargetLevel`, `readSourceOldidFromMarkdown`).

## Module Design

**Exports:**

- Export focused public functions/types per module (`src/scraper/index.ts`, `src/mastra/index.ts`, `src/cli-output.ts`).
- Keep internal helpers unexported within the same file (`src/mastra/guide-context.ts`, `src/scraper/extract.ts`, `src/scraper/writers.ts`).

**Barrel Files:**

- Minimal barrel usage; only re-export constants/types where needed (`src/scraper/index.ts` re-exports from `src/scraper/types.ts`).

---

_Convention analysis: 2026-02-21_
