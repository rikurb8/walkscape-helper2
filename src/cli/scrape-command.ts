import { Args, Command, Flags } from "@oclif/core";
import ora from "ora";

import { printJson } from "../cli-output.js";
import { printScrapeSummary, runScrape, SUPPORTED_COLLECTIONS } from "../scraper/index.js";
import type { ScrapeProgressEvent } from "../scraper/types.js";
import { parseCollections } from "./scrape/collections.js";
import { renderScrapeHelp } from "./scrape/help.js";
import { formatProgress } from "./scrape/progress.js";
import { printSavedDocs, readSavedDocs } from "./scrape/saved-docs.js";
import { toStructuredScrapeSummary } from "./scrape/summary.js";

class ScrapeCommandCli extends Command {
  static override summary = "Scrape WalkScape wiki pages into local docs/raw outputs";

  static override args = {
    collections: Args.string({
      required: false,
      description: "Optional collection list (comma-separated)"
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
      default: true,
      description: "Skip rewriting unchanged pages by comparing source_oldid (default)"
    }),
    full: Flags.boolean({
      default: false,
      description: "Disable incremental mode and force full rewrite"
    }),
    collections: Flags.string({
      char: "c",
      multiple: true,
      description: "Collections to scrape (repeat flag or comma-separated list)"
    }),
    "print-docs": Flags.boolean({
      char: "p",
      default: false,
      description: "Print saved docs after scrape"
    }),
    json: Flags.boolean({
      default: false,
      description: "Output machine-readable JSON"
    })
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ScrapeCommandCli);
    const jsonMode = flags.json;

    if (flags.help) {
      const helpText = renderScrapeHelp(SUPPORTED_COLLECTIONS);

      if (jsonMode) {
        printJson({
          mode: "scrape",
          ok: true,
          help: helpText
        });
        return;
      }

      this.log(helpText);
      return;
    }

    const collections = parseCollections(args.collections, flags.collections);
    const hasTty = Boolean(process.stdout.isTTY) && !jsonMode;
    const spinner = hasTty
      ? ora({ text: "Charting your local WalkScape wiki map", isEnabled: true }).start()
      : null;

    const onProgress = (event: ScrapeProgressEvent): void => {
      if (jsonMode) {
        return;
      }

      const text = formatProgress(event);

      if (!hasTty) {
        if (event.stage !== "progress" || event.current === event.total) {
          this.log(text);
        }
        return;
      }

      if (event.stage === "warning") {
        spinner?.warn(text);
        spinner?.start("Continuing scrape");
        return;
      }

      if (spinner) {
        spinner.text = text;
      }
    };

    try {
      const result = await runScrape({
        collections,
        incremental: flags.full ? false : flags.incremental,
        onProgress
      });

      const savedDocs = flags["print-docs"] ? await readSavedDocs(result.summary) : null;

      if (spinner) {
        spinner.succeed(`Completed scrape (${result.collections.join(", ")})`);
      } else if (!jsonMode) {
        this.log(`Completed scrape (${result.collections.join(", ")})`);
      }

      if (jsonMode) {
        printJson({
          mode: "scrape",
          ok: true,
          collections: result.collections,
          sectionCount: result.sectionCount,
          stats: toStructuredScrapeSummary(result.summary),
          savedDocs: savedDocs?.documents ?? [],
          savedDocWarnings: savedDocs?.warnings ?? []
        });
        return;
      }

      printScrapeSummary(result);

      if (savedDocs) {
        printSavedDocs(savedDocs);
      }
    } catch (error) {
      spinner?.fail("Scrape failed");
      throw error;
    }
  }
}

export function isJsonModeArgv(argv: string[]): boolean {
  return argv.includes("--json");
}

export async function runScrapeCommandCli(argv: string[]): Promise<void> {
  await ScrapeCommandCli.run(argv);
}
