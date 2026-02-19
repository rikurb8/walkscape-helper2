import { getRequestCount, resetRequestCount } from "./api.js";
import { collectSections } from "./collections.js";
import {
  type ScrapeCollection,
  type ScrapeOptions,
  type ScrapeRunResult,
  SUPPORTED_COLLECTIONS
} from "./types.js";
import { writeCollectionsOutput } from "./writers.js";

export { SUPPORTED_COLLECTIONS } from "./types.js";
export type { ScrapeCollection, ScrapeOptions, ScrapeRunResult } from "./types.js";

export function isScrapeCollection(collection: string): collection is ScrapeCollection {
  return (SUPPORTED_COLLECTIONS as readonly string[]).includes(collection);
}

export async function runScrape(options: ScrapeOptions = {}): Promise<ScrapeRunResult> {
  const collections = options.collections ?? [...SUPPORTED_COLLECTIONS];
  const incremental = options.incremental ?? false;
  const onProgress = options.onProgress;

  resetRequestCount();
  const sectionCollections = await collectSections(collections, onProgress);
  const requestCount = getRequestCount();
  const summary = await writeCollectionsOutput(sectionCollections, {
    selectedCollections: collections,
    incremental,
    requestCount,
    onProgress
  });

  return {
    collections,
    sectionCount: sectionCollections.length,
    summary
  };
}

export function printScrapeSummary(result: ScrapeRunResult): void {
  const { sectionCount, summary } = result;
  const pagesGenerated = Number(summary.pages_generated_total ?? 0);
  const tablesFound = Number(summary.tables_found_total ?? 0);
  const requestCount = Number(summary.request_count ?? 0);
  const writeStats = (summary.write_stats as Record<string, unknown>) ?? {};

  console.log(`Generated ${pagesGenerated} page(s) across ${sectionCount} section(s)`);
  console.log(`Extracted ${tablesFound} table(s) total`);
  console.log(`MediaWiki requests: ${requestCount}`);

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
