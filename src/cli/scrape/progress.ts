import type { ScrapeProgressEvent } from "../../scraper/types.js";

export function formatProgress(event: ScrapeProgressEvent): string {
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
