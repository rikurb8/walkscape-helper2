from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, UTC
import json
import re

from bs4 import BeautifulSoup, Tag
from markdownify import markdownify as md


@dataclass(slots=True)
class ExtractedTable:
    index: int
    section: str
    columns: list[str]
    rows: list[dict[str, str]]


@dataclass(slots=True)
class ExtractedDocument:
    body_markdown: str
    tables: list[ExtractedTable]
    scraped_at: str


def extract_document(html: str) -> ExtractedDocument:
    soup = BeautifulSoup(html, "html.parser")
    root = soup.select_one("div.mw-parser-output")
    if root is None:
        raise ValueError("Could not find mw-parser-output in page HTML")

    _normalize_links(root)
    _remove_noise(root)

    tables = _extract_tables(root)
    for table in root.select("table.wikitable"):
        table.decompose()

    body_markdown = md(str(root), heading_style="ATX", bullets="-")
    body_markdown = _clean_markdown(body_markdown)

    return ExtractedDocument(
        body_markdown=body_markdown,
        tables=tables,
        scraped_at=datetime.now(UTC).isoformat(),
    )


def render_markdown_tables(tables: list[ExtractedTable]) -> str:
    chunks: list[str] = []
    for table in tables:
        chunks.append(f"### Table {table.index} ({table.section})")
        chunks.append(_render_markdown_table(table.columns, table.rows))
    return "\n\n".join(chunks).strip()


def render_structured_data(tables: list[ExtractedTable]) -> str:
    payload = {
        "tables": [
            {
                "index": t.index,
                "section": t.section,
                "columns": t.columns,
                "rows": t.rows,
            }
            for t in tables
        ]
    }
    return json.dumps(payload, indent=2, ensure_ascii=True)


def _normalize_links(root: Tag) -> None:
    for link in root.select("a[href]"):
        href = _attr_as_str(link.get("href")) or ""
        if href.startswith("/wiki/"):
            link["href"] = f"https://wiki.walkscape.app{href}"
        elif href.startswith("/index.php"):
            link["href"] = f"https://wiki.walkscape.app{href}"


def _remove_noise(root: Tag) -> None:
    selectors = [
        "div#toc",
        "div.toc",
        ".mw-editsection",
        "span.mw-editsection",
        ".mw-pt-languages",
        ".navigation-not-searchable",
        "script",
        "style",
        "noscript",
        "sup.reference",
    ]
    for selector in selectors:
        for node in root.select(selector):
            node.decompose()

    for figure in root.select("figure"):
        figure.decompose()

    for image in root.select("img"):
        image.decompose()

    for anchor in root.select("a"):
        if not anchor.get_text(" ", strip=True):
            anchor.decompose()

    for br in root.select("br"):
        br.replace_with("\n")

    for table in root.select("table"):
        classes = table.attrs.get("class", []) if table.attrs else []
        if "wikitable" not in classes:
            table.decompose()

def _extract_tables(root: Tag) -> list[ExtractedTable]:
    tables: list[ExtractedTable] = []
    table_index = 1

    for table in root.select("table.wikitable"):
        heading = table.find_previous(["h1", "h2", "h3", "h4", "h5", "h6"])
        current_section = heading.get_text(" ", strip=True) if heading else "Introduction"
        columns, rows = _parse_wikitable(table)
        if columns and rows:
            tables.append(
                ExtractedTable(
                    index=table_index,
                    section=current_section,
                    columns=columns,
                    rows=rows,
                )
            )
            table_index += 1

    return tables


def _parse_wikitable(table: Tag) -> tuple[list[str], list[dict[str, str]]]:
    grid: list[list[str]] = []
    span_map: dict[int, tuple[str, int]] = {}

    for tr in table.find_all("tr"):
        row: list[str] = []
        col = 0

        def flush_spans_until(target_col: int | None = None) -> None:
            nonlocal col
            while col in span_map and (target_col is None or col < target_col):
                text, remaining = span_map[col]
                _ensure_len(row, col + 1)
                row[col] = text
                if remaining <= 1:
                    del span_map[col]
                else:
                    span_map[col] = (text, remaining - 1)
                col += 1

        cells = tr.find_all(["th", "td"], recursive=False)
        for cell in cells:
            flush_spans_until()
            while col < len(row) and row[col] != "":
                col += 1

            text = _clean_cell_text(cell.get_text(" ", strip=True))
            rowspan = _safe_int(_attr_as_str(cell.get("rowspan")), default=1)
            colspan = _safe_int(_attr_as_str(cell.get("colspan")), default=1)

            for i in range(colspan):
                _ensure_len(row, col + i + 1)
                row[col + i] = text
                if rowspan > 1:
                    span_map[col + i] = (text, rowspan - 1)
            col += colspan

        flush_spans_until()
        if any(cell.strip() for cell in row):
            grid.append(row)

    if not grid:
        return [], []

    max_cols = max(len(r) for r in grid)
    for r in grid:
        _ensure_len(r, max_cols)

    header = _normalize_headers(grid[0])
    body_rows = grid[1:] if len(grid) > 1 else []
    if not body_rows:
        return [], []

    header, body_rows = _drop_empty_columns_from_matrix(header, body_rows)
    header = _simplify_headers(header)
    row_objects = [{header[i]: row[i] for i in range(len(header))} for row in body_rows]
    return header, row_objects


def _drop_empty_columns_from_matrix(headers: list[str], matrix: list[list[str]]) -> tuple[list[str], list[list[str]]]:
    if not headers or not matrix:
        return headers, matrix

    keep_indices = [
        i for i, _ in enumerate(headers) if any((r[i] if i < len(r) else "").strip() for r in matrix)
    ]
    new_headers = [headers[i] for i in keep_indices]
    new_rows = [[r[i] if i < len(r) else "" for i in keep_indices] for r in matrix]
    return new_headers, new_rows


def _normalize_headers(header: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: dict[str, int] = {}

    for idx, raw in enumerate(header, start=1):
        base = raw.strip() or f"Column_{idx}"
        count = seen.get(base, 0) + 1
        seen[base] = count
        normalized.append(base if count == 1 else f"{base}_{count}")

    return normalized


def _simplify_headers(headers: list[str]) -> list[str]:
    output: list[str] = []
    header_set = set(headers)
    for header in headers:
        if header.endswith("_2"):
            base = header[:-2]
            if base and base not in header_set:
                output.append(base)
                continue
        output.append(header)
    return output


def _render_markdown_table(columns: list[str], rows: list[dict[str, str]]) -> str:
    header = "| " + " | ".join(_escape_md_cell(c) for c in columns) + " |"
    separator = "| " + " | ".join("---" for _ in columns) + " |"
    body = [
        "| " + " | ".join(_escape_md_cell(row.get(col, "")) for col in columns) + " |"
        for row in rows
    ]
    return "\n".join([header, separator, *body])


def _clean_cell_text(text: str) -> str:
    compact = " ".join(text.split())
    return re.sub(r"\s+([,.;:!?])", r"\1", compact)


def _escape_md_cell(text: str) -> str:
    return text.replace("|", "\\|")


def _safe_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _attr_as_str(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _ensure_len(row: list[str], length: int) -> None:
    if len(row) < length:
        row.extend([""] * (length - len(row)))


def _clean_markdown(text: str) -> str:
    lines = [line.rstrip() for line in text.splitlines()]
    cleaned: list[str] = []
    last_blank = True
    for line in lines:
        blank = line.strip() == ""
        if blank and last_blank:
            continue
        cleaned.append(line)
        last_blank = blank
    return "\n".join(cleaned).strip() + "\n"
