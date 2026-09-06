"""Package the downloaded official map snapshot as a self-contained local viewer.

Input cache: local-only/delta-official-source (official HTML/CDN files).
Tile configuration: local-only/delta-layers.json. Run sync_delta_interactive.py to refresh.
Only presentation adapters and local resource routing are changed; map coordinates stay upstream.
"""
from pathlib import Path
from PIL import Image
import json, re, shutil, os, urllib.parse
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'local-only/delta-official-source'
OUT = ROOT / 'assets/maps/delta-interactive'
BASE = 'https://game.gtimg.cn/images/dfm/cp/a20240729directory/'
layers = json.loads((ROOT / 'local-only/delta-layers.json').read_text())
OUT.mkdir(parents=True, exist_ok=True)
for p in SRC.rglob('*'):
    if not p.is_file() or p.name == 'fetch-errors.json' or '#' in p.name: continue
    target = OUT / p.relative_to(SRC)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(p, target)

# Generate lower zoom levels from original highest-resolution tiles. Preserve their world offsets.
for name, config in layers.items():
    folder = OUT / 'img' / name
    size = config['tileSize']
    for z in range(config['z'] - 1, -1, -1):
        children = list(folder.glob(f'{z+1}_*.jpg'))
        parents = {(int(p.stem.split('_')[1])//2, int(p.stem.split('_')[2])//2) for p in children}
        for x,y in parents:
            dest = folder / f'{z}_{x}_{y}.jpg'
            if dest.exists(): continue
            canvas = Image.new('RGB', (size*2, size*2), '#0c1518')
            for dx in range(2):
                for dy in range(2):
                    source = folder / f'{z+1}_{x*2+dx}_{y*2+dy}.jpg'
                    if source.exists():
                        with Image.open(source) as im: canvas.paste(im.resize((size,size)), (dx*size,dy*size))
            canvas.resize((size,size), Image.Resampling.LANCZOS).save(dest, quality=94)
Image.new('RGB',(256,256),'#0c1518').save(OUT/'blank.jpg')
index = {name:[p.stem for p in (OUT/'img'/name).glob('*.jpg')] for name in layers}
(OUT/'tile-index.js').write_text('window.DELTA_TILES = '+json.dumps(index,separators=(',',':'))+';\n')

for p in OUT.rglob('*.css'):
    original = SRC/p.relative_to(OUT)
    if not original.exists(): continue
    def css_url(m):
        url=m.group(1).strip('"\'')
        if url.startswith('data:') or url.startswith('#'): return m.group(0)
        absolute=urllib.parse.urljoin(BASE+str(p.relative_to(OUT)),url)
        if not absolute.startswith(BASE): return m.group(0)
        target=OUT/urllib.parse.urlsplit(absolute[len(BASE):]).path
        return 'url("'+os.path.relpath(target,p.parent)+'")'
    p.write_text(re.sub(r'url\(([^)]+)\)',css_url,original.read_text()))

for p in OUT.rglob('*.js'):
    original=SRC/p.relative_to(OUT)
    if not original.exists(): continue
    content=original.read_text()
    prefix='../' if p.relative_to(OUT).parts[0]=='m' else './'
    content=re.sub(r'(?:https?:)?//game\.gtimg\.cn/images/dfm/cp/a20240729directory/?',prefix,content)
    if p.name=='main.js' and p.parent.name=='lib':
        content=re.sub(r'var IMG_PRE = [^\n]+',"var IMG_PRE = window.DELTA_ASSET_ROOT.replace(/\\/$/, '');",content,count=1)
        content=content.replace("attribution: '© OpenStreetMap contributors'", "attribution: '地图与数据 © 腾讯 / 三角洲行动'")
        content=re.sub(r'errorTileUrl\s*:\s*href\s*\+\s*`[^`]+`',"errorTileUrl: window.DELTA_ASSET_ROOT + 'blank.jpg'",content)
        content=content.replace('let currMoveMap, currMoveWarMap,currWarMap_s;', 'let currMoveMap = currMap, currMoveWarMap = currWarMap, currWarMap_s;')
        content=content.replace('PTTSendClick && PTTSendClick',"typeof PTTSendClick === 'function' && PTTSendClick")
    # Some upstream floor/warfare configurations use a relative development path.
    content=re.sub(r"href\s*:\s*['\"]\./img/['\"]", "href: window.DELTA_ASSET_ROOT + 'img/'", content)
    p.write_text(content)

for mobile in [False,True]:
    rel=Path('m/index.html' if mobile else 'index.html');prefix='../' if mobile else './'
    content=(SRC/rel).read_text()
    content=re.sub(r'<!--.*?-->','',content,flags=re.S)
    def script(m):
        tag=m.group(0);src=re.search(r'src="([^"]+)"',tag)
        if src:
            url=src.group(1)
            if 'game.gtimg.cn/images/dfm/cp/a20240729directory/' not in url:return ''
            if '/js/lib/' not in url:return '' # CSS-only webpack bootstrap
            return tag
        if any(x in tag for x in ['TGshare','TGMobileShare','msdk','setSite','navigator.userAgent.toLowerCase())||(location.href','self.location=']):return ''
        return tag
    content=re.sub(r'<script\b[^>]*>.*?</script>',script,content,flags=re.S)
    content=re.sub(r'(?:https?:)?//game\.gtimg\.cn/images/dfm/cp/a20240729directory/',prefix,content)
    content=re.sub(r'<link rel="icon"[^>]+>', '',content)
    content=content.replace('<title>《三角洲行动》地图工具</title>','<title>三角洲行动 · 本地互动地图</title>')
    boot="<script>var warMapInfo;window.DELTA_ASSET_ROOT=new URL('"+prefix+"',location.href).href;</script>"
    if not mobile:
        boot+="<script>if(innerWidth<760)location.replace('m/index.html'+location.search+location.hash);</script>"
    content=content.replace('</head>',boot+'<script src="'+prefix+'tile-index.js"></script><script src="'+prefix+'local-adapter.js"></script><link rel="stylesheet" href="'+prefix+'local-adapter.css"></head>')
    (OUT/rel).write_text(content)

(OUT/'snapshot.json').write_text(json.dumps({'source':'https://df.qq.com/cp/a20240729directory/','retrievedAt':'2026-09-06','maps':20,'layers':layers,'tileCount':sum(map(len,index.values())),'notes':['官方公开地图工具的静态快照；地图、点位与美术版权归腾讯及相应权利人。','最高层级使用官方原始切片，较低层级本地生成。','原站在潮汐监狱边界之外缺少的 24 张切片保留为空白，不替换真实地图内容。','分享 SDK、统计 SDK、游戏内桥接未集成。']},ensure_ascii=False,indent=2))
print('Packaged', len(layers), 'layers /', sum(map(len,index.values())), 'tiles')
