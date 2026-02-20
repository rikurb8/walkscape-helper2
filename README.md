# WalkScape Helper

WalkScape helper with wiki scraping and AI-powered Q&A. The default run scrapes all supported collections into structured markdown for AI use.

Supported collections: `skills`, `core-mechanics`, `activities` (including activity pages listed in the Activities table), and `recipes`.

## Code structure

- `src/main.ts` - oclif CLI entrypoint (`--help`, flags, and live progress spinner)
- `src/scraper/index.ts` - public scraper entry API (`runScrape`)
- `src/scraper/collections.ts` - section/page discovery and collection building
- `src/scraper/writers.ts` - markdown/raw/doc-nav/report output writing
- `src/scraper/link-rewrite.ts` - internal wiki link rewriting for generated docs
- `src/scraper/api.ts` - MediaWiki API fetch/parsing layer
- `src/scraper/extract.ts` - HTML cleanup, table extraction, and markdown rendering
- `src/mastra/index.ts` - Mastra instance with local-data skill Q&A workflow and agent
- `src/mastra/workflows/answer-skill-question-workflow.ts` - deterministic progression planning workflow
- `src/mastra/tools/*.ts` - local wiki data + route planner tools
- `src/mastra/evals/fishing-30-55.eval.ts` - fishing 30->55 eval using `@mastra/evals` scorer

## What it generates

- `docs/wiki/skills/index.md` - cleaned overview markdown + extracted tables
- `docs/wiki/skills/*.md` - one cleaned page for each skill found in overview (`agility.md`, `carpentry.md`, etc.)
- `docs/wiki/core-mechanics/index.md` - cleaned Core Mechanics page
- `docs/wiki/activities/index.md` + `docs/wiki/activities/*.md` - Activities overview and activity pages found from the Activities table
- `docs/wiki/recipes/index.md` - cleaned Recipes page with extracted tables
- `data/raw/*_parse.json` - raw MediaWiki parse response snapshots for each scraped page
- `data/raw/*_structured.json` - extracted table data payload for each scraped page
- `reports/scrape_report.json` - summary for the latest scrape run
- `docs/.vitepress/config.mts` - auto-generated VitePress navigation/sidebar config for scraped pages

## Copy-paste run commands

```bash
pnpm install
pnpm scrape
pnpm docs:dev
```

You can inspect CLI help with:

```bash
pnpm scrape --help
```

Open the local URL shown by VitePress (usually `http://localhost:5173`) to validate rendering.

## Build static docs

```bash
pnpm docs:build
```

To preview the built site locally:

```bash
pnpm docs:preview
```

## Quality gates

If you use `go-task`, run all checks with:

```bash
task ci
```

This runs formatting checks, linting, type checking, TypeScript build, and docs build.

## Mastra local skill planning

This repo includes a Mastra 1.x setup that uses only local scraped wiki data.

- Agent: `src/mastra/agents/wiki-coach-agent.ts`
- Workflow: `src/mastra/workflows/answer-skill-question-workflow.ts`
- Tools: `wiki-skill-data` and `skill-route-planner`

Run tests and the fixed eval case:

```bash
pnpm test
pnpm eval:fishing
```

Run Mastra Studio/API locally:

```bash
pnpm mastra:dev
```

Studio will be available at `http://localhost:4111`.

Ask a local progression question from CLI:

```bash
pnpm ask "what should i do to get fishing from 30 to 55?"
```

## Optional: specific collections only

```bash
pnpm scrape --collections skills --collections recipes
```

## Optional: incremental refresh (skip unchanged pages)

```bash
pnpm scrape --incremental
```

You can also pass a comma-separated collection list positionally:

```bash
pnpm scrape skills,activities
```

Incremental mode compares each page's `source_oldid` and skips rewriting markdown/raw files when unchanged.

During scraping, the CLI shows TUI-style progress updates for both collection and writing phases so you can follow page-by-page progress.
