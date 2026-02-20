# Scraper Module (`src/scraper`)

The scraper exists to make WalkScape wiki knowledge local, repeatable, and machine-friendly.

It is the ingestion boundary of the system: everything downstream assumes this module turns remote MediaWiki content into deterministic project artifacts.

## Why this module exists

- The wiki is an external, changing source. This module creates a stable local snapshot the project can rely on.
- Docs generation needs normalized markdown, not raw MediaWiki responses.
- Data consumers (including `src/mastra`) need predictable structured outputs, especially for tables.
- Reproducibility matters: repeated runs should produce the same shape and paths so diffs stay meaningful.

## How it fits the system

- **Upstream boundary:** talks to MediaWiki and handles page discovery/fetching concerns.
- **Transformation layer:** converts and normalizes page content into a consistent internal format.
- **Publishing layer:** writes canonical artifacts consumed by:
  - `docs/wiki/...` for local docs browsing
  - `data/raw/...` for machine-readable source + structured payloads
  - `reports/scrape_report.json` for run visibility and troubleshooting
- **Contract provider:** defines output structure that other modules treat as stable interfaces.

## Module responsibilities

- Discover pages for supported content collections.
- Fetch source content with controlled API usage.
- Normalize/extract content (markdown body + table structures).
- Rewrite internal links to local generated docs paths.
- Write deterministic outputs and support incremental skips for unchanged pages.

## Internal components

- `index.ts`: scraper entrypoint and orchestration.
- `collections.ts`: collection/page discovery rules.
- `api.ts`: MediaWiki API access and request tracking.
- `extract.ts`: content normalization and table extraction.
- `link-rewrite.ts`: wiki link to local docs link mapping.
- `writers.ts`: deterministic output writing, incremental logic, reporting.
- `types.ts`: shared scraper contracts.
- `utils.ts`: common helpers used by scraper internals.

## Design constraints

- Keep output schemas and field names stable unless coordinated across consumers.
- Preserve deterministic formatting and path conventions.
- Treat incremental behavior (`source_oldid`-based skips) as part of the public behavior.
