# WalkScape Helper

`walkscape-helper` is a CLI driven helper for Walkscape. It turns the WalkScape wiki into a local, queryable knowledge base for progression planning.

The project is centered around four concepts:

- `scrape`: build and refresh your local wiki snapshot (incremental by default);
- `wiki`: ask questions using only local wiki content;
- `guide`: ask context-aware questions using your own character profile + local wiki data;
- `evals`: run repeatable quality checks so you can track response quality as prompts/tools evolve over time.

## Try it now

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

# 6) Inspect what guide saved locally
pnpm guide show

# 7) Ask a context-aware progression question
#    - guide can infer your current level from imported profile
pnpm guide ask "how do i get fishing to 70?"

# 8) Optional: compare with raw search matches
pnpm wiki:search "magnet fishing location"

# 9) Run evals to track quality over time
pnpm eval:fishing
```

## What this project does

At a high level, this repository combines four capabilities:

1. **Wiki ingestion pipeline** (`scrape`): fetches selected wiki sections, cleans and transforms HTML, extracts tabular data, rewrites links, and writes deterministic outputs.
2. **Local knowledge access** (`wiki`, `wiki:search`, docs site): lets you ask and keyword-search against what was scraped.
3. **Personal guide** (`guide`): stores your character context (username + levels from export) and answers progression questions with profile-aware defaults.
4. **Quality evaluations** (`eval:fishing`): runs stable progression evals so results can be compared over time after model/prompt/tooling changes.

Supported scrape collections:

- `skills`
- `core-mechanics`
- `activities` (plus linked activity pages from the Activities table)
- `recipes`

## Quick start

```bash
pnpm install
pnpm scrape
pnpm wiki "where can i train fishing around level 50?"
pnpm guide ask "how do i get fishing to 55?"
```

Optional next commands:

```bash
pnpm guide set --username your_name
pnpm guide import --character-export-file ./example-character-export.json
pnpm wiki:search "magnet fishing location"
pnpm docs:dev
pnpm eval:fishing
```

## Typical workflow

1. **Scrape**: run `pnpm scrape` to build/update local data (`incremental` is on by default).
2. **Wiki**: run `pnpm wiki "..."` for question-style lookup or `pnpm wiki:search "..."` for raw matches.
3. **Guide**: set/import context with `pnpm guide ...`, then ask profile-aware progression questions.
4. **Validate quality**: run tests/evals and build checks.

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
```

Behavior notes:

- if no collections are passed, all supported collections are scraped;
- incremental mode skips unchanged pages using `source_oldid` (enabled by default);
- use `--full` when you want to force a complete rewrite;
- progress is streamed in collect/write phases with warnings surfaced during the run.

### Wiki questions

```bash
pnpm wiki "best fishing activity around level 40"
```

### Guide (personal context-aware assistant)

Save username:

```bash
pnpm guide set --username your_name
```

Import character export:

```bash
pnpm guide import --character-export-file ./example-character-export.json
# or
pnpm guide import --character-export-json '{"username":"your_name","skills":{"fishing":{"level":35}}}'
```

Notes:

- the importer accepts either direct skill levels or skill XP values;
- when XP values are provided, guide estimates current levels before using them for route planning.

Ask with context:

```bash
pnpm guide ask "how do i get fishing to 55?"
```

Inspect/reset context:

```bash
pnpm guide show
pnpm guide reset
```

### Search local wiki index (raw match mode)

```bash
pnpm wiki:search "best fishing activity around level 40"
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

- `src/main.ts`: CLI entrypoint, flags, progress rendering.
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
