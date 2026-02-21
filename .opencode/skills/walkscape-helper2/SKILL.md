---
name: walkscape-helper2
description: Help AI assistants guide users through walkscape-helper2 CLI commands with clear, copy-pasteable first-time onboarding steps.
compatibility: opencode
metadata:
  project: walkscape-helper2
  purpose: cli-usage-manual
  package_manager: pnpm
---

## What I do

- Turn user goals into the exact `pnpm` command to run.
- Give short, beginner-friendly, copy-pasteable command sequences.
- Prefer the shortest successful path before advanced options.
- Explain command output briefly and suggest the next command.

## When to use me

Use this skill when the user wants to use the project as a CLI tool, for example:

- first-time setup and first successful query;
- scraping wiki data and understanding incremental vs full modes;
- wiki-only Q&A (`pnpm wiki`) vs profile-aware Q&A (`pnpm guide ask`);
- local search (`pnpm wiki:search`) and deterministic route planner (`pnpm ask`);
- guide profile setup/import/show/reset flows.

## Default onboarding flow

1. Install dependencies:
   - `pnpm install`
2. Build local wiki snapshot:
   - `pnpm scrape`
3. Ask a wiki-only question:
   - `pnpm wiki "where can i train fishing around level 50?"`
4. (Optional) set personal guide context:
   - `pnpm guide set --username <name>`
   - `pnpm guide import --character-export-file ./example-character-export.json`
5. Ask a context-aware progression question:
   - `pnpm guide ask "how do i get fishing to 70?"`

## Command chooser

- User wants local wiki answer only -> `pnpm wiki "..."`
- User wants raw retrieval matches -> `pnpm wiki:search "..."`
- User wants personalized progression guidance -> `pnpm guide ask "..."`
- User wants deterministic skill route plan -> `pnpm ask "how to get from fishing 35 to 50?"`

## Helpful variants to include

- Machine-readable output: add `--json` to most commands.
- Scrape only selected collections: `pnpm scrape --collections skills --collections recipes`.
- Force full scrape: `pnpm scrape --full`.
- Show scrape docs paths in output: `pnpm scrape --print-docs`.
- Import JSON from stdin (macOS clipboard): `pbpaste | pnpm guide import`.

## Output and troubleshooting notes

- If no data has been scraped yet, guide the user to run `pnpm scrape` first.
- If user is unsure what was saved in guide context, use `pnpm guide show`.
- If guide data seems wrong, reset and re-import:
  - `pnpm guide reset`
  - `pnpm guide import --character-export-file ./example-character-export.json`
- Keep answers action-oriented: command first, short explanation second.

## Important boundary

This skill is for using the CLI, not for developing or refactoring repository code.
If the user asks for code changes, load a separate development-focused skill.
