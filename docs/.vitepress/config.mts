import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitepress";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_ROOT = path.resolve(__dirname, "..");
const WIKI_ROOT = path.join(DOCS_ROOT, "wiki");
const SECTION_ORDER = ["skills", "core-mechanics", "activities", "recipes"];

interface NavItem {
  text: string;
  link: string;
}

interface SidebarItem {
  text: string;
  link: string;
}

interface SidebarSection {
  text: string;
  items: SidebarItem[];
}

interface SectionMenu {
  sectionSlug: string;
  sectionTitle: string;
  items: SidebarItem[];
}

const sections = collectSectionsFromDocs();
const nav: NavItem[] = [{ text: "Home", link: "/" }, ...sections.map((section) => ({ text: section.sectionTitle, link: `/wiki/${section.sectionSlug}/` }))];
const sidebar: SidebarSection[] = sections.map((section) => ({ text: section.sectionTitle, items: section.items }));

export default defineConfig({
  title: "WalkScape Wiki Scraper",
  description: "Local validation viewer for scraped WalkScape markdown",
  cleanUrls: true,
  themeConfig: {
    nav,
    sidebar,
    search: {
      provider: "local"
    }
  }
});

function collectSectionsFromDocs(): SectionMenu[] {
  if (!fs.existsSync(WIKI_ROOT)) {
    return [];
  }

  const entries = fs.readdirSync(WIKI_ROOT, { withFileTypes: true });
  const sectionSlugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const sortedSectionSlugs = sortSectionSlugs(sectionSlugs);

  return sortedSectionSlugs.map((sectionSlug) => {
    const sectionDir = path.join(WIKI_ROOT, sectionSlug);
    const markdownFiles = listMarkdownFiles(sectionDir);
    const sectionTitle = inferSectionTitle(sectionDir, sectionSlug);
    const items: SidebarItem[] = [{ text: "Overview", link: `/wiki/${sectionSlug}/` }];

    for (const markdownRelpath of markdownFiles) {
      if (markdownRelpath === "index.md") {
        continue;
      }

      const pagePath = path.join(sectionDir, markdownRelpath);
      const pageTitle = inferPageTitle(pagePath, markdownRelpath);
      const wikiRelpath = path.posix.join("wiki", sectionSlug, toPosix(markdownRelpath));
      items.push({ text: pageTitle, link: toVitePressLink(wikiRelpath) });
    }

    return { sectionSlug, sectionTitle, items };
  });
}

function sortSectionSlugs(sectionSlugs: string[]): string[] {
  const priorities = new Map<string, number>();
  for (let index = 0; index < SECTION_ORDER.length; index += 1) {
    priorities.set(SECTION_ORDER[index], index);
  }

  return [...sectionSlugs].sort((left, right) => {
    const leftPriority = priorities.get(left);
    const rightPriority = priorities.get(right);
    if (typeof leftPriority === "number" && typeof rightPriority === "number") {
      return leftPriority - rightPriority;
    }
    if (typeof leftPriority === "number") {
      return -1;
    }
    if (typeof rightPriority === "number") {
      return 1;
    }
    return left.localeCompare(right);
  });
}

function listMarkdownFiles(directory: string, prefix = ""): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sorted) {
    const relpath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(path.join(directory, entry.name), relpath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relpath);
    }
  }

  return files;
}

function inferSectionTitle(sectionDir: string, sectionSlug: string): string {
  const title = readFrontmatterTitle(path.join(sectionDir, "index.md"));
  if (title) {
    return title;
  }

  return humanizeSlug(sectionSlug);
}

function inferPageTitle(filePath: string, markdownRelpath: string): string {
  const title = readFrontmatterTitle(filePath);
  if (title) {
    return title;
  }

  const fileSlug = path.posix.basename(toPosix(markdownRelpath), ".md");
  return humanizeSlug(fileSlug);
}

function readFrontmatterTitle(filePath: string): string | undefined {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }

  const markdown = fs.readFileSync(filePath, "utf-8");
  if (!markdown.startsWith("---\n") && !markdown.startsWith("---\r\n")) {
    return undefined;
  }

  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return undefined;
  }

  const titleLine = match[1].split(/\r?\n/).find((line) => line.trimStart().startsWith("title:"));
  if (!titleLine) {
    return undefined;
  }

  const rawValue = titleLine.split(":", 2)[1]?.trim();
  if (!rawValue) {
    return undefined;
  }

  if ((rawValue.startsWith("\"") && rawValue.endsWith("\"")) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function humanizeSlug(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toPosix(filePath: string): string {
  return filePath.split(path.sep).join("/");
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
