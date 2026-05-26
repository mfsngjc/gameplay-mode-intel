#!/usr/bin/env python3
"""Collect Fortnite official pages into draft mode-intel records.

This v0.1 script is intentionally conservative: it fetches configured source
URLs, extracts page title/description/open-graph image, and writes a review
file. A human or Codex pass should decide which drafts become modes.json rows.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCES = ROOT / "data" / "modes.json"
DEFAULT_OUT = ROOT / "data" / "fortnite-sync-draft.json"


class MetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = {key.lower(): value or "" for key, value in attrs}
        if tag.lower() == "title":
            self._in_title = True
        if tag.lower() != "meta":
            return

        key = attrs_map.get("property") or attrs_map.get("name")
        content = attrs_map.get("content")
        if key and content:
            self.meta[key.lower()] = content

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data.strip()


@dataclass
class Draft:
    sourceUrl: str
    title: str
    description: str
    imageUrl: str
    suggestedModeName: str
    status: str = "needs_review"


def fetch(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/125.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
        },
    )
    with urlopen(request, timeout=20) as response:
        return response.read().decode("utf-8", errors="replace")


def clean_title(title: str) -> str:
    title = re.sub(r"\s+", " ", title).strip()
    title = title.replace(" | Fortnite", "").replace(" - Fortnite", "")
    return title


def parse_page(url: str, html: str) -> Draft:
    parser = MetaParser()
    parser.feed(html)
    title = clean_title(parser.meta.get("og:title") or parser.title)
    description = parser.meta.get("og:description") or parser.meta.get("description") or ""
    image = parser.meta.get("og:image") or parser.meta.get("twitter:image") or ""
    return Draft(
        sourceUrl=url,
        title=title,
        description=description,
        imageUrl=image,
        suggestedModeName=title.split(":")[0].strip(),
    )


def load_urls(path: Path) -> list[str]:
    modes = json.loads(path.read_text(encoding="utf-8"))
    return sorted({mode["sourceUrl"] for mode in modes if mode.get("sourceUrl")})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", type=Path, default=DEFAULT_SOURCES)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--url", action="append", help="Fetch an extra Fortnite source URL")
    args = parser.parse_args()

    urls = load_urls(args.sources)
    if args.url:
      urls.extend(args.url)

    drafts: list[Draft] = []
    errors: list[dict[str, str]] = []
    for url in dict.fromkeys(urls):
        try:
            drafts.append(parse_page(url, fetch(url)))
        except Exception as exc:  # noqa: BLE001 - keep sync report resilient.
            errors.append({"sourceUrl": url, "error": str(exc)})

    payload = {
        "generatedBy": "scripts/sync_fortnite.py",
        "drafts": [asdict(draft) for draft in drafts],
        "errors": errors,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(drafts)} drafts and {len(errors)} errors to {args.out}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
