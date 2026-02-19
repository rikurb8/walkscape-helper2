import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderMarkdownTables, renderStructuredData } from "./extract.js";
import { rewriteInternalLinks } from "./link-rewrite.js";
import type { CollectionResult, PageRecord, ScrapeCollection, ScrapeProgressHandler, WriteStats } from "./types.js";
import { asciiJsonStringify, normalizeTitle, safeReadDir, toPosix } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");

interface WriteCollectionsInput {
  selectedCollections: ScrapeCollection[];
  incremental: boolean;
  requestCount: number;
  onProgress?: ScrapeProgressHandler;
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

export async function writeCollectionsOutput(
  collections: CollectionResult[],
  input: WriteCollectionsInput
): Promise<Record<string, unknown>> {
  await prepareOutputDirectories(collections);
  const writeStats = await writeCollectionOutputs(collections, input.incremental, input.onProgress);

  input.onProgress?.({
    phase: "write",
    stage: "progress",
    message: "Updating docs index and VitePress navigation"
  });

  await writeDocsIndex(collections);
  await writeVitePressConfig(collections);
  return writeReport(collections, input.selectedCollections, input.incremental, input.requestCount, writeStats);
}

async function prepareOutputDirectories(collections: CollectionResult[]): Promise<void> {
  const docsRoot = path.join(PROJECT_ROOT, "docs", "wiki");
  const rawRoot = path.join(PROJECT_ROOT, "data", "raw");

  await fs.mkdir(docsRoot, { recursive: true });
  await fs.mkdir(path.join(PROJECT_ROOT, "docs", ".vitepress"), { recursive: true });
  await fs.mkdir(rawRoot, { recursive: true });
  await fs.mkdir(path.join(PROJECT_ROOT, "reports"), { recursive: true });

  for (const collection of collections) {
    await fs.mkdir(path.join(docsRoot, collection.sectionSlug), { recursive: true });
    await fs.mkdir(path.join(rawRoot, collection.sectionSlug), { recursive: true });
  }
}

async function writeCollectionOutputs(
  collections: CollectionResult[],
  incremental: boolean,
  onProgress?: ScrapeProgressHandler
): Promise<WriteStats> {
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
  const totalPages = allPages.length;
  let completedPages = 0;

  onProgress?.({
    phase: "write",
    stage: "start",
    message: `Writing ${totalPages} page(s)`,
    current: completedPages,
    total: totalPages
  });

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

    completedPages += 1;
    onProgress?.({
      phase: "write",
      stage: "progress",
      message: `Processed ${page.title}`,
      sectionTitle: page.sectionTitle,
      pageTitle: page.title,
      current: completedPages,
      total: totalPages
    });
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

  onProgress?.({
    phase: "write",
    stage: "complete",
    message: `Output complete: ${stats.docsWritten} docs written, ${stats.docsSkipped} docs skipped`,
    current: totalPages,
    total: totalPages
  });

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
    lines.push(`- [${collection.sectionTitle}](wiki/${collection.sectionSlug}/)`);
  }
  lines.push("");

  await fs.writeFile(path.join(PROJECT_ROOT, "docs", "index.md"), `${lines.join("\n")}`, "utf-8");
}

async function writeVitePressConfig(collections: CollectionResult[]): Promise<void> {
  const nav = buildVitePressNav(collections);
  const sidebar = buildVitePressSidebar(collections);
  const configText = [
    'import { defineConfig } from "vitepress";',
    "",
    `const nav = ${asciiJsonStringify(nav)};`,
    "",
    `const sidebar = ${asciiJsonStringify(sidebar)};`,
    "",
    "export default defineConfig({",
    '  title: "WalkScape Wiki Scraper",',
    '  description: "Local validation viewer for scraped WalkScape markdown",',
    "  cleanUrls: true,",
    "  themeConfig: {",
    "    nav,",
    "    sidebar,",
    "    search: {",
    '      provider: "local"',
    "    }",
    "  }",
    "});",
    ""
  ].join("\n");

  const configFile = path.join(PROJECT_ROOT, "docs", ".vitepress", "config.mts");
  await fs.writeFile(configFile, configText, "utf-8");
}

function buildVitePressNav(collections: CollectionResult[]): Array<{ text: string; link: string }> {
  const nav = [{ text: "Home", link: "/" }];
  for (const collection of collections) {
    nav.push({
      text: collection.sectionTitle,
      link: `/wiki/${collection.sectionSlug}/`
    });
  }
  return nav;
}

function buildVitePressSidebar(
  collections: CollectionResult[]
): Array<{ text: string; items: Array<{ text: string; link: string }> }> {
  const sidebar: Array<{ text: string; items: Array<{ text: string; link: string }> }> = [];
  for (const collection of collections) {
    const items: Array<{ text: string; link: string }> = [{ text: "Overview", link: `/wiki/${collection.sectionSlug}/` }];

    for (const page of collection.pageRecords) {
      if (page.isRoot) {
        continue;
      }
      items.push({ text: page.title, link: toVitePressLink(page.outputRelpath) });
    }

    sidebar.push({ text: collection.sectionTitle, items });
  }

  return sidebar;
}

function toVitePressLink(markdownRelpath: string): string {
  const withoutExtension = toPosix(markdownRelpath).replace(/\.md$/i, "");
  if (withoutExtension === "index") {
    return "/";
  }
  if (withoutExtension.endsWith("/index")) {
    return `/${withoutExtension.slice(0, -"/index".length)}/`;
  }
  return `/${withoutExtension}`;
}

async function writeReport(
  collections: CollectionResult[],
  selectedCollections: ScrapeCollection[],
  incremental: boolean,
  requestCount: number,
  writeStats: WriteStats
): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {
    mode: "scrape",
    collections: selectedCollections,
    incremental,
    sections: [],
    pages_generated_total: 0,
    tables_found_total: 0,
    request_count: requestCount,
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

  const reportName = "scrape_report.json";
  const reportPath = path.join(PROJECT_ROOT, "reports", reportName);
  await fs.writeFile(reportPath, asciiJsonStringify(report), "utf-8");

  return report;
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
