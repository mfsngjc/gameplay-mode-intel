#!/usr/bin/env python3
"""Sync public VALORANT and CS2 cosmetic catalogues into local static snapshots.

This command never publishes the site. Generic game-client preview videos are
kept as previews; their presence is not evidence of a reviewed inspect clip.
Failed requests leave the last successful public game snapshot untouched.
"""

from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import html
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "data" / "weapon-skins"
CACHE = ROOT / "local-only" / "weapon-skins" / "source-cache"
VAL_BASE = "https://valorant-api.com/v1"
CS_BASE = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api"
VAL_SOURCE = "https://valorant-api.com/"
CS_SOURCE = "https://github.com/ByMykel/CSGO-API"
RGX_BLADE_LEVEL = "d67af30b-4b2a-b1e6-3ac2-6aba74b885d4"
RGX_BLADE_REVIEWED_URL = "https://valorant.dyn.riotcdn.net/x/videos/release-13.09/99d27d45-4e1f-75ba-df79-c18f1b610628_default_universal.mp4"
# Curated official posts supplement the client catalogue. These are attached by
# stable skin UUID so later catalogue refreshes retain the verified association.
# source_confirmed describes the official post and metadata, not frame review.
CURATED_VAL_MEDIA = {
    "d901cc46-43c7-ebe8-9c5a-f7963f1a4db3": [{
        "id": "val-bili-BV1XXazzwE4u", "kind": "inspect", "provider": "bilibili",
        "videoId": "BV1XXazzwE4u", "url": "https://www.bilibili.com/video/BV1XXazzwE4u/",
        "title": "【无畏契约】2025冠军套蝴蝶刀全新检视动作",
        "sourcePageUrl": "https://www.bilibili.com/video/BV1XXazzwE4u/",
        "sourceName": "无畏契约 · 官方 B 站", "sourceType": "official",
        "authorName": "无畏契约", "authorId": "147546636", "cid": "32134136751",
        "duration": 28, "containsActions": ["inspect"], "reviewStatus": "source_confirmed",
        "reviewedAt": "2026-11-02",
        "metadataSourceUrl": "https://api.bilibili.com/x/web-interface/view?bvid=BV1XXazzwE4u",
        "reviewNote": "官方投稿标题明确为 2025 冠军套蝴蝶刀检视；已核对作者、CID 与 28 秒时长，未逐帧标注动作起止时间。",
        "rightsNote": "原稿标注未经作者授权禁止转载，使用原站播放器并保留作者与出处。",
    }],
}
VAL_CATEGORIES = {
    "Heavy": "机枪", "Rifle": "步枪", "SMG": "冲锋枪", "Shotgun": "霰弹枪",
    "Sidearm": "手枪", "Sniper": "狙击步枪", "Melee": "近战武器",
}
CS_CATEGORIES = {
    "csgo_inventory_weapon_category_rifles": "步枪",
    "csgo_inventory_weapon_category_smgs": "冲锋枪",
    "csgo_inventory_weapon_category_pistols": "手枪",
    "csgo_inventory_weapon_category_heavy": "重型武器",
    "sfui_invpanel_filter_melee": "近战武器",
}


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load(path: Path, default=None):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def atomic_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(",", ":"))
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def clean(value) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", "", str(value or "")))
    return text.replace("\\n", "\n").replace("\r", "").strip()


def public_https(value) -> str:
    text = str(value or "")
    parsed = urlparse(text)
    if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
        return ""
    return text


def fetch_json(name: str, url: str, offline: bool):
    cache_path = CACHE / (name + ".json")
    metadata_path = CACHE / (name + ".source.json")
    if offline:
        cached = load(cache_path)
        metadata = load(metadata_path)
        if cached is None or not metadata or metadata.get("url") != url:
            raise RuntimeError("缺少可复用的来源缓存：" + name)
        return cached, metadata
    last_error = None
    for attempt in range(2):
        try:
            curl = shutil.which("curl.exe") or shutil.which("curl")
            if curl:
                response = subprocess.run(
                    [curl, "--silent", "--show-error", "--fail", "--location",
                     "--proto", "=https", "--proto-redir", "=https",
                     "--max-time", "45", "--max-filesize", "50000000", url],
                    capture_output=True, check=False, timeout=50,
                )
                if response.returncode:
                    raise RuntimeError(response.stderr.decode("utf-8", errors="replace").strip())
                raw = response.stdout
            else:
                request = Request(url, headers={"User-Agent": "gameplay-mode-intel-cosmetics/1.0"})
                with urlopen(request, timeout=45) as response:
                    raw = response.read(50_000_001)
            if len(raw) > 50_000_000:
                raise RuntimeError("来源超过允许的 50 MB 大小")
            value = json.loads(raw)
            if not isinstance(value, (list, dict)):
                raise RuntimeError("来源不是 JSON 对象或数组")
            metadata = {"url": url, "retrievedAt": now(), "bytes": len(raw)}
            atomic_json(cache_path, value)
            atomic_json(metadata_path, metadata)
            return value, metadata
        except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
            last_error = error
            if attempt == 0:
                time.sleep(0.5)
    raise RuntimeError(name + "：" + str(last_error))


def fetch_group(specifications: dict[str, str], offline: bool):
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {name: pool.submit(fetch_json, name, url, offline)
                   for name, url in specifications.items()}
        results = {name: future.result() for name, future in futures.items()}
    return {name: value for name, (value, _) in results.items()}, [meta for _, meta in results.values()]


def api_data(value, label: str, minimum: int = 1):
    if not isinstance(value, dict) or value.get("status") != 200:
        raise RuntimeError(label + " 返回失败状态")
    data = value.get("data")
    if not isinstance(data, list) or len(data) < minimum:
        raise RuntimeError(label + " 缺少完整数据数组")
    return data


def index_by(values, key):
    result = {entry[key]: entry for entry in values}
    if len(result) != len(values):
        raise RuntimeError("来源存在重复 ID：" + key)
    return result


def first_seen(previous: dict, identifier: str, timestamp: str) -> str:
    return previous.get(identifier, {}).get("firstSeenAt", timestamp)


def image_record(url: str, page: str, provider: str) -> dict:
    hostname = urlparse(url).hostname or ""
    host_type = "official" if hostname.endswith(".steamstatic.com") or hostname.endswith(".riotcdn.net") else "community"
    return {
        "url": url, "assetSourceUrl": url, "sourcePageUrl": page,
        "sourceType": "game_asset", "provider": provider, "hostType": host_type,
        "provenanceNote": "游戏客户端资源图；由社区目录提供地址。" if host_type == "official" else "游戏客户端资源图，由社区接口提取并托管；非官方素材托管站。",
    }


def val_video(identifier: str, video: str, title: str, source_page: str, **relation) -> dict | None:
    url = public_https(video)
    hostname = urlparse(url).hostname or ""
    if not url or not hostname.endswith(".riotcdn.net"):
        return None
    return {
        "id": identifier, "kind": "preview", "provider": "mp4", "url": url,
        "title": title, "sourcePageUrl": source_page, "sourceName": "Riot 游戏内皮肤预览（Valorant-API 索引）",
        "sourceType": "official", "reviewStatus": "metadata_only", **relation,
    }


def build_valorant(raw: dict, sources: list[dict], previous: dict, timestamp: str):
    weapons = api_data(raw["valorant-weapons-zh"], "瓦洛兰特中文武器树", 15)
    english_weapons = index_by(api_data(raw["valorant-weapons-en"], "瓦洛兰特英文武器树", 15), "uuid")
    tiers = index_by(api_data(raw["valorant-tiers-zh"], "瓦洛兰特品质"), "uuid")
    version = raw["valorant-version"].get("data")
    if not isinstance(version, dict) or not version.get("version"):
        raise RuntimeError("缺少瓦洛兰特版本依据")
    skins = []
    excluded = Counter()
    missing_english = 0
    raw_count = 0
    for weapon in weapons:
        en_weapon = english_weapons.get(weapon["uuid"])
        if not en_weapon:
            raise RuntimeError("中英文武器树不同步")
        en_skins = index_by(en_weapon["skins"], "uuid")
        if set(en_skins) != {entry["uuid"] for entry in weapon["skins"]}:
            raise RuntimeError("中英文皮肤目录的 ID 集合不同步：" + weapon["uuid"])
        category_key = weapon.get("category", "").split("::")[-1]
        category = VAL_CATEGORIES.get(category_key)
        if not category:
            raise RuntimeError("未识别的武器分类：" + category_key)
        for skin in weapon["skins"]:
            raw_count += 1
            en = en_skins.get(skin["uuid"])
            if not en:
                missing_english += 1
                continue
            english_name = clean(en.get("displayName"))
            asset_path = (skin.get("assetPath") or "").lower()
            if skin["uuid"] == weapon.get("defaultSkinUuid") or english_name.startswith("Standard ") or "/standard/" in asset_path:
                excluded["default"] += 1
                continue
            if "Random Favorite Skin" in english_name or "/random/" in asset_path:
                excluded["random_favorite"] += 1
                continue
            en_chromas = index_by(en.get("chromas", []), "uuid")
            en_levels = index_by(en.get("levels", []), "uuid")
            identifier = "val-" + skin["uuid"]
            name = clean(skin.get("displayName")) or english_name
            page = VAL_BASE + "/weapons/skins/" + skin["uuid"] + "?language=zh-CN"
            chromas, levels, media = [], [], []
            for chroma in skin.get("chromas", []):
                chroma_name = clean(chroma.get("displayName")) or name
                video = val_video("val-chroma-" + chroma["uuid"], chroma.get("streamedVideo"), chroma_name + " · 炫彩预览", page, chromaId=chroma["uuid"])
                chromas.append({
                    "id": chroma["uuid"], "name": chroma_name,
                    "englishName": clean(en_chromas.get(chroma["uuid"], {}).get("displayName")),
                    "imageUrl": public_https(chroma.get("fullRender")) or public_https(chroma.get("displayIcon")),
                    "swatchUrl": public_https(chroma.get("swatch")), "videoUrl": video["url"] if video else None,
                })
                if video:
                    media.append(video)
            for position, level in enumerate(skin.get("levels", []), 1):
                level_name = clean(level.get("displayName")) or (name + " 等级 " + str(position))
                effect_type = (level.get("levelItem") or "").split("::")[-1] or "base"
                video = val_video("val-level-" + level["uuid"], level.get("streamedVideo"), level_name + " · 等级预览", page, levelId=level["uuid"])
                if video and level["uuid"] == RGX_BLADE_LEVEL and video["url"] == RGX_BLADE_REVIEWED_URL:
                    video["reviewStatus"] = "sample_reviewed"
                    video["containsActions"] = ["equip", "attack", "inspect"]
                    video["reviewedAt"] = "2026-11-02"
                    video["reviewNote"] = "本轮对混合动作预览抽帧核对，含持刀、攻击与检视；未标注精确片段起止时间。"
                levels.append({
                    "id": level["uuid"], "name": level_name,
                    "englishName": clean(en_levels.get(level["uuid"], {}).get("displayName")),
                    "level": position, "effectType": effect_type,
                    "imageUrl": public_https(level.get("displayIcon")), "videoUrl": video["url"] if video else None,
                })
                if video:
                    media.append(video)
            media.extend(dict(supplement) for supplement in CURATED_VAL_MEDIA.get(skin["uuid"], []))
            image = public_https(skin.get("displayIcon")) or next((c["imageUrl"] for c in chromas if c["imageUrl"]), "") or next((l["imageUrl"] for l in levels if l["imageUrl"]), "")
            if not image:
                excluded["no_image"] += 1
                continue
            tier_id = skin.get("contentTierUuid") or "unclassified"
            tier = tiers.get(tier_id, {})
            tier_color = str(tier.get("highlightColor") or "8c9692")[:6]
            if not re.fullmatch(r"[0-9a-fA-F]{6}", tier_color):
                tier_color = "8c9692"
            tags = [clean(weapon["displayName"]), category]
            if media:
                tags.append("动作预览")
            if any(m["kind"] == "inspect" or "inspect" in m.get("containsActions", []) for m in media):
                tags.append("检视")
            if len(chromas) > 1:
                tags.append("多炫彩")
            if len(levels) > 1:
                tags.append("可升级")
            skins.append({
                "id": identifier, "game": "valorant", "name": name, "englishName": english_name,
                "weaponId": weapon["uuid"], "weaponName": clean(weapon["displayName"]),
                "weaponEnglishName": clean(en_weapon["displayName"]),
                "weaponType": "melee" if category_key == "Melee" else "gun", "category": category,
                "rarity": {"id": tier_id, "name": clean(tier.get("displayName")) or "未标品质", "englishName": tier.get("devName", ""), "color": "#" + tier_color, "rank": tier.get("rank", -1)},
                "description": "", "sourceId": skin["uuid"], "sourceUrl": page,
                "sourceName": "Valorant-API 社区游戏资源目录", "region": "全球客户端资源",
                "firstSeenAt": first_seen(previous, identifier, timestamp), "lastSeenAt": timestamp,
                "releaseDate": None, "releaseDateStatus": "unverified", "sourceStatus": "present",
                "publicationStatus": "ready", "researchStatus": "catalogued",
                "image": image_record(image, page, "Valorant-API"),
                "wallpaperUrl": public_https(skin.get("wallpaper")), "themeId": skin.get("themeUuid"),
                "chromas": chromas, "levels": levels, "media": media, "tags": tags,
            })
    if missing_english:
        raise RuntimeError("中英文皮肤目录不同步，缺少 " + str(missing_english) + " 条英文记录")
    if len(skins) < 500:
        raise RuntimeError("瓦洛兰特结果异常少，保留原快照")
    return skins, {
        "sourceRecordCount": raw_count, "cataloguedCount": len(skins), "excluded": dict(excluded),
        "weaponCount": len(weapons), "gunCount": sum(x["weaponType"] == "gun" for x in skins),
        "meleeCount": sum(x["weaponType"] == "melee" for x in skins),
        "withVideoCount": sum(bool(x["media"]) for x in skins), "videoCount": sum(len(x["media"]) for x in skins),
        "reviewedVideoCount": sum(m["reviewStatus"] in {"sample_reviewed", "source_confirmed"} for x in skins for m in x["media"]),
        "sampleReviewedVideoCount": sum(m["reviewStatus"] == "sample_reviewed" for x in skins for m in x["media"]),
        "sourceConfirmedVideoCount": sum(m["reviewStatus"] == "source_confirmed" for x in skins for m in x["media"]),
        "previewVideoCount": sum(m["kind"] == "preview" for x in skins for m in x["media"]),
        "dedicatedInspectVideoCount": sum(m["kind"] == "inspect" for x in skins for m in x["media"]),
        "imageFallbackCount": sum(not s.get("displayIcon") for w in weapons for s in w["skins"] if "val-" + s["uuid"] in {x["id"] for x in skins}),
        "scope": "本次社区接口的非默认枪械与近战外观目录；不保证已覆盖所有地区和历史发行。",
        "mediaScope": "客户端视频字段用于索引动作预览；抽帧核对样本与官方投稿确认的检视分别标记，不代表全部视频可播或全部皮肤含独立检视。",
    }, version


def build_cs2(raw: dict, sources: list[dict], previous: dict, timestamp: str):
    zh = raw["cs2-skins-zh"]
    en = raw["cs2-skins-en"]
    if not isinstance(zh, list) or not isinstance(en, list) or min(len(zh), len(en)) < 1000:
        raise RuntimeError("CS2 来源数组缺失或异常少，保留原快照")
    english = index_by(en, "id")
    skins = []
    excluded = Counter()
    for skin in zh:
        category_id = skin.get("category", {}).get("id")
        if category_id not in CS_CATEGORIES:
            excluded[skin.get("category", {}).get("name", "unknown")] += 1
            continue
        en_skin = english.get(skin["id"])
        if not en_skin:
            raise RuntimeError("CS2 中英文目录不同步：" + skin["id"])
        image = public_https(skin.get("image"))
        if not image:
            excluded["no_image"] += 1
            continue
        identifier = "cs2-" + skin["id"]
        weapon = skin.get("weapon") or {}
        native_weapon_id = weapon.get("weapon_id")
        if isinstance(native_weapon_id, int) and not isinstance(native_weapon_id, bool) and native_weapon_id > 0:
            # Vanilla knives use SFUI localization keys in weapon.id, while
            # painted variants use item classnames. Valve's numeric defindex
            # identifies the same base weapon in both forms.
            canonical_weapon_id = "cs2-weapon-" + str(native_weapon_id)
        else:
            canonical_class = clean((skin.get("original") or {}).get("name"))
            if not canonical_class.startswith("weapon_"):
                canonical_class = clean(weapon.get("id"))
            if not canonical_class.startswith("weapon_"):
                raise RuntimeError("CS2 武器缺少原生数字 ID 或可靠 classname：" + skin["id"])
            canonical_weapon_id = "cs2-class-" + canonical_class
        rarity = skin.get("rarity") or {}
        name = clean(skin.get("name"))
        english_name = clean(en_skin.get("name"))
        color = str(rarity.get("color") or "#8c9692")
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
            color = "#8c9692"
        skins.append({
            "id": identifier, "game": "cs2", "name": name, "englishName": english_name,
            "weaponId": canonical_weapon_id, "weaponName": clean(weapon.get("name")),
            "sourceWeaponId": weapon.get("id", ""), "weaponNumericId": native_weapon_id,
            "weaponEnglishName": clean(en_skin.get("weapon", {}).get("name")),
            "weaponType": "melee" if category_id == "sfui_invpanel_filter_melee" else "gun",
            "category": CS_CATEGORIES[category_id], "rarity": {"id": rarity.get("id", "unclassified"), "name": clean(rarity.get("name")) or "未标品质", "color": color},
            "description": clean(skin.get("description")), "sourceId": skin["id"],
            "sourceUrl": CS_BASE + "/zh-CN/skins.json", "sourceName": "ByMykel/CSGO-API 社区目录",
            "region": "全球客户端资源", "firstSeenAt": first_seen(previous, identifier, timestamp),
            "lastSeenAt": timestamp, "releaseDate": None, "releaseDateStatus": "unverified",
            "sourceStatus": "present", "publicationStatus": "ready", "researchStatus": "catalogued",
            "image": image_record(image, CS_SOURCE, "Valve Steam CDN" if (urlparse(image).hostname or "").endswith(".steamstatic.com") else "ByMykel 游戏资源归档"),
            "chromas": [], "levels": [], "media": [], "paintIndex": skin.get("paint_index"),
            "pattern": skin.get("pattern"), "floatRange": {"min": skin.get("min_float"), "max": skin.get("max_float")},
            "wears": skin.get("wears", []), "collections": [{"id": x["id"], "name": x.get("name", ""), "imageUrl": public_https(x.get("image"))} for x in skin.get("collections", [])],
            "crates": [{"id": x["id"], "name": x.get("name", "")} for x in skin.get("crates", [])],
            "statTrakAvailable": bool(skin.get("stattrak")), "souvenirAvailable": bool(skin.get("souvenir")),
            "marketSearchUrl": "https://steamcommunity.com/market/search?appid=730&q=" + quote(english_name),
            "tags": [clean(weapon.get("name")), CS_CATEGORIES[category_id], *[clean(x.get("name")) for x in skin.get("collections", [])]],
        })
    if len(skins) < 1000:
        raise RuntimeError("CS2 枪械与近战结果异常少，保留原快照")
    ids_by_name, names_by_id = {}, {}
    for skin in skins:
        name, weapon_id = skin["weaponEnglishName"], skin["weaponId"]
        if name in ids_by_name and ids_by_name[name] != weapon_id:
            raise RuntimeError("同一 CS2 基础武器对应多个标准 ID：" + name)
        if weapon_id in names_by_id and names_by_id[weapon_id] != name:
            raise RuntimeError("不同 CS2 基础武器被合并为同一 ID：" + weapon_id)
        ids_by_name[name] = weapon_id
        names_by_id[weapon_id] = name
    return skins, {
        "sourceRecordCount": len(zh), "cataloguedCount": len(skins), "excluded": dict(excluded),
        "gunCount": sum(x["weaponType"] == "gun" for x in skins), "meleeCount": sum(x["weaponType"] == "melee" for x in skins),
        "weaponCount": len(names_by_id),
        "withVideoCount": 0, "videoCount": 0, "reviewedVideoCount": 0,
        "scope": "本次上游按涂装聚合的枪械与刀皮目录，排除手套、装备与探员；不是每个磨损、模板和单件库存的枚举。",
        "mediaScope": "上游仅提供静态资源；第一人称检视录像另行关联，不将图片或游戏内检视链接称为动作视频。",
    }, None


SPECIFICATIONS = {
    "valorant": {
        "valorant-weapons-zh": VAL_BASE + "/weapons?language=zh-CN",
        "valorant-weapons-en": VAL_BASE + "/weapons?language=en-US",
        "valorant-tiers-zh": VAL_BASE + "/contenttiers?language=zh-CN",
        "valorant-version": VAL_BASE + "/version",
    },
    "cs2": {"cs2-skins-zh": CS_BASE + "/zh-CN/skins.json", "cs2-skins-en": CS_BASE + "/en/skins.json"},
}


def sync_game(game: str, offline: bool):
    output_path = PUBLIC / (game + ".json")
    old = load(output_path, {})
    previous = {entry["id"]: entry for entry in old.get("skins", [])}
    raw, sources = fetch_group(SPECIFICATIONS[game], offline)
    timestamp = max(source["retrievedAt"] for source in sources)
    builder = build_valorant if game == "valorant" else build_cs2
    skins, coverage, version = builder(raw, sources, previous, timestamp)
    present_ids = {entry["id"] for entry in skins}
    absent = []
    for identifier, previous_entry in previous.items():
        if identifier not in present_ids:
            absent.append({**previous_entry, "sourceStatus": "not_in_latest_snapshot"})
    coverage["retainedHistoricalCount"] = len(absent)
    coverage["status"] = "catalogued"
    payload = {
        "schemaVersion": 1, "game": game, "updatedAt": timestamp,
        "source": {"name": "Valorant-API" if game == "valorant" else "ByMykel/CSGO-API", "type": "community_catalogue", "url": VAL_SOURCE if game == "valorant" else CS_SOURCE, "retrievedAt": timestamp, "requests": sources},
        "coverage": coverage,
        "skins": sorted(skins + absent, key=lambda entry: (entry["weaponType"] != "melee", entry["weaponName"], entry["name"], entry["id"])),
    }
    if version:
        payload["source"]["version"] = version["version"]
        payload["source"]["branch"] = version.get("branch")
        payload["source"]["clientBuildDate"] = version.get("buildDate")
    ids = [entry["id"] for entry in payload["skins"]]
    if len(set(ids)) != len(ids):
        raise RuntimeError("输出存在重复皮肤 ID")
    atomic_json(output_path, payload)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game", choices=["all", "valorant", "cs2"], default="all")
    parser.add_argument("--offline", action="store_true", help="仅使用已成功保存的来源缓存重建，不将缓存日期改为今天")
    options = parser.parse_args()
    coverage_path = PUBLIC / "sync-coverage.json"
    ledger = load(coverage_path, {"schemaVersion": 1, "games": {}})
    failed = False
    for game in SPECIFICATIONS if options.game == "all" else [options.game]:
        attempted_at = now()
        try:
            result = sync_game(game, options.offline)
            ledger["games"][game] = {
                "status": "rebuilt_from_cache" if options.offline else "success",
                "lastAttemptAt": attempted_at, "lastSuccessfulAt": result["updatedAt"],
                "snapshotPath": "data/weapon-skins/" + game + ".json", **result["coverage"],
            }
            # coverage.status describes research scope; sync status describes this run.
            ledger["games"][game]["status"] = "rebuilt_from_cache" if options.offline else "success"
            print(json.dumps({"game": game, **result["coverage"], "syncStatus": ledger["games"][game]["status"]}, ensure_ascii=False))
        except Exception as error:
            failed = True
            previous_status = ledger["games"].get(game, {})
            ledger["games"][game] = {**previous_status, "status": "failed", "lastAttemptAt": attempted_at, "error": str(error), "retainedLastGoodSnapshot": (PUBLIC / (game + ".json")).exists()}
            print(game + " 同步失败，保留上次成功快照：" + str(error), file=sys.stderr)
        ledger["updatedAt"] = now()
        atomic_json(coverage_path, ledger)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
