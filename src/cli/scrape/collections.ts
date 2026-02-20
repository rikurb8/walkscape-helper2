import { isScrapeCollection, SUPPORTED_COLLECTIONS } from "../../scraper/index.js";
import type { ScrapeCollection } from "../../scraper/types.js";

export function parseCollections(
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
