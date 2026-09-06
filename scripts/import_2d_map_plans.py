#!/usr/bin/env python3
"""Copy public 2D in-game map plans for Battlefield 6 and VALORANT.

The files are kept separate from the promotional cover art already used by the
map cards. Each record keeps the page that supplied the plan so the UI can show
the asset as a sourced 2D reference rather than an official interactive map.
"""
from pathlib import Path
from io import BytesIO
import json
import urllib.request

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/maps.json"
OUT = ROOT / "assets/maps/2d-plans"
OUT.mkdir(parents=True, exist_ok=True)
PROXIES = urllib.request.getproxies()

BF_SOURCE = "https://www.battlefield6.gg/maps/"
BF_PLANS = {
    "bf6-empire-state": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/empire-state-columbia-conquest-version.png",
    "bf6-iberian-offensive": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/iberan-offensive-kings-battery-conquest-map.png",
    "bf6-liberation-peak": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/liberation-peak-ridge-13-conquest-version.png",
    "bf6-manhattan-bridge": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/manhattan-bridge-conquest-version.png",
    "bf6-mirak-valley": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/mirak-valley-rivers-edge-conquest-version.png",
    "bf6-new-sobek-city": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/new-sobek-city-conquest-map.png",
    "bf6-operation-firestorm": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/operation-firestorm-scorched-earth-conquest-version.png",
    "bf6-saints-quarter": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/saints-quarter-contact-shot-domination-version-.png",
    "bf6-siege-of-cairo": "https://media.battlefield6.gg/cdn-cgi/image/format=auto,quality=85/media/siege-of-cairo-conquest.png",
}

VAL_SOURCE = "https://valdb.gg/maps/"
VAL_PLANS = {
    "valorant-ascent": "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
    "valorant-split": "d960549e-485c-e861-8d71-aa9d1aed12a2",
    "valorant-fracture": "b529448b-4d60-346e-e89e-00a4c527a405",
    "valorant-bind": "2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba",
    "valorant-breeze": "2fb9a4fd-47b8-4e7d-a969-74b4046ebd53",
    "valorant-abyss": "224b0a95-48b9-f703-1bd8-67aca101a61f",
    "valorant-lotus": "2fe4ed3a-450a-948b-6d6b-e89a78e680a9",
    "valorant-sunset": "92584fbe-486a-b1b2-9faa-39b0f486b498",
    "valorant-pearl": "fd267378-4d1d-484f-ff52-77821ed10dc2",
    "valorant-summit": "756da597-416b-c0f2-f47b-afbdf28670bc",
    "valorant-icebox": "e2ad5c54-4114-a870-9641-8ea21279579a",
    "valorant-corrode": "1c18ab1f-420d-0d8b-71d0-77ad3c439115",
    "valorant-haven": "2bee0dc9-4ffe-519b-1cbd-7fbe763a6047",
}


def download(url):
    session = requests.Session()
    session.proxies.update(PROXIES)
    response = session.get(url, timeout=(8, 30))
    response.raise_for_status()
    return response.content


def save_image(raw, ident, extension):
    with Image.open(BytesIO(raw)) as image:
        image = image.convert("RGBA") if extension == "png" else image.convert("RGB")
        max_width = 2400
        if image.width > max_width:
            image = image.resize((max_width, round(image.height * max_width / image.width)), Image.Resampling.LANCZOS)
        path = OUT / f"{ident}.{extension}"
        if extension == "png":
            image.save(path, optimize=True)
        else:
            image.save(path, quality=88, optimize=True)
        return image.width, image.height, f"assets/maps/2d-plans/{path.name}"


def main():
    entries = json.loads(DATA.read_text())
    plans = {**BF_PLANS, **{
        ident: f"https://media.valorant-api.com/maps/{uuid}/displayicon.png"
        for ident, uuid in VAL_PLANS.items()
    }}
    imported = 0
    for entry in entries:
        ident = entry.get("id")
        if ident not in plans:
            continue
        url = plans[ident]
        extension = "png" if ident.startswith("valorant-") else "jpg"
        raw = download(url)
        width, height, local = save_image(raw, ident, extension)
        entry["planImageUrl"] = local
        entry["planWidth"] = width
        entry["planHeight"] = height
        entry["planType"] = "游戏内小地图 · Callout 平面图" if ident.startswith("valorant-") else "模式战术图 · Conquest / Domination"
        entry["planSourceUrl"] = VAL_SOURCE if ident.startswith("valorant-") else BF_SOURCE
        entry["planSource"] = "VALDB / Valorant API 游戏内小地图" if ident.startswith("valorant-") else "Battlefield6.gg 模式战术图"
        imported += 1
    DATA.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {imported} local 2D map plans")


if __name__ == "__main__":
    main()
