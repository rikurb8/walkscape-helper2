export function toStructuredScrapeSummary(summary: Record<string, unknown>): {
  pagesGenerated: number;
  tablesExtracted: number;
  mediaWikiRequests: number;
  docs: {
    written: number;
    skipped: number;
    removed: number;
  };
  warningsCount: number;
} {
  const writeStats =
    summary.write_stats && typeof summary.write_stats === "object"
      ? (summary.write_stats as Record<string, unknown>)
      : {};
  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];

  return {
    pagesGenerated: toNumber(summary.pages_generated_total),
    tablesExtracted: toNumber(summary.tables_found_total),
    mediaWikiRequests: toNumber(summary.request_count),
    docs: {
      written: toNumber(writeStats.docs_written),
      skipped: toNumber(writeStats.docs_skipped),
      removed: toNumber(writeStats.docs_removed)
    },
    warningsCount: warnings.length
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return 0;
}
