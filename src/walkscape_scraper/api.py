from __future__ import annotations

from dataclasses import dataclass
import json
from urllib.parse import urlencode
from urllib.request import urlopen


API_BASE = "https://wiki.walkscape.app/api.php"


@dataclass(slots=True)
class ParsedPage:
    title: str
    html: str
    page_id: int
    revid: int | None
    categories: list[str]
    source_url: str
    raw_payload: dict


def fetch_parsed_page(page_title: str) -> ParsedPage:
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "text|categories|revid",
        "format": "json",
        "formatversion": "2",
    }
    url = f"{API_BASE}?{urlencode(params)}"
    with urlopen(url, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if "parse" not in payload:
        error = payload.get("error", {})
        code = error.get("code", "unknown")
        info = error.get("info", "No details")
        raise RuntimeError(f"Parse request failed for '{page_title}' ({code}): {info}")

    parsed = payload["parse"]
    categories = [cat.get("category") or cat.get("*") for cat in parsed.get("categories", [])]
    categories = [cat for cat in categories if cat]
    source_url = f"https://wiki.walkscape.app/wiki/{page_title.replace(' ', '_')}"

    return ParsedPage(
        title=parsed["title"],
        html=parsed["text"],
        page_id=parsed["pageid"],
        revid=parsed.get("revid"),
        categories=categories,
        source_url=source_url,
        raw_payload=payload,
    )
