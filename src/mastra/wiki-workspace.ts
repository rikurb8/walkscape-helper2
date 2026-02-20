import { Dirent, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LocalFilesystem, Workspace } from "@mastra/core/workspace";

import { extractDocument, renderMarkdownTables } from "../scraper/extract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const RAW_DATA_DIR = path.join(PROJECT_ROOT, "data", "raw");

export interface WikiSearchResult {
  id: string;
  content: string;
  score: number;
  lineRange?: {
    start: number;
    end: number;
  };
}

let workspaceInitPromise: Promise<Workspace> | null = null;

export async function searchLocalWiki(
  query: string,
  options?: {
    topK?: number;
    minScore?: number;
  }
): Promise<WikiSearchResult[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error("Search query cannot be empty");
  }

  const workspace = await getWikiWorkspace();
  const results = await workspace.search(normalizedQuery, {
    mode: "bm25",
    topK: options?.topK,
    minScore: options?.minScore
  });

  return results.map((result) => ({
    id: result.id,
    content: result.content,
    score: result.score,
    lineRange: result.lineRange
  }));
}

async function getWikiWorkspace(): Promise<Workspace> {
  if (!workspaceInitPromise) {
    workspaceInitPromise = initializeWorkspace();
  }

  return workspaceInitPromise;
}

async function initializeWorkspace(): Promise<Workspace> {
  const workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath: PROJECT_ROOT
    }),
    bm25: true,
    autoIndexPaths: ["/docs/wiki"]
  });

  await workspace.init();

  const parseFiles = await collectParseFiles(RAW_DATA_DIR);
  if (!parseFiles.length) {
    throw new Error(
      "No parsed wiki files found in data/raw. Run `pnpm scrape` first to build a local search index."
    );
  }

  await Promise.all(
    parseFiles.map(async (filePath) => {
      const indexed = await toIndexedDocument(filePath);
      if (!indexed) {
        return;
      }

      await workspace.index(indexed.id, indexed.content, {
        metadata: indexed.metadata
      });
    })
  );

  return workspace;
}

async function collectParseFiles(directory: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectParseFiles(absolutePath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith("_parse.json")) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function toIndexedDocument(filePath: string): Promise<{
  id: string;
  content: string;
  metadata: Record<string, unknown>;
} | null> {
  const text = await fs.readFile(filePath, "utf-8");
  const payload = JSON.parse(text) as {
    parse?: {
      title?: unknown;
      text?: unknown;
    };
  };

  const title = typeof payload.parse?.title === "string" ? payload.parse.title : null;
  const html = typeof payload.parse?.text === "string" ? payload.parse.text : null;
  if (!title || !html) {
    return null;
  }

  const extracted = extractDocument(html);
  const markdownTables = renderMarkdownTables(extracted.tables);
  const content = [`# ${title}`, extracted.bodyMarkdown.trim(), markdownTables]
    .filter((chunk) => chunk.trim().length > 0)
    .join("\n\n");

  const relativePath = toPosixPath(path.relative(PROJECT_ROOT, filePath));

  return {
    id: `/${relativePath}`,
    content,
    metadata: {
      title,
      source: "data/raw",
      relativePath
    }
  };
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
