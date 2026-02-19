# Wiki Data Site Map

High-level map of the scraped WalkScape wiki data in this repo.

## Coverage Snapshot

- Total markdown pages in `docs/wiki`: **129**
- Total raw parse snapshots in `data/raw`: **139**
- Last scrape mode (per report): `scrape --incremental`

## Data Layout

```text
docs/
  wiki/
    skills/                 # 11 pages (index + 10 skill pages)
    core-mechanics/         # 1 page (index)
    activities/             # 116 pages (index + 115 activity pages)
    recipes/                # 1 page (index)
    sitemap.md              # this file

data/
  raw/
    activities/             # 116 MediaWiki parse JSON snapshots
    skills/                 # 11 MediaWiki parse JSON snapshots
    *.json                  # 12 top-level legacy/root snapshots

reports/
  scrape_report.json       # latest scrape summary
  skills_phase1_report.json
  skills_phase2_report.json
```

## Wiki Sections

- Skills: `docs/wiki/skills/index.md`
- Core Mechanics: `docs/wiki/core-mechanics/index.md`
- Activities: `docs/wiki/activities/index.md`
- Recipes: `docs/wiki/recipes/index.md`

## Source + Metadata Pattern

Each generated wiki markdown page follows the same pattern:

- YAML frontmatter (title, `source_url`, `source_oldid`, `scraped_at`, categories)
- cleaned markdown body
- extracted table markdown (when present)
- `Structured Data` JSON block

Raw source snapshots are stored as the corresponding MediaWiki parse JSON under `data/raw/...`.
