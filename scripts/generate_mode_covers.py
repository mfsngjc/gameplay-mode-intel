#!/usr/bin/env python3
"""Generate readable local covers for mode records without a verified image URL.

Official images remain preferred. This fallback gives historical cards a stable,
local editorial cover instead of a broken remote URL or an empty card surface.
"""
from __future__ import annotations

import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data/modes.json"
COVERS = ROOT / "assets/modes/generated"

PALETTES = {
    "Fortnite": ("#6f5b9f", "#c8b8f4"),
    "PUBG": ("#76613b", "#e5c982"),
    "PUBG Mobile": ("#315c87", "#9bc7f0"),
    "Free Fire": ("#9e402d", "#ffad70"),
    "和平精英": ("#315c70", "#9ad4df"),
    "Apex Legends": ("#8f403b", "#ffb19c"),
    "三角洲行动": ("#3f644d", "#a8d1a7"),
}


def title_lines(name: str) -> tuple[str, str]:
    name = name.replace("\n", " ").strip()
    if "（" in name:
        first, rest = name.split("（", 1)
        second = "（" + rest
        return first[:22], second[:28]
    if len(name) <= 16:
        return name, ""
    middle = len(name) // 2
    return name[:middle], name[middle:middle + 22]


def cover_svg(mode: dict) -> str:
    game = str(mode.get("game", "射击游戏"))
    name = str(mode.get("modeName", "玩法模式"))
    year = str(mode.get("year") or mode.get("launchDate") or "待确认")
    primary, secondary = PALETTES.get(game, ("#475569", "#b6c7d9"))
    line1, line2 = title_lines(name)
    gameplay = " / ".join(mode.get("gameplayTypes") or ["casual"]).upper()
    esc = lambda value: html.escape(str(value), quote=True)
    second = f'<text x="84" y="350" class="subtitle">{esc(line2)}</text>' if line2 else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
  <title id="title">{esc(name)} · {esc(game)}</title>
  <desc id="desc">本地整理封面，依据官方模式资料制作。</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{primary}"/><stop offset="1" stop-color="{secondary}"/></linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><path d="M0 0H48V48" fill="none" stroke="#ffffff" stroke-opacity=".12" stroke-width="1"/></pattern>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect width="1200" height="675" fill="url(#grid)"/>
  <circle cx="1050" cy="110" r="210" fill="#fff" fill-opacity=".08"/><circle cx="1130" cy="580" r="300" fill="#000" fill-opacity=".12"/>
  <path d="M0 540L360 390 620 475 1200 250V675H0Z" fill="#000" fill-opacity=".16"/>
  <text x="84" y="88" class="meta" fill="#fff">GAMEPLAY ARCHIVE  /  {esc(game)}  /  {esc(year)}</text>
  <rect x="84" y="122" width="116" height="5" rx="2.5" fill="#fff" fill-opacity=".75"/>
  <text x="84" y="290" class="title">{esc(line1)}</text>
  {second}
  <text x="84" y="552" class="label">{esc(gameplay)}  ·  本地整理封面</text>
  <text x="84" y="592" class="note">依据官方模式资料制作 / 官方原图待确认</text>
  <style>
    text {{ font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; }}
    .meta {{ font-size: 22px; letter-spacing: 3px; font-weight: 650; }}
    .title {{ font-size: 68px; font-weight: 780; fill: #fff; }}
    .subtitle {{ font-size: 38px; font-weight: 650; fill: #fff; fill-opacity: .9; }}
    .label {{ font-size: 23px; letter-spacing: 2px; font-weight: 700; fill: #fff; }}
    .note {{ font-size: 18px; fill: #fff; fill-opacity: .72; }}
  </style>
</svg>'''


def main() -> None:
    modes = json.loads(DATA.read_text(encoding="utf-8"))
    COVERS.mkdir(parents=True, exist_ok=True)
    generated = 0
    for mode in modes:
        if mode.get("imageUrl"):
            continue
        filename = f"{mode['id']}.svg"
        (COVERS / filename).write_text(cover_svg(mode), encoding="utf-8")
        mode["imageUrl"] = f"assets/modes/generated/{filename}"
        mode["imageSource"] = "本地整理封面（依据官方模式资料设计；官方原图待确认）"
        generated += 1
    DATA.write_text(json.dumps(modes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {generated} local mode covers in {COVERS}")


if __name__ == "__main__":
    main()
