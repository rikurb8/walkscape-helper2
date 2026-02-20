export function renderScrapeHelp(supportedCollections: readonly string[]): string {
  return [
    "Scrape WalkScape wiki pages into local docs/raw outputs",
    "",
    "Usage:",
    "  tsx src/main.ts [collection-a,collection-b] [--collections <name>]... [--incremental] [--full] [--print-docs] [--json]",
    "",
    `Collections: ${supportedCollections.join(", ")}`,
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
