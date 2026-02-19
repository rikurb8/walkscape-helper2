const API_BASE = "https://wiki.walkscape.app/api.php";

export interface ParsedPage {
  title: string;
  html: string;
  pageId: number;
  revid: number | null;
  categories: string[];
  sourceUrl: string;
  rawPayload: Record<string, unknown>;
}

interface MediaWikiError {
  code?: string;
  info?: string;
}

interface MediaWikiParseCategory {
  category?: string;
  "*"?: string;
}

interface MediaWikiParsePayload {
  title: string;
  text: string;
  pageid: number;
  revid?: number;
  categories?: MediaWikiParseCategory[];
}

interface MediaWikiResponse {
  parse?: MediaWikiParsePayload;
  error?: MediaWikiError;
}

export async function fetchParsedPage(pageTitle: string): Promise<ParsedPage> {
  const params = new URLSearchParams({
    action: "parse",
    page: pageTitle,
    prop: "text|categories|revid",
    format: "json",
    formatversion: "2"
  });

  const url = `${API_BASE}?${params.toString()}`;
  const payload = await fetchJson(url);
  const parse = payload.parse;

  if (!parse) {
    const code = payload.error?.code ?? "unknown";
    const info = payload.error?.info ?? "No details";
    throw new Error(`Parse request failed for '${pageTitle}' (${code}): ${info}`);
  }

  const categories = (parse.categories ?? [])
    .map((cat) => cat.category ?? cat["*"] ?? "")
    .filter((cat): cat is string => Boolean(cat));

  return {
    title: parse.title,
    html: parse.text,
    pageId: parse.pageid,
    revid: parse.revid ?? null,
    categories,
    sourceUrl: `https://wiki.walkscape.app/wiki/${pageTitle.replace(/ /g, "_")}`,
    rawPayload: payload as unknown as Record<string, unknown>
  };
}

async function fetchJson(url: string): Promise<MediaWikiResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as MediaWikiResponse;
  } finally {
    clearTimeout(timer);
  }
}
