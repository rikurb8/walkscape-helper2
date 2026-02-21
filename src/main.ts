#!/usr/bin/env node

import { printCommandError } from "./cli-output.js";
import { isJsonModeArgv, runScrapeCommandCli } from "./cli/scrape-command.js";

const jsonMode = isJsonModeArgv(process.argv);

void runScrapeCommandCli(process.argv.slice(2)).catch((error: unknown) => {
  printCommandError("scrape", error, jsonMode);
  process.exitCode = 1;
});
