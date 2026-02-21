# Codebase Concerns

**Analysis Date:** 2026-02-21

## Tech Debt

**Duplicated skill domain constants across modules:**

- Issue: The same skill list is hardcoded in multiple modules, so adding/renaming a skill requires synchronized manual edits.
- Files: `src/mastra/index.ts`, `src/mastra/guide.ts`, `src/mastra/guide-context.ts`, `src/mastra/workflows/answer-skill-question-workflow.ts`
- Impact: Drift between modules can break parsing, profile import, and route-planning behavior inconsistently.
- Fix approach: Centralize the skill list in one exported constant (for example in `src/mastra/skills.ts`) and import it everywhere.

**Large multi-responsibility files increase change risk:**

- Issue: Core modules combine orchestration, parsing, formatting, and persistence logic in single large files.
- Files: `src/scraper/collections.ts`, `src/scraper/extract.ts`, `src/scraper/writers.ts`, `src/mastra/guide.ts`, `src/mastra/index.ts`, `src/mastra/guide-context.ts`
- Impact: Small changes require broad context loading; regressions are easier to introduce and harder to isolate.
- Fix approach: Extract focused units (parse helpers, formatter helpers, I/O adapters) while preserving public APIs.

**Repeated HTML extraction logic in runtime paths:**

- Issue: Scraped HTML is parsed repeatedly in separate modules instead of reusing already-structured artifacts.
- Files: `src/mastra/wiki-store.ts`, `src/mastra/wiki-workspace.ts`, `src/scraper/extract.ts`, `data/raw/*_structured.json`
- Impact: CPU overhead and duplicated parsing rules increase maintenance and runtime cost.
- Fix approach: Load `*_structured.json` where possible and keep `extractDocument` primarily in scraper generation paths.

## Known Bugs

**Route and wiki commands fail when AI is unavailable, despite deterministic local pipeline:**

- Symptoms: `runLocalSkillQuestion` and `runLocalWikiQuestion` throw when `OPENAI_API_KEY` is unset or AI generation fails.
- Files: `src/mastra/index.ts`
- Trigger: Run `pnpm ask ...`, `pnpm wiki ...`, or `pnpm guide ask ...` without a working `OPENAI_API_KEY`.
- Workaround: Provide a valid `OPENAI_API_KEY`; otherwise command fails instead of returning local deterministic output.

**Progression path errors are silently swallowed and converted to wiki fallback:**

- Symptoms: Real route-planning failures are hidden, and users get a generic wiki answer path.
- Files: `src/mastra/index.ts`
- Trigger: Ask progression question with explicit range and hit any planning failure inside `runLocalSkillQuestion`.
- Workaround: Run progression route directly via `pnpm ask` and inspect thrown error message.

**Workspace index can become stale within long-lived process:**

- Symptoms: `searchLocalWiki` reuses one cached workspace and does not refresh after new scrape outputs are written.
- Files: `src/mastra/wiki-workspace.ts`, `src/scraper/writers.ts`
- Trigger: Re-scrape data in same running process/session and then search again.
- Workaround: Restart the process to force `workspaceInitPromise` reinitialization.

## Security Considerations

**Prompt-injection surface from untrusted wiki text into LLM prompts:**

- Risk: Retrieved content is inserted directly into prompts, so malicious/hostile wiki text can influence model behavior.
- Files: `src/mastra/index.ts`, `src/mastra/wiki-workspace.ts`, `src/mastra/agents/wiki-coach-agent.ts`
- Current mitigation: Instruction text says to use local data only, but there is no explicit prompt-hardening or content sanitization layer.
- Recommendations: Wrap excerpts in strict delimiters, add refusal rules for instruction-like content inside sources, and validate answer citations against selected IDs.

**Arbitrary local file read from import flag path:**

- Risk: `guide import --character-export-file` reads any user-provided filesystem path.
- Files: `src/mastra/guide.ts`
- Current mitigation: Not detected beyond normal OS file permissions.
- Recommendations: Restrict to expected extensions (for example `.json`), validate path exists/is file, and emit explicit warnings when absolute/system paths are used.

## Performance Bottlenecks

**Search startup re-indexes full raw corpus and reparses HTML:**

- Problem: First search call initializes workspace and indexes every `*_parse.json` file, including HTML -> markdown extraction per file.
- Files: `src/mastra/wiki-workspace.ts`, `src/scraper/extract.ts`
- Cause: `initializeWorkspace()` always traverses `data/raw` and calls `extractDocument` for each parse file.
- Improvement path: Persist an index build artifact keyed by scrape report/version and incrementally refresh only changed files.

**Potential duplicate indexing load (`autoIndexPaths` + manual index):**

- Problem: Workspace auto-indexes `/docs/wiki` and then manually indexes `data/raw/*_parse.json` content.
- Files: `src/mastra/wiki-workspace.ts`
- Cause: Both indexing paths are active in `initializeWorkspace()`.
- Improvement path: Choose a single canonical corpus (prefer structured/raw or docs, not both) or weight/scoped search namespaces explicitly.

**Route planning repeatedly sorts candidate subsets:**

- Problem: For each segment boundary, planner filters then sorts candidates to pick best activity.
- Files: `src/mastra/skill-route-planner.ts`
- Cause: `selectBestActivity()` performs sort work per boundary.
- Improvement path: Pre-sort once by efficiency and scan for first eligible candidate, or maintain level-indexed best choices.

## Fragile Areas

**Table extraction depends on unstable wiki markup conventions:**

- Files: `src/scraper/extract.ts`, `src/scraper/collections.ts`, `src/mastra/wiki-store.ts`
- Why fragile: Logic assumes specific section labels (`Activities`, `Consumables`) and column names (`Activity Name`, `Skills`, `Recipe Name`).
- Safe modification: Introduce normalized column mapping and fixture-based parser tests before changing table/heading handling.
- Test coverage: Gaps in parser-level tests for alternate table layouts and heading variants.

**Incremental skip detection depends on frontmatter parsing heuristics:**

- Files: `src/scraper/writers.ts`
- Why fragile: `readSourceOldidFromMarkdown()` scans a bounded line window and string prefixes; format drift can silently disable skip behavior.
- Safe modification: Parse frontmatter structurally (YAML parser) and validate required keys on write/read.
- Test coverage: No direct tests for incremental up-to-date detection edge cases.

**CLI argument parsing in guide flow is hand-rolled:**

- Files: `src/mastra/guide.ts`
- Why fragile: Flag lookup is custom and not schema-driven, making edge-case ordering/duplication handling brittle.
- Safe modification: Migrate to a structured parser (consistent with `@oclif/core` usage in scraper command) while keeping current UX strings.
- Test coverage: No dedicated tests for malformed combinations of `--character-export-file`, `--character-export-json`, stdin, and `--json`.

## Scaling Limits

**Single-threaded request pacing caps scrape throughput:**

- Current capacity: One request per ~500ms (`REQUEST_INTERVAL_MS = 500`) with no parallel fetch pipeline.
- Limit: Large collection scrapes scale linearly with page count and become slow as content grows.
- Scaling path: Add bounded concurrency with global rate-limiter tokens instead of strict serial waits.

**In-memory caches have no eviction strategy:**

- Current capacity: Unbounded growth for `pageCache` and workspace index over process lifetime.
- Limit: Memory pressure increases with corpus size and long-lived sessions.
- Scaling path: Add LRU/TTL policies and explicit cache reset hooks on scrape completion.

**Bulk indexing uses `Promise.all` without backpressure controls:**

- Current capacity: All parse files are transformed/indexed concurrently after discovery.
- Limit: High file counts can spike CPU/memory usage and degrade responsiveness.
- Scaling path: Use a concurrency limiter for `toIndexedDocument()` and `workspace.index()` tasks.

## Dependencies at Risk

**LLM provider dependency is hardcoded to one model path:**

- Risk: Behavior/cost can drift with provider changes; failures block user-facing answers in current implementation.
- Impact: Route and wiki command reliability depends on external model availability when fallback is not used.
- Migration plan: Add provider abstraction and default to deterministic local answer when LLM is unavailable.

**`marked-terminal` integration relies on `as any` cast:**

- Risk: Type/runtime API changes can break rendered saved docs without compile-time protection.
- Impact: `--print-docs` rendering path may fail unexpectedly on dependency updates.
- Migration plan: Replace cast with typed wrapper or isolate renderer behind runtime capability checks.

## Missing Critical Features

**Deterministic non-LLM answer fallback in CLI user flows:**

- Problem: Existing deterministic outputs are available (workflow route + search matches) but not returned when AI formatting fails.
- Blocks: Offline or keyless use of `pnpm ask`, `pnpm wiki`, and `pnpm guide ask` despite local corpus availability.

**Persistent/incremental search index lifecycle:**

- Problem: Search index is rebuilt at runtime rather than persisted with scrape artifacts.
- Blocks: Fast startup and predictable search performance on larger datasets.

## Test Coverage Gaps

**Scraper core pipeline largely untested:**

- What's not tested: API fetch behavior, collection derivation, HTML/table extraction edge cases, writer incremental cleanup logic.
- Files: `src/scraper/api.ts`, `src/scraper/collections.ts`, `src/scraper/extract.ts`, `src/scraper/writers.ts`
- Risk: Wiki markup or API response shifts can break ingestion/output contracts without early detection.
- Priority: High

**Mastra retrieval/indexing paths lack direct tests:**

- What's not tested: workspace initialization, indexing correctness, stale cache behavior, search result stability.
- Files: `src/mastra/wiki-workspace.ts`, `src/mastra/index.ts`
- Risk: Retrieval regressions surface only at runtime and are hard to diagnose.
- Priority: High

**Guide CLI parser and error-path matrix untested:**

- What's not tested: flag precedence, malformed import inputs, conflicting argument modes, stdin + flag interactions.
- Files: `src/mastra/guide.ts`
- Risk: User-facing CLI behavior can regress in edge cases without CI signal.
- Priority: Medium

---

_Concerns audit: 2026-02-21_
