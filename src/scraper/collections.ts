import path from "node:path";

import { fetchParsedPage } from "./api.js";
import { extractDocument, type ExtractedDocument, type ExtractedTable } from "./extract.js";
import type { CollectionResult, FetchCache, ScrapeCollection, ScrapeProgressHandler } from "./types.js";
import { normalizeTitle, slugifyTitle, uniqueSlug } from "./utils.js";

interface BuildCollectionInput {
  sectionSlug: string;
  sectionTitle: string;
  rootTitle: string;
  childTitles: string[];
  fetchCache: FetchCache;
  onProgress?: ScrapeProgressHandler;
}

export async function collectSections(
  selectedCollections: ScrapeCollection[],
  onProgress?: ScrapeProgressHandler
): Promise<CollectionResult[]> {
  const fetchCache: FetchCache = new Map();
  const collections: CollectionResult[] = [];
  const selected = new Set<ScrapeCollection>(selectedCollections);

  if (selected.has("skills")) {
    collections.push(await buildSkillsCollection(fetchCache, onProgress));
  }
  if (selected.has("core-mechanics")) {
    collections.push(
      await buildSinglePageCollection("core-mechanics", "Core Mechanics", "Core Mechanics", fetchCache, onProgress)
    );
  }
  if (selected.has("activities")) {
    collections.push(await buildActivitiesCollection(fetchCache, onProgress));
  }
  if (selected.has("recipes")) {
    collections.push(await buildSinglePageCollection("recipes", "Recipes", "Recipes", fetchCache, onProgress));
  }

  return collections;
}

async function buildSkillsCollection(fetchCache: FetchCache, onProgress?: ScrapeProgressHandler): Promise<CollectionResult> {
  const { doc: rootDoc } = await fetchPageDocument("Skills", fetchCache);
  const childTitles = deriveSkillTitles(rootDoc.tables);

  return buildCollection({
    sectionSlug: "skills",
    sectionTitle: "Skills",
    rootTitle: "Skills",
    childTitles,
    fetchCache,
    onProgress
  });
}

async function buildActivitiesCollection(fetchCache: FetchCache, onProgress?: ScrapeProgressHandler): Promise<CollectionResult> {
  const { parsed: rootPage, doc: rootDoc } = await fetchPageDocument("Activities", fetchCache);
  const childTitles = deriveActivityTitles(rootDoc.tables);

  return buildCollection({
    sectionSlug: "activities",
    sectionTitle: "Activities",
    rootTitle: rootPage.title,
    childTitles,
    fetchCache,
    onProgress
  });
}

async function buildSinglePageCollection(
  sectionSlug: string,
  sectionTitle: string,
  rootTitle: string,
  fetchCache: FetchCache,
  onProgress?: ScrapeProgressHandler
): Promise<CollectionResult> {
  return buildCollection({
    sectionSlug,
    sectionTitle,
    rootTitle,
    childTitles: [],
    fetchCache,
    onProgress
  });
}

async function buildCollection(input: BuildCollectionInput): Promise<CollectionResult> {
  const warnings: string[] = [];
  const uniqueChildTitles = dedupeTitles(input.childTitles);
  const totalPages = uniqueChildTitles.length + 1;
  let completedPages = 0;

  input.onProgress?.({
    phase: "collect",
    stage: "start",
    message: `Collecting section ${input.sectionTitle}`,
    sectionTitle: input.sectionTitle,
    current: completedPages,
    total: totalPages
  });

  const { parsed: rootPage, doc: rootDoc } = await fetchPageDocument(input.rootTitle, input.fetchCache);
  completedPages += 1;
  input.onProgress?.({
    phase: "collect",
    stage: "progress",
    message: `Fetched ${rootPage.title}`,
    sectionTitle: input.sectionTitle,
    pageTitle: rootPage.title,
    current: completedPages,
    total: totalPages
  });

  const pageRecords = [
    {
      sectionSlug: input.sectionSlug,
      sectionTitle: input.sectionTitle,
      title: rootPage.title,
      slug: "index",
      isRoot: true,
      parsed: rootPage,
      extracted: rootDoc,
      outputRelpath: path.join("wiki", input.sectionSlug, "index.md")
    }
  ];

  const seenTitles = new Set<string>([normalizeTitle(rootPage.title)]);
  const usedSlugs = new Set<string>(["index"]);

  for (const childTitle of uniqueChildTitles) {
    const titleKey = normalizeTitle(childTitle);
    if (!titleKey || seenTitles.has(titleKey)) {
      continue;
    }

    seenTitles.add(titleKey);
    try {
      const { parsed: childPage, doc: childDoc } = await fetchPageDocument(childTitle, input.fetchCache);
      const slug = uniqueSlug(slugifyTitle(childPage.title), usedSlugs);

      pageRecords.push({
        sectionSlug: input.sectionSlug,
        sectionTitle: input.sectionTitle,
        title: childPage.title,
        slug,
        isRoot: false,
        parsed: childPage,
        extracted: childDoc,
        outputRelpath: path.join("wiki", input.sectionSlug, `${slug}.md`)
      });
      completedPages += 1;
      input.onProgress?.({
        phase: "collect",
        stage: "progress",
        message: `Fetched ${childPage.title}`,
        sectionTitle: input.sectionTitle,
        pageTitle: childPage.title,
        current: completedPages,
        total: totalPages
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to fetch '${childTitle}' in section '${input.sectionTitle}': ${message}`);
      completedPages += 1;
      input.onProgress?.({
        phase: "collect",
        stage: "warning",
        message: `Failed to fetch ${childTitle}: ${message}`,
        sectionTitle: input.sectionTitle,
        pageTitle: childTitle,
        current: completedPages,
        total: totalPages
      });
    }
  }

  input.onProgress?.({
    phase: "collect",
    stage: "complete",
    message: `Collected ${pageRecords.length} page(s) in ${input.sectionTitle}`,
    sectionTitle: input.sectionTitle,
    current: totalPages,
    total: totalPages
  });

  return {
    sectionSlug: input.sectionSlug,
    sectionTitle: input.sectionTitle,
    rootTitle: rootPage.title,
    pageRecords,
    warnings
  };
}

function dedupeTitles(titles: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const title of titles) {
    const key = normalizeTitle(title);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(title);
  }

  return deduped;
}

async function fetchPageDocument(
  pageTitle: string,
  fetchCache: FetchCache
): Promise<{ parsed: Awaited<ReturnType<typeof fetchParsedPage>>; doc: ExtractedDocument }> {
  const cacheKey = normalizeTitle(pageTitle);
  const cached = fetchCache.get(cacheKey);
  if (cached) {
    return { parsed: cached.parsed, doc: cached.extracted };
  }

  const parsed = await fetchParsedPage(pageTitle);
  const extracted = extractDocument(parsed.html);
  fetchCache.set(cacheKey, { parsed, extracted });
  return { parsed, doc: extracted };
}

function deriveSkillTitles(tables: ExtractedTable[]): string[] {
  if (!tables.length) {
    throw new Error("No tables found on Skills overview page");
  }

  const skillTable = tables[0];
  if (!skillTable.rows.length) {
    throw new Error("No rows found in Skills overview table");
  }

  let candidateColumns = skillTable.columns.filter((column) => column.toLowerCase().startsWith("skill"));
  if (!candidateColumns.length) {
    candidateColumns = skillTable.columns;
  }

  return extractUniqueColumnValues(skillTable.rows, candidateColumns[0]);
}

function deriveActivityTitles(tables: ExtractedTable[]): string[] {
  for (const table of tables) {
    for (const column of table.columns) {
      if (normalizeTitle(column) === "activity name") {
        const titles = extractUniqueColumnValues(table.rows, column);
        if (titles.length) {
          return titles;
        }
      }
    }
  }

  throw new Error("Could not find Activity Name column in Activities tables");
}

function extractUniqueColumnValues(rows: Record<string, string>[], column: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const value = (row[column] ?? "").trim();
    const key = normalizeTitle(value);
    if (key && !seen.has(key)) {
      values.push(value);
      seen.add(key);
    }
  }

  return values;
}
