#!/usr/bin/env node

import { printCommandError } from "./cli-output.js";
import { isJsonModeArgv, runScrapeCommandCli } from "./cli/scrape-command.js";
import { runAskCommandCli } from "./mastra/ask.js";
import { runGuideCommandCli } from "./mastra/guide.js";
import { runWikiSearchCommandCli } from "./mastra/search.js";
import { runWikiCommandCli } from "./mastra/wiki.js";

const args = process.argv.slice(2);
const rootCommand = args[0];
const jsonMode = isJsonModeArgv(process.argv);

void runRootCommand(rootCommand, args).catch((error: unknown) => {
  printCommandError(toErrorMode(rootCommand), error, jsonMode);
  process.exitCode = 1;
});

async function runRootCommand(command: string | undefined, argv: string[]): Promise<void> {
  if (!command) {
    await runScrapeCommandCli(argv);
    return;
  }

  if (command === "help") {
    process.stdout.write(`${renderRootHelp()}\n`);
    return;
  }

  if (command === "--help" || command === "-h") {
    process.stdout.write(`${renderRootHelp()}\n`);
    return;
  }

  if (command === "scrape") {
    await runScrapeCommandCli(argv.slice(1));
    return;
  }

  if (command === "ask") {
    await runAskCommandCli(argv.slice(1));
    return;
  }

  if (command === "guide") {
    await runGuideCommandCli(argv.slice(1));
    return;
  }

  if (command === "wiki") {
    await runWikiCommandCli(argv.slice(1));
    return;
  }

  if (command === "wiki-search" || command === "wiki:search") {
    await runWikiSearchCommandCli(argv.slice(1));
    return;
  }

  await runScrapeCommandCli(argv);
}

function toErrorMode(command: string | undefined): string {
  if (command === "ask") {
    return "ask";
  }

  if (command === "guide") {
    return "guide";
  }

  if (command === "wiki") {
    return "wiki";
  }

  if (command === "wiki-search" || command === "wiki:search") {
    return "wiki-search";
  }

  return "scrape";
}

function renderRootHelp(): string {
  return [
    "walkscape-helper - unified WalkScape helper CLI",
    "",
    "Usage:",
    "  walkscape-helper [scrape] [flags]",
    '  walkscape-helper ask [--json] "how to get from fishing 35 to 50?"',
    "  walkscape-helper guide <set|import|show|reset|ask> [args]",
    '  walkscape-helper wiki [--json] "where can i train fishing around level 50?"',
    '  walkscape-helper wiki-search [--json] "magnet fishing location"',
    "",
    "Notes:",
    "  omit command to run scrape (backward compatible)",
    "  pass --json for machine-readable output"
  ].join("\n");
}
