#!/usr/bin/env python3
"""Archive the verified official 2D base maps. Requires Pillow; never modifies POIs.

The official tool serves 256px JPEG tiles. Join zoom-3 tiles into a 2048px
overview without changing orientation, labels or game geometry. Higher zoom,
floors, difficulty variants and live POIs remain in the linked official tool.
"""
import concurrent.futures
import io
import json
from pathlib import Path
import time
import urllib.request
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MAPS = json.loads((ROOT / 'data/maps.json').read_text())


def tile(job):
    url, x, y = job
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                data = response.read()
            image = Image.open(io.BytesIO(data)).convert('RGB')
            if image.size != (256, 256):
                raise ValueError(f'Unexpected tile size: {url}: {image.size}')
            return image, x, y
        except Exception:
            if attempt == 3:
                raise
            time.sleep(attempt + 1)


def main():
    for entry in MAPS:
        destination = ROOT / entry['imageUrl']
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists():
            jobs = [(entry['tileBaseUrl'] + f'3_{x}_{y}.jpg', x, y)
                    for y in range(8) for x in range(8)]
            canvas = Image.new('RGB', (2048, 2048))
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                for image, x, y in pool.map(tile, jobs):
                    canvas.paste(image, (x * 256, y * 256))
            canvas.save(destination, quality=95, subsampling=0)
        with Image.open(destination) as image:
            image.thumbnail((512, 512))
            image.save(ROOT / entry['thumbnailUrl'], quality=88)
        print(entry['name'], 'archived', flush=True)
    notice = ('三角洲行动官方地图底图 / 核查日期：2026-09-06\n'
              '来源：https://df.qq.com/cp/a20240729directory/\n'
              '地图图像版权归腾讯所有。此合集为公开二维底图的归档，不是游戏引擎工程或 3D 关卡文件。\n'
              '含 6 张烽火地带地表底图、14 张全面战场 PC 攻防底图；不含楼层、物资点、难度或活动变体。\n'
              '黑鹰坠落暂未找到公开底图。底图不代表当前所有平台与赛季的实时版本，详见官方工具。\n')
    with zipfile.ZipFile(ROOT / 'assets/maps/delta-force-maps.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('地图来源与范围.txt', notice)
        archive.writestr('maps.json', json.dumps(MAPS, ensure_ascii=False, indent=2))
        for entry in MAPS:
            archive.write(ROOT / entry['imageUrl'], entry['name'] + '.jpg')


if __name__ == '__main__':
    main()
