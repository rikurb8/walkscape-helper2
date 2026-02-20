# WalkScape Helper

> 🧭⚒️🌲 `local wiki + progression planning` 🌊📜✨

`walkscape-helper` is a CLI driven helper for Walkscape. It turns the WalkScape wiki into a local, queryable knowledge base for progression planning. Other game related functionality will be added later (gear optimizer, ...)

The project is centered around four concepts:

- `scrape`: build and refresh your local wiki snapshot (incremental by default);
  - Incremental mode compares wiki revision IDs and skips unchanged pages to minimize requests.
  - Extracted tables are also written as structured JSON (`data/raw/*_structured.json`) alongside cleaned markdown.
  - Outputs include cleaned markdown pages (`docs/wiki/`), raw API snapshots, structured data, and a scrape report.
- `wiki`: ask questions using only local wiki content;
  - Scraped pages live in a rich directory hierarchy (`docs/wiki/recipes/carpentry/cut-a-teak-plank.md`); frontmatter carries source metadata, the body contains cleaned content with tables rendered inline.
  - Questions are matched against the local index with BM25 search; top results are passed to an AI agent that returns a grounded, source-cited answer.
- `guide`: ask context-aware questions using your own character profile + local wiki data;
  - Stores your player profile locally (username + skill levels parsed from a character export).
  - Character exports can be copied to clipboard from in-game settings and piped straight into the CLI.
  - Questions are routed to a progression planner or wiki Q&A, personalized with your profile context.
- `evals`: run repeatable quality checks so you can track response quality as prompts/tools evolve over time.
  - Each eval runs a fixed question through the pipeline and checks route segments + keyword coverage against expected answers.
  - Scores are deterministic and comparable across prompt, model, or tooling changes.

CLI output modes:

- by default human mode, every operation is optimized for human terminal use;
- add `--json` to any operation for machine-readable output (automation/AI workflows).

## Try it out

```bash
# 1) Install dependencies
pnpm install

# 2) Build your local wiki snapshot
#    - incremental mode is enabled by default
pnpm scrape

# 3) Ask a wiki-only question (no player context)
pnpm wiki "where can i train fishing around level 50?"

# 4) Set up your personal guide context
pnpm guide set --username Riku1

# 5) Import the included sample character export
#    - this file stores skills as XP values
#    - guide converts those XP values to estimated current levels
pnpm guide import --character-export-file ./example-character-export.json

# 5b) Import JSON from clipboard via stdin (macOS)
#     - useful when an export is copied to your clipboard
pbpaste | pnpm guide import

# 6) Inspect what guide saved locally
pnpm guide show

# 7) Ask a context-aware progression question
#    - guide can infer your current level from imported profile
pnpm guide ask "how do i get fishing to 70?"

# 7b) Get machine-readable output for AI agents/tools
pnpm guide ask --json "how do i get fishing to 70?"

# 8) Optional: compare with raw search matches
pnpm wiki:search "magnet fishing location"

# 9) Run evals to track quality over time
pnpm eval:fishing
```

## What this project does

At a high level, this repository combines four capabilities:

1. **Wiki ingestion pipeline** (`scrape`): hits the MediaWiki API for selected collections, cleans HTML, extracts tables into structured JSON, rewrites internal links for the local docs site, and writes cleaned markdown with frontmatter. Incremental mode compares revision IDs (`source_oldid`) to skip unchanged pages. Outputs land in `docs/wiki/` (markdown), `data/raw/` (parse snapshots + structured data), and `reports/` (run metadata).
2. **Local knowledge access** (`wiki`, `wiki:search`, docs site): indexes all parse snapshots with BM25 full-text search. `wiki:search` returns raw ranked matches; `wiki` passes the top results to an AI agent that produces a grounded, source-cited answer. The docs site is a VitePress build generated from scraped markdown with auto-configured sidebar navigation.
3. **Personal guide** (`guide`): persists a local player profile (username + skill levels) in `.walkscape/guide-context.json`. Character exports are parsed with flexible JSON traversal and XP values are auto-converted to estimated levels. Questions are routed to either a deterministic progression-planning workflow (when a skill + target level is detected) or the wiki Q&A agent, both personalized with the stored profile.
4. **Quality evaluations** (`eval:fishing`): runs a fixed question through the full pipeline, then checks route segments against expected ranges and scores the AI answer with keyword-coverage metrics. Results are deterministic and comparable across prompt, model, or tooling changes.

## Supported scrape collections

Currently data is only fetched for the following collections. Wiki has lots more (routes, items, ...) that we can also fetch when needed.

- `skills`
- `core-mechanics`
- `activities` (plus linked activity pages from the Activities table)
- `recipes`

## CLI usage

### Scrape

```bash
pnpm scrape
```

Useful variants:

```bash
pnpm scrape --help
pnpm scrape --incremental
pnpm scrape --full
pnpm scrape --collections skills --collections recipes
pnpm scrape skills,activities
pnpm scrape --print-docs
pnpm scrape --json
```

Behavior notes:

- if no collections are passed, all supported collections are scraped;
- incremental mode skips unchanged pages using `source_oldid` (enabled by default);
- use `--full` when you want to force a complete rewrite;
- progress is streamed in collect/write phases with warnings surfaced during the run.

### Wiki questions

```bash
pnpm wiki "best fishing activity around level 40"
# machine-readable mode
pnpm wiki --json "best fishing activity around level 40"
```

### Guide (personal context-aware assistant)

Save username:

```bash
pnpm guide set --username your_name
pnpm guide set --json --username your_name
```

Import character export:

```bash
pnpm guide import --character-export-file ./example-character-export.json
# or
pnpm guide import --character-export-json '{"username":"your_name","skills":{"fishing":{"level":35}}}'
# or pipe JSON into stdin (macOS clipboard example)
pbpaste | pnpm guide import
# machine-readable mode
pnpm guide import --json --character-export-file ./example-character-export.json
```

Notes:

- the importer accepts either direct skill levels or skill XP values;
- when XP values are provided, guide estimates current levels before using them for route planning.

Ask with context:

```bash
pnpm guide ask "how do i get fishing to 55?"
pnpm guide ask --json "how do i get fishing to 55?"
```

Inspect/reset context:

```bash
pnpm guide show
pnpm guide reset
pnpm guide show --json
pnpm guide reset --json
```

### Search local wiki index (raw match mode)

```bash
pnpm wiki:search "best fishing activity around level 40"
pnpm wiki:search --json "best fishing activity around level 40"
```

### Route-only ask (skill planner)

```bash
pnpm ask "how to get from fishing 35 to 50?"
pnpm ask --json "how to get from fishing 35 to 50?"
```

### Evals

```bash
pnpm eval:fishing
pnpm eval:fishing --json
```

## Outputs you should expect

After a scrape, key artifacts are written to:

- `docs/wiki/...` for cleaned markdown pages used for browsing;
- `data/raw/*_parse.json` for raw MediaWiki parse snapshots;
- `data/raw/*_structured.json` for extracted table-oriented payloads;
- `reports/scrape_report.json` for run metadata and summary;
- `docs/.vitepress/config.mts` for generated docs navigation/sidebar.

Representative docs outputs:

- `docs/wiki/skills/index.md` and `docs/wiki/skills/*.md`
- `docs/wiki/core-mechanics/index.md`
- `docs/wiki/activities/index.md` and `docs/wiki/activities/*.md`
- `docs/wiki/recipes/index.md`

## Repository map

- `src/main.ts`: scrape CLI bootstrap and top-level error handling.
- `src/cli/`: scrape command CLI module (args/flags, progress/output helpers).
- `src/scraper/index.ts`: scraper orchestration API (`runScrape`) and summary printing.
- `src/scraper/api.ts`: MediaWiki API access and request pacing.
- `src/scraper/collections.ts`: section/page discovery and collection assembly.
- `src/scraper/extract.ts`: HTML cleanup, table extraction, markdown conversion.
- `src/scraper/link-rewrite.ts`: internal link rewriting for generated docs.
- `src/scraper/writers.ts`: markdown/raw/report/docs-config writers.
- `src/mastra/index.ts`: local Q&A integration entrypoint.
- `src/mastra/wiki.ts`: wiki Q&A CLI command.
- `src/mastra/guide.ts`: guide context CLI command.
- `src/mastra/guide-context.ts`: guide context persistence + character export parsing.
- `src/mastra/workflows/answer-skill-question-workflow.ts`: deterministic route-planning workflow.
- `src/mastra/tools/*.ts`: local data + planning/search tools used by the workflow.
- `src/mastra/wiki-workspace.ts`: local wiki indexing and retrieval.
- `src/mastra/evals/fishing-30-55.eval.ts`: fixed fishing progression evaluation.

Module docs for faster discovery:

- `src/cli/README.md`
- `src/scraper/README.md`
- `src/mastra/README.md`

## Build, test, and quality checks

Primary checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm docs:build
```

If you use `go-task`, you can run the aggregate pipeline with:

```bash
task ci
```

## Docs and local tools

- Start docs dev server: `pnpm docs:dev` (typically `http://localhost:5173`).
- Build docs site: `pnpm docs:build`.
- Preview built docs: `pnpm docs:preview`.
- Start Mastra Studio/API: `pnpm mastra:dev` (typically `http://localhost:4111`).

## Recommended verification flow for changes

For scraper/knowledge-path changes, this sequence is usually enough:

```bash
pnpm build
pnpm scrape --collections skills --incremental
pnpm docs:build
```

Run a full scrape only when necessary (it performs network requests and rewrites generated outputs).
