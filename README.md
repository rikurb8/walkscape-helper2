# WalkScape Wiki Scraper

TypeScript + pnpm scraper for WalkScape wiki pages. Current scope scrapes the WalkScape `Skills` overview page and all linked skill pages into structured markdown for AI use.

`scrape-wiki` extends this with `Core Mechanics`, `Activities` (including activity pages listed in the Activities table), and `Recipes`.

## What it generates

- `docs/wiki/skills/index.md` - cleaned overview markdown + extracted tables + structured JSON block
- `docs/wiki/skills/*.md` - one cleaned page for each skill found in overview (`agility.md`, `carpentry.md`, etc.)
- `docs/wiki/core-mechanics/index.md` - cleaned Core Mechanics page
- `docs/wiki/activities/index.md` + `docs/wiki/activities/*.md` - Activities overview and activity pages found from the Activities table
- `docs/wiki/recipes/index.md` - cleaned Recipes page with extracted tables
- `data/raw/*.json` - raw MediaWiki parse response snapshots for each scraped page
- `reports/skills_scrape_report.json` - summary for `scrape-skills`
- `reports/wiki_scrape_report.json` - summary for `scrape-wiki`
- `mkdocs.yml` - auto-generated docs nav for the scraped pages

## Copy-paste run commands

```bash
pnpm install
pnpm scrape:wiki
mkdocs serve
```

Open the local URL shown by MkDocs (usually `http://127.0.0.1:8000`) to validate rendering.

## Build static docs

```bash
mkdocs build
```

## Optional: skills-only refresh

```bash
pnpm scrape:skills
```

## Optional: incremental refresh (skip unchanged pages)

```bash
pnpm scrape:wiki:incremental
```

Incremental mode compares each page's `source_oldid` and skips rewriting markdown/raw files when unchanged.
