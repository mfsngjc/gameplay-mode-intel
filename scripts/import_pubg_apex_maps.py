#!/usr/bin/env python3
"""Download and register public 2D map plans for PUBG and Apex Legends."""
from __future__ import annotations

import io
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAPS_PATH = ROOT / "data/maps.json"
ASSET_DIR = ROOT / "assets/maps/2d-plans"
ASSET_DIR.mkdir(parents=True, exist_ok=True)

PUBG_PLAN_BASE = "https://pubgplanet.com/maps/full/24222322/"
PUBG_SOURCE = "https://pubgplanet.com/maps"
PUBG_WIKI_BASE = "https://pubg.fandom.com/wiki/"
PUBG = [
    ("erangel", "艾伦格（Erangel）", "Erangel.webp", "8×8 km", "erangel"),
    ("miramar", "米拉玛（Miramar）", "Miramar.webp", "8×8 km", "miramar"),
    ("sanhok", "萨诺（Sanhok）", "Sanhok.webp", "4×4 km", "sanhok"),
    ("vikendi", "维寒迪（Vikendi）", "Vikendi.webp", "8×8 km", "vikendi"),
    ("karakin", "卡拉金（Karakin）", "Karakin.webp", "2×2 km", "karakin"),
    ("paramo", "帕拉莫（Paramo）", "Paramo.webp", "3×3 km", "paramo"),
    ("haven", "褐湾（Haven）", "Haven.webp", "1×1 km", "haven"),
    ("taego", "泰戈（Taego）", "Taego.webp", "8×8 km", "taego"),
    ("deston", "帝斯顿（Deston）", "Deston.webp", "8×8 km", "deston"),
    ("rondo", "荣都（Rondo）", "Rondo.webp", "8×8 km", "rondo"),
]

APEX_IMAGE_API = "https://apexlegends.wiki.gg/api.php"
APEX_SOURCE = "https://apexlegends.wiki.gg/wiki/Category:Map_images"
APEX_OFFICIAL = "https://www.ea.com/games/apex-legends/apex-legends/game-objects/maps-hub"
APEX = [
    ("kings-canyon", "王者峡谷（Kings Canyon）", "Kings Canyon.png", "BR · 约 4×4 km", "Kings_Canyon"),
    ("worlds-edge", "世界尽头（World's Edge）", "World's Edge.png", "BR · 约 4×4 km", "World%27s_Edge"),
    ("olympus", "奥林匹斯（Olympus）", "Olympus.png", "BR · 约 4×4 km", "Olympus"),
    ("storm-point", "风暴点（Storm Point）", "Storm Point.png", "BR · 约 4×4 km", "Storm_Point"),
    ("broken-moon", "残月（Broken Moon）", "Broken Moon.png", "BR · 约 4×4 km", "Broken_Moon"),
    ("e-district", "电流区（E-District）", "E-District.png", "BR · 约 4×4 km", "E-District"),
]


def download(url: str) -> bytes:
    response = requests.get(url, timeout=(10, 60), headers={"User-Agent": "gameplay-mode-intel map archive"})
    response.raise_for_status()
    return response.content


def save_assets(raw: bytes, stem: str) -> tuple[str, str, int, int]:
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    width, height = image.size
    full_path = ASSET_DIR / f"{stem}.jpg"
    thumb_path = ASSET_DIR / f"{stem}-thumb.jpg"
    image.save(full_path, "JPEG", quality=91, optimize=True, progressive=True)
    thumb = image.copy()
    thumb.thumbnail((720, 720), Image.Resampling.LANCZOS)
    thumb.save(thumb_path, "JPEG", quality=86, optimize=True, progressive=True)
    return str(full_path.relative_to(ROOT)), str(thumb_path.relative_to(ROOT)), width, height


def fetch_apex_urls() -> dict[str, str]:
    titles = ["File:" + item[2] for item in APEX]
    response = requests.get(APEX_IMAGE_API, params={
        "action": "query", "format": "json", "titles": "|".join(titles),
        "prop": "imageinfo", "iiprop": "url",
    }, timeout=(10, 30))
    response.raise_for_status()
    pages = response.json()["query"]["pages"].values()
    return {page["title"][5:]: page["imageinfo"][0]["url"] for page in pages if page.get("imageinfo")}


def main() -> None:
    existing = json.loads(MAPS_PATH.read_text())
    by_id = {item["id"]: item for item in existing}
    jobs: dict[str, tuple[str, str]] = {}
    for slug, _, filename, _, _ in PUBG:
        jobs[f"pubg-{slug}"] = (PUBG_PLAN_BASE + quote(filename), f"pubg-{slug}")
    apex_urls = fetch_apex_urls()
    for slug, _, filename, _, _ in APEX:
        jobs[f"apex-{slug}"] = (apex_urls[filename], f"apex-{slug}")

    payloads: dict[str, bytes] = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(download, url): key for key, (url, _) in jobs.items()}
        for future in as_completed(futures):
            key = futures[future]
            payloads[key] = future.result()
            print(f"downloaded {key}: {len(payloads[key]) / 1024 / 1024:.1f} MB")

    for slug, name, filename, size, official_slug in PUBG:
        key = f"pubg-{slug}"
        full, thumb, width, height = save_assets(payloads[key], key)
        by_id[key] = {
            "game": "PUBG", "gameKey": "pubg", "id": key, "name": name,
            "category": "battle-royale", "variant": f"大逃杀 · {size}",
            "sourceUrl": f"https://pubg.com/en/game-info/maps/{official_slug}",
            "imageUrl": full, "thumbnailUrl": thumb, "width": width, "height": height,
            "imageSource": "PUBG Planet 2D 游戏内地图（公开归档）",
            "originalName": filename.rsplit('.', 1)[0], "checkedAt": "2026-09-06",
            "planImageUrl": full, "planWidth": width, "planHeight": height,
            "planType": "游戏内 2D 平面图 · 地形与点位文字已烘焙",
            "planSourceUrl": PUBG_SOURCE, "planSource": "PUBG Planet / data-mine-pubg 地图图集",
            "wikiUrl": PUBG_WIKI_BASE + official_slug.replace("-", "_"),
        }
    for slug, name, filename, size, wiki_slug in APEX:
        key = f"apex-{slug}"
        full, thumb, width, height = save_assets(payloads[key], key)
        by_id[key] = {
            "game": "Apex Legends", "gameKey": "apex", "id": key, "name": name,
            "category": "battle-royale", "variant": f"大逃杀 · {size.replace('BR · ', '')}",
            "sourceUrl": APEX_OFFICIAL, "imageUrl": full, "thumbnailUrl": thumb,
            "width": width, "height": height,
            "imageSource": "Apex Legends Wiki 地图图像（公开归档）",
            "originalName": re.sub(r"\.png$", "", filename), "checkedAt": "2026-09-06",
            "planImageUrl": full, "planWidth": width, "planHeight": height,
            "planType": "游戏内 2D 平面图 · POI 点位文字已烘焙",
            "planSourceUrl": APEX_SOURCE, "planSource": "Apex Legends Wiki / Map images",
            "wikiUrl": f"https://apexlegends.wiki.gg/wiki/{wiki_slug}",
        }

    # Keep the existing curated order, then append the new game collections.
    ordered = existing + [by_id[key] for key in [f"pubg-{x[0]}" for x in PUBG] + [f"apex-{x[0]}" for x in APEX]]
    MAPS_PATH.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {len(ordered)} map records")


if __name__ == "__main__":
    main()
