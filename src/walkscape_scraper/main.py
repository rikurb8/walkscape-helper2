from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlparse

from .api import ParsedPage, fetch_parsed_page
from .extract import ExtractedDocument, ExtractedTable, extract_document, render_markdown_tables, render_structured_data


PROJECT_ROOT = Path(__file__).resolve().parents[2]
WIKI_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\((https://wiki\.walkscape\.app/wiki/[^\s\)]+)(?:\s+\"[^\"]*\")?\)")


@dataclass(slots=True)
class PageRecord:
    section_slug: str
    section_title: str
    title: str
    slug: str
    is_root: bool
    parsed: ParsedPage
    extracted: ExtractedDocument

    @property
    def output_relpath(self) -> Path:
        filename = "index.md" if self.is_root else f"{self.slug}.md"
        return Path("wiki") / self.section_slug / filename


@dataclass(slots=True)
class CollectionResult:
    section_slug: str
    section_title: str
    root_title: str
    page_records: list[PageRecord]
    warnings: list[str]


@dataclass(slots=True)
class WriteStats:
    docs_written: int = 0
    docs_skipped: int = 0
    docs_removed: int = 0
    raw_written: int = 0
    raw_skipped: int = 0
    raw_removed: int = 0


def main() -> None:
    parser = argparse.ArgumentParser(description="WalkScape wiki scraper")
    subparsers = parser.add_subparsers(dest="command", required=True)

    skills_parser = subparsers.add_parser("scrape-skills", help="Scrape Skills overview and skill pages")
    skills_parser.add_argument(
        "--incremental",
        action="store_true",
        help="Skip rewriting page files when source_oldid has not changed",
    )

    wiki_parser = subparsers.add_parser("scrape-wiki", help="Scrape Skills, Core Mechanics, Activities, and Recipes")
    wiki_parser.add_argument(
        "--incremental",
        action="store_true",
        help="Skip rewriting page files when source_oldid has not changed",
    )

    args = parser.parse_args()
    if args.command == "scrape-skills":
        scrape_skills(incremental=args.incremental)
    elif args.command == "scrape-wiki":
        scrape_wiki(incremental=args.incremental)


def scrape_skills(incremental: bool = False) -> None:
    collections, summary = _run_collections(include_extended=False, incremental=incremental)
    _print_summary(collections, summary)


def scrape_wiki(incremental: bool = False) -> None:
    collections, summary = _run_collections(include_extended=True, incremental=incremental)
    _print_summary(collections, summary)


def _run_collections(include_extended: bool, incremental: bool) -> tuple[list[CollectionResult], dict]:
    fetch_cache: dict[str, tuple[ParsedPage, ExtractedDocument]] = {}
    collections: list[CollectionResult] = []

    collections.append(_build_skills_collection(fetch_cache))

    if include_extended:
        collections.append(_build_single_page_collection("core-mechanics", "Core Mechanics", "Core Mechanics", fetch_cache))
        collections.append(_build_activities_collection(fetch_cache))
        collections.append(_build_single_page_collection("recipes", "Recipes", "Recipes", fetch_cache))

    _prepare_output_directories(collections)
    write_stats = _write_collection_outputs(collections, incremental=incremental)
    _write_docs_index(collections)
    _write_mkdocs_config(collections)
    summary = _write_report(
        collections,
        include_extended=include_extended,
        incremental=incremental,
        write_stats=write_stats,
    )
    return collections, summary


def _build_skills_collection(fetch_cache: dict[str, tuple[ParsedPage, ExtractedDocument]]) -> CollectionResult:
    root_page, root_doc = _fetch_page_document("Skills", fetch_cache)
    child_titles = _derive_skill_titles(root_doc.tables)
    return _build_collection(
        section_slug="skills",
        section_title="Skills",
        root_title="Skills",
        child_titles=child_titles,
        fetch_cache=fetch_cache,
    )


def _build_activities_collection(fetch_cache: dict[str, tuple[ParsedPage, ExtractedDocument]]) -> CollectionResult:
    root_page, root_doc = _fetch_page_document("Activities", fetch_cache)
    child_titles = _derive_activity_titles(root_doc.tables)
    return _build_collection(
        section_slug="activities",
        section_title="Activities",
        root_title=root_page.title,
        child_titles=child_titles,
        fetch_cache=fetch_cache,
    )


def _build_single_page_collection(
    section_slug: str,
    section_title: str,
    root_title: str,
    fetch_cache: dict[str, tuple[ParsedPage, ExtractedDocument]],
) -> CollectionResult:
    return _build_collection(
        section_slug=section_slug,
        section_title=section_title,
        root_title=root_title,
        child_titles=[],
        fetch_cache=fetch_cache,
    )


def _build_collection(
    section_slug: str,
    section_title: str,
    root_title: str,
    child_titles: list[str],
    fetch_cache: dict[str, tuple[ParsedPage, ExtractedDocument]],
) -> CollectionResult:
    warnings: list[str] = []
    page_records: list[PageRecord] = []

    root_page, root_doc = _fetch_page_document(root_title, fetch_cache)
    page_records.append(
        PageRecord(
            section_slug=section_slug,
            section_title=section_title,
            title=root_page.title,
            slug="index",
            is_root=True,
            parsed=root_page,
            extracted=root_doc,
        )
    )

    seen_titles = {_normalize_title(root_page.title)}
    used_slugs = {"index"}

    for child_title in child_titles:
        title_key = _normalize_title(child_title)
        if not title_key or title_key in seen_titles:
            continue
        seen_titles.add(title_key)

        try:
            child_page, child_doc = _fetch_page_document(child_title, fetch_cache)
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"Failed to fetch '{child_title}' in section '{section_title}': {exc}")
            continue

        slug = _unique_slug(_slugify_title(child_page.title), used_slugs)
        page_records.append(
            PageRecord(
                section_slug=section_slug,
                section_title=section_title,
                title=child_page.title,
                slug=slug,
                is_root=False,
                parsed=child_page,
                extracted=child_doc,
            )
        )

    return CollectionResult(
        section_slug=section_slug,
        section_title=section_title,
        root_title=root_page.title,
        page_records=page_records,
        warnings=warnings,
    )


def _fetch_page_document(
    page_title: str,
    fetch_cache: dict[str, tuple[ParsedPage, ExtractedDocument]],
) -> tuple[ParsedPage, ExtractedDocument]:
    cache_key = _normalize_title(page_title)
    if cache_key in fetch_cache:
        return fetch_cache[cache_key]

    parsed = fetch_parsed_page(page_title)
    extracted = extract_document(parsed.html)
    fetch_cache[cache_key] = (parsed, extracted)
    return parsed, extracted


def _prepare_output_directories(collections: list[CollectionResult]) -> None:
    docs_root = PROJECT_ROOT / "docs" / "wiki"
    raw_root = PROJECT_ROOT / "data" / "raw"
    docs_root.mkdir(parents=True, exist_ok=True)
    raw_root.mkdir(parents=True, exist_ok=True)
    (PROJECT_ROOT / "reports").mkdir(parents=True, exist_ok=True)

    for collection in collections:
        section_docs_dir = docs_root / collection.section_slug
        section_raw_dir = raw_root / collection.section_slug
        section_docs_dir.mkdir(parents=True, exist_ok=True)
        section_raw_dir.mkdir(parents=True, exist_ok=True)


def _write_collection_outputs(collections: list[CollectionResult], incremental: bool) -> WriteStats:
    stats = WriteStats()
    all_pages = [page for collection in collections for page in collection.page_records]
    title_to_path = _build_title_to_path_map(all_pages)

    expected_doc_paths: set[Path] = set()
    expected_raw_paths: set[Path] = set()

    for page in all_pages:
        output_file = PROJECT_ROOT / "docs" / page.output_relpath
        output_file.parent.mkdir(parents=True, exist_ok=True)
        expected_doc_paths.add(output_file)

        up_to_date_doc = incremental and _is_markdown_up_to_date(output_file, page.parsed.revid)
        if up_to_date_doc:
            stats.docs_skipped += 1
        else:
            body = _rewrite_internal_links(page.extracted.body_markdown, page.output_relpath, title_to_path)
            markdown_tables = render_markdown_tables(page.extracted.tables)
            structured_data = render_structured_data(page.extracted.tables)

            markdown = _render_page_markdown(
                title=page.title,
                source_url=page.parsed.source_url,
                source_oldid=page.parsed.revid,
                scraped_at=page.extracted.scraped_at,
                categories=page.parsed.categories,
                body=body,
                markdown_tables=markdown_tables,
                structured_data=structured_data,
            )
            output_file.write_text(markdown, encoding="utf-8")
            stats.docs_written += 1

        raw_file = PROJECT_ROOT / "data" / "raw" / page.section_slug / f"{page.slug}_parse.json"
        raw_file.parent.mkdir(parents=True, exist_ok=True)
        expected_raw_paths.add(raw_file)

        up_to_date_raw = incremental and _is_raw_up_to_date(raw_file, page.parsed.revid)
        if up_to_date_raw:
            stats.raw_skipped += 1
        else:
            raw_file.write_text(json.dumps(page.parsed.raw_payload, indent=2, ensure_ascii=True), encoding="utf-8")
            stats.raw_written += 1

    for collection in collections:
        section_docs_dir = PROJECT_ROOT / "docs" / "wiki" / collection.section_slug
        section_raw_dir = PROJECT_ROOT / "data" / "raw" / collection.section_slug

        for path in section_docs_dir.glob("*.md"):
            if path not in expected_doc_paths:
                path.unlink()
                stats.docs_removed += 1

        for path in section_raw_dir.glob("*.json"):
            if path not in expected_raw_paths:
                path.unlink()
                stats.raw_removed += 1

    return stats


def _build_title_to_path_map(all_pages: list[PageRecord]) -> dict[str, Path]:
    mapping: dict[str, Path] = {}
    for page in all_pages:
        key = _normalize_title(page.title)
        if key not in mapping:
            mapping[key] = page.output_relpath
    return mapping


def _write_docs_index(collections: list[CollectionResult]) -> None:
    lines = ["# WalkScape Wiki Scraper", ""]
    for collection in collections:
        lines.append(f"- [{collection.section_title}](wiki/{collection.section_slug}/index.md)")
    lines.append("")
    (PROJECT_ROOT / "docs" / "index.md").write_text("\n".join(lines), encoding="utf-8")


def _write_mkdocs_config(collections: list[CollectionResult]) -> None:
    nav_lines = [
        "site_name: WalkScape Wiki Scraper",
        "site_description: Local validation viewer for scraped WalkScape markdown",
        "theme:",
        "  name: material",
        "",
        "nav:",
        "  - Home: index.md",
    ]

    for collection in collections:
        nav_lines.append(f"  - {_yaml_quote(collection.section_title)}:")
        nav_lines.append(f"      - Overview: wiki/{collection.section_slug}/index.md")
        for page in collection.page_records:
            if page.is_root:
                continue
            nav_lines.append(f"      - {_yaml_quote(page.title)}: wiki/{collection.section_slug}/{page.slug}.md")

    nav_lines.extend(
        [
            "",
            "markdown_extensions:",
            "  - tables",
            "  - admonition",
            "  - toc:",
            "      permalink: true",
            "",
        ]
    )

    (PROJECT_ROOT / "mkdocs.yml").write_text("\n".join(nav_lines), encoding="utf-8")


def _write_report(
    collections: list[CollectionResult],
    include_extended: bool,
    incremental: bool,
    write_stats: WriteStats,
) -> dict:
    report = {
        "mode": "scrape-wiki" if include_extended else "scrape-skills",
        "incremental": incremental,
        "sections": [],
        "pages_generated_total": 0,
        "tables_found_total": 0,
        "write_stats": {
            "docs_written": write_stats.docs_written,
            "docs_skipped": write_stats.docs_skipped,
            "docs_removed": write_stats.docs_removed,
            "raw_written": write_stats.raw_written,
            "raw_skipped": write_stats.raw_skipped,
            "raw_removed": write_stats.raw_removed,
        },
        "warnings": [],
    }

    for collection in collections:
        section_tables = sum(len(page.extracted.tables) for page in collection.page_records)
        section_output_files = [f"docs/{page.output_relpath.as_posix()}" for page in collection.page_records]
        section_entry = {
            "section": collection.section_title,
            "section_slug": collection.section_slug,
            "root_title": collection.root_title,
            "pages_generated": len(collection.page_records),
            "tables_found": section_tables,
            "output_files": section_output_files,
            "warnings": collection.warnings,
        }
        report["sections"].append(section_entry)
        report["pages_generated_total"] += len(collection.page_records)
        report["tables_found_total"] += section_tables
        report["warnings"].extend(collection.warnings)

    report_name = "wiki_scrape_report.json" if include_extended else "skills_scrape_report.json"
    report_path = PROJECT_ROOT / "reports" / report_name
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=True), encoding="utf-8")
    return report


def _print_summary(collections: list[CollectionResult], summary: dict) -> None:
    print(f"Generated {summary['pages_generated_total']} page(s) across {len(collections)} section(s)")
    print(f"Extracted {summary['tables_found_total']} table(s) total")
    write_stats = summary.get("write_stats", {})
    docs_written = write_stats.get("docs_written")
    docs_skipped = write_stats.get("docs_skipped")
    if docs_written is not None and docs_skipped is not None:
        print(f"Docs written: {docs_written}, skipped: {docs_skipped}")
    if summary["warnings"]:
        print(f"Warnings: {len(summary['warnings'])}")


def _is_markdown_up_to_date(markdown_file: Path, source_oldid: int | None) -> bool:
    if not markdown_file.exists():
        return False
    existing_oldid = _read_source_oldid_from_markdown(markdown_file)
    return existing_oldid == source_oldid


def _is_raw_up_to_date(raw_file: Path, source_oldid: int | None) -> bool:
    if not raw_file.exists():
        return False
    try:
        payload = json.loads(raw_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    existing = payload.get("parse", {}).get("revid")
    return existing == source_oldid


def _read_source_oldid_from_markdown(markdown_file: Path) -> int | None:
    try:
        text = markdown_file.read_text(encoding="utf-8")
    except OSError:
        return None

    if not text.startswith("---\n"):
        return None

    lines = text.splitlines()
    for line in lines[1:80]:
        if line.strip() == "---":
            break
        if line.startswith("source_oldid:"):
            value = line.split(":", 1)[1].strip()
            if value == "null":
                return None
            try:
                return int(value)
            except ValueError:
                return None
    return None


def _derive_skill_titles(tables: list[ExtractedTable]) -> list[str]:
    if not tables:
        raise ValueError("No tables found on Skills overview page")

    skill_table = tables[0]
    if not skill_table.rows:
        raise ValueError("No rows found in Skills overview table")

    candidate_columns = [col for col in skill_table.columns if col.lower().startswith("skill")]
    if not candidate_columns:
        candidate_columns = skill_table.columns

    return _extract_unique_column_values(skill_table.rows, candidate_columns[0])


def _derive_activity_titles(tables: list[ExtractedTable]) -> list[str]:
    for table in tables:
        for column in table.columns:
            if _normalize_title(column) == "activity name":
                titles = _extract_unique_column_values(table.rows, column)
                if titles:
                    return titles
    raise ValueError("Could not find Activity Name column in Activities tables")


def _extract_unique_column_values(rows: list[dict[str, str]], column: str) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    for row in rows:
        value = row.get(column, "").strip()
        key = _normalize_title(value)
        if key and key not in seen:
            values.append(value)
            seen.add(key)
    return values


def _render_page_markdown(
    title: str,
    source_url: str,
    source_oldid: int | None,
    scraped_at: str,
    categories: list[str],
    body: str,
    markdown_tables: str,
    structured_data: str,
) -> str:
    if categories:
        category_lines = ["categories:", *[f'  - "{cat}"' for cat in categories]]
    else:
        category_lines = ["categories: []"]

    frontmatter = "\n".join(
        [
            "---",
            f'title: "{title}"',
            f'source_url: "{source_url}"',
            f"source_oldid: {source_oldid if source_oldid is not None else 'null'}",
            f'scraped_at: "{scraped_at}"',
            *category_lines,
            "---",
            "",
        ]
    )

    sections = [frontmatter, f"# {title}\n\n{body.strip()}"]

    if markdown_tables:
        sections.append("## Extracted Tables\n\n" + markdown_tables)

    sections.append("## Structured Data\n\n```json\n" + structured_data + "\n```")
    return "\n\n".join(sections).rstrip() + "\n"


def _rewrite_internal_links(markdown: str, current_path: Path, title_to_path: dict[str, Path]) -> str:
    def replace(match: re.Match[str]) -> str:
        label = match.group(1)
        url = match.group(2)
        title, fragment = _title_from_wiki_url(url)
        if title is None:
            return match.group(0)

        target = title_to_path.get(_normalize_title(title))
        if target is None:
            return match.group(0)

        rel = os.path.relpath(target, start=current_path.parent).replace(os.sep, "/")
        if fragment:
            _ = fragment
        return f"[{label}]({rel})"

    return WIKI_LINK_PATTERN.sub(replace, markdown)


def _title_from_wiki_url(url: str) -> tuple[str | None, str | None]:
    parsed = urlparse(url)
    if not parsed.path.startswith("/wiki/"):
        return None, None

    wiki_path = unquote(parsed.path[len("/wiki/") :])
    if wiki_path.startswith("Special:MyLanguage/"):
        wiki_path = wiki_path.split("/", 1)[1]

    title = wiki_path.replace("_", " ").strip()
    if not title:
        return None, None

    fragment = parsed.fragment.strip() if parsed.fragment else None
    return title, fragment


def _normalize_title(title: str) -> str:
    return " ".join(title.replace("_", " ").split()).casefold()


def _slugify_title(title: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", title.casefold())
    return cleaned.strip("-") or "page"


def _unique_slug(base: str, used: set[str]) -> str:
    candidate = base
    suffix = 2
    while candidate in used:
        candidate = f"{base}-{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate


def _yaml_quote(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


if __name__ == "__main__":
    main()
