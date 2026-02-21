# Plan: Fetch Remaining Wiki Content (Items Section)

## Confirmed Findings (Current Repo State)

From local scraper code and generated artifacts:

- Only these collections are currently supported: `skills`, `core-mechanics`,
  `activities`, `recipes`
- `docs/wiki/` only contains those four sections
- `data/raw/` only contains those four sections
- `reports/wiki_scrape_report.json` also reports only those four sections

Implication:

- Missing `Items` is primarily a **collection coverage gap** (not yet proven to
  be extraction failure)

Known missing top-level sections from
`WalkScape:_Grind_by_walking!` include at least:

- Items
- Locations
- Services
- Characters
- Buildings
- Shops

## Goal

Ensure our local wiki data includes the missing **Items** section from
`https://wiki.walkscape.app/wiki/WalkScape:_Grind_by_walking`, specifically:

- Equipment
- Materials
- Consumables
- Collectibles
- Chests
- Pet Eggs
- Cosmetics

## Current Gap

The generated local artifacts are missing at least one full section subtree
(`Items`) that exists on the source wiki page.

## Domain-Specific Principle

Treat this as a **WalkScape knowledge-modeling fix**, not a generic scraper
exercise. The wiki is finite and game-domain semantics matter:

- Keep canonical game taxonomy for item classes (the 7 categories above)
- Prefer explicit handling for known WalkScape page structures
- Optimize for correctness and consistency of game data over generic abstraction
- Avoid introducing reusable/generic parser layers unless strictly needed

## Scope

In scope:

- Discover why `Items` content is skipped or not persisted
- Add/fix scraping so all listed WalkScape item categories are captured exactly
- Preserve deterministic output in `docs/`, `data/raw/`, and `reports/`
- Validate incremental behavior still works

Out of scope:

- Broad scraper refactors unrelated to this missing section
- Generalized "works for any wiki" parser redesign
- Changing output schemas unless required for correctness

## Execution Plan

### 0) Create Domain-First Collection Checklist

Before code changes, lock a concrete WalkScape-first collection plan:

1. Add `items` as first new collection.
2. Use explicit child titles (canonical game pages):
   `Equipment`, `Materials`, `Consumables`, `Collectibles`, `Chests`,
   `Pet Eggs`, `Cosmetics`.
3. Keep later collections (`locations`, `services`, `characters`, `buildings`,
   `shops`) as follow-up phases after `items` lands.

Deliverable:

- Ordered implementation checklist with exact page titles (no generic discovery
  logic for this phase).

### 1) Reproduce and Baseline

1. Run scrape with current collections and capture absence of `items` outputs.
2. Confirm missing `Items` section in generated outputs (`docs/` and `data/raw/`).
3. Save concrete evidence (which file/section is missing, expected vs actual).

Deliverable:

- A short baseline note with exact missing paths/sections.

### 2) Trace Ingestion Path for the Source Page

1. Verify whether `items` can be selected at all from CLI/collection types.
2. Verify MediaWiki content fetch includes the needed section nodes.
3. Inspect section extraction/normalization for the exact `Items` heading and
   its child category list (`Equipment`, `Materials`, `Consumables`,
   `Collectibles`, `Chests`, `Pet Eggs`, `Cosmetics`).
4. Check internal link rewriting and filtering do not drop these entries.

Likely failure points to confirm (in order of probability):

- `items` is absent from supported collection enum/options
- `items` builder is absent in collection assembly

- Section walker stops before the `Items` subtree on this page
- Nested bullet/list parsing does not emit the 7 item category links
- Link rewrite/filter rules drop `wiki/*` item targets during normalization
- Collection/page inclusion rules process skills but miss this overview subtree

Deliverable:

- Root cause statement with file-level ownership.

### 3) Implement Minimal Fix

1. Extend collection types/CLI so `items` is a valid collection.
2. Add `buildItemsCollection()` using explicit `childTitles` for the 7 category
   pages.
3. Patch only the affected scraper stage(s) to include the `Items` subtree and
   all 7 known child categories.
4. Use explicit, readable handling for this known WalkScape section shape
   rather than adding broad generic heuristics.
5. Keep existing output schema stable (`columns`, `rows`, `row_links` where
   applicable).
6. Preserve deterministic ordering and formatting.
7. Ensure no regressions in incremental skip logic (`source_oldid` semantics).

Deliverable:

- Minimal code diff that restores missing content.

### 4) Validate End-to-End

Run repository validation for this scope:

1. `pnpm build`
2. `pnpm scrape --collections skills --incremental` (baseline CI command)
3. `pnpm scrape --collections items --incremental`
4. Targeted mixed scrape with existing collection + new one:
   `pnpm scrape --collections skills --collections items --incremental`
5. `pnpm docs:build` (required because docs content changes)

Then verify:

- `Items` section appears in generated docs with all 7 categories
- Raw JSON/artifacts include corresponding structured content
- Reports show no new scraping errors for these pages
- Category names match canonical game naming (`Pet Eggs`, not normalized away)

Deliverable:

- Verification notes with command results and artifact paths.

### 5) Hardening (If Needed)

If root cause is parser-shape specific, add a focused regression guard:

- A small fixture or assertion for nested section/list extraction of `Items`
  style content.

## Acceptance Criteria

- All 7 item categories are present in local generated outputs
- All 7 categories are represented as WalkScape game-domain entities
- No schema drift in existing artifacts
- Incremental scrape behavior remains correct
- Build + scrape + docs build pass

## Suggested Implementation Order

1. Domain-first checklist lock
2. Baseline reproduction
3. Root cause trace
4. Minimal patch (types + builder + wiring)
5. Validation run
6. Optional regression guard

## Notes

- Prioritize smallest behavior-preserving diff.
- Prefer explicit domain mappings over generic parser abstraction.
- Do not regenerate unrelated content beyond what scrape/docs builds require.
