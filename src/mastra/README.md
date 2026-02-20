# Mastra Module (`src/mastra`)

This module is the local Q&A and planning layer built on top of scraped wiki data.

It wires Mastra agents, tools, and workflows so CLI commands can answer WalkScape questions using only local artifacts.

## What it does

- **What:** This module provides the local intelligence layer behind the CLI's `wiki`, `search`, `ask`, and `guide` commands.
  - It exposes two main entrypoints:
    - `runLocalWikiQuestion()` for general wiki retrieval + answer generation.
    - `runLocalSkillQuestion()` for progression-specific route planning.
  - It also owns supporting pieces such as guide context persistence, search tooling, and usage/eval instrumentation.
- **Why:** Keep answers deterministic, grounded, and usable offline against your scraped WalkScape knowledge base.
  - General Q&A and progression planning run against local artifacts first, not live wiki requests.
  - Route planning is reproducible because it is derived from parsed local tables and fixed planning logic.
  - AI is optional: when unavailable, the module still returns structured local results.
- **How:** It combines a small runtime, local data/index services, and optional AI formatting.
  - CLI handlers call Mastra entrypoints in `index.ts`, which route to workflow/tool pipelines.
  - `wiki-workspace.ts` builds/queries a BM25 index over scraped docs/raw data for retrieval.
  - `wiki-store.ts` loads parsed skill/activity/consumable data from scraper outputs.
  - `skill-route-planner.ts` computes level-segmented routes using local unlock/XP data.
  - If `OPENAI_API_KEY` is set, `wikiCoachAgent` formats concise grounded answers; otherwise local outputs are returned directly.
  - `ai-usage.ts` records token/cost metadata for CLI reporting and eval runs.

## High-level functionality

- Local wiki Q&A over scraped WalkScape data.
- Local BM25-based wiki search across docs/raw artifacts.
- Deterministic skill route planning from parsed activity/consumable tables.
- Guide/profile context loading, persistence, and reuse across commands.
- Optional AI answer formatting constrained to local retrieved context.
- AI usage accounting for CLI output and eval reporting.

## High-level flow

1. Parse question and decide mode (progression route vs general wiki lookup).
2. Retrieve local data:
   - progression: load skill page tables and plan route segments
   - wiki: search indexed local docs/raw content with BM25
3. If AI is available, ask `wikiCoachAgent` to produce a concise answer constrained to local context.
4. Return answer + usage metadata to CLI commands (`wiki`, `ask`, `guide`).

## Main building blocks

- `index.ts`: Mastra runtime wiring and public local Q&A functions.
- `agents/wiki-coach-agent.ts`: constrained assistant configuration and tool/workflow registration.
- `workflows/answer-skill-question-workflow.ts`: structured parse -> plan -> format progression workflow.
- `tools/*.ts`: reusable tool interfaces for skill data, route planning, and wiki search.
- `wiki-workspace.ts`: workspace initialization and local search indexing.
- `wiki-store.ts`: skill page loading + extraction of activities/consumables.
- `skill-route-planner.ts`: best-activity route segmentation by level unlocks and XP efficiency.
- `guide-context.ts`: persisted profile (`.walkscape/guide-context.json`) + character export parsing.
- `evals/*.ts`: repeatable quality checks over fixed questions.

## Data dependencies

- Requires scraper outputs in `data/raw/` (especially `*_parse.json`) to search and plan routes.
- If no local scrape data is present, commands should fail fast with instructions to run `pnpm scrape`.
