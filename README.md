# WalkScape Helper

`walkscape-helper` is a local-first CLI for WalkScape progression planning.
It turns the WalkScape wiki into a queryable local knowledge base and adds optional profile-aware guidance. Other functionalities coming later.

## Try it out

```bash
# 1) Install dependencies
pnpm install

# 2) Build your local wiki snapshot
#    - incremental mode is enabled by default
pnpm scrape

# 3) Ask a wiki-only question (no player context)
pnpm wiki "where can i train fishing from level 32 to 50?"

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

## Commands at a glance

- `scrape`: build and refresh your local wiki snapshot (incremental by default)
- `wiki`: ask questions using local wiki content only
- `guide`: ask context-aware questions using your saved character profile + local wiki data
- `wiki:search`: inspect raw BM25 matches from the local index
- `ask`: use the deterministic route planner directly for skill/target-level questions
- `eval:fishing`: run repeatable quality checks to compare behavior over time

## NPX usage tips

You can run the published CLI directly with `npx`:

```bash
npx walkscape-helper --help
npx walkscape-helper wiki "where can i train fishing from level 32 to 50?"
npx walkscape-helper guide show
npx walkscape-helper ask "how to get from fishing 35 to 50?"
npx walkscape-helper wiki-search "magnet fishing location"
```

Notes:

- first run may take longer because `npx` installs the package;
- add `--json` to any of the commands above for machine-readable output.

CLI output modes:

- by default human mode, every operation is optimized for human terminal use;
- add `--json` to any operation for machine-readable output (automation/AI workflows).

## How it works

- `scrape` fetches selected wiki collections, cleans and normalizes page content, extracts tables, rewrites internal links, and writes deterministic artifacts to `docs/wiki/`, `data/raw/`, and `reports/`.
- `wiki` and `wiki:search` run over a local BM25 index built from parsed wiki snapshots; `wiki` adds AI-generated, source-cited answers on top of ranked retrieval.
- `guide` stores your local profile in `.walkscape/guide-context.json`, imports character exports (including XP-to-level conversion), and personalizes either route-planning or wiki Q&A.
- `eval:fishing` runs a fixed prompt through the pipeline and scores output consistency so prompt/tooling changes remain comparable.

## Supported scrape collections

Currently data is only fetched for the following collections. Wiki has lots more (routes, items, ...) that we can also fetch when needed.

- `skills`
- `core-mechanics`
- `activities` (plus linked activity pages from the Activities table)
- `recipes`
- `items` (plus canonical item category pages: equipment, materials, consumables, collectibles, chests, pet eggs, cosmetics)

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
pnpm scrape --collections items
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

## OpenCode skills for this repo

If you use OpenCode agents, you can define reusable behavior in `.opencode/skills/<name>/SKILL.md`.
For first-time users, the most helpful pattern is a CLI-focused skill that turns natural questions into the exact commands to run.

What a CLI skill can do:

- explain the shortest happy-path from install -> scrape -> ask;
- suggest the correct command variant for each task (`wiki`, `guide`, `wiki:search`, `ask`);
- include copy-paste commands for file import, JSON mode, and troubleshooting;
- reduce first-run confusion by mapping plain-English goals to concrete CLI steps.

Current project skill:

- `.opencode/skills/walkscape-helper2/SKILL.md`

Generic CLI skill example (first-time user friendly):

```md
---
name: walkscape-helper2
description: Help first-time users run walkscape-helper2 commands end-to-end with clear copy-paste steps.
compatibility: opencode
---

## What I do

- Give the fastest onboarding flow:
  1. `pnpm install`
  2. `pnpm scrape`
  3. `pnpm wiki "..."`
- Translate user intent into the right command (`guide ask` vs `wiki` vs `ask`).
- Prefer beginner-safe defaults and include `--json` alternatives when useful.
- Explain outputs briefly and point to next command.

## Response style

- Use short steps with copy-pasteable commands.
- Assume user is new unless they ask for advanced options.
- If a command fails, provide the smallest recovery step first.
```

Commentary:

- this should be the default skill for helping new users in chat or terminal;
- it optimizes for successful first-run UX, not internal implementation details.

Specific CLI skill example (guide import + progression help):

```md
---
name: walkscape-guide-onboarding
description: Walk users through guide setup, character import, and context-aware progression questions.
compatibility: opencode
---

## Use when

- User asks about personal progression, target levels, or importing character data.

## Steps

- Set username: `pnpm guide set --username <name>`
- Import export file: `pnpm guide import --character-export-file ./example-character-export.json`
- Verify context: `pnpm guide show`
- Ask plan: `pnpm guide ask "how do i get fishing to 70?"`
- Optional machine mode: add `--json` to any guide command

## Notes

- Mention that XP values are converted to estimated levels during import.
- If input is missing, suggest stdin flow: `pbpaste | pnpm guide import`.
```

Commentary:

- this focused skill is useful after the user has completed the base scrape step;
- pair it with the generic CLI skill so guidance stays simple but context-aware.

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
