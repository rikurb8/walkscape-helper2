import path from "node:path";

import { normalizeTitle } from "./utils.js";

const WIKI_LINK_PATTERN = /\[([^\]]+)\]\((https:\/\/wiki\.walkscape\.app\/wiki\/[^\s)]+)(?:\s+"[^"]*")?\)/g;

export function rewriteInternalLinks(markdown: string, currentPath: string, titleToPath: Map<string, string>): string {
  return markdown.replace(WIKI_LINK_PATTERN, (match, label: string, url: string) => {
    const title = titleFromWikiUrl(url);
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

function titleFromWikiUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!parsed.pathname.startsWith("/wiki/")) {
    return null;
  }

  let wikiPath = decodeURIComponent(parsed.pathname.slice("/wiki/".length));
  if (wikiPath.startsWith("Special:MyLanguage/")) {
    const [, rest] = wikiPath.split("/", 2);
    wikiPath = rest ?? "";
  }

  const title = wikiPath.replace(/_/g, " ").trim();
  return title || null;
}
