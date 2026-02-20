# CLI Module (`src/cli`)

This module holds command-specific CLI orchestration and presentation helpers.

It keeps entrypoints like `src/main.ts` thin by moving scrape command wiring, argument handling, progress rendering, and machine-readable output shaping into focused files.

## What it does

- Defines the scrape command wrapper used by `src/main.ts` (`scrape-command.ts`).
- Parses and validates scrape collection inputs from args/flags (`scrape/collections.ts`).
- Renders human help text for scrape usage (`scrape/help.ts`).
- Formats scrape progress lines for spinner/non-TTY output (`scrape/progress.ts`).
- Reads and prints saved docs when `--print-docs` is enabled (`scrape/saved-docs.ts`).
- Converts scrape report payloads into stable JSON summary output (`scrape/summary.ts`).

## High-level flow (scrape domain + structure)

1. `src/main.ts` is the scrape entrypoint and forwards argv to `src/cli/scrape-command.ts`.
2. `src/cli/scrape-command.ts` maps CLI intent (`--collections`, `--incremental`, `--full`, `--print-docs`, `--json`) to scraper domain execution by calling `runScrape()` in `src/scraper/index.ts`.
3. During execution, scraper domain events from collection discovery + page writes are formatted by `src/cli/scrape/progress.ts` for terminal UX (spinner in TTY, logs in non-TTY).
4. After `runScrape()`, CLI composes domain outputs:
   - scrape report stats -> `src/cli/scrape/summary.ts` for stable JSON fields,
   - generated docs paths from `summary.sections[*].output_files` -> `src/cli/scrape/saved-docs.ts` for optional markdown preview.
5. Final presentation stays in CLI layer: human summary delegates to `printScrapeSummary()` from `src/scraper/index.ts`, while machine mode returns a deterministic JSON payload for automation.

## Design notes

- Keep this layer focused on CLI concerns only (parsing, UX, output formatting).
- Core scrape business logic stays in `src/scraper`.
- Prefer small helper modules per concern to avoid regrowing monolithic command files.
- Treat scraper outputs as domain contracts: CLI should read/report existing fields (for example `write_stats`, `warnings`, `sections[*].output_files`) without redefining scraper schemas.
- Preserve deterministic machine output in `--json` mode so automation and downstream agents can rely on stable keys and value types across runs.
- Keep human and machine presentation paths separate: terminal readability (spinner/help/progress/docs preview) should not leak into JSON payloads.
- Respect incremental semantics from the domain layer: CLI flags select mode (`--incremental`/`--full`), but skip/rewrite decisions remain owned by scraper logic.
- Surface domain warnings clearly but non-disruptively: warnings should be visible in human mode and explicitly carried in JSON (`savedDocWarnings`/summary warning counts).
- Prefer fail-fast input validation at CLI boundaries (collections/args) so invalid requests do not trigger unnecessary API calls or partial scrape work.

## Related docs

- `README.md`
- `src/scraper/README.md`
- `src/mastra/README.md`
