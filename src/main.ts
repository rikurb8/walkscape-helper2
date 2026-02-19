import { Args, Command, Flags } from "@oclif/core";
import ora from "ora";

import { printScrapeSummary, runScrape, SUPPORTED_SCRAPE_COMMANDS } from "./scraper/index.js";
import type { ScrapeCommand, ScrapeProgressEvent } from "./scraper/types.js";

const SCRAPE_COMMAND_OPTIONS = [...SUPPORTED_SCRAPE_COMMANDS];

class ScrapeCommandCli extends Command {
  static override summary = "Scrape WalkScape wiki pages into local docs/raw outputs";

  static override args = {
    command: Args.string({
      required: false,
      options: SCRAPE_COMMAND_OPTIONS,
      description: "Scrape mode"
    })
  };

  static override flags = {
    help: Flags.boolean({
      char: "h",
      default: false,
      description: "Show help"
    }),
    incremental: Flags.boolean({
      char: "i",
      default: false,
      description: "Skip rewriting unchanged pages by comparing source_oldid"
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ScrapeCommandCli);

    if (flags.help) {
      this.log(renderHelp());
      return;
    }

    if (!args.command) {
      this.log(renderHelp());
      this.exit(1);
      return;
    }

    const command = args.command as ScrapeCommand;
    const hasTty = Boolean(process.stdout.isTTY);
    const spinner = ora({ text: "Starting scrape", isEnabled: hasTty }).start();

    const onProgress = (event: ScrapeProgressEvent): void => {
      const text = formatProgress(event);

      if (!hasTty) {
        if (event.stage !== "progress" || event.current === event.total) {
          this.log(text);
        }
        return;
      }

      if (event.stage === "warning") {
        spinner.warn(text);
        spinner.start("Continuing scrape");
        return;
      }

      spinner.text = text;
    };

    try {
      const result = await runScrape(command, {
        incremental: flags.incremental,
        onProgress
      });

      spinner.succeed(`Completed ${result.command}`);
      printScrapeSummary(result);
    } catch (error) {
      spinner.fail("Scrape failed");
      throw error;
    }
  }
}

function formatProgress(event: ScrapeProgressEvent): string {
  const phase = event.phase === "collect" ? "Collect" : "Write";
  const progress =
    typeof event.current === "number" && typeof event.total === "number" ? ` ${event.current}/${event.total}` : "";
  const scopeParts = [event.sectionTitle, event.pageTitle].filter((value): value is string => Boolean(value));
  const scope = scopeParts.length ? ` (${scopeParts.join(" > ")})` : "";
  const prefix = event.stage === "warning" ? "Warning: " : "";

  return `${phase}${progress}: ${prefix}${event.message}${scope}`;
}

function renderHelp(): string {
  return [
    "Scrape WalkScape wiki pages into local docs/raw outputs",
    "",
    "Usage:",
    "  tsx src/main.ts <scrape-skills|scrape-wiki> [--incremental]",
    "",
    "Flags:",
    "  -h, --help         Show help",
    "  -i, --incremental  Skip rewriting unchanged pages by comparing source_oldid",
    ""
  ].join("\n");
}

void ScrapeCommandCli.run(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
