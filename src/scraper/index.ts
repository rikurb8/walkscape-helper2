import { collectSections } from "./collections.js";
import {
  type ScrapeCommand,
  type ScrapeOptions,
  type ScrapeRunResult,
  SUPPORTED_SCRAPE_COMMANDS
} from "./types.js";
import { writeCollectionsOutput } from "./writers.js";

export { SUPPORTED_SCRAPE_COMMANDS } from "./types.js";
export type { ScrapeCommand, ScrapeOptions, ScrapeRunResult } from "./types.js";

export function isScrapeCommand(command: string): command is ScrapeCommand {
  return (SUPPORTED_SCRAPE_COMMANDS as readonly string[]).includes(command);
}

export async function runScrape(command: ScrapeCommand, options: ScrapeOptions = {}): Promise<ScrapeRunResult> {
  const incremental = options.incremental ?? false;
  const includeExtended = command === "scrape-wiki";
  const onProgress = options.onProgress;
  const collections = await collectSections(includeExtended, onProgress);
  const summary = await writeCollectionsOutput(collections, { includeExtended, incremental, onProgress });

  return {
    command,
    sectionCount: collections.length,
    summary
  };
}

export function printScrapeSummary(result: ScrapeRunResult): void {
  const { sectionCount, summary } = result;
  const pagesGenerated = Number(summary.pages_generated_total ?? 0);
  const tablesFound = Number(summary.tables_found_total ?? 0);
  const writeStats = (summary.write_stats as Record<string, unknown>) ?? {};

  console.log(`Generated ${pagesGenerated} page(s) across ${sectionCount} section(s)`);
  console.log(`Extracted ${tablesFound} table(s) total`);

  const docsWritten = writeStats.docs_written;
  const docsSkipped = writeStats.docs_skipped;
  if (typeof docsWritten === "number" && typeof docsSkipped === "number") {
    console.log(`Docs written: ${docsWritten}, skipped: ${docsSkipped}`);
  }

  const warnings = summary.warnings;
  if (Array.isArray(warnings) && warnings.length) {
    console.log(`Warnings: ${warnings.length}`);
  }
}
