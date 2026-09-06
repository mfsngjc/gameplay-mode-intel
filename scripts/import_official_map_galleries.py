#!/usr/bin/env python3
"""Import official Battlefield 6 and VALORANT map gallery images.

The two official galleries expose promotional map visuals and descriptions rather
than a reusable interactive map runtime. Images are copied locally and resized
for the map archive; the original official page remains the source link.
"""
from pathlib import Path
import json
import io
import urllib.request

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/maps/official-galleries"
DATA = ROOT / "data/maps.json"
OUT.mkdir(parents=True, exist_ok=True)
PROXIES = urllib.request.getproxies()

BF_SOURCE = "https://www.ea.com/games/battlefield/battlefield-6/features/maps"
BF6 = [
    ("bf6-wake-island", "威克岛（Wake Island）", "Wake Island", "https://drop-assets.ea.com/images/5FQXj9qpCTm2Stxcpcuqy8/be0400da05ceefda6ad5b514112fb99c/BF6_S4B1_Vista_Screenshot_WakeIsland_05_1920x1080_NoLogo.png?im=AspectCrop=(16,9),xPosition=0.5,yPosition=0.5;Resize=(1920)&q=85"),
    ("bf6-tsuru-reef", "鹤礁（Tsuru Reef）", "Tsuru Reef", "https://drop-assets.ea.com/images/26VncxDHwqpREUrND2naMz/bace16d577ad46a9197529650add70d9/BF6_S4B1_Vista_Screenshot_TsuruReef_01_1920x1080_NoLogo.png?im=AspectCrop=(16,9),xPosition=0.5,yPosition=0.5;Resize=(1920)&q=85"),
    ("bf6-cairo-bazaar", "开罗集市（Cairo Bazaar）", "Cairo Bazaar", "https://drop-assets.ea.com/images/4o05OKCBc0vFEiRYCLCYK8/d32f4ebdcd30734e7c18dff889675750/BF6_S3B2_Vista_Screenshot_CairoBazaar_05_1920x1080_NoLogo.jpg?im=AspectCrop=(16,9),xPosition=0.5114583333333333,yPosition=0.40370370370370373"),
    ("bf6-railway-to-golmud", "戈尔穆德铁路（Railway to Golmud）", "Railway to Golmud", "https://drop-assets.ea.com/images/59OIVp8IYUELZkcsZSYSVI/ea1344930039434a8b01ccf34e410a25/BF6_S3B1_Vista_Screenshot_RailwayToGolmud_04_1920x1080_NoLogo.jpg?im=AspectCrop=(16,9),xPosition=0.5744791666666667,yPosition=0.37407407407407406"),
    ("bf6-contaminated", "污染区（Contaminated）", "Contaminated", "https://drop-assets.ea.com/images/sh0zn9ZdgpM77e4SmEXyQ/7077c8095ab9df01c308592c23bf4008/BF6_S2B1_Vista_Screenshot_Contaminated_03_1920x1080_NoLogo.jpg?im=AspectCrop=(16,9),xPosition=0.5770833333333333,yPosition=0.45185185185185184"),
    ("bf6-blackwell-fields", "布莱克威尔农场（Blackwell Fields）", "Blackwell Fields", "https://drop-assets.ea.com/images/n5zC7AzHHaepNQmyzI2g3/aa3af97848a332aea87f5209bc3e4446/BF6-Map-BlackwellFields-16x9.png?im=AspectCrop=(16,9),xPosition=0.5802083333333333,yPosition=0.475"),
    ("bf6-eastwood", "伊斯特伍德（Eastwood）", "Eastwood", "https://drop-assets.ea.com/images/6MNrWqyla26wRXRwkxyqeZ/75fec117d2c0c00578b4fabaf6957978/BF6-Map-Eastwood-16x9.png?im=AspectCrop=(16,9),xPosition=0.3770833333333333,yPosition=0.46944444444444444"),
    ("bf6-siege-of-cairo", "开罗围城战（Siege of Cairo）", "Siege of Cairo", "https://drop-assets.ea.com/images/2gaOIu6z6JIJnh46jI3tGR/62da76819b468987bd6c7df80706b972/battlefield-6-map-siege-of-cairo-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.4942708333333333,yPosition=0.47962962962962963"),
    ("bf6-iberian-offensive", "伊比利亚攻势（Iberian Offensive）", "Iberian Offensive", "https://drop-assets.ea.com/images/3oAmRCdrSQ654uFt5j62Qf/17eca08599af69206cd55f5f8c8c0d74/battlefield-6-map-iberian-offensive-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.44583333333333336,yPosition=0.5458333333333333"),
    ("bf6-liberation-peak", "解放峰（Liberation Peak）", "Liberation Peak", "https://drop-assets.ea.com/images/7pDTq8d8QnXMkDqiZe65x7/3caa1df2efb8a04656d8850d0f3ca475/battlefield-6-map-liberation-peak-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.5598958333333334,yPosition=0.5050925925925925"),
    ("bf6-empire-state", "帝国州（Empire State）", "Empire State", "https://drop-assets.ea.com/images/5f0CfcOL9vgGpwKxGUR6hY/d041670499c2a2ca89777d50f4e43a66/battlefield-6-map-operation-empire-state-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.5315104166666667,yPosition=0.44907407407407407"),
    ("bf6-operation-firestorm", "烈焰风暴行动（Operation Firestorm）", "Operation Firestorm", "https://drop-assets.ea.com/images/3V3lXmPhgDags1WIUT6FeA/b308db42a568ae17d353b4b7b59301e9/battlefield-6-map-operation-firestorm-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.45416666666666666,yPosition=0.4287037037037037"),
    ("bf6-saints-quarter", "圣徒街区（Saints Quarter）", "Saints Quarter", "https://drop-assets.ea.com/images/6BnXoxhQVxVyPBb85vpvNY/6f784156ab5d9860fed48ad9c2d12950/battlefield-6-map-saints-quarter-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.5,yPosition=0.5"),
    ("bf6-new-sobek-city", "新索贝克城（New Sobek City）", "New Sobek City", "https://drop-assets.ea.com/images/3AnIaIVTpSwMAQFFtG8f8Q/07918caeb194a73bd1d2eb3be8a9ade9/battlefield-6-map-new-sobek-city-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.5114583333333333,yPosition=0.6013888888888889"),
    ("bf6-mirak-valley", "米拉克谷（Mirak Valley）", "Mirak Valley", "https://drop-assets.ea.com/images/Jh0ZF2620FOI9ZG98PozU/ff6f53f549f1570a1251d998ab39ffb5/battlefield-6-map-mirak-valley-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.5684895833333333,yPosition=0.4898148148148148"),
    ("bf6-manhattan-bridge", "曼哈顿大桥（Manhattan Bridge）", "Manhattan Bridge", "https://drop-assets.ea.com/images/2gurRDG7kLT99I1fK9ilS0/825a55bc0b2c82de6466c0c10801d702/battlefield-6-map-manhattan-bridge-16x9.jpg?im=AspectCrop=(16,9),xPosition=0.44869791666666664,yPosition=0.40879629629629627"),
]

VAL_SOURCE = "https://playvalorant.com/en-us/maps/"
VALORANT = [
    ("valorant-summit", "峰顶（Summit）", "Summit", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/97986033c47822dad7ac5b1af24fa183b8b04983-915x515.jpg?accountingTag=VAL"),
    ("valorant-corrode", "腐蚀（Corrode）", "Corrode", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/6e3e66577519c8290d874aa94d82e28aec2ccc3e-915x515.jpg?accountingTag=VAL"),
    ("valorant-abyss", "深渊（Abyss）", "Abyss", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/53698d442a14b5a6be643d53eb970ac16442cb38-930x522.png?accountingTag=VAL"),
    ("valorant-sunset", "日落之城（Sunset）", "Sunset", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/5101e4ee241fbfca261bf8150230236c46c8b991-3840x2160.png?accountingTag=VAL"),
    ("valorant-lotus", "莲华古城（Lotus）", "Lotus", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/67d199e0f7108bc60e8293d3f9a37538b0b55b11-3840x2160.png?accountingTag=VAL"),
    ("valorant-pearl", "深海明珠（Pearl）", "Pearl", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/7ba5df090f5efee7988d8d33f4b43c3441cb1aab-3840x2160.png?accountingTag=VAL"),
    ("valorant-fracture", "裂变峡谷（Fracture）", "Fracture", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/983a6d66978aabd3ccd4e51517298d9a0b5467d9-3840x2160.png?accountingTag=VAL"),
    ("valorant-breeze", "微风岛屿（Breeze）", "Breeze", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news_live/430fb50965f1d99cdaef3588df13d98dbea340cf-930x522.png?accountingTag=VAL"),
    ("valorant-icebox", "霜城（Icebox）", "Icebox", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/72853f583a0f6b25aed54870531756483a7b61de-3840x2160.png?accountingTag=VAL"),
    ("valorant-ascent", "亚海悬城（Ascent）", "Ascent", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/5cb7e65c04a489eccd725ce693fdc11e99982e10-3840x2160.png?accountingTag=VAL"),
    ("valorant-split", "霓虹町（Split）", "Split", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/878d51688c0f9dd0de827162e80c40811668e0c6-3840x2160.png?accountingTag=VAL"),
    ("valorant-haven", "隐世修所（Haven）", "Haven", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/bccc7b5f8647a4f654d4bb359247bce6e82c77ab-3840x2160.png?accountingTag=VAL"),
    ("valorant-bind", "炼狱小镇（Bind）", "Bind", "https://cmsassets.rgpub.io/sanity/images/dsfx7636/news/7df1e6ee284810ef0cbf8db369c214a8cbf6578c-3840x2160.png?accountingTag=VAL"),
]

def download(url):
    session = requests.Session()
    session.proxies.update(PROXIES)
    response = session.get(url, timeout=(8, 30))
    response.raise_for_status()
    return response.content

def main():
    existing = json.loads(DATA.read_text())
    existing = [entry for entry in existing if entry.get("gameKey") not in {"battlefield6", "valorant"}]
    imported = []
    for game_key, game, source, records, variant in [
        ("battlefield6", "战地风云 6", BF_SOURCE, BF6, "大战场 · 官方地图视觉"),
        ("valorant", "无畏契约", VAL_SOURCE, VALORANT, "爆破模式 · 官方地图视觉"),
    ]:
        for ident, name, original, url in records:
            raw = download(url)
            with Image.open(io.BytesIO(raw)) as image:
                image = image.convert("RGB")
                width = 1200
                height = round(width * image.height / image.width)
                image = image.resize((width, height), Image.Resampling.LANCZOS)
                filename = f"{ident}.jpg"
                image.save(OUT / filename, quality=88, optimize=True)
                thumb = image.copy()
                thumb.thumbnail((512, 512), Image.Resampling.LANCZOS)
                thumb.save(OUT / f"{ident}-thumb.jpg", quality=84, optimize=True)
            imported.append({
                "game": game,
                "gameKey": game_key,
                "id": ident,
                "name": name,
                "category": game_key,
                "variant": variant,
                "sourceUrl": source,
                "imageUrl": f"assets/maps/official-galleries/{ident}.jpg",
                "thumbnailUrl": f"assets/maps/official-galleries/{ident}-thumb.jpg",
                "width": width,
                "height": height,
                "imageSource": "官方地图页视觉图",
                "originalName": original,
                "checkedAt": "2026-09-06",
            })
    DATA.write_text(json.dumps(existing + imported, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {len(imported)} official gallery maps")

if __name__ == "__main__":
    main()
