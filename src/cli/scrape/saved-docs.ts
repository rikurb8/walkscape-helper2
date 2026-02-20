import { promises as fs } from "node:fs";
import path from "node:path";

import { marked } from "marked";
import { markedTerminal } from "marked-terminal";

marked.use(markedTerminal() as any);

interface SavedDoc {
  path: string;
  markdown: string;
}

export interface SavedDocsReadResult {
  documents: SavedDoc[];
  warnings: string[];
}

export async function readSavedDocs(
  summary: Record<string, unknown>
): Promise<SavedDocsReadResult> {
  const docPaths = getSavedDocPaths(summary);

  if (!docPaths.length) {
    return {
      documents: [],
      warnings: []
    };
  }

  const documents: SavedDoc[] = [];
  const warnings: string[] = [];

  for (const docPath of docPaths) {
    const absolutePath = path.resolve(process.cwd(), docPath);

    let markdown: string;
    try {
      markdown = await fs.readFile(absolutePath, "utf-8");
    } catch {
      warnings.push(`Could not read saved doc: ${docPath}`);
      continue;
    }

    documents.push({
      path: docPath,
      markdown: stripFrontmatter(markdown).trim() || "_(empty document)_"
    });
  }

  return {
    documents,
    warnings
  };
}

export function printSavedDocs(result: SavedDocsReadResult): void {
  if (!result.documents.length) {
    console.log("No saved docs found to print.");
    return;
  }

  console.log(`\n=== Saved Docs (${result.documents.length}) ===`);

  for (const doc of result.documents) {
    const rendered = marked.parse(doc.markdown) as string;

    console.log(`\n--- ${doc.path} ---`);
    console.log(rendered.trimEnd());
  }

  for (const warning of result.warnings) {
    console.warn(warning);
  }
}

function getSavedDocPaths(summary: Record<string, unknown>): string[] {
  const sections = summary.sections;
  if (!Array.isArray(sections)) {
    return [];
  }

  const docPaths = new Set<string>();

  for (const section of sections) {
    if (typeof section !== "object" || !section) {
      continue;
    }

    const outputFiles = (section as { output_files?: unknown }).output_files;
    if (!Array.isArray(outputFiles)) {
      continue;
    }

    for (const outputFile of outputFiles) {
      if (typeof outputFile !== "string") {
        continue;
      }

      if (outputFile.startsWith("docs/") && outputFile.endsWith(".md")) {
        docPaths.add(outputFile);
      }
    }
  }

  return [...docPaths];
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}
