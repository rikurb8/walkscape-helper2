import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchParsedPage, type ParsedPage } from "./api.js";
import {
  extractDocument,
  renderMarkdownTables,
  renderStructuredData,
  type ExtractedDocument,
  type ExtractedTable
} from "./extract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const WIKI_LINK_PATTERN = /\[([^\]]+)\]\((https:\/\/wiki\.walkscape\.app\/wiki\/[^\s)]+)(?:\s+"[^"]*")?\)/g;

interface PageRecord {
  sectionSlug: string;
  sectionTitle: string;
  title: string;
  slug: string;
  isRoot: boolean;
  parsed: ParsedPage;
  extracted: ExtractedDocument;
  outputRelpath: string;
}

interface CollectionResult {
  sectionSlug: string;
  sectionTitle: string;
  rootTitle: string;
  pageRecords: PageRecord[];
  warnings: string[];
}

interface WriteStats {
  docsWritten: number;
  docsSkipped: number;
  docsRemoved: number;
  rawWritten: number;
  rawSkipped: number;
  rawRemoved: number;
}

type FetchCache = Map<string, { parsed: ParsedPage; extracted: ExtractedDocument }>;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const incremental = args.includes("--incremental");

  if (command === "scrape-skills") {
    await scrapeSkills(incremental);
    return;
  }

  if (command === "scrape-wiki") {
    await scrapeWiki(incremental);
    return;
  }

  printUsage();
  process.exitCode = 1;
}

async function scrapeSkills(incremental = false): Promise<void> {
  const { collections, summary } = await runCollections(false, incremental);
  printSummary(collections, summary);
}

async function scrapeWiki(incremental = false): Promise<void> {
  const { collections, summary } = await runCollections(true, incremental);
  printSummary(collections, summary);
}

async function runCollections(
  includeExtended: boolean,
  incremental: boolean
): Promise<{ collections: CollectionResult[]; summary: Record<string, unknown> }> {
  const fetchCache: FetchCache = new Map();
  const collections: CollectionResult[] = [];

  collections.push(await buildSkillsCollection(fetchCache));

  if (includeExtended) {
    collections.push(await buildSinglePageCollection("core-mechanics", "Core Mechanics", "Core Mechanics", fetchCache));
    collections.push(await buildActivitiesCollection(fetchCache));
    collections.push(await buildSinglePageCollection("recipes", "Recipes", "Recipes", fetchCache));
  }

  await prepareOutputDirectories(collections);
  const writeStats = await writeCollectionOutputs(collections, incremental);
  await writeDocsIndex(collections);
  await writeMkdocsConfig(collections);
  const summary = await writeReport(collections, includeExtended, incremental, writeStats);

  return { collections, summary };
}

async function buildSkillsCollection(fetchCache: FetchCache): Promise<CollectionResult> {
  const { doc: rootDoc } = await fetchPageDocument("Skills", fetchCache);
  const childTitles = deriveSkillTitles(rootDoc.tables);

  return buildCollection({
    sectionSlug: "skills",
    sectionTitle: "Skills",
    rootTitle: "Skills",
    childTitles,
    fetchCache
  });
}

async function buildActivitiesCollection(fetchCache: FetchCache): Promise<CollectionResult> {
  const { parsed: rootPage, doc: rootDoc } = await fetchPageDocument("Activities", fetchCache);
  const childTitles = deriveActivityTitles(rootDoc.tables);

  return buildCollection({
    sectionSlug: "activities",
    sectionTitle: "Activities",
    rootTitle: rootPage.title,
    childTitles,
    fetchCache
  });
}

async function buildSinglePageCollection(
  sectionSlug: string,
  sectionTitle: string,
  rootTitle: string,
  fetchCache: FetchCache
): Promise<CollectionResult> {
  return buildCollection({
    sectionSlug,
    sectionTitle,
    rootTitle,
    childTitles: [],
    fetchCache
  });
}

interface BuildCollectionInput {
  sectionSlug: string;
  sectionTitle: string;
  rootTitle: string;
  childTitles: string[];
  fetchCache: FetchCache;
}

async function buildCollection(input: BuildCollectionInput): Promise<CollectionResult> {
  const warnings: string[] = [];
  const pageRecords: PageRecord[] = [];

  const { parsed: rootPage, doc: rootDoc } = await fetchPageDocument(input.rootTitle, input.fetchCache);
  pageRecords.push({
    sectionSlug: input.sectionSlug,
    sectionTitle: input.sectionTitle,
    title: rootPage.title,
    slug: "index",
    isRoot: true,
    parsed: rootPage,
    extracted: rootDoc,
    outputRelpath: path.join("wiki", input.sectionSlug, "index.md")
  });

  const seenTitles = new Set<string>([normalizeTitle(rootPage.title)]);
  const usedSlugs = new Set<string>(["index"]);

  for (const childTitle of input.childTitles) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to fetch '${childTitle}' in section '${input.sectionTitle}': ${message}`);
    }
  }

  return {
    sectionSlug: input.sectionSlug,
    sectionTitle: input.sectionTitle,
    rootTitle: rootPage.title,
    pageRecords,
    warnings
  };
}

async function fetchPageDocument(
  pageTitle: string,
  fetchCache: FetchCache
): Promise<{ parsed: ParsedPage; doc: ExtractedDocument }> {
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

async function prepareOutputDirectories(collections: CollectionResult[]): Promise<void> {
  const docsRoot = path.join(PROJECT_ROOT, "docs", "wiki");
  const rawRoot = path.join(PROJECT_ROOT, "data", "raw");

  await fs.mkdir(docsRoot, { recursive: true });
  await fs.mkdir(rawRoot, { recursive: true });
  await fs.mkdir(path.join(PROJECT_ROOT, "reports"), { recursive: true });

  for (const collection of collections) {
    await fs.mkdir(path.join(docsRoot, collection.sectionSlug), { recursive: true });
    await fs.mkdir(path.join(rawRoot, collection.sectionSlug), { recursive: true });
  }
}

async function writeCollectionOutputs(collections: CollectionResult[], incremental: boolean): Promise<WriteStats> {
  const stats: WriteStats = {
    docsWritten: 0,
    docsSkipped: 0,
    docsRemoved: 0,
    rawWritten: 0,
    rawSkipped: 0,
    rawRemoved: 0
  };

  const allPages = collections.flatMap((collection) => collection.pageRecords);
  const titleToPath = buildTitleToPathMap(allPages);
  const expectedDocPaths = new Set<string>();
  const expectedRawPaths = new Set<string>();

  for (const page of allPages) {
    const outputFile = path.join(PROJECT_ROOT, "docs", page.outputRelpath);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    expectedDocPaths.add(path.resolve(outputFile));

    const upToDateDoc = incremental && (await isMarkdownUpToDate(outputFile, page.parsed.revid));
    if (upToDateDoc) {
      stats.docsSkipped += 1;
    } else {
      const body = rewriteInternalLinks(page.extracted.bodyMarkdown, page.outputRelpath, titleToPath);
      const markdownTables = renderMarkdownTables(page.extracted.tables);
      const structuredData = renderStructuredData(page.extracted.tables);

      const markdown = renderPageMarkdown({
        title: page.title,
        sourceUrl: page.parsed.sourceUrl,
        sourceOldid: page.parsed.revid,
        scrapedAt: page.extracted.scrapedAt,
        categories: page.parsed.categories,
        body,
        markdownTables,
        structuredData
      });

      await fs.writeFile(outputFile, markdown, "utf-8");
      stats.docsWritten += 1;
    }

    const rawFile = path.join(PROJECT_ROOT, "data", "raw", page.sectionSlug, `${page.slug}_parse.json`);
    await fs.mkdir(path.dirname(rawFile), { recursive: true });
    expectedRawPaths.add(path.resolve(rawFile));

    const upToDateRaw = incremental && (await isRawUpToDate(rawFile, page.parsed.revid));
    if (upToDateRaw) {
      stats.rawSkipped += 1;
    } else {
      await fs.writeFile(rawFile, asciiJsonStringify(page.parsed.rawPayload), "utf-8");
      stats.rawWritten += 1;
    }
  }

  for (const collection of collections) {
    const sectionDocsDir = path.join(PROJECT_ROOT, "docs", "wiki", collection.sectionSlug);
    const sectionRawDir = path.join(PROJECT_ROOT, "data", "raw", collection.sectionSlug);

    for (const item of await safeReadDir(sectionDocsDir)) {
      if (!item.endsWith(".md")) {
        continue;
      }
      const target = path.resolve(path.join(sectionDocsDir, item));
      if (!expectedDocPaths.has(target)) {
        await fs.unlink(target);
        stats.docsRemoved += 1;
      }
    }

    for (const item of await safeReadDir(sectionRawDir)) {
      if (!item.endsWith(".json")) {
        continue;
      }
      const target = path.resolve(path.join(sectionRawDir, item));
      if (!expectedRawPaths.has(target)) {
        await fs.unlink(target);
        stats.rawRemoved += 1;
      }
    }
  }

  return stats;
}

function buildTitleToPathMap(allPages: PageRecord[]): Map<string, string> {
  const mapping = new Map<string, string>();
  for (const page of allPages) {
    const key = normalizeTitle(page.title);
    if (!mapping.has(key)) {
      mapping.set(key, page.outputRelpath);
    }
  }
  return mapping;
}

async function writeDocsIndex(collections: CollectionResult[]): Promise<void> {
  const lines = ["# WalkScape Wiki Scraper", ""];
  for (const collection of collections) {
    lines.push(`- [${collection.sectionTitle}](wiki/${collection.sectionSlug}/index.md)`);
  }
  lines.push("");

  await fs.writeFile(path.join(PROJECT_ROOT, "docs", "index.md"), `${lines.join("\n")}`, "utf-8");
}

async function writeMkdocsConfig(collections: CollectionResult[]): Promise<void> {
  const navLines = [
    "site_name: WalkScape Wiki Scraper",
    "site_description: Local validation viewer for scraped WalkScape markdown",
    "theme:",
    "  name: material",
    "",
    "nav:",
    "  - Home: index.md"
  ];

  for (const collection of collections) {
    navLines.push(`  - ${yamlQuote(collection.sectionTitle)}:`);
    navLines.push(`      - Overview: wiki/${collection.sectionSlug}/index.md`);

    for (const page of collection.pageRecords) {
      if (page.isRoot) {
        continue;
      }
      navLines.push(`      - ${yamlQuote(page.title)}: wiki/${collection.sectionSlug}/${page.slug}.md`);
    }
  }

  navLines.push(
    "",
    "markdown_extensions:",
    "  - tables",
    "  - admonition",
    "  - toc:",
    "      permalink: true",
    ""
  );

  await fs.writeFile(path.join(PROJECT_ROOT, "mkdocs.yml"), navLines.join("\n"), "utf-8");
}

async function writeReport(
  collections: CollectionResult[],
  includeExtended: boolean,
  incremental: boolean,
  writeStats: WriteStats
): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {
    mode: includeExtended ? "scrape-wiki" : "scrape-skills",
    incremental,
    sections: [],
    pages_generated_total: 0,
    tables_found_total: 0,
    write_stats: {
      docs_written: writeStats.docsWritten,
      docs_skipped: writeStats.docsSkipped,
      docs_removed: writeStats.docsRemoved,
      raw_written: writeStats.rawWritten,
      raw_skipped: writeStats.rawSkipped,
      raw_removed: writeStats.rawRemoved
    },
    warnings: []
  };

  const sections = report.sections as Record<string, unknown>[];
  const warnings = report.warnings as string[];

  for (const collection of collections) {
    const sectionTables = collection.pageRecords.reduce((sum, page) => sum + page.extracted.tables.length, 0);
    const sectionOutputFiles = collection.pageRecords.map((page) => `docs/${toPosix(page.outputRelpath)}`);
    sections.push({
      section: collection.sectionTitle,
      section_slug: collection.sectionSlug,
      root_title: collection.rootTitle,
      pages_generated: collection.pageRecords.length,
      tables_found: sectionTables,
      output_files: sectionOutputFiles,
      warnings: collection.warnings
    });

    report.pages_generated_total = (report.pages_generated_total as number) + collection.pageRecords.length;
    report.tables_found_total = (report.tables_found_total as number) + sectionTables;
    warnings.push(...collection.warnings);
  }

  const reportName = includeExtended ? "wiki_scrape_report.json" : "skills_scrape_report.json";
  const reportPath = path.join(PROJECT_ROOT, "reports", reportName);
  await fs.writeFile(reportPath, asciiJsonStringify(report), "utf-8");

  return report;
}

function printSummary(collections: CollectionResult[], summary: Record<string, unknown>): void {
  const pagesGenerated = Number(summary.pages_generated_total ?? 0);
  const tablesFound = Number(summary.tables_found_total ?? 0);
  const writeStats = (summary.write_stats as Record<string, unknown>) ?? {};

  console.log(`Generated ${pagesGenerated} page(s) across ${collections.length} section(s)`);
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

async function isMarkdownUpToDate(markdownFile: string, sourceOldid: number | null): Promise<boolean> {
  try {
    await fs.access(markdownFile);
  } catch {
    return false;
  }

  const existingOldid = await readSourceOldidFromMarkdown(markdownFile);
  return existingOldid === sourceOldid;
}

async function isRawUpToDate(rawFile: string, sourceOldid: number | null): Promise<boolean> {
  try {
    const text = await fs.readFile(rawFile, "utf-8");
    const payload = JSON.parse(text) as { parse?: { revid?: unknown } };
    return payload.parse?.revid === sourceOldid;
  } catch {
    return false;
  }
}

async function readSourceOldidFromMarkdown(markdownFile: string): Promise<number | null> {
  let text: string;
  try {
    text = await fs.readFile(markdownFile, "utf-8");
  } catch {
    return null;
  }

  if (!text.startsWith("---\n")) {
    return null;
  }

  const lines = text.split(/\r?\n/);
  const limit = Math.min(lines.length, 80);
  for (let i = 1; i < limit; i += 1) {
    const line = lines[i];
    if (line.trim() === "---") {
      break;
    }

    if (line.startsWith("source_oldid:")) {
      const value = line.split(":", 2)[1]?.trim() ?? "";
      if (value === "null") {
        return null;
      }

      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
  }

  return null;
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

interface RenderPageMarkdownInput {
  title: string;
  sourceUrl: string;
  sourceOldid: number | null;
  scrapedAt: string;
  categories: string[];
  body: string;
  markdownTables: string;
  structuredData: string;
}

function renderPageMarkdown(input: RenderPageMarkdownInput): string {
  const categoryLines = input.categories.length
    ? ["categories:", ...input.categories.map((category) => `  - "${category}"`)]
    : ["categories: []"];

  const frontmatter = [
    "---",
    `title: "${input.title}"`,
    `source_url: "${input.sourceUrl}"`,
    `source_oldid: ${input.sourceOldid ?? "null"}`,
    `scraped_at: "${input.scrapedAt}"`,
    ...categoryLines,
    "---",
    ""
  ].join("\n");

  const sections = [frontmatter, `# ${input.title}\n\n${input.body.trim()}`];
  if (input.markdownTables) {
    sections.push(`## Extracted Tables\n\n${input.markdownTables}`);
  }
  sections.push(`## Structured Data\n\n\`\`\`json\n${input.structuredData}\n\`\`\``);

  return `${sections.join("\n\n").trimEnd()}\n`;
}

function rewriteInternalLinks(markdown: string, currentPath: string, titleToPath: Map<string, string>): string {
  return markdown.replace(WIKI_LINK_PATTERN, (match, label: string, url: string) => {
    const [title] = titleFromWikiUrl(url);
    if (!title) {
      return match;
    }

    const target = titleToPath.get(normalizeTitle(title));
    if (!target) {
      return match;
    }

    const rel = path.relative(path.dirname(currentPath), target).split(path.sep).join("/");
    return `[${label}](${rel})`;
  });
}

function titleFromWikiUrl(url: string): [string | null, string | null] {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [null, null];
  }

  if (!parsed.pathname.startsWith("/wiki/")) {
    return [null, null];
  }

  let wikiPath = decodeURIComponent(parsed.pathname.slice("/wiki/".length));
  if (wikiPath.startsWith("Special:MyLanguage/")) {
    const [, rest] = wikiPath.split("/", 2);
    wikiPath = rest ?? "";
  }

  const title = wikiPath.replace(/_/g, " ").trim();
  if (!title) {
    return [null, null];
  }

  const fragment = parsed.hash ? parsed.hash.slice(1).trim() : null;
  return [title, fragment || null];
}

function normalizeTitle(title: string): string {
  return title.replace(/_/g, " ").trim().replace(/\s+/g, " ").toLowerCase();
}

function slugifyTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";
}

function uniqueSlug(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function yamlQuote(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function asciiJsonStringify(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7F]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

async function safeReadDir(directory: string): Promise<string[]> {
  try {
    return await fs.readdir(directory);
  } catch {
    return [];
  }
}

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function printUsage(): void {
  console.error("Usage: tsx src/main.ts <scrape-skills|scrape-wiki> [--incremental]");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
