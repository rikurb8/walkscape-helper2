import { promises as fs } from "node:fs";
import path from "node:path";

export function normalizeTitle(title: string): string {
  return title.replace(/_/g, " ").trim().replace(/\s+/g, " ").toLowerCase();
}

export function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "page"
  );
}

export function uniqueSlug(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function yamlQuote(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function asciiJsonStringify(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[^\x00-\x7F]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

export async function safeReadDir(directory: string): Promise<string[]> {
  try {
    return await fs.readdir(directory);
  } catch {
    return [];
  }
}

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
