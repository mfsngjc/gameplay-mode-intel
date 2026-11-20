"""Classify UGC ranking entries using public tags and cached work descriptions."""

import argparse
import hashlib
from itertools import chain
import json
import re
from pathlib import Path

from sync_ugc import atomic_json, read_json


ROOT = Path(__file__).resolve().parents[1]
UNKNOWN = 'unclassified'
CATEGORIES = {
    'cs2': {
        'aim': '练枪与热身', 'tactics': '预瞄与道具训练', 'movement': '身法与跑图',
        'standard': '标准对战地图', 'arena': '竞技场与小规模对战', 'party': '娱乐与小游戏',
        'roleplay': '角色扮演与越狱', 'pve': '合作闯关与生存', 'zombies': '僵尸逃脱与生化',
        'tool': '设置与性能测试', 'showcase': '展示与沙盒', 'assets': '服务器与配套资源',
    },
    'roblox': {
        'progression': '经营与数值养成', 'roleplay': '社交扮演与装扮', 'survival': '生存与恐怖',
        'rpg': 'RPG 与角色成长', 'action': '动作与格斗', 'shooter': '射击对战与射击 PvE',
        'obby': '跑酷与平台跳跃', 'adventure': '冒险与剧情', 'strategy': '塔防与策略',
        'party': '派对与解谜', 'simulation': '载具、物理与其他模拟',
        'sports': '体育与竞速', 'other': '展示、教育与工具',
    },
    'fortnite': {
        'duel': '建造对练与盒战', 'combat': '团队对抗与混战', 'zone': '模拟缩圈与大逃杀',
        'objective': '目标攻防与床战', 'training': '瞄准与编辑训练',
        'tycoon': '经营、收集与养成', 'pve': 'PvE 与冒险', 'horror': '恐怖与逃脱',
        'parkour': '跑酷与闯关', 'party': '派对与小游戏', 'racing': '竞速与载具', 'roleplay': '社交扮演与探索',
    },
    'minecraft': {
        'performance': '性能与兼容优化', 'interface': '界面、地图与信息', 'visual': '画面、动画与音效',
        'utility': '便捷操作与实用工具', 'adventure': '世界生成与冒险内容', 'building': '建筑与装饰',
        'tech': '科技自动化与魔法', 'mechanics': '规则、装备与玩法', 'server': '联机与服务器工具',
    },
}

# Source descriptions resolve cases where broad tags or the title point to a different feature.
REVIEWED = {
    'cs2': {
        # These hubs offer several drills, with aim and warm-up as the common entry point.
        '3070389038': 'aim', '3086023598': 'aim', '3416003536': 'aim', '3254587589': 'aim',
        '3070715607': 'aim', '3836909719': 'aim', '3070217773': 'aim',
        '3124182019': 'aim', '3615956855': 'aim', '3560122496': 'aim', '3718948297': 'aim',
        '3076559091': 'tactics', '3781011632': 'tactics', '3808451248': 'tactics',
        '1465165748': 'showcase', '3283982324': 'showcase', '3204903088': 'party',
        '3838287398': 'tactics', '3836206718': 'tactics', '3311703073': 'aim',
        '3446321924': 'roleplay', '3149722721': 'arena', '3573299763': 'roleplay',
        '3778550955': 'party', '3637482129': 'party', '3781662899': 'pve', '3833486540': 'pve',
        '3725771337': 'showcase', '3687298714': 'showcase', '3736187921': 'showcase',
        '3343693110': 'showcase', '3681322159': 'showcase', '3340666852': 'showcase',
        '3676707428': 'standard', '3564514272': 'assets', '3776848003': 'assets',
        '3778932198': 'assets', '3831831416': 'assets', '3832208515': UNKNOWN,
        '3608644625': 'party', '3344925772': 'party', '3425636965': 'party',
        '3414483755': 'arena', '3835271133': 'aim', '3823363089': 'assets',
    },
    'roblox': {'9978329815': 'other', '10773416193': 'shooter', '10770463307': 'survival'},
    'fortnite': {
        # The island description specifies a free-for-all sandbox, regardless of its title.
        '6155-1398-4059': 'combat', '8765-4125-9209': 'combat',
        '0105-1573-8859': 'combat', '8532-9413-6963': 'party', '6980-2761-9936': 'tycoon',
        '5253-8468-3364': 'party', '7008-1142-1669': 'party', '0798-3938-6478': 'racing',
        '6531-4403-0726': 'roleplay', '7314-4269-5911': 'roleplay', '6462-6469-4435': 'roleplay',
        '4650-1603-2769': 'combat',
    },
    'minecraft': {
        # Shader support, model/texture replacements, and render distance are visual features.
        'YL57xq9U': 'visual', '4I1XuqiY': 'visual', 'GchcoXML': 'visual', 'uCdwusMi': 'visual',
        'QdG47OkI': 'visual', 'JuksLGBQ': 'visual', 'BVzZfTc1': 'visual', 'rcTfTZr3': 'visual',
        'fM515JnW': 'visual', 'WhbRG4iK': 'visual', 'EIa1eiMm': 'visual', 'idMHQ4n2': 'visual',
        'DnNYdJsx': 'visual', 'G1s2WpNo': 'visual', '3qAYkBMB': 'visual',
        'PtjYWJkn': 'performance', 'bKhHBluE': 'performance', 'OsnvQwPM': 'performance',
        'Bh37bMuy': 'interface', '3azQ6p0W': 'interface', 'Wb5oqrBJ': 'interface', '8qkXwOnk': 'interface',
        'aC3cM3Vq': 'utility', 'O7RBXm3n': 'utility', 'sGmHWmeL': 'utility', 'SaCpeal4': 'utility',
        '9eGKb6K1': 'server', 'k2ZPuTBm': 'server', 'uLbm7CG6': 'performance', 'Wnxd13zP': 'performance',
        'QwxR6Gcd': 'performance', 'Orvt0mRa': 'performance', 'nfn13YXA': 'interface',
        'joEfVgkn': 'utility', 'LOpKHB2A': 'utility', 'fPetb5Kh': 'interface',
        'hbSfT032': 'performance', 'Ey3OuBuM': 'performance', 'Gwl4VXlb': 'mechanics', 'SzzJttH8': 'mechanics',
        'YyO8B4Mq': 'visual', 'DAQQfcTq': 'visual', 'p6m1u5Bu': 'visual', 'sI88vVWl': 'mechanics',
        '7COzXwtc': 'building', 'R8r1wiW4': 'mechanics', 'kcgUksbd': 'interface',
        'R2OftAxM': 'mechanics', 'Xy8aRQKS': 'mechanics', '6iTJugQR': 'mechanics',
    },
}


def match_rules(value, rules):
    for category, pattern in rules:
        if re.search(pattern, value):
            return category
    return None


def cs2(title, description, tags, intro=''):
    if re.match(r'^prac test\s*\d', title):
        return UNKNOWN
    # Workshop connection guides often append unrelated search terms. Use explicit modes in the title.
    if 'disable_workshop_command_filtering' in description:
        return match_rules(title, (
            ('roleplay', r'\bjail\s?break\b|тюрьма'),
            ('party', r'\b(?:hide and seek|prop hunt|random (?:cheats|skills|abilities|cards|models))\b|\bрандомные способности\b'),
            ('arena', r'\b(?:awp\s+lego\s*2?|duels?)\b'),
            ('movement', r'\bbhop\b'),
            ('standard', r'^(?:de )?(?:dust ?2|mirage) (?:fps\+?|winter(?: online| \(зимний мираж\))?)$'),
        )) or UNKNOWN
    if re.search(r'\b(?:assets(?: alpha| omega)?|test resource|character resource)\b|에셋|资源包|配套资源|服务器的客户端.{0,14}资源|武器替换模型', title + '\n' + intro):
        return 'assets'
    if re.match(r'^z[em]\s', title) or re.search(r'僵尸逃脱|僵尸生存|生化(?:模式|地图)|\bzombie (?:escape|survival|mode|mod)\b', intro):
        return 'zombies'
    title_category = match_rules(title, (
        ('tool', r'\b(?:config|crosshair|viewmodel|view model|hud)\s*(?:generator|gen|editor|map)\b|\b(?:benchmark|fps test|sensitivity finder)\b'),
        ('roleplay', r'\b(?:jail\s?break|roleplay|role play|ttt)\b|тюрьма'),
        ('tactics', r'\b(?:pre ?fire|utility|smokes?|retakes?|ego peek|angle hold|ct defense|wallbang|line[- ]?ups)\b|^5e prac |预瞄|道具训练'),
        ('movement', r'\b(?:bhop|bunny hop|surf|kz|parkour|climb|movement|jump ?training|only up)\b|跑酷|身法'),
        ('zombies', r'\bzombie (?:escape|survival|mode)\b|僵尸逃脱|生化'),
        ('pve', r'\b(?:co-?op|pve|boss fight)\b'),
        ('party', r'\b(?:arcade football|soccer|football|hide and seek|prop ?hunt|minigames?|chess|bowling|quiz|squid game|paintball)\b|捉迷藏|躲猫猫|足球'),
        ('aim', r'\b(?:aim\s*(?:training|trainer|course|rush|hub|botz|/?reflex|reaction trainer|& run)|awp training|recoil|warm ?up|bots? training|training hub|training aim)\b|^cs2 aim$|练枪|压枪|热身'),
        ('arena', r'^am\s|\b35\s*hp\b|\b(?:[1-5]\s*(?:v|vs?\.?|versus)\s*[1-5]|duels?|aim map|awp\s+lego\s*2?|arena|death ?match|ffa|fy iceworld|aim redline)\b'),
        ('showcase', r'\b(?:showcase|sandbox|weapon test|skin test|knife test|inspect skins)\b'),
    ))
    if title_category:
        return title_category
    description_category = match_rules(intro + '\n' + description, (
        ('tactics', r'\b(?:prefire angles|practice (?:your |the )?(?:smokes?|retakes)|grenade lineups|learn .{0,35} smokes)\b|预瞄|投掷物(?:练习|点位|训练)|раскидке гранат'),
        ('aim', r'\b(?:aim training|aim trainer|warm.?up map|warm up like a pro|hone your basic aiming|shoot (?:bots|targets))\b|练枪|瞄准(?:练习|训练)|反应时间|机器人训练'),
        ('zombies', r'\bzombie (?:escape|survival|mode|mod)\b|僵尸逃脱|生化(?:模式|地图)'),
        ('party', r'\b(?:hide and seek|prop ?hunt|seek_mirage|seek_pool_home)\b|小游戏(?:地图|模式|集合)|滑行竞速|冰面赛道|拔河玩法'),
        ('movement', r'\b(?:movement challenge|movement practice|bunny hop|surf map|parkour map)\b|连续跳跃|连跳(?:图|地图)|斜坡滑行|身法障碍|障碍跑图|跑图路线'),
        ('tool', r'\b(?:crosshair generator|viewmodel generator|benchmark for testing)\b'),
        ('pve', r'\b(?:cooperative (?:mission|campaign)|co.?op (?:map|mission))\b|合作(?:闯关|探索|生存)|抵挡一波波'),
        ('standard', r'\b(?:bomb defusal|hostage rescue|wingman map|competitive 5v5|defuse map)\b|拆弹|人质(?:救援|地图)|双人搭档(?:对战|地图)'),
        ('arena', r'\b(?:aim map|deathmatch map|1v1 map|gun game|arms race map)\b|单挑|对枪(?:图|地图)|狙击对战|点生命值对战'),
        ('showcase', r'\b(?:tech demo|showcase map|test (?:skins|knives))\b|场景观赏|自由探索'),
    ))
    if description_category:
        return description_category
    if title.startswith('mg '):
        return 'party'
    if re.search(r'^(?:de|cs) ', title) or tags & {'classic', 'wingman'}:
        return 'standard'
    if tags & {'deathmatch', 'armsrace'}:
        return 'arena'
    return UNKNOWN


def roblox(title, _description, tags):
    if tags & {'tycoon', 'incremental simulator', 'idle'}:
        return 'progression'
    for category, genres in (
        ('roleplay', {'roleplay & avatar sim', 'social', 'shopping', 'town and city', 'town'}),
        ('survival', {'survival', 'horror'}), ('rpg', {'rpg'}), ('shooter', {'shooter', 'fps'}),
        ('action', {'action', 'fighting'}), ('obby', {'obby & platformer'}), ('adventure', {'adventure'}),
        ('strategy', {'strategy'}), ('party', {'party & casual', 'puzzle', 'comedy'}),
        ('sports', {'sports & racing', 'sports'}), ('simulation', {'simulation', 'building'}),
        ('other', {'entertainment', 'education', 'utility & other'}),
    ):
        if tags & genres:
            return category
    return match_rules(title, (
        ('strategy', r'\btower defense\b'), ('obby', r'\bobby\b'),
        ('progression', r'\btycoon\b'), ('roleplay', r'\brole\s?play\b'),
        ('survival', r'\b(?:survive|horror)\b'),
    )) or UNKNOWN


def fortnite(title, description, tags):
    title_category = match_rules(title, (
        ('objective', r'\b(?:bed ?wars|capture the flag|search (?:and|&) destroy)\b'),
        ('parkour', r'\b(?:parkour|death ?run|only up|obby)\b'),
        ('party', r'\b(?:pillars|prop hunt|hide and seek|color switch|minigames?|squid game|fashion show)\b'),
        ('zone', r'\b(?:zone\s?wars|battle royale|scrims?)\b|سكرمز'),
        ('pve', r'\b(?:roguelike|zombies?|boss\s?fight)\b'),
        ('training', r'\b(?:aim|edit) (?:\+\s*)?(?:edit )?(?:course|trainer|training)\b'),
        ('duel', r'\b(?:box ?(?:fight|pvp)|piece control|build ?fight|\d\s?v\s?\d realistics?)'),
        ('combat', r'\b(?:red (?:vs?\.?|versus) blue|free for all|team deathmatch|gun game|sniper one shot)\b'),
    ))
    if title_category:
        return title_category
    for category, signals in (
        ('tycoon', {'tycoon', 'simulator', 'collection'}),
        ('horror', {'survival horror', 'horror', 'escape room'}),
        ('training', {'aim course', 'edit course'}),
        ('zone', {'zonewars', 'zone wars', 'battle royale'}),
        ('duel', {'boxfight', 'box fight'}),
        ('party', {'party game', 'minigame', 'prop hunt', 'hide & seek'}),
        ('parkour', {'parkour', 'deathrun'}),
        ('objective', {'capture the flag', 'search and destroy', 'objective'}),
        ('combat', {'free for all', 'team deathmatch', 'gun game'}),
        ('roleplay', {'role playing', 'roleplay'}),
        ('racing', {'race', 'racing', 'driving'}),
        ('pve', {'pve', 'roguelike', 'boss battle'}),
        ('roleplay', {'social'}),
        ('duel', {'1v1', '2v2', '3v3'}),
        ('combat', {'pvp'}),
        ('pve', {'adventure'}),
    ):
        if tags & signals:
            return category
    return match_rules(description, (
        ('tycoon', r'\b(?:earn cash|generate cash|rebirth)\b.{0,90}\b(?:upgrade|collect|rebirth)\b'),
        ('horror', r'\b(?:horror map|escape room)\b'), ('pve', r'\b(?:fight waves|boss fights?|roguelike)\b'),
    )) or UNKNOWN


def minecraft(title, description, tags):
    content = match_rules(title + '\n' + description, (
        ('server', r'\b(?:voice chat|server administration|server management|server moderation|server-side anticheat|lan server|chat reports)\b'),
        ('interface', r'\b(?:mini\s?map|world map|hud|tooltips?|key.bindings? menu|mod menu|recipe viewer|enchantment descriptions|menu customization|customize minecraft.s menus)\b'),
        ('performance', r'\b(?:fram[e]?\s?rates?|memory leaks?|reduces? (?:lag|memory usage)|performance (?:mod|optimization)|fps (?:boost|optimization)|fixes? (?:crashes|glfw))\b'),
        ('visual', r'\b(?:dynamic lights?|shader(?: pack)?s? loader|shaders?|animations?|connected textures|resource.?pack support|sound physics|sound attenuation|footstep sounds|custom entity model|custom item textures|particles?|fullbright|skin layers?|render distances?)\b'),
        ('building', r'\b(?:litematica|worldedit|schematic mod|furniture|building blocks|decorative blocks|building tools|place blocks how)\b'),
        ('utility', r'\b(?:veinmin(?:er|ing)|zoomify|borderless fullscreen|inventory sorting|crafting result|carry on)\b'),
    ))
    if content:
        return content
    for category, signals in (
        ('performance', {'optimization'}), ('adventure', {'worldgen', 'adventure', 'mobs'}),
        ('tech', {'technology', 'magic', 'storage'}), ('building', {'decoration'}),
        ('mechanics', {'equipment', 'game-mechanics', 'transportation', 'food', 'economy', 'minigame', 'cursed'}),
        ('server', {'management', 'social'}), ('utility', {'utility'}),
    ):
        if tags & signals:
            return category
    return UNKNOWN


CLASSIFIERS = {'cs2': cs2, 'roblox': roblox, 'fortnite': fortnite, 'minecraft': minecraft}


def classify(platform, row, source):
    identifier = str(source.get('canonicalId') or row['id'])
    if identifier in REVIEWED[platform]:
        return REVIEWED[platform][identifier]
    title = re.sub(r'[_–—]', ' ', row['title'].casefold())
    description = ' '.join((source.get('description') or row.get('summary') or '').casefold().split())
    tags = {tag.casefold() for tag in source.get('categories', []) if tag}
    if not tags:
        tags = {tag.casefold() for tag in row.get('categories', []) if tag}
    if platform == 'cs2':
        tags = tags | {value for zh, value in {
            '经典': 'classic', '经典对战': 'classic', '搭档模式': 'wingman',
            '死亡竞赛': 'deathmatch', '死斗': 'deathmatch', '军备竞赛': 'armsrace',
        }.items() if zh in tags}
        return cs2(title, description, tags, (row.get('introZh') or '').casefold())
    return CLASSIFIERS[platform](title, description, tags)


def build(folder, latest, evidence):
    platforms = {platform: {'labels': {**labels, UNKNOWN: '待分类'}, 'entries': {}}
                 for platform, labels in CATEGORIES.items()}
    source_boards = read_json(folder / 'source-boards/cs2.json', {}).get('boards', [])
    workshop = {row['id']: row for board in source_boards
                for row in board['rows']}
    supplements = read_json(folder / 'cs2-source-board-intros.json', {}).get('entries', {})
    translations = read_json(folder / 'chinese.json', {}).get('entries', {})

    def workshop_intro(identifier):
        return (translations.get(f'cs2:{identifier}', {}).get('intro') or
                supplements.get(identifier) or workshop.get(identifier, {}).get('introZh'))

    snapshots = (json.loads(path.read_text(encoding='utf-8'))
                 for path in sorted((folder / 'history').glob('????-??-??.json'), reverse=True))
    for snapshot in chain([latest], snapshots):
        for board in snapshot['platforms'].values():
            platform = board['platformId']
            entries = platforms[platform]['entries']
            for row in board['entries']:
                identifier = str(row['id'])
                if identifier in entries:
                    continue
                source = evidence.get(f'{platform}:{identifier}', {})
                if platform == 'cs2':
                    row = {**row, 'introZh': workshop_intro(identifier)}
                entries[identifier] = classify(platform, row, source)
    entries = platforms['cs2']['entries']
    for identifier, row in workshop.items():
        if identifier not in entries:
            entries[identifier] = classify('cs2', {**row, 'introZh': workshop_intro(identifier), 'categories': row['tags']},
                                           evidence.get(f'cs2:{identifier}', {}))
    revision = hashlib.sha256(json.dumps(platforms, sort_keys=True).encode()).hexdigest()[:16]
    output = {'schemaVersion': 1, 'revision': revision, 'platforms': platforms}
    atomic_json(folder / 'board-categories.json', output)
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    folder = parser.parse_args().root / 'data/ugc'
    latest = json.loads((folder / 'latest.json').read_text(encoding='utf-8'))
    cache = json.loads((folder / 'source-descriptions.json').read_text(encoding='utf-8'))
    result = build(folder, latest, cache['entries'])
    for platform, data in result['platforms'].items():
        entries = data['entries']
        print(f'{platform}: {len(entries)} works, {sum(value == UNKNOWN for value in entries.values())} unclassified')
