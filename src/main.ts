import { promises as fs } from "node:fs";
import path from "node:path";

import { Args, Command, Flags } from "@oclif/core";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import ora from "ora";

import { printCommandError, printJson } from "./cli-output.js";
import {
  isScrapeCollection,
  printScrapeSummary,
  runScrape,
  SUPPORTED_COLLECTIONS
} from "./scraper/index.js";
import type { ScrapeCollection, ScrapeProgressEvent } from "./scraper/types.js";

marked.use(markedTerminal() as any);

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
      if (jsonMode) {
        printJson({
          mode: "scrape",
          ok: true,
          help: renderHelp()
        });
        return;
      }

      this.log(renderHelp());
      return;
    }

    const collections = parseCollections(args.collections, flags.collections);
    const hasTty = Boolean(process.stdout.isTTY) && !jsonMode;
    const spinner = hasTty
      ? ora({ text: "Charting your local WalkScape wiki map", isEnabled: true }).start()
      : null;
    const progressEvents: ScrapeProgressEvent[] = [];

    const onProgress = (event: ScrapeProgressEvent): void => {
      if (jsonMode) {
        progressEvents.push(event);
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
          summary: result.summary,
          progress: progressEvents,
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

interface SavedDoc {
  path: string;
  markdown: string;
}

interface SavedDocsReadResult {
  documents: SavedDoc[];
  warnings: string[];
}

function formatProgress(event: ScrapeProgressEvent): string {
  const phase = event.phase === "collect" ? "COLLECT" : "WRITE";
  const progress =
    typeof event.current === "number" && typeof event.total === "number"
      ? ` ${event.current}/${event.total}`
      : "";
  const scopeParts = [event.sectionTitle, event.pageTitle].filter((value): value is string =>
    Boolean(value)
  );
  const scope = scopeParts.length ? ` (${scopeParts.join(" > ")})` : "";
  const stageLabel = event.stage === "warning" ? "WARN" : "INFO";

  return `[${phase}${progress}] ${stageLabel}: ${event.message}${scope}`;
}

function renderHelp(): string {
  const supportedCollections = SUPPORTED_COLLECTIONS.join(", ");
  return [
    "Scrape WalkScape wiki pages into local docs/raw outputs",
    "",
    "Usage:",
    "  tsx src/main.ts [collection-a,collection-b] [--collections <name>]... [--incremental] [--full] [--print-docs] [--json]",
    "",
    `Collections: ${supportedCollections}`,
    "If no collections are provided, all collections are scraped.",
    "",
    "Flags:",
    "  -h, --help         Show help",
    "  -c, --collections  Collections to scrape (repeat flag or comma-separated list)",
    "  -i, --incremental  Skip rewriting unchanged pages by comparing source_oldid (default)",
    "      --full         Disable incremental mode and force full rewrite",
    "  -p, --print-docs   Print saved docs after scrape",
    "      --json         Output machine-readable JSON",
    ""
  ].join("\n");
}

async function readSavedDocs(summary: Record<string, unknown>): Promise<SavedDocsReadResult> {
  const docPaths = getSavedDocPaths(summary);

  if (!docPaths.length) {
    return {
      documents: [],
      warnings: []
    };
  }

  const documents: SavedDoc[] = [];
  const warnings: string[] = [];

  for (const docPath of docPaths) {
    const absolutePath = path.resolve(process.cwd(), docPath);

    let markdown: string;
    try {
      markdown = await fs.readFile(absolutePath, "utf-8");
    } catch {
      warnings.push(`Could not read saved doc: ${docPath}`);
      continue;
    }

    documents.push({
      path: docPath,
      markdown: stripFrontmatter(markdown).trim() || "_(empty document)_"
    });
  }

  return {
    documents,
    warnings
  };
}

function printSavedDocs(result: SavedDocsReadResult): void {
  if (!result.documents.length) {
    console.log("No saved docs found to print.");
    return;
  }

  console.log(`\n=== Saved Docs (${result.documents.length}) ===`);

  for (const doc of result.documents) {
    const rendered = marked.parse(doc.markdown) as string;

    console.log(`\n--- ${doc.path} ---`);
    console.log(rendered.trimEnd());
  }

  for (const warning of result.warnings) {
    console.warn(warning);
  }
}

function getSavedDocPaths(summary: Record<string, unknown>): string[] {
  const sections = summary.sections;
  if (!Array.isArray(sections)) {
    return [];
  }

  const docPaths = new Set<string>();

  for (const section of sections) {
    if (typeof section !== "object" || !section) {
      continue;
    }

    const outputFiles = (section as { output_files?: unknown }).output_files;
    if (!Array.isArray(outputFiles)) {
      continue;
    }

    for (const outputFile of outputFiles) {
      if (typeof outputFile !== "string") {
        continue;
      }

      if (outputFile.startsWith("docs/") && outputFile.endsWith(".md")) {
        docPaths.add(outputFile);
      }
    }
  }

  return [...docPaths];
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

function parseCollections(
  argValue?: string,
  flagValues?: string[]
): ScrapeCollection[] | undefined {
  const rawValues = [argValue ?? "", ...(flagValues ?? [])]
    .join(",")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!rawValues.length) {
    return undefined;
  }

  const deduped: ScrapeCollection[] = [];
  const seen = new Set<ScrapeCollection>();

  for (const value of rawValues) {
    if (!isScrapeCollection(value)) {
      throw new Error(
        `Unknown collection '${value}'. Supported collections: ${SUPPORTED_COLLECTIONS.join(", ")}`
      );
    }

    if (!seen.has(value)) {
      deduped.push(value);
      seen.add(value);
    }
  }

  return deduped;
}

const jsonMode = process.argv.includes("--json");

void ScrapeCommandCli.run(process.argv.slice(2)).catch((error) => {
  printCommandError("scrape", error, jsonMode);
  process.exitCode = 1;
});
