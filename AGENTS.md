# AGENTS.md

Guidance for coding agents working in `walkscape-wiki-scraper`.

## Scope

- Applies to the entire repository.
- Prefer small, surgical changes that match existing patterns.
- Do not introduce new frameworks/tools unless requested.

## Rule Files Check

- `.cursorrules`: not present.
- `.cursor/rules/`: not present.
- `.github/copilot-instructions.md`: not present.
- If any of these are added later, treat them as highest-priority local instructions.

## Tech Stack Snapshot

- Language: TypeScript (`strict` mode).
- Runtime target: Node.js, ESM modules.
- Package manager: `pnpm` (`pnpm@10.5.2`).
- CLI framework: `@oclif/core`.
- HTML parsing: `cheerio`.
- HTML -> Markdown: `turndown`.
- Docs preview/build: `vitepress`.

## Project Layout

- `src/main.ts`: CLI entrypoint and flag parsing.
- `src/scraper/index.ts`: public scraper API and summary printing.
- `src/scraper/api.ts`: MediaWiki fetch + rate limiting.
- `src/scraper/collections.ts`: page discovery and collection assembly.
- `src/scraper/extract.ts`: HTML cleanup and table extraction.
- `src/scraper/writers.ts`: markdown/raw/report/docs config output.
- `src/scraper/link-rewrite.ts`: internal link rewriting.
- `src/scraper/types.ts`: shared types and constants.
- `src/scraper/utils.ts`: utility helpers.

## Setup Commands

- Install deps: `pnpm install`
- Run scraper: `pnpm scrape`
- CLI help: `pnpm scrape --help`
- Run specific collections: `pnpm scrape --collections skills --collections recipes`
- Incremental scrape: `pnpm scrape --incremental`

## Build / Lint / Test Commands

Current `package.json` scripts:

- Build TypeScript: `pnpm build`
- Run docs dev server: `pnpm docs:dev`
- Build docs site: `pnpm docs:build`
- Preview docs build: `pnpm docs:preview`
- Run scraper entrypoint: `pnpm scrape`

Lint status in this repo:

- No lint script/config is currently committed.
- Do not invent lint tooling in routine changes.
- For code health checks, use `pnpm build` as the baseline gate.

Test status in this repo:

- No test runner or test script is currently committed.
- There are no existing `*.test.*` / `*.spec.*` files in `src/`.
- Validation currently relies on build success + scraper/docs smoke checks.

Single-test execution guidance:

- Not applicable right now (no test framework configured).
- If a test framework is added, document and use its file-level command, e.g.:
- `pnpm test -- path/to/file.test.ts`
- `pnpm vitest path/to/file.test.ts`
- `node --test path/to/file.test.ts`
- Pick the command that matches the committed test tool; do not assume.

## Recommended Verification Workflow

- `pnpm build`
- `pnpm scrape --collections skills --incremental`
- `pnpm docs:build`

Use full scrape only when needed (it performs network requests and rewrites generated docs/raw output).

## TypeScript and Module Conventions

- Use ESM import/export syntax only.
- Keep local imports using `.js` extension in TypeScript source (NodeNext style).
- Prefer `node:`-prefixed built-in imports (`node:fs`, `node:path`, etc.).
- Separate value imports from type imports when useful:
- `import type { Foo } from "./types.js";`
- Preserve `strict` typing; avoid weakening compiler guarantees.
- Avoid `any`; if unavoidable, keep scope narrow and explain with code context.

## Formatting and Structure Conventions

- Match existing formatting style (2 spaces, semicolons, double quotes).
- Keep functions focused and single-purpose.
- Prefer early returns for guard clauses.
- Keep long logic split into small helpers where readability improves.
- Preserve existing object key naming style (snake_case only in serialized report payloads where already used).

## Naming Conventions

- `camelCase`: variables, functions, non-class methods.
- `PascalCase`: interfaces, types, classes.
- `UPPER_SNAKE_CASE`: top-level constants (`API_BASE`, `REQUEST_INTERVAL_MS`).
- Boolean names should read clearly (`isRoot`, `incremental`, `hasTty`).
- Keep file names lowercase with hyphens where already established (`link-rewrite.ts`).

## Error Handling Conventions

- Throw `Error` with specific, contextual messages.
- Include relevant identifiers in error text (page title, section, HTTP status, etc.).
- In `catch`, treat errors as `unknown`; narrow with `instanceof Error` before reading `.message`.
- Only swallow errors intentionally in safe fallback paths (e.g., best-effort file checks).
- Preserve partial progress behavior where current code records warnings instead of hard-failing entire runs.

## Async / IO Conventions

- Use `fs.promises` APIs consistently.
- Await asynchronous operations explicitly; avoid floating promises.
- Keep path handling cross-platform via `path.join` and `path.resolve`.
- Convert to POSIX path format only at boundaries where URLs/docs links require it.
- Preserve the existing request-rate limiting behavior in `api.ts` unless asked to change it.

## Scraper-Specific Practices

- Preserve deterministic output structure in `docs/`, `data/raw/`, and `reports/`.
- Do not change frontmatter/report field names casually; downstream tooling may depend on them.
- Maintain internal link rewriting behavior for generated docs.
- Keep extracted table formats stable (`columns`, `rows`, `row_links`).
- Keep incremental mode semantics intact (`source_oldid` checks for skip decisions).

## Editing Guidelines for Agents

- Prefer minimal diffs and avoid broad refactors.
- Do not edit generated output files unless task explicitly targets generated artifacts.
- If source changes require regenerated output, run scraper/docs commands and include regenerated files together.
- Avoid unrelated formatting-only churn.

## Commit/PR Hygiene (When Asked)

- Group logically related changes.
- Explain why behavior changed, not just what changed.
- Mention verification commands run (`pnpm build`, scrape mode used, docs build).
- Call out any network-dependent steps and non-deterministic effects.

## Quick Pre-merge Checklist

- Code compiles with `pnpm build`.
- Changed behavior validated with a targeted scrape run.
- Docs build succeeds when docs config/content changed.
- No accidental secrets or environment-specific paths committed.
- No new dependencies/tooling added without explicit need.
