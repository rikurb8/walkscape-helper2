# AGENTS.md

Guidance for coding agents working in `walkscape-wiki-scraper`.

## Scope

- Applies to the entire repository.
- Prefer small, surgical changes that match existing patterns.
- Do not introduce new frameworks/tools unless requested.

## Priority and Consistency Defaults

- Highest-priority local rules (if present): `.cursorrules`, `.cursor/rules/`, `.github/copilot-instructions.md`.
- Interpret requirement words strictly: **MUST** is required, **SHOULD** is expected unless there is a documented reason not to.
- Use existing repository patterns as the default tie-breaker for ambiguous implementation choices.
- Choose the smallest behavior-preserving diff that satisfies the request.
- Avoid opportunistic refactors, renames, or structural churn outside task scope.
- Keep outputs deterministic unless the task explicitly requires a format change.
- Record assumptions in handoff notes when requirements are incomplete.

## Domain and Architecture

- Language/runtime: TypeScript (`strict`), Node.js ESM.
- Package manager: `pnpm` (`pnpm@10.5.2`).
- Core libraries: `@oclif/core`, `cheerio`, `turndown`, `vitepress`.
- Problem domain: keep WalkScape wiki knowledge local, deterministic, and queryable.
- System has two primary modules:
  - `Scraper` (`src/scraper/*`): discovers wiki pages, fetches MediaWiki content, extracts/normalizes sections and tables, rewrites internal links, and writes deterministic artifacts to `docs/`, `data/raw/`, and `reports/`.
  - `Mastra` (`src/mastra/*`): local Q&A/planning layer over generated wiki data; provides agent/workflow/tooling entrypoints for asking questions, guide context, search, and evaluations.
- CLI entrypoints:
  - `src/main.ts`: scraper CLI.
  - `src/mastra/index.ts`: Mastra runtime setup and workflow/agent wiring.

## Commands

- Install deps: `pnpm install`
- Build TypeScript: `pnpm build`
- Run scraper: `pnpm scrape`
- Scraper help: `pnpm scrape --help`
- Incremental scrape: `pnpm scrape --incremental`
- Targeted scrape example: `pnpm scrape --collections skills --collections recipes`
- Build docs site: `pnpm docs:build`

## Standard Task Workflow

- Read relevant files first and bound scope before editing.
- Implement minimal source changes required to satisfy the request.
- Run task CI checks appropriate to the change.
- Self-review the full diff for accidental edits, consistency drift, and type safety issues.
- Finish by meeting all Land the Plane requirements.

## Verification and CI

- Task CI baseline
  - `pnpm build`
  - `pnpm scrape --collections skills --incremental`
  - `pnpm docs:build` (required when docs/config/content may be affected)
- Lint status: no lint script/config is committed; do not invent lint tooling in routine changes.
- Test status: no test runner is committed; validation currently relies on build success plus scraper/docs smoke checks.
- Use full scrape only when needed (it performs network requests and rewrites generated outputs).

## Code Conventions

- Use ESM import/export only.
- Keep local imports in TypeScript using `.js` extensions.
- Prefer `node:`-prefixed built-in imports.
- Preserve strict typing; avoid `any` unless scope is narrow and justified.
- Match existing formatting style (2 spaces, semicolons, double quotes).
- Keep functions focused and use early returns for guard clauses.
- Naming: `camelCase` variables/functions, `PascalCase` types/classes, `UPPER_SNAKE_CASE` top-level constants.
- In `catch`, treat errors as `unknown` and narrow with `instanceof Error` before reading `.message`.
- Use `fs.promises`, avoid floating promises, and use `path.join` / `path.resolve` for cross-platform paths.

## Scraper-Specific Practices

- Preserve deterministic output structure in `docs/`, `data/raw/`, and `reports/`.
- Do not change frontmatter/report field names casually.
- Maintain internal link rewriting behavior for generated docs.
- Keep extracted table formats stable (`columns`, `rows`, `row_links`).
- Keep incremental mode semantics intact (`source_oldid` skip decisions).
- Preserve request-rate limiting behavior in `src/scraper/api.ts` unless asked to change it.

## Editing Guidelines for Agents

- Prefer minimal diffs and avoid broad refactors.
- Do not edit generated output files unless the task explicitly targets generated artifacts.
- If source changes require regenerated output, run scraper/docs commands and include regenerated files together.
- Avoid unrelated formatting-only churn.

## Land the Plane

Work is not complete until all required closure steps are done:

- Task CI is run and passing for the scope of change.
- Code review is completed (at minimum: full self-review of the final diff).
- A commit is created containing only the intended changes.
- Handoff notes include verification commands and any known risk/follow-up.

No CI + no review + no commit means the task is still in progress.

## Commit/PR Hygiene (When Asked)

- Group logically related changes.
- Explain why behavior changed, not just what changed.
- Mention verification commands run (`pnpm build`, scrape mode used, docs build).
- Call out any network-dependent steps and non-deterministic effects.
