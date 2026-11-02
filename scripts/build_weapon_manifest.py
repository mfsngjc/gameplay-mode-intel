#!/usr/bin/env python3
"""Build the small public cosmetics index from the explicit game snapshots."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAMES = [
    ("valorant", "无畏契约"), ("delta-force", "三角洲行动"),
    ("call-of-duty", "使命召唤"), ("cod-mobile", "使命召唤手游"),
    ("cf-mobile", "穿越火线手游"), ("cfhd", "CFHD"),
    ("cs2", "CS2"), ("apex", "Apex Legends"),
]


def main():
    entries = []
    for game, name in GAMES:
        source = ROOT / "data/weapon-skins" / (game + ".json")
        payload = json.loads(source.read_text(encoding="utf-8"))
        if payload.get("game") != game or payload.get("schemaVersion") != 1:
            raise ValueError("Invalid weapon snapshot: " + game)
        skins = [skin for skin in payload["skins"] if skin.get("publicationStatus") == "ready"]
        entries.append({
            "id": game, "name": name, "url": "data/weapon-skins/" + source.name,
            "count": len(skins), "meleeCount": sum(skin["weaponType"] == "melee" for skin in skins),
            "withVideoCount": sum(any(media.get("provider") in {"mp4", "youtube", "bilibili"} for media in skin.get("media", [])) for skin in skins),
            "withAnimationCount": sum(any(media.get("provider") == "gif" for media in skin.get("media", [])) for skin in skins),
            "updatedAt": payload["updatedAt"],
            "coverage": payload.get("coverage", {}), "source": payload.get("source", {}),
        })
    result = {
        "schemaVersion": 1, "updatedAt": max(entry["updatedAt"] for entry in entries),
        "total": sum(entry["count"] for entry in entries),
        "games": entries,
        "note": "独立武器外观目录；不计入玩法模式和基础体验更新。收录时间不作为首发日期。",
    }
    destination = ROOT / "data/weapon-skins/manifest.json"
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(destination)
    print(json.dumps({entry["id"]: entry["count"] for entry in entries}, ensure_ascii=False))
    print("Weapon cosmetics manifest: " + str(result["total"]) + " records")


if __name__ == "__main__":
    main()
