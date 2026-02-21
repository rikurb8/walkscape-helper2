# Technology Stack

**Analysis Date:** 2026-02-21

## Languages

**Primary:**

- TypeScript (strict) - CLI app, scraper, and Mastra runtime in `src/**/*.ts` with compiler settings in `tsconfig.json`.

**Secondary:**

- Markdown - generated docs content and project docs under `docs/` and `README.md`.
- YAML - task and CI automation in `Taskfile.yml` and `.github/workflows/ci.yml`.

## Runtime

**Environment:**

- Node.js 22 - pinned in CI at `.github/workflows/ci.yml` and required by modern ESM + built-in `fetch` usage in `src/scraper/api.ts`.

**Package Manager:**

- pnpm 10.5.2 - declared in `package.json` (`packageManager`) and CI setup in `.github/workflows/ci.yml`.
- Lockfile: present (`pnpm-lock.yaml`, lockfileVersion `9.0`).

## Frameworks

**Core:**

- `@oclif/core` (CLI command framework) - scrape command parsing and flags in `src/cli/scrape-command.ts`.
- `@mastra/core` + `@mastra/memory` + `@mastra/libsql` - local agent/workflow runtime and persistence in `src/mastra/index.ts` and `src/mastra/agents/wiki-coach-agent.ts`.
- VitePress - local docs site generation in `docs/.vitepress/config.mts` with scripts in `package.json`.

**Testing:**

- Node test runner via `tsx --test` - configured by `package.json` script `test` and used by tests like `src/mastra/guide-context.test.ts`.

**Build/Dev:**

- TypeScript compiler (`tsc`) - production build and type-check scripts in `package.json`.
- `tsx` - TypeScript execution for CLIs/scripts (`scrape`, `wiki`, `guide`, `ask`, evals) in `package.json`.
- ESLint + TypeScript ESLint - lint configuration in `eslint.config.mjs`.
- Prettier - formatting configuration in `prettier.config.mjs`.

## Key Dependencies

**Critical:**

- `@mastra/core` / `@mastra/evals` - powers local Q&A agent/workflow runtime and eval scoring in `src/mastra/index.ts` and `src/mastra/evals/fishing-30-55.eval.ts`.
- `@oclif/core` - command entrypoint behavior for scraper CLI in `src/cli/scrape-command.ts`.
- `cheerio` + `turndown` - HTML parsing and markdown conversion pipeline in `src/scraper/extract.ts`.
- `zod` - workflow/tool schemas in `src/mastra/workflows/answer-skill-question-workflow.ts` and `src/mastra/tools/*.ts`.

**Infrastructure:**

- `@mastra/libsql` - local LibSQL-backed storage configured to `file:./mastra.db` in `src/mastra/index.ts`.
- `marked` + `marked-terminal` - terminal rendering of markdown output in `src/cli/scrape/saved-docs.ts`.
- `ora` - CLI progress spinners in `src/cli/scrape-command.ts`.

## Configuration

**Environment:**

- Optional AI auth uses `OPENAI_API_KEY` checks in `src/mastra/index.ts`; without it, AI answer generation returns unavailable errors.
- No `.env*` files are detected in repository root (runtime expects environment variables from shell/CI).
- Local guide profile data is persisted to `.walkscape/guide-context.json` in `src/mastra/guide-context.ts`.

**Build:**

- TypeScript config: `tsconfig.json` (ES2022 target, NodeNext modules, strict mode, `dist` output).
- Lint config: `eslint.config.mjs`.
- Format config: `prettier.config.mjs`.
- Docs config: `docs/.vitepress/config.mts`.
- CI config: `.github/workflows/ci.yml`.

## Platform Requirements

**Development:**

- Node.js 22 + pnpm 10.5.2 for local commands in `README.md` and CI parity from `.github/workflows/ci.yml`.
- Network access to WalkScape MediaWiki API for scraping in `src/scraper/api.ts`.
- `OPENAI_API_KEY` required only for AI-generated answer text paths in `src/mastra/index.ts`.

**Production:**

- Not detected as a deployed service; current platform is local CLI/runtime execution (`pnpm scrape`, `pnpm wiki`, `pnpm guide`) described in `README.md`.

---

_Stack analysis: 2026-02-21_
