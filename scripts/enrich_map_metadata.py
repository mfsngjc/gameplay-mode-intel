#!/usr/bin/env python3
"""Add public callout names and Wiki links to the map archive."""
from pathlib import Path
from html import unescape
import json
import re
import urllib.parse
import urllib.request

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/maps.json"
PROXIES = urllib.request.getproxies()

VAL_SLUGS = {
    "valorant-ascent": "ascent",
    "valorant-split": "split",
    "valorant-fracture": "fracture",
    "valorant-bind": "bind",
    "valorant-breeze": "breeze",
    "valorant-abyss": "abyss",
    "valorant-lotus": "lotus",
    "valorant-sunset": "sunset",
    "valorant-pearl": "pearl",
    "valorant-summit": "summit",
    "valorant-icebox": "icebox",
    "valorant-corrode": "corrode",
    "valorant-haven": "haven",
}

BF_SLUGS = {
    "bf6-empire-state": "Empire_State",
    "bf6-iberian-offensive": "Iberian_Offensive",
    "bf6-liberation-peak": "Liberation_Peak",
    "bf6-manhattan-bridge": "Manhattan_Bridge",
    "bf6-mirak-valley": "Mirak_Valley",
    "bf6-new-sobek-city": "New_Sobek_City",
    "bf6-operation-firestorm": "Operation_Firestorm",
    "bf6-saints-quarter": "Saints_Quarter",
    "bf6-siege-of-cairo": "Siege_of_Cairo",
    "bf6-blackwell-fields": "Blackwell_Fields",
    "bf6-eastwood": "Eastwood",
    "bf6-contaminated": "Contaminated",
    "bf6-railway-to-golmud": "Railway_to_Golmud",
    "bf6-cairo-bazaar": "Cairo_Bazaar",
    "bf6-tsuru-reef": "Tsuru_Reef",
    "bf6-wake-island": "Wake_Island_(Battlefield_6)",
}

# Delta Force has a maintained community Wiki index, but several localized map
# names do not have a stable one-to-one English page slug. Link every Delta
# record to the index so the card still has a reliable Wiki jump link rather
# than guessing a page that may be renamed.
DELTA_WIKI_INDEX = "https://delta-force.fandom.com/wiki/Maps"


def fetch(url):
    session = requests.Session()
    session.proxies.update(PROXIES)
    response = session.get(url, timeout=(8, 30))
    response.raise_for_status()
    return response.text


def extract_callout_points(markup):
    pattern = re.compile(
        r'<button[^>]*style="left:([\d.]+)%;top:([\d.]+)%[^" ]*"[^>]*>(.*?)</button>',
        re.S,
    )
    points = []
    seen = set()
    for left, top, raw in pattern.findall(markup):
        label = re.sub(r"<[^>]+>", "", unescape(raw)).strip()
        if not label or label in seen:
            continue
        seen.add(label)
        points.append({"name": label, "left": round(float(left), 3), "top": round(float(top), 3)})
    return points


def main():
    entries = json.loads(DATA.read_text())
    changed = 0
    for entry in entries:
        ident = entry.get("id", "")
        if ident in VAL_SLUGS:
            slug = VAL_SLUGS[ident]
            entry["wikiUrl"] = f"https://valorant.fandom.com/wiki/{slug.title()}"
            markup = fetch(f"https://valdb.gg/map/{slug}/")
            points = extract_callout_points(markup)
            if points:
                entry["planCallouts"] = [point["name"] for point in points]
                entry["planCalloutPoints"] = points
                entry["planCalloutSourceUrl"] = f"https://valdb.gg/map/{slug}/"
            changed += 1
        elif ident in BF_SLUGS:
            entry["wikiUrl"] = "https://battlefield.fandom.com/wiki/" + BF_SLUGS[ident]
            changed += 1
        elif entry.get("game") == "三角洲行动":
            entry["wikiUrl"] = DELTA_WIKI_INDEX
            changed += 1
    DATA.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")
    print(f"Enriched {changed} map records")


if __name__ == "__main__":
    main()
