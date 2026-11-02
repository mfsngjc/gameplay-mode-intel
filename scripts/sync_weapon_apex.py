#!/usr/bin/env python3
"""Reconcile Apex Wiki weapon galleries with the public apex.source.gs item feed.

No video is downloaded. Missing artwork stays pending, never a fake ready card.
The feed is a dated community extraction, not an official/live completeness API.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
from urllib.parse import quote, unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/weapon-skins/apex.json"
CACHE = ROOT / "local-only/weapon-skins/apex/source-cache"
REPORT = ROOT / "local-only/weapon-skins/apex/reconciliation.json"
WIKI = "https://apexlegends.wiki.gg"
FEED = "https://apex.source.gs/api/items/"
COLORS = {"mythic": "#bf403d", "legendary": "#c18426", "epic": "#9563c9", "rare": "#4386bc", "common": "#7c858d"}
WEAPON_ZH = {
    "HAVOC Rifle": "哈沃克步枪", "VK-47 Flatline": "平行步枪", "Hemlok Burst AR": "赫姆洛克连发突击步枪",
    "R-301 Carbine": "R-301 卡宾枪", "Nemesis Burst AR": "复仇女神连发突击步枪",
    "Alternator SMG": "转换者冲锋枪", "Prowler Burst PDW": "猎兽连发冲锋枪", "R-99 SMG": "R-99 冲锋枪",
    "Volt SMG": "电能冲锋枪", "C.A.R. SMG": "C.A.R. 冲锋枪", "Devotion LMG": "专注轻机枪",
    "L-STAR EMG": "L-STAR 能量机枪", "M600 Spitfire": "M600 喷火轻机枪", "Rampage LMG": "暴走轻机枪",
    "G7 Scout": "G7 侦察枪", "Triple Take": "三重式", "30-30 Repeater": "30-30 连发枪",
    "Bocek Compound Bow": "波塞克复合弓", "Longbow DMR": "长弓精确步枪", "Charge Rifle": "充能步枪",
    "Kraber .50-Cal Sniper": "克雷贝尔 .50 口径狙击枪", "Sentinel": "哨兵狙击枪",
    "EVA-8 Auto": "EVA-8 自动霰弹枪", "Mastiff Shotgun": "獒犬霰弹枪", "Mozambique Shotgun": "莫桑比克霰弹枪",
    "Peacekeeper": "和平捍卫者", "RE-45 Auto": "RE-45 自动手枪", "P2020": "P2020", "Wingman": "小帮手",
}
CATEGORIES = {"ARs": "突击步枪", "SMGs": "冲锋枪", "LMGs": "轻机枪", "Marksmen": "射手武器", "Snipers": "狙击步枪", "Shotguns": "霰弹枪", "Pistols": "手枪"}
LEGEND_ALIASES = {"Seer": ["希尔", "席尔"], "Wraith": ["恶灵", "惡靈"], "Octane": ["动力小子", "動力小子"]}
ALIASES = {"vermillion": "vermilion", "hope s dusk": "hope s dusk"}
WEAPON_FAMILY = {"Hemlok Breach AR": "Hemlok Burst AR", "RE-45 Burst": "RE-45 Auto"}
# Reviewed Wiki copy/paste caption errors: identify by the observed media file.
# Keep the original caption alongside the resolved client-name/file association.
CAPTION_CORRECTIONS = {
    "Sakura_Sentry_Nemesis.png": "Sakura Sentry", "Safety_Protocol_Volt.png": "Safety Protocol",
    "Emblematic_Volt.png": "Emblematic", "Money_Maker_Mastiff.png": "Money Maker",
    "Pink_Purr_P2020.png": "Pink Purr", "Pushing_Daisies_G7_Scout.png": "Pushing Daisies",
    "Tagged_(Season_16)_RE-45.png": "Tagged (Season 16)",
}
RESUME = False
CURATED_INSPECT = {
    "Showstoppers": {"videoId": "quqQRYvHAdI", "title": "Apex Legends New Seer Heirloom All Animations", "author": "MadLad", "publishedDate": "2023-01-10", "start": 74, "end": 170},
    "Hope's Dawn": {"videoId": "ao44wqdjSlo", "title": "Wraith Heirloom Hopes Dawn All Animations - Apex Legends", "author": "MadLad", "publishedDate": "2023-03-07", "start": 32, "end": 114},
    "Butterfly Knife": {"videoId": "PbAUemaZtv4", "title": "Octane Heirloom - All Secret Animations and Inspects / Apex Legends", "author": "XanthiumGUM", "publishedDate": "2021-04-26"},
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load(path, fallback=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else fallback


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(",", ":"))
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def fetch(label, url, offline):
    path = CACHE / (label + ".txt")
    meta_path = CACHE / (label + ".source.json")
    recent = load(meta_path)
    resume_recent = RESUME and recent and recent.get("url") == url and (datetime.now(timezone.utc) - datetime.fromisoformat(recent["retrievedAt"].replace("Z", "+00:00"))).total_seconds() < 43200
    if offline or resume_recent:
        meta = load(meta_path)
        if not path.exists() or not meta or meta.get("url") != url:
            raise RuntimeError("Missing exact offline cache: " + label)
        return path.read_text(encoding="utf-8"), meta
    command = [shutil.which("curl.exe") or "curl", "--silent", "--show-error", "--fail", "--location", "--compressed",
               "--proto", "=https", "--proto-redir", "=https", "--max-time", "45", "--max-filesize", "20000000", url]
    for attempt in range(3):
        response = subprocess.run(command, capture_output=True, timeout=50)
        if response.returncode and "429" in response.stderr.decode("utf-8", errors="replace") and attempt < 2:
            time.sleep(20)
            continue
        break
    if response.returncode:
        raise RuntimeError(label + ": " + response.stderr.decode("utf-8", errors="replace").strip())
    raw = response.stdout
    text = raw.decode("utf-8")
    if len(raw) < 100 or "<title>Just a moment" in text or "<title>Access denied" in text:
        raise RuntimeError("Source returned no usable content: " + label)
    meta = {"url": url, "retrievedAt": now(), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    atomic(meta_path, meta)
    if url.startswith(WIKI):
        time.sleep(2.5)
    return text, meta


def render_quality(item, offline):
    """Reject client UI masks that the feed also exposes as skin pictures.

    Only used for feed artwork not backed by a Wiki gallery image. Persist the
    exact URL, byte hash and pixel check, so offline builds are reproducible.
    """
    from PIL import Image
    source = item["image"]
    path = CACHE / ("render-" + item["id"] + ".webp")
    meta_path = CACHE / ("render-" + item["id"] + ".source.json")
    metadata = load(meta_path)
    stale = metadata and (datetime.now(timezone.utc) - datetime.fromisoformat(metadata["retrievedAt"].replace("Z", "+00:00"))).total_seconds() > 43200
    if not path.exists() or not metadata or metadata.get("url") != source or (not offline and stale):
        if offline:
            raise RuntimeError("Missing exact render quality cache: " + item["id"])
        fd, temporary = tempfile.mkstemp(prefix="apex-render-", suffix=".webp", dir=CACHE)
        os.close(fd)
        try:
            response = subprocess.run([shutil.which("curl.exe") or "curl", "--silent", "--show-error", "--fail", "--location",
                                       "--proto", "=https", "--proto-redir", "=https", "--max-time", "30", "--max-filesize", "2000000",
                                       "--output", temporary, source], capture_output=True, timeout=35)
            if response.returncode:
                raise RuntimeError("Render source failed: " + item["id"])
            with Image.open(temporary) as image:
                image.verify()
            os.replace(temporary, path)
            raw = path.read_bytes()
            metadata = {"url": source, "retrievedAt": now(), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
            atomic(meta_path, metadata)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    if hashlib.sha256(path.read_bytes()).hexdigest() != metadata["sha256"]:
        raise RuntimeError("Render cache byte mismatch: " + item["id"])
    with Image.open(path) as image:
        converted = image.convert("RGBA")
        pixels = [pixel for pixel in converted.get_flattened_data() if pixel[3] > 100]
        chromatic = sum(max(pixel[:3]) - min(pixel[:3]) > 20 for pixel in pixels) / max(1, len(pixels))
        white = sum(min(pixel[:3]) > 225 for pixel in pixels) / max(1, len(pixels))
        silhouette = chromatic < .02 and white > .6
        quality = {"status": "client_ui_silhouette" if silhouette else "colored_resource", "width": image.width, "height": image.height,
                   "chromaticRatio": round(chromatic, 4), "whiteRatio": round(white, 4), "imageSource": metadata,
                   "note": "纯白/单色客户端UI轮廓不作为真实材质展示；有色资源仍以真实提供方标注，未声称每图逐帧游戏核对。"}
    return quality


class Node:
    def __init__(self, tag="", attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs or []), parent, []

    def all(self, tag=None, cls=None):
        result = []
        for child in self.children:
            if isinstance(child, Node):
                if (not tag or child.tag == tag) and (not cls or cls in child.attrs.get("class", "").split()):
                    result.append(child)
                result.extend(child.all(tag, cls))
        return result

    def text(self):
        return "".join(child.text() if isinstance(child, Node) else child for child in self.children).strip()


class Tree(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.current = self.root
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in self.VOID:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def key(value):
    clean = re.sub(r"[^a-z0-9]+", " ", html.unescape(value).lower()).strip()
    return ALIASES.get(clean, clean)


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def section(source, identifier):
    match = re.search(r'<h2[^>]*>.*?id="' + re.escape(identifier) + r'"[^>]*>.*?</h2>', source)
    if not match:
        return ""
    return re.split(r"<h2\b", source[match.end():], maxsplit=1)[0]


def source_revision(source):
    match = re.search(r'"wgRevisionId":(\d+)', source)
    return int(match.group(1)) if match else None


def weapon_list(source):
    body = section(source, "List_of_Weapons")
    result = []
    for piece in re.split(r"(?=<h3\b)", body):
        category = next((value for marker, value in CATEGORIES.items() if 'id="' + marker + '"' in piece), None)
        if not category:
            continue
        for card in Tree(piece).root.all("li", "gallerybox"):
            captions = card.all(cls="gallerytext")
            links = captions[0].all("a") if captions else []
            if links and links[0].attrs.get("href", "").startswith("/wiki/"):
                result.append({"name": links[0].text(), "path": links[0].attrs["href"], "category": category})
    if len(result) < 29 or len({item['path'] for item in result}) != len(result):
        raise RuntimeError("Weapon index incomplete or duplicated")
    return result


def wiki_image(node, page, retrieved, kind="render"):
    # Only the large skin artwork, never currency/event icons in its caption.
    images = [image for image in node.all("img") if int(image.attrs.get("data-file-width", "0") or 0) >= 400
              and int(image.attrs.get("width", "0") or 0) >= 100
              and re.search(r"\.(?:png|jpe?g|webp)(?:\?|$)", image.attrs.get("src", ""), re.I)]
    if not images:
        return None
    image = images[0]
    anchor = image.parent
    while anchor and anchor.tag != "a":
        anchor = anchor.parent
    src = urljoin(WIKI, image.attrs.get("src", ""))
    if not src.startswith(WIKI + "/images/"):
        return None
    # Derive original only from the observed MediaWiki thumbnail URL.
    original = re.sub(r"/images/thumb/(.*?)/[^/?]+(\?[^#]*)?$", r"/images/\1\2", src)
    return {"url": original, "thumbnailUrl": src,
            "sourcePageUrl": urljoin(WIKI, anchor.attrs["href"]) if anchor and anchor.attrs.get("href", "").startswith("/wiki/File:") else page,
            "assetSourceUrl": original, "sourceType": "game_asset", "provider": "Apex Legends Wiki",
            "kind": kind, "caption": "游戏资源图，由社区 Wiki 提供；未作为官方素材站标注。" if kind == "render" else "游戏内传家宝套装图，由社区 Wiki 提供，包含同套装其他奖励。",
            "width": int(image.attrs["data-file-width"]), "height": int(image.attrs["data-file-height"]), "retrievedAt": retrieved}


def gallery(source, weapon, metadata):
    body = section(source, "Skins")
    if not body:
        # Some new weapon variants redirect/reuse another weapon's customization.
        return [], {"weapon": weapon["name"], "sourceUrl": metadata["url"], "revision": source_revision(source), "declared": 0, "parsed": 0, "reason": "no_skin_section"}
    cards = Tree(body).root.all("li", "gallerybox")
    skins = []
    for card in cards:
        captions = card.all(cls="gallerytext")
        if not captions:
            continue
        caption = captions[0]
        named = [span for span in caption.all("span") if re.search(r"--theme-(mythic|legendary|epic|rare|common)-color", span.attrs.get("style", ""))]
        if not named:
            continue
        named_span = named[0]
        name = named_span.text()
        rarity = re.search(r"--theme-(\w+)-color", named_span.attrs["style"])[1]
        image = wiki_image(card, metadata["url"], metadata["retrievedAt"])
        files = [unquote(link.attrs.get("href", "").split("/wiki/File:", 1)[-1]) for link in card.all("a") if link.attrs.get("href", "").startswith("/wiki/File:")]
        if not files:
            files = [unquote(link.attrs.get("href", "").split("wpDestFile=", 1)[-1].split("&", 1)[0]) for link in card.all("a") if "wpDestFile=" in link.attrs.get("href", "")]
        file_name = files[0] if files else None
        original_caption = name
        if file_name in CAPTION_CORRECTIONS:
            name = CAPTION_CORRECTIONS[file_name]
        skins.append({"name": name, "rarity": rarity, "image": image, "weapon": weapon,
                      "sourceUrl": metadata["url"] + "#Skins", "revision": source_revision(source), "fileName": file_name,
                      "originalCaption": original_caption if original_caption != name else None})
    declared_match = re.search(r"total of\s*<b>([\d,]+)</b>\s*skins", body)
    declared = int(declared_match[1].replace(",", "")) if declared_match else len(cards)
    if len(skins) != len(cards):
        raise RuntimeError(f"{weapon['name']}: parsed {len(skins)} != actual gallery cards {len(cards)}")
    return skins, {"weapon": weapon["name"], "sourceUrl": metadata["url"], "revision": source_revision(source),
                   "declared": declared, "parsed": len(skins), "declaredDelta": len(skins) - declared,
                   "denominatorStatus": "matched" if len(skins) == declared else "source_count_disagrees_with_gallery",
                   "withWikiImage": sum(bool(skin["image"]) for skin in skins),
                   "defaultCount": sum(key(skin["name"]) == "factory issue" for skin in skins)}


def base_record(identifier, name, weapon, rarity, source_id, source_url, timestamp, previous):
    owner = weapon["name"]
    weapon_name = WEAPON_ZH.get(owner, owner)
    rarity = rarity.lower()
    return {"id": identifier, "game": "apex", "name": weapon_name + " · " + name,
            "englishName": owner + " — " + name, "weaponId": "apex-" + slug(owner), "weaponName": weapon_name,
            "weaponEnglishName": owner, "weaponType": "gun", "category": weapon["category"],
            "rarity": {"id": rarity, "name": rarity.title(), "color": COLORS.get(rarity, "#7c858d")},
            "description": "武器外观目录记录；保留资源名称和图片出处。未核实首发日期，未关联逐皮肤独立检视录像。",
            "sourceId": source_id, "sourceUrl": source_url, "sourceName": "Apex Legends Wiki / apex.source.gs",
            "region": "国际服", "gameTitle": "Apex Legends", "firstSeenAt": previous.get(identifier, {}).get("firstSeenAt", timestamp),
            "releaseDate": None, "releaseDateStatus": "unverified", "timingNote": "采集时间及资源构建时间不等于皮肤首发日或当前可获取状态。",
            "publicationStatus": "pending", "chromas": [], "levels": [], "media": [], "tags": [owner, weapon_name, rarity.title()]}


def heirloom_owners(source):
    result = {}
    body = section(source, "Heirloom_Sets")
    for part in re.split(r"(?=<h3\b)", body):
        heading = re.search(r"<h3\b.*?</h3>", part)
        if not heading:
            continue
        owner = re.sub(r"'s Sets?$", "", Tree(heading[0]).root.text())
        for name in re.findall(r"A Melee Weapon Skin:\s*<span[^>]*>(.*?)</span>", part, re.I):
            result[key(Tree(name).root.text())] = owner
    return result


def heirloom_images(source, metadata):
    result = {}
    for identifier, kind in [("Heirloom_Sets", "set"), ("Universal_Heirlooms", "render")]:
        for part in re.split(r"(?=<h[34]\b)", section(source, identifier)):
            names = re.findall(r"A Melee Weapon Skin:\s*<span[^>]*>(.*?)</span>", part, re.I)
            if not names:
                continue
            image = wiki_image(Tree(part).root, metadata["url"], metadata["retrievedAt"], kind)
            if image:
                for name in names:
                    result[key(Tree(name).root.text())] = image
    return result


def inspect_media(item_name):
    curated = CURATED_INSPECT.get(item_name)
    if not curated:
        return None
    url = "https://www.youtube.com/watch?v=" + curated["videoId"]
    record = {"id": "youtube-" + curated["videoId"], "kind": "showcase", "provider": "youtube", "url": url,
              "videoId": curated["videoId"], "title": curated["title"], "sourcePageUrl": url,
              "sourceName": curated["author"], "sourceType": "community", "contains": ["inspect"],
              "reviewStatus": "source_confirmed", "reviewedAt": "2026-11-02", "publishedDate": curated["publishedDate"],
              "reviewNote": "已核对原作者标题及视频说明中的检视说明；未逐帧复核，原稿年代的动作版本不代表最新客户端。"}
    if "start" in curated:
        record["segments"] = [{"kind": "inspect", "startSeconds": curated["start"], "endSeconds": curated["end"], "basis": "author_chapters"}]
        record["reviewNote"] += " 检视时间段依据原作者章节。"
    return record


def run(offline):
    previous_doc = load(OUT, {"skins": []})
    previous = {skin["id"]: skin for skin in previous_doc["skins"]}
    timestamp = now()
    requests = []
    index, index_meta = fetch("wiki-weapons", WIKI + "/wiki/Weapon", offline)
    feed_raw, feed_meta = fetch("source-gs-items", FEED, offline)
    heirloom_raw, heirloom_meta = fetch("wiki-heirlooms", WIKI + "/wiki/Heirloom", offline)
    requests.extend([index_meta, feed_meta, heirloom_meta])
    feed = json.loads(feed_raw)
    if not isinstance(feed.get("items"), list) or len(feed["items"]) != feed["count"] or feed["count"] < 10000:
        raise RuntimeError("Incomplete source.gs feed")
    weapons = weapon_list(index)
    entries, per_weapon = [], []

    def get_weapon(weapon):
        raw, meta = fetch("wiki-weapon-" + slug(weapon["name"]), urljoin(WIKI, weapon["path"]), offline)
        parsed, coverage = gallery(raw, weapon, meta)
        return parsed, coverage, meta

    with ThreadPoolExecutor(max_workers=1) as pool:
        for parsed, coverage, meta in pool.map(get_weapon, weapons):
            entries.extend(parsed)
            per_weapon.append(coverage)
            requests.append(meta)
    if len(entries) < 2500:
        raise RuntimeError("Gallery enumeration is unexpectedly small")
    wiki_by_key = {}
    shared_variant_cards = 0
    for item in entries:
        original_weapon = item["weapon"]["name"]
        canonical = WEAPON_FAMILY.get(original_weapon, original_weapon)
        item["weapon"] = dict(item["weapon"], name=canonical)
        item["wikiWeaponName"] = original_weapon
        identity = (key(canonical), key(item["name"]))
        if identity in wiki_by_key:
            prior = wiki_by_key[identity]
            if prior.get("fileName") != item.get("fileName"):
                raise RuntimeError("Ambiguous Wiki weapon/skin image: " + str(identity))
            prior.setdefault("sharedVariantSourceUrls", []).append(item["sourceUrl"])
            if not prior.get("image") and item.get("image"):
                prior["image"] = item["image"]
            shared_variant_cards += 1
            continue
        wiki_by_key[identity] = item
    weapons_by_name = {key(weapon["name"]): weapon for weapon in weapons}
    source_guns = [item for item in feed["items"] if item["type"] == "weapon-skins" and item.get("owner")]
    source_melee = [item for item in feed["items"] if item["type"] == "heirlooms"]
    melee_by_id = {item["id"]: item for item in source_melee}
    source_names = Counter((key(item["owner"]), key(item["name"])) for item in source_guns)
    matched, raw_defaults = set(), 0
    records = []
    source_stats = defaultdict(Counter)
    for item in source_guns:
        if key(item["name"]) == "factory issue":
            raw_defaults += 1
            continue
        owner_key = key(item["owner"])
        weapon = weapons_by_name.get(owner_key)
        if not weapon:
            raise RuntimeError("Unknown source weapon owner: " + item["owner"])
        identity = (owner_key, key(item["name"]))
        wiki = wiki_by_key.get(identity) if source_names[identity] == 1 else None
        if wiki:
            matched.add(identity)
        identifier = "apex-src-" + item["id"].replace("_", "-")
        if item["owner"] == "Triple Take" and item["name"] == "Absolute Zero":
            identifier = "apex-triple-take-absolute-zero"
        record = base_record(identifier, item["name"], weapon, item["rarity"], item["id"], item["url"], timestamp, previous)
        source_stats[item["owner"]]["sourceNonDefault"] += 1
        if wiki:
            record["wikiUrl"] = wiki["sourceUrl"]
            record["wikiRevision"] = wiki["revision"]
            source_stats[item["owner"]]["wikiNameMatches"] += 1
            if wiki.get("originalCaption"):
                record["sourceCaptionCorrection"] = {"original": wiki["originalCaption"], "resolved": wiki["name"], "basis": wiki["fileName"]}
        if wiki and wiki["image"]:
            record["image"] = wiki["image"]
            record["sourceUrl"] = wiki["sourceUrl"]
            source_stats[item["owner"]]["wikiImages"] += 1
        elif item.get("image"):
            quality = render_quality(item, offline)
            record["sourceRenderQuality"] = quality
            if quality["status"] == "colored_resource":
                record["image"] = {"url": item["image"], "sourcePageUrl": item["url"], "assetSourceUrl": item["image"],
                                   "sourceType": "game_asset", "provider": "apex.source.gs", "kind": "render",
                                   "caption": "游戏外观资源图，由社区数据库提供；保留原始出处。", "retrievedAt": quality["imageSource"]["retrievedAt"],
                                   "width": quality["width"], "height": quality["height"]}
                source_stats[item["owner"]]["sourceRenderImages"] += 1
            else:
                record["unverifiedRenderCandidateUrl"] = item["image"]
                source_stats[item["owner"]]["rejectedSilhouetteImages"] += 1
        record["publicationStatus"] = "ready" if record.get("image") else "pending"
        if not record.get("image"):
            record["pendingReason"] = "两条来源均无可用逐条外观图片，纯白客户端轮廓不作为材质展示"
        records.append(record)
    wiki_only = []
    for identity, item in wiki_by_key.items():
        if identity in matched or key(item["name"]) == "factory issue":
            continue
        identifier = "apex-wiki-" + slug(item["weapon"]["name"]) + "-" + slug(item["name"])
        record = base_record(identifier, item["name"], item["weapon"], item["rarity"], "wiki:" + item["weapon"]["name"] + ":" + item["name"], item["sourceUrl"], timestamp, previous)
        record["wikiRevision"] = item["revision"]
        if item.get("originalCaption"):
            record["sourceCaptionCorrection"] = {"original": item["originalCaption"], "resolved": item["name"], "basis": item["fileName"]}
        record["catalogueNote"] = "Wiki 图库条目，本次较旧的游戏资源索引未按武器与名称匹配。"
        if item["image"]:
            record["image"] = item["image"]
            record["publicationStatus"] = "ready"
        else:
            record["pendingReason"] = "Wiki 未提供外观图片"
        wiki_only.append({"weapon": item["weapon"]["name"], "name": item["name"], "withImage": bool(item["image"])})
        records.append(record)
    # The extracted feed has client model IDs for every melee item; use these
    # renders instead of generic collection posters. Existing reviewed media stay.
    wiki_owners = heirloom_owners(heirloom_raw)
    wiki_melee_images = heirloom_images(heirloom_raw, heirloom_meta)
    melee_default_excluded = 0
    for item in source_melee:
        if item["id"] == "melee_skin_default":
            melee_default_excluded += 1
            continue
        identifier = "apex-src-" + item["id"].replace("_", "-")
        if item["name"] == "Showstoppers":
            identifier = "apex-seer-showstoppers"
        elif item["name"] == "Cobalt Katar":
            identifier = "apex-cobalt-katar"
        owner = wiki_owners.get(key(item["name"])) or item.get("owner")
        universal = item["id"].startswith("melee_skin_agnostic_") or item["id"] == "melee_skin_artifact_sword"
        category = "传家宝" if owner else "通用近战" if universal else "近战外观（归属待核）"
        family_id = re.sub(r"_(?:rt|rc)\d+$", "", item["id"])
        family_name = melee_by_id.get(family_id, item)["name"]
        weapon_name = owner + " 传家宝" if owner else family_name + " 系列"
        record = base_record(identifier, item["name"], {"name": weapon_name, "category": category}, item["rarity"], item["id"], item["url"], timestamp, previous)
        record.update(weaponType="melee", weaponId="apex-melee-" + slug(owner or family_id), name=(owner + " · " if owner else "") + item["name"],
                      englishName=(owner + " — " if owner else "") + item["name"], sourceName="apex.source.gs · 游戏客户端资源索引")
        if owner:
            record["legend"] = owner
            record["searchAliases"] = LEGEND_ALIASES.get(owner, [])
            record["legendEvidenceUrl"] = WIKI + "/wiki/Heirloom#Heirloom_Sets"
        record["description"] = "神话近战外观。保留客户端资源标识及可核对的 Wiki 配图；套装图包含其他奖励，不等于单件渲染。不同外观变体分别记录，未枚举所有自定义组件组合。"
        if key(item["name"]) in wiki_melee_images:
            record["image"] = wiki_melee_images[key(item["name"])]
            record["sourceUrl"] = WIKI + "/wiki/Heirloom"
            record["publicationStatus"] = "ready"
        else:
            record["pendingReason"] = "尚无核实的彩色近战外观图；社区资源轮廓/模型占位图不作为完整皮肤效果展示"
            if item.get("image"):
                record["unverifiedRenderCandidateUrl"] = item["image"]
        if identifier in previous:
            record["media"] = previous[identifier].get("media", [])
        curated = inspect_media(item["name"])
        if curated and curated["id"] not in {media["id"] for media in record["media"]}:
            record["media"].append(curated)
        records.append(record)
    if "apex-cobalt-katar" in previous and "apex-cobalt-katar" not in {record["id"] for record in records}:
        curated = dict(previous["apex-cobalt-katar"])
        curated["catalogueNote"] = "官方已确认的精选补充；当前客户端资源 feed 未以相同对象列出，保留系列总览配图并明确标注。"
        records.append(curated)
    # Stable historical entries stay available without using a disappeared source
    # as proof of current availability; no full-dataset overwrite on partial fetch.
    present = {record["id"] for record in records}
    historical = previous_doc.get("retainedHistorical", []) + [dict(record, sourcePresent=False) for identifier, record in previous.items() if identifier not in present]
    ready = [record for record in records if record["publicationStatus"] == "ready"]
    for coverage in per_weapon:
        canonical = WEAPON_FAMILY.get(coverage["weapon"], coverage["weapon"])
        coverage.update(source_stats[canonical])
        coverage["canonicalWeapon"] = canonical
        weapon_ready = [record for record in ready if record["weaponEnglishName"] == canonical and record["weaponType"] == "gun"]
        weapon_all = [record for record in records if record["weaponEnglishName"] == canonical and record["weaponType"] == "gun"]
        coverage.update(cataloguedNonDefault=len(weapon_all), readyWithImage=len(weapon_ready), missingImage=len(weapon_all) - len(weapon_ready))
        coverage["countUnit"] = "canonical_weapon_family_after_shared_variant_gallery_dedup"
    coverage = {"status": "partial", "complete": False, "catalogScope": "wiki_galleries_reconciled_with_dated_client_extraction",
                "scope": "逐项扫描 Wiki 武器列表的枪皮图库，并对账 2026-10-07 客户端资源索引及近战变体；缺图条目不进入公开页面。不是全历史、全地区、全部自定义组合或全动作资源的完整声明。",
                "sourceBuild": feed.get("build"), "sourceExtractedAt": feed.get("extracted"),
                "sourceRecordCount": len(source_guns) + len(source_melee), "sourceNonDefaultGunCount": len(source_guns) - raw_defaults,
                "sourceMeleeCount": len(source_melee), "sourceMeleeNonDefaultCount": len(source_melee) - melee_default_excluded,
                "sourceMeleeDefaultExcluded": melee_default_excluded, "sourceDefaultExcluded": raw_defaults,
                "sourceOutOfScopeCount": sum(item["type"] == "weapon-skins" and not item.get("owner") for item in feed["items"]),
                "sourceOutOfScopeNote": "无基础枪械owner的投掷物/能力资源，不混为枪皮；其他角色、挂件、动作等类型也不在本目录。",
                "wikiWeaponCount": len(weapons), "weaponFamilyCount": len({WEAPON_FAMILY.get(weapon["name"], weapon["name"]) for weapon in weapons}),
                "wikiSkinCountIncludingDefaults": len(entries), "sharedWeaponVariantCardsDeduplicated": shared_variant_cards,
                "weaponVariantNote": "Hemlok Breach/Burst 与 RE-45 Burst/Auto 的同名同文件图库按武器家族去重，保留31页的逐页对账。",
                "wikiUniqueSkinCountIncludingDefaults": len(wiki_by_key), "wikiOnlyCount": len(wiki_only),
                "cataloguedCount": len(records), "entryCount": len(ready), "pendingImageCount": len(records) - len(ready),
                "gunCount": sum(record["weaponType"] == "gun" for record in ready), "meleeCount": sum(record["weaponType"] == "melee" for record in ready),
                "withVideoCount": sum(bool(record["media"]) for record in ready), "videoCount": sum(len(record["media"]) for record in ready),
                "wikiImageCount": sum(record["image"]["provider"] == "Apex Legends Wiki" for record in ready),
                "coloredSourceImageCount": sum(record["image"]["provider"] == "apex.source.gs" for record in ready),
                "rejectedGunSilhouetteImages": sum(record.get("sourceRenderQuality", {}).get("status") == "client_ui_silhouette" for record in records),
                "imageScope": "公开记录必须有真实彩图或明确标注范围的套装/系列图；已检测的纯白客户端UI轮廓不作为皮肤材质展示。",
                "mediaScope": "来源索引和 Wiki 图库不提供全皮肤动作包；仅保留经身份核对的原作者视频，当前不代表全量检视覆盖。",
                "perWeapon": per_weapon, "remaining": ["未渲染或 Wiki 缺失的逐皮肤外观图", "全部近战自定义组合与最新资源差异", "独立检视、换弹与击杀特效视频及时间段", "准确首发日期与地区差异"]}
    output = {"schemaVersion": 1, "game": "apex", "updatedAt": max(meta["retrievedAt"] for meta in requests),
              "source": {"name": "Apex Legends Wiki + apex.source.gs", "url": WIKI + "/wiki/Weapon", "type": "community_catalogue",
                         "retrievedAt": max(meta["retrievedAt"] for meta in requests), "requests": requests,
                         "feedUrl": FEED, "feedBuild": feed.get("build"), "feedExtractedAt": feed.get("extracted"),
                         "rightsNote": "游戏资源权利归 EA/Respawn；apex.source.gs 明确允许该 feed 引用并要求回链。Wiki 图片保留逐条原始出处。"},
              "coverage": coverage, "skins": sorted(records, key=lambda record: (record["weaponType"], record["weaponEnglishName"], record["englishName"], record["id"])),
              "retainedHistorical": {item["id"]: item for item in historical}.values()}
    output["retainedHistorical"] = list(output["retainedHistorical"])
    ids = [record["id"] for record in records]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Duplicate normalized skin ID")
    atomic(REPORT, {"generatedAt": timestamp, "offline": offline, "coverage": coverage, "wikiOnly": wiki_only,
                    "missingImages": [{"id": record["id"], "name": record["englishName"], "sourceUrl": record["sourceUrl"]} for record in records if record["publicationStatus"] != "ready"]})
    atomic(OUT, output)
    print(json.dumps({"game": "apex", "ready": len(ready), "guns": coverage["gunCount"], "melee": coverage["meleeCount"],
                      "pendingImages": coverage["pendingImageCount"], "wikiWeapons": len(weapons), "withVideo": coverage["withVideoCount"], "offline": offline}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Rebuild exact cached sources without changing their retrieval times")
    parser.add_argument("--resume", action="store_true", help="Reuse successful exact source caches from the past 12 hours after an interrupted batch")
    args = parser.parse_args()
    RESUME = args.resume
    try:
        run(args.offline)
    except Exception as error:
        print("Apex sync failed; previous public snapshot preserved: " + str(error))
        raise SystemExit(1)
