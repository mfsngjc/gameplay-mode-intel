#!/usr/bin/env python3
"""Refresh a bounded, source-reviewed weapon cosmetic selection.

This is a curated selection, not a full-game scraper. Public Bilibili and
YouTube metadata is refreshed; videos remain in the original platform player.
Images are preserved byte-for-byte, with original URLs, dimensions and hashes.
A failed source leaves that game's previous JSON snapshot untouched.

Usage: python scripts/sync_weapon_curated.py [--offline] [--game GAME]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from urllib.parse import urlencode

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data/weapon-skins"
ASSETS = ROOT / "assets/weapon-skins/curated"
CACHE = ROOT / "local-only/weapon-skins/curated-source-cache"
REVIEWED_AT = "2026-11-02"
CURL = shutil.which("curl.exe") or shutil.which("curl")
OFFLINE = False

COD_HOLGER = "https://www.callofduty.com/uk/en/blog/2021/06/Call-of-Duty-Mobile-Mythic-Weapon-Holger-Dark-Frontier"
COD_MG42 = "https://www.callofduty.com/blog/2024/04/call-of-duty-mobile-season-4-fools-gold-seek-new-riches-intel"
COD_RELOADED = "https://www.callofduty.com/blog/2023/08/call-of-duty-modern-warfare-II-season-05-reloaded-multiplayer-DMZ-content-drop"
APEX_ARTIFACTS = "https://www.ea.com/games/apex-legends/apex-legends/news/apex-artifacts"
APEX_SPELLBOUND = "https://www.ea.com/ea-play/news/spellbound-collection-event"


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


def request(url: str) -> bytes:
    if OFFLINE:
        raise RuntimeError("Offline mode requires a retained source and image cache")
    if not CURL:
        raise RuntimeError("curl is required for public HTTPS source requests")
    process = subprocess.run(
        [CURL, "--silent", "--show-error", "--location", "--fail", "--connect-timeout", "10", "--max-time", "35", url],
        capture_output=True, check=False,
    )
    if process.returncode:
        raise RuntimeError(process.stderr.decode("utf-8", errors="replace").strip())
    return process.stdout


def metadata(filename: str, url: str, offline: bool) -> dict:
    cache = CACHE / filename
    if offline:
        return json.loads(cache.read_text(encoding="utf-8"))
    body = request(url)
    value = json.loads(body)
    # Validate before replacing a previous successful source cache.
    if "bilibili.com" in url and (value.get("code") != 0 or not value.get("data")):
        raise ValueError(f"Bilibili metadata refused: {value.get('code')}")
    if "youtube.com/oembed" in url and not value.get("author_name"):
        raise ValueError("YouTube oEmbed has no verified author")
    atomic_json(cache, value)
    atomic_json(cache.with_suffix(".meta.json"), {"url": url, "retrievedAt": datetime.now(timezone.utc).isoformat()})
    return value


def archived_image(filename: str, url: str, source_url: str, provider: str,
                   *, kind: str = "render", source_type: str = "official", caption: str = "") -> dict:
    path = ASSETS / filename
    evidence = CACHE / "image-provenance" / (filename + ".json")
    previous = json.loads(evidence.read_text(encoding="utf-8")) if evidence.exists() else {}
    # A changed metadata URL must not be attached to the old image bytes.
    if not path.exists() or (previous and previous.get("assetSourceUrl") != url):
        body = request(url)
        temp = path.with_suffix(path.suffix + ".tmp")
        temp.parent.mkdir(parents=True, exist_ok=True)
        temp.write_bytes(body)
        try:
            with Image.open(temp) as image:
                image.verify()
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)
    with Image.open(path) as image:
        width, height = image.size
    relative = path.relative_to(ROOT).as_posix()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if previous.get("assetSourceUrl") == url and previous.get("sha256") != digest:
        raise ValueError(f"Retained image hash changed: {filename}; review it before resyncing")
    record = {
        "url": relative, "sourcePageUrl": source_url, "assetSourceUrl": url,
        "sourceType": source_type, "provider": provider, "kind": kind,
        "caption": caption, "width": width, "height": height,
        "sha256": digest, "retrievedAt": REVIEWED_AT,
    }
    atomic_json(evidence, record)
    return record


def skin(identifier: str, game: str, name: str, weapon_id: str, weapon_name: str,
         weapon_type: str, category: str, source_url: str, source_name: str,
         description: str, *, english_name: str = "", region: str = "国际服",
         rarity: str = "", rarity_id: str = "", color: str = "#a24a40", game_title: str = "") -> dict:
    return {
        "id": identifier, "game": game, "name": name, "englishName": english_name,
        "weaponId": weapon_id, "weaponName": weapon_name, "weaponEnglishName": weapon_name,
        "weaponType": weapon_type, "category": category,
        "rarity": {"id": rarity_id or rarity.lower(), "name": rarity, "color": color},
        "description": description, "sourceId": identifier, "sourceUrl": source_url,
        "sourceName": source_name, "region": region, "gameTitle": game_title,
        "firstSeenAt": REVIEWED_AT, "releaseDate": None, "releaseDateStatus": "unverified",
        "timingNote": "资料发现时间与官方投稿日期单列；未据此推定精确首发日期或当前可获取状态。",
        "publicationStatus": "ready", "reviewedAt": REVIEWED_AT,
        "chromas": [], "levels": [], "media": [], "tags": [],
    }


def youtube(video_id: str, filename: str, offline: bool, *, official: bool,
            kind: str = "showcase", note: str = "") -> tuple[dict, dict]:
    url = f"https://www.youtube.com/watch?v={video_id}"
    meta = metadata(filename, "https://www.youtube.com/oembed?" + urlencode({"url": url, "format": "json"}), offline)
    expected = {"Garena Call of Duty Mobile", "Call of Duty: Mobile", "Apex Legends"}
    if official and meta["author_name"] not in expected:
        raise ValueError(f"Unexpected official channel: {meta['author_name']}")
    media = {
        "id": "youtube-" + video_id, "kind": kind, "provider": "youtube", "url": url,
        "videoId": video_id, "title": meta["title"], "sourcePageUrl": url,
        "sourceName": meta["author_name"], "sourceType": "official" if official else "community",
        "reviewStatus": "source_confirmed" if kind == "inspect" else "metadata_only",
        "reviewNote": note or "已核视频标题、作者及对象身份；尚未逐帧标注动作与时间段。",
        "contains": ["inspect"] if kind == "inspect" else [], "reviewedAt": REVIEWED_AT,
    }
    return media, meta


DELTA = [
    ("create", "BV11jdbB8EsB", "造物纪元", "枪械", "gun", "枪械", "典藏",
     "枪身内的打印机器人在常规检视时解构并生成枪身样式；官方说明该变化不改变配件效果。原稿未注明适配枪型。", ["inspect"]),
    ("polaris", "BV1gkgSzPEvX", "北极星", "弹簧刀", "melee", "近战武器", "传说",
     "弹簧刀外观；官方实录说明包括专属检视、挥刀与收刀动作。", ["inspect", "attack", "unequip"]),
    ("executioner", "BV1DNzZBkEiv", "处刑者", "近战武器", "melee", "近战武器", "",
     "可分四阶段升级的近战外观；官方说明可逐步解锁切出、检视、攻击动作与外观形态。各阶段动作尚未逐段标注。", ["equip", "inspect", "attack"]),
    ("dirge", "BV1xV7K6zEZS", "挽歌", "反曲刀", "melee", "近战武器", "传说",
     "反曲刀外观；官方说明其具有独立的检视效果。", ["inspect"]),
    ("sea", "BV15pojYHE6i", "黑海", "战术斧", "melee", "近战武器", "传说",
     "以深海为主题的战术斧；官方说明包括专属检视、多种攻击与收刀动作。", ["inspect", "attack", "unequip"]),
    ("darkstar", "BV1ywzSBkESs", "暗星", "排障刀", "melee", "近战武器", "传说",
     "排障刀外观。官方实录与同名捆绑包资料已关联；原稿未逐项说明动作差异，未标为已核验检视。", []),
    ("starfall", "BV1btQGBVEbT", "坠星者", "短刃", "melee", "近战武器", "传说",
     "短刃外观。官方实录已关联；挥刀动作以原片为准，尚未单独标注检视时间段。", ["attack"]),
    ("bounty", "BV1RPCCBDETf", "AS Val · 悬赏令", "AS Val", "gun", "突击步枪", "典藏",
     "AS Val 典藏外观；官方说明有多套检视动作，检视图案随击败干员数量变化，具体阶段阈值未在源稿中给出。", ["inspect"]),
]


def delta_skins(offline: bool) -> list[dict]:
    entries = []
    for slug, bvid, name, weapon, weapon_type, category, rarity, description, contains in DELTA:
        url = f"https://www.bilibili.com/video/{bvid}/"
        meta = metadata("delta-" + slug + ".json", "https://api.bilibili.com/x/web-interface/view?bvid=" + bvid, offline)["data"]
        if meta["owner"]["mid"] != 3494376565115651 or meta["owner"]["name"] != "三角洲行动":
            raise ValueError("Delta source is not the reviewed official account")
        entry = skin("delta-" + slug, "delta-force", name, "delta-" + weapon, weapon, weapon_type,
                     category, url, "三角洲行动官方 · 哔哩哔哩", description, region="国服", rarity=rarity)
        entry["sourceId"] = bvid
        entry["publishedDate"] = datetime.fromtimestamp(meta["pubdate"], timezone.utc).astimezone(timezone.utc).date().isoformat()
        entry["image"] = archived_image("delta-" + slug + ".jpg", meta["pic"].replace("http://", "https://"), url,
                                        "三角洲行动官方", kind="poster", caption="官方实录原始封面；不作为独立游戏内渲染图。")
        entry["media"] = [{
            "id": "bilibili-" + bvid, "kind": "showcase", "provider": "bilibili", "url": url,
            "videoId": bvid, "title": meta["title"], "sourcePageUrl": url, "sourceName": "三角洲行动官方",
            "sourceType": "official", "reviewStatus": "source_confirmed" if contains else "metadata_only",
            "reviewNote": "已核官方账号及原稿动作说明；尚未逐帧标注片段起止与触发条件。",
            "contains": contains, "duration": meta["duration"], "reviewedAt": REVIEWED_AT,
            "rightsNote": "源稿标注未经作者授权禁止转载；通过原站播放器观看，保留作者与来源。",
        }]
        entry["tags"] = [rarity, *contains] if rarity else contains
        entries.append(entry)
    return entries


def cod_skins(offline: bool) -> list[dict]:
    entries = []
    # CODM is maintained in cod-mobile.json by sync_weapon_codm.py.
    entry = skin("cod-mwii-slaughter-king", "call-of-duty", "战斗刀 · Slaughter King", "cod-mwii-combat-knife", "Combat Knife",
                 "melee", "近战武器", COD_RELOADED, "Call of Duty 官方公告 / GamesAtlas", "Modern Warfare II / Warzone 2 的 21 Savage 捆绑包近战蓝图。官方公告确认名称；目录图由 GamesAtlas 提供，专属检视录像尚待补齐。",
                 english_name="Combat Knife — Slaughter King", rarity="", game_title="Modern Warfare II / Warzone 2")
    entry["image"] = archived_image("cod-slaughter-king-render.webp", "https://www.gamesatlas.com/images/jch-optimize/ng/images_cod-modern-warfare-2_blueprints_Slaughter-King.webp",
                                    "https://www.gamesatlas.com/cod-warzone-2-blueprints/modern-warfare-2/slaughter-king", "GamesAtlas", source_type="game_asset",
                                    caption="Slaughter King 刀具游戏资源图，由社区目录 GamesAtlas 提供；未标为官方宣传图。")
    entry["tags"] = ["端游", "蓝图", "21 Savage"]
    entry["publishedDate"] = "2023-08-28"
    entries.append(entry)
    return entries


def apex_skins(offline: bool) -> list[dict]:
    entries = []
    entry = skin("apex-cobalt-katar", "apex", "Cobalt Katar", "apex-katar", "Katar", "melee", "通用近战",
                 APEX_ARTIFACTS, "EA / Respawn 官方", "通用神话近战外观，属于可自定义的 Apex Artifacts。官方资料介绍基础外观、主题、能源、启动动作及死亡盒等独立组件；当前封面为系列总览，不代表某一自定义组合。",
                 english_name="Cobalt Katar", rarity="Mythic", color="#bf403d")
    entry["image"] = archived_image("apex-katar-collection.jpg", "https://drop-assets.ea.com/images/hAvhWGnOBa42ZqoThxtN9/223972345eca22c62f1f9742d220faa4/R5_S21_Launch_Action_LineupArtifacts_v03__1_.png",
                                    APEX_ARTIFACTS, "EA / Respawn 官方", kind="collection", caption="Apex Artifacts 官方系列总览；并非 Cobalt Katar 单独渲染图。")
    entry["tags"] = ["Apex Artifacts", "神话", "可自定义", "全传奇可用"]
    entry["publishedDate"] = "2024-05-03"
    entries.append(entry)
    entry = skin("apex-seer-showstoppers", "apex", "希尔 · Showstoppers", "apex-seer-heirloom", "希尔传家宝", "melee", "传家宝",
                 APEX_SPELLBOUND, "EA 官方 / Apex Legends Wiki", "希尔专属传家宝近战外观。官方活动公告确认 Showstoppers 名称；游戏资源图展示传家宝套装，社区作者 Dazs 的录像作为动作补充，尚未逐段标注检视。",
                 english_name="Seer — Showstoppers", rarity="Mythic", color="#bf403d")
    entry["image"] = archived_image("apex-seer-set.png", "https://apexlegends.wiki.gg/images/Seer_Heirloom_Set.png?b80862",
                                    "https://apexlegends.wiki.gg/wiki/File:Seer_Heirloom_Set.png", "Apex Legends Wiki", source_type="game_asset", kind="set",
                                    caption="游戏内传家宝套装资源图，由社区 Wiki 提供；包含同套装的其他奖励。")
    media, _ = youtube("jVi3ITV1sHs", "apex-seer-video.json", offline, official=False)
    official, _ = youtube("IFrrZ3j8hw4", "apex-spellbound-video.json", offline, official=True)
    official["reviewNote"] = "官方活动总览视频；未作为 Showstoppers 独立检视录像。"
    entry["media"] = [media, official]
    entry["tags"] = ["希尔", "Seer", "传家宝", "神话"]
    entries.append(entry)
    entry = skin("apex-triple-take-absolute-zero", "apex", "三重式 · Absolute Zero", "apex-triple-take", "三重式", "gun", "射手步枪",
                 "https://apexlegends.wiki.gg/wiki/Triple_Take", "Apex Legends Wiki", "三重式的 Absolute Zero 武器外观。当前收录游戏资源静态图；原图上传日期不作为皮肤上线日期，尚未关联专属检视录像。",
                 english_name="Triple Take — Absolute Zero", rarity="Legendary", color="#c18426")
    entry["weaponEnglishName"] = "Triple Take"
    entry["image"] = archived_image("apex-absolute-zero.png", "https://apexlegends.wiki.gg/images/Absolute_Zero_Triple_Take.png?42c727",
                                    "https://apexlegends.wiki.gg/wiki/File:Absolute_Zero_Triple_Take.png", "Apex Legends Wiki", source_type="game_asset",
                                    caption="游戏资源图，由社区 Wiki 提供，未作为官方宣传图标注。")
    entry["tags"] = ["三重式", "Triple Take", "Legendary"]
    entries.append(entry)
    return entries


def main() -> int:
    global OFFLINE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Use retained reviewed source caches; do not claim a new live check")
    parser.add_argument("--game", choices=["delta-force", "call-of-duty", "apex"])
    args = parser.parse_args()
    OFFLINE = args.offline
    CACHE.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    if args.game == "apex":
        command = [sys.executable, str(ROOT / "scripts/sync_weapon_apex.py")]
        if args.offline:
            command.append("--offline")
        return subprocess.call(command)
    jobs = {"delta-force": delta_skins, "call-of-duty": cod_skins}
    failures = []
    for game, build in jobs.items():
        if args.game and args.game != game:
            continue
        if game == "call-of-duty":
            command = [sys.executable, str(ROOT / "scripts/sync_weapon_cod_pc.py")]
            if args.offline:
                command.append("--offline")
            result = subprocess.call(command)
            if result:
                failures.append({"game": game, "error": "Dedicated PC blueprint sync failed", "previousSnapshotPreserved": True})
            continue
        path = DATA / (game + ".json")
        try:
            entries = build(args.offline)
            previous = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
            first_seen = {item["id"]: item["firstSeenAt"] for item in previous.get("skins", [])}
            for item in entries:
                item["firstSeenAt"] = first_seen.get(item["id"], item["firstSeenAt"])
            snapshot = {
                "schemaVersion": 1, "game": game,
                "updatedAt": previous.get("updatedAt", REVIEWED_AT) if args.offline else datetime.now(timezone.utc).isoformat(),
                "source": {"name": "官方资料与经复核的原作者媒体选集", "url": entries[0]["sourceUrl"], "reviewedAt": REVIEWED_AT},
                "coverage": {
                    "status": "partial", "catalogScope": "curated_featured", "complete": False,
                    "entryCount": len(entries), "entriesWithVideo": sum(bool(item["media"]) for item in entries),
                    "liveMetadataRefreshed": not args.offline,
                    "note": "首批精选资料，不代表本游戏全部历史皮肤。动作说明、视频身份与实际片段核验分别记录；未将首次采集时间或预告日期当作实际上线日期。",
                    "remaining": ["完整历史皮肤目录", "动作片段起止与触发条件", "精确首发日期与地区差异"],
                },
                "skins": entries,
            }
            atomic_json(path, snapshot)
            print(json.dumps({"game": game, "count": len(entries), "withVideo": snapshot["coverage"]["entriesWithVideo"], "path": str(path.relative_to(ROOT))}, ensure_ascii=False))
        except Exception as error:
            failures.append({"game": game, "error": str(error), "previousSnapshotPreserved": path.exists()})
            print(json.dumps(failures[-1], ensure_ascii=False), file=sys.stderr)
    atomic_json(CACHE / "last-run.json", {"attemptedAt": datetime.now(timezone.utc).isoformat(), "offline": args.offline, "failures": failures})
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
