import { load, type CheerioAPI } from "cheerio";
import TurndownService from "turndown";

export interface ExtractedTable {
  index: number;
  section: string;
  columns: string[];
  rows: Record<string, string>[];
  rowLinks: Record<string, string[]>[];
}

export interface ExtractedDocument {
  bodyMarkdown: string;
  tables: ExtractedTable[];
  scrapedAt: string;
}

export function extractDocument(html: string): ExtractedDocument {
  const $ = load(html);
  const root = $("div.mw-parser-output").first();
  if (!root.length) {
    throw new Error("Could not find mw-parser-output in page HTML");
  }

  normalizeLinks($, root);
  removeNoise($, root);

  const tables = extractTables($, root);
  root.find("table.wikitable").remove();

  const turndownService = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-"
  });

  const bodyMarkdown = cleanMarkdown(turndownService.turndown($.html(root)));
  return {
    bodyMarkdown,
    tables,
    scrapedAt: new Date().toISOString()
  };
}

export function renderMarkdownTables(tables: ExtractedTable[]): string {
  const chunks: string[] = [];
  for (const table of tables) {
    chunks.push(`### Table ${table.index} (${table.section})`);
    chunks.push(renderMarkdownTable(table.columns, table.rows));
  }
  return chunks.join("\n\n").trim();
}

export function renderStructuredData(tables: ExtractedTable[]): string {
  const payload = {
    tables: tables.map((table) => ({
      index: table.index,
      section: table.section,
      columns: table.columns,
      rows: table.rows,
      row_links: table.rowLinks
    }))
  };

  return asciiJsonStringify(payload);
}

function normalizeLinks($: CheerioAPI, root: any): void {
  root.find("a[href]").each((_: number, element: any) => {
    const href = $(element).attr("href") ?? "";
    if (href.startsWith("/wiki/") || href.startsWith("/index.php")) {
      $(element).attr("href", `https://wiki.walkscape.app${href}`);
    }
  });
}

function removeNoise($: CheerioAPI, root: any): void {
  const selectors = [
    "div#toc",
    "div.toc",
    ".mw-editsection",
    "span.mw-editsection",
    ".mw-pt-languages",
    ".navigation-not-searchable",
    "script",
    "style",
    "noscript",
    "sup.reference"
  ];

  for (const selector of selectors) {
    root.find(selector).remove();
  }

  root.find("figure").remove();
  root.find("img").remove();

  root.find("a").each((_: number, element: any) => {
    if (!$(element).text().trim()) {
      $(element).remove();
    }
  });

  root.find("br").each((_: number, element: any) => {
    $(element).replaceWith("\n");
  });

  root.find("table").each((_: number, element: any) => {
    const classes = ($(element).attr("class") ?? "").split(/\s+/).filter(Boolean);
    if (!classes.includes("wikitable")) {
      $(element).remove();
    }
  });
}

function extractTables($: CheerioAPI, root: any): ExtractedTable[] {
  const tables: ExtractedTable[] = [];
  let tableIndex = 1;
  let currentSection = "Introduction";

  root.find("h1, h2, h3, h4, h5, h6, table.wikitable").each((_: number, element: any) => {
    const tag = element.tagName?.toLowerCase();
    if (!tag) {
      return;
    }

    if (/^h[1-6]$/.test(tag)) {
      const heading = $(element).text().trim();
      if (heading) {
        currentSection = heading;
      }
      return;
    }

    if (tag === "table") {
      const { columns, rows, rowLinks } = parseWikitable($, $(element));
      if (columns.length && rows.length) {
        tables.push({
          index: tableIndex,
          section: currentSection,
          columns,
          rows,
          rowLinks
        });
        tableIndex += 1;
      }
    }
  });

  return tables;
}

function parseWikitable($: CheerioAPI, table: any): {
  columns: string[];
  rows: Record<string, string>[];
  rowLinks: Record<string, string[]>[];
} {
  const grid: string[][] = [];
  const linkGrid: string[][][] = [];
  const spanMap = new Map<number, { text: string; links: string[]; remaining: number }>();

  table.find("tr").each((_: number, tr: any) => {
    const row: string[] = [];
    const rowLinks: string[][] = [];
    let col = 0;

    const flushSpansUntil = (targetCol?: number): void => {
      while (spanMap.has(col) && (targetCol === undefined || col < targetCol)) {
        const entry = spanMap.get(col);
        if (!entry) {
          break;
        }
        ensureLength(row, col + 1);
        ensureLinksLength(rowLinks, col + 1);
        row[col] = entry.text;
        rowLinks[col] = [...entry.links];
        if (entry.remaining <= 1) {
          spanMap.delete(col);
        } else {
          spanMap.set(col, { text: entry.text, links: entry.links, remaining: entry.remaining - 1 });
        }
        col += 1;
      }
    };

    const cells = $(tr).children("th, td").toArray();
    for (const cell of cells) {
      flushSpansUntil();
      while (col < row.length && row[col] !== "") {
        col += 1;
      }

      const text = cleanCellText($(cell).text());
      const links = extractCellLinks($, cell);
      const rowspan = safeInt($(cell).attr("rowspan"), 1);
      const colspan = safeInt($(cell).attr("colspan"), 1);

      for (let i = 0; i < colspan; i += 1) {
        ensureLength(row, col + i + 1);
        ensureLinksLength(rowLinks, col + i + 1);
        row[col + i] = text;
        rowLinks[col + i] = [...links];
        if (rowspan > 1) {
          spanMap.set(col + i, { text, links: [...links], remaining: rowspan - 1 });
        }
      }
      col += colspan;
    }

    flushSpansUntil();
    if (row.some((cell) => cell.trim())) {
      grid.push(row);
      linkGrid.push(rowLinks);
    }
  });

  if (!grid.length) {
    return { columns: [], rows: [], rowLinks: [] };
  }

  const maxCols = Math.max(...grid.map((row) => row.length));
  for (let i = 0; i < grid.length; i += 1) {
    ensureLength(grid[i], maxCols);
    ensureLinksLength(linkGrid[i], maxCols);
  }

  let header = normalizeHeaders(grid[0]);
  let bodyRows = grid.slice(1);
  let bodyLinkRows = linkGrid.slice(1);
  if (!bodyRows.length) {
    return { columns: [], rows: [], rowLinks: [] };
  }

  const compacted = dropEmptyColumnsFromMatrix(header, bodyRows);
  header = compacted.headers;
  bodyRows = compacted.rows;
  bodyLinkRows = bodyLinkRows.map((row) => compacted.keepIndices.map((index) => row[index] ?? []));

  header = simplifyHeaders(header);

  const rowObjects = bodyRows.map((row) => {
    const result: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      result[header[i]] = row[i] ?? "";
    }
    return result;
  });

  const rowLinkObjects = bodyLinkRows.map((row) => {
    const result: Record<string, string[]> = {};
    for (let i = 0; i < header.length; i += 1) {
      const links = row[i] ?? [];
      if (links.length) {
        result[header[i]] = links;
      }
    }
    return result;
  });

  return { columns: header, rows: rowObjects, rowLinks: rowLinkObjects };
}

function dropEmptyColumnsFromMatrix(
  headers: string[],
  matrix: string[][]
): { headers: string[]; rows: string[][]; keepIndices: number[] } {
  if (!headers.length || !matrix.length) {
    return { headers, rows: matrix, keepIndices: headers.map((_, index) => index) };
  }

  const keepIndices: number[] = [];
  for (let i = 0; i < headers.length; i += 1) {
    const hasContent = matrix.some((row) => (row[i] ?? "").trim() !== "");
    if (hasContent) {
      keepIndices.push(i);
    }
  }

  const newHeaders = keepIndices.map((index) => headers[index]);
  const newRows = matrix.map((row) => keepIndices.map((index) => row[index] ?? ""));
  return { headers: newHeaders, rows: newRows, keepIndices };
}

function extractCellLinks($: CheerioAPI, cell: any): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  $(cell)
    .find("a[href]")
    .each((_: number, anchor: any) => {
      const rawHref = $(anchor).attr("href") ?? "";
      const href = normalizeHref(rawHref);
      if (!href || seen.has(href)) {
        return;
      }

      seen.add(href);
      links.push(href);
    });

  return links;
}

function normalizeHref(href: string): string {
  if (!href || href.startsWith("#")) {
    return "";
  }

  if (href.startsWith("/wiki/") || href.startsWith("/index.php")) {
    return `https://wiki.walkscape.app${href}`;
  }

  return href;
}

function normalizeHeaders(headers: string[]): string[] {
  const output: string[] = [];
  const seen = new Map<string, number>();

  headers.forEach((raw, index) => {
    const base = raw.trim() || `Column_${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    output.push(count === 1 ? base : `${base}_${count}`);
  });

  return output;
}

function simplifyHeaders(headers: string[]): string[] {
  const headerSet = new Set(headers);
  return headers.map((header) => {
    if (header.endsWith("_2")) {
      const base = header.slice(0, -2);
      if (base && !headerSet.has(base)) {
        return base;
      }
    }
    return header;
  });
}

function renderMarkdownTable(columns: string[], rows: Record<string, string>[]): string {
  const header = `| ${columns.map((column) => escapeMdCell(column)).join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((column) => escapeMdCell(row[column] ?? "")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function cleanCellText(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/\s+([,.;:!?])/g, "$1");
}

function escapeMdCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function safeInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function ensureLength(row: string[], length: number): void {
  while (row.length < length) {
    row.push("");
  }
}

function ensureLinksLength(row: string[][], length: number): void {
  while (row.length < length) {
    row.push([]);
  }
}

function cleanMarkdown(text: string): string {
  const lines = text.split("\n").map((line) => line.replace(/\s+$/g, ""));
  const cleaned: string[] = [];
  let lastBlank = true;

  for (const line of lines) {
    const blank = line.trim() === "";
    if (blank && lastBlank) {
      continue;
    }
    cleaned.push(line);
    lastBlank = blank;
  }

  return `${cleaned.join("\n").trim()}\n`;
}

function asciiJsonStringify(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7F]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}
