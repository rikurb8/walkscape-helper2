# WalkScape Helper

`walkscape-helper` turns the WalkScape wiki into a local, queryable knowledge base for progression planning.

It is designed for a local-first workflow:

- scrape and normalize wiki content into docs + structured data;
- search and inspect that data locally;
- ask progression questions against local content;
- evaluate answer quality with repeatable checks.

## What this project does

At a high level, this repository combines three capabilities:

1. **Wiki ingestion pipeline** (`scrape`): fetches selected wiki sections, cleans and transforms HTML, extracts tabular data, rewrites links, and writes deterministic outputs.
2. **Local knowledge access** (`wiki:search`, docs site): lets you browse and keyword-search what was scraped.
3. **Route-planning assistant workflow** (`ask`, `eval:fishing`): uses local scraped data in a deterministic planning workflow to answer skill progression questions.

Supported scrape collections:

- `skills`
- `core-mechanics`
- `activities` (plus linked activity pages from the Activities table)
- `recipes`

## Quick start

```bash
pnpm install
pnpm scrape
pnpm ask "how to get from fishing 35 to 50?"
```

Optional next commands:

```bash
pnpm wiki:search "magnet fishing location"
pnpm docs:dev
pnpm eval:fishing
```

## Typical workflow

1. **Build local snapshot**: run `pnpm scrape` (or `pnpm scrape --incremental`).
2. **Inspect data**: use `pnpm wiki:search "..."` and/or browse docs with `pnpm docs:dev`.
3. **Ask planning questions**: run `pnpm ask "..."` for level-by-level routes.
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
pnpm scrape --collections skills --collections recipes
pnpm scrape skills,activities
pnpm scrape --print-docs
```

Behavior notes:

- if no collections are passed, all supported collections are scraped;
- incremental mode skips unchanged pages using `source_oldid`;
- progress is streamed in collect/write phases with warnings surfaced during the run.

### Ask progression questions

```bash
pnpm ask "how to get from fishing 35 to 50?"
```

### Search local wiki index

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
