# 武器外观与检视资料

2026-11-02 首批本地接入，2026-11-03 扩充为八款游戏。入口为 `#skins`。资料独立于模式、基础体验更新及主题道具，不增加模式数，不复用玩法分类。只有 `publicationStatus: ready` 的皮肤进入页面和公开构建；构建成功不代表已经部署。

2026-11-15 同步无畏契约和 CS2 两份图鉴，并收录四款已核实官方图片的活动外观。无畏契约 1,396、CS2 2,025、Apex Legends 2,723、CODM 3,885、CFM 252、CFHD 21、三角洲行动 9、使命召唤端游 3，共 10,314 款。Apex 与三角洲新增条目为官方活动选集。两款 Bellum 蓝图共用官方对照图，各自标注图内位置，BlackCell 的卸装护罩功能有官方说明。版本更新和图鉴缺口见[本轮记录](daily-update-2026-11-15.md)。

2026-11-16 从穿越火线手游官方稿件补入 14 款，另从 CFHD 社区资源和官方原稿补入 1,531 款外观。八款游戏共 11,859 款可浏览外观。CFHD 目录中的 220 款炫彩均可随母皮肤展示。

## 11 月 3 日可浏览资料基线

| 游戏 | 目录 | 枪械 | 刀与近战 | 含视频 | 含动图 |
|---|---:|---:|---:|---:|---:|
| 无畏契约 | 1,391 | 1,215 | 176 | 585 | 0 |
| 三角洲行动 | 8 | 2 | 6 | 8 | 0 |
| 使命召唤 | 1 | 0 | 1 | 0 | 0 |
| 使命召唤手游 | 3,885 | 3,274 | 611 | 4 | 0 |
| 穿越火线手游 | 252 | 187 | 65 | 3 | 4 |
| CFHD | 21 | 17 | 4 | 11 | 0 |
| CS2 | 2,025 | 1,449 | 576 | 0 | 0 |
| Apex Legends | 2,722 | 2,699 | 23 | 3 | 0 |
| 合计 | 10,305 | 8,843 | 1,462 | 614 | 4 |

视频与 GIF 分别统计，同一皮肤可以同时有两类媒体。目录记录不代表当前在售、可获取或具备专属检视；未知首发日保持 null / unverified，首次收录时间和来源发布日期不充当上线日期。

## 各游戏覆盖与来源

### 无畏契约 / 瓦洛兰特

从 [Valorant-API](https://valorant-api.com/) 的中英武器树保留武器、皮肤、等级、炫彩 UUID，并参考 [Riot 公共素材说明](https://developer.riotgames.com/docs/valorant#assets)。源 1,433 项排除 21 个默认项和 21 个随机收藏项；47 项缺顶层图标时使用真实炫彩或等级图。585 款具有预览地址，不能把它们全部称为检视。

RGX 战刀二级视频已抽帧核对，包含切出、攻击和检视；2025 全球冠军赛蝴蝶刀关联官方专门检视投稿，两种证据分别标记。没有声明全地区、全历史无遗漏。

### CS2

[ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API) 中英目录按涂装聚合 2,025 款，排除 94 项手套和 7 项装备。对应 54 种基础武器（34 枪、20 刀），使用 Valve 数字编号去重，不枚举每个磨损、模板和库存单件。上游提供静态资源，没有将游戏内检视链接当成动作视频。

### Apex Legends

合并 [Wiki 武器图库](https://apexlegends.wiki.gg/wiki/Weapon)与 [apex.source.gs 公开索引](https://apex.source.gs/api/items/)，保留[索引范围说明](https://apex.source.gs/about/)及逐条来源。索引来自 2026-10-07 客户端提取，不能作为当前官方全量 API。

扫描 31 个武器页，Hemlok 与 RE-45 的新旧共享图库去重为 29 个枪械家族；两源合并目录 3,069 项，其中 **2,722 项有图可浏览，347 项缺图待补**。枪皮中 2,646 张来自 Wiki，53 张为核对后的社区渲染图。143 张候选补图完成检查，30 张纯白枪械轮廓被排除；近战使用 22 张 Wiki 单件或套装彩图，另保留明确标注的 Cobalt Katar 官方系列总览。套装图不冒充单件渲染。

希尔 Showstoppers、恶灵 Hope’s Dawn、动力小子 Butterfly Knife 有明确检视出处，共 5 条视频（含希尔原来的两条展示）。检视依据原作者标题或章节记为 `source_confirmed`，未宣称全部逐帧核验。支持这三位传奇的中文检索。**仍未取得全量彩图、全部自定义组合和完整动作包。**

### 使命召唤手游 / CODM

[Zilliongamer 武器皮肤索引](https://zilliongamer.com/call-of-duty-mobile/c/skins-list/call-of-duty-mobile-skins-list)实际链接的 134 篇页面已遍历，127 篇含皮肤图，源图记录 4,471 条。合并同名和同图别名、排除 5 项裸近战武器后收录 3,885 款，125 个基础武器标签。124 种使用远程图的武器各抽查一图，全部为可访问图片；Fennec 使用归档官方封面。旧 Fennec 新闻链接 404，保留缺口说明。

目录明确是国际服社区资料，未核实中文皮肤名保留英文，不声称国服或全历史齐全。4 个旧 `codm-` ID、官方配图和视频迁入 `cod-mobile.json`，收藏标识保持；QQ9 的官方投稿标题明确为检视。端游 `call-of-duty.json` 独立维护跨代端游蓝图和近战。

### 穿越火线手游 / CFM

[4399 历史图鉴](https://news.4399.com/cfsy/)首页 300 个入口排除 26 个原型、24 个投掷物和 2 个重复项，保留 248 款早期枪械及近战变体，另收录 18 款较新官方稿件精选。当前可浏览 266 款，其中 200 款枪械、66 款近战。2019 年后的大部分外观仍待逐项核对。

社区图鉴图片存在防盗链，按实际来源页面取得的原图归档到本地，记录 SHA-256、尺寸和原址。精选包含 3 款带视频和 17 款带官方稿件动图的外观，动图单列。来源标明体验服、抢先展示或赛季范围，未能核实的首发日期留空。 [手斧·兔兔战士](https://news.17173.com/content/11142025/111817866.shtml) · [P90-雷暴王者](https://news.17173.com/content/02032026/145632931.shtml) · [2026 年 S1 赏金令选集](https://news.17173.com/content/01242026/121512819.shtml)

### CFHD

[CFHD 数据中心](https://www.crossfirehd.com/weapons.html)枚举 76 种武器、1,790 项资源。220 款炫彩归入母皮肤，得到 1,570 款目录。现有 1,552 款可浏览，其中 23 款使用官方配图，1,529 款使用已核对并归档的社区游戏资源图。详情默认显示母皮肤图，220 款炫彩均可切换并打开各自原图。

11 款有官网独立 PNG 和直接公开的 MP4，另 10 款使用官方道聚城商品图。擎天、屠龙、USP 虹儿片内的检视标题已抽样核对，完整视频包含多种展示。传说天启标准版和神话炫彩各有对应官方检视 GIF，展示封面来自原片抽帧。铭刻版使用明确标注的官方兑换页配图。 [CFHD 官方公众号稿件](https://news.17173.com/content/09182026/152640272.shtml)

本轮断点续取后，确认共用的汤姆逊图标实际对应黑曜。重对活动奖励截图与原作者展示封面，枪身斜面、鼓形弹匣和枪托相符。详情保留两处核对链接。 [2022 双区特惠活动截图](https://www.9game.cn/news/7126275.html) · [黑曜局内展示](https://www.bilibili.com/video/BV1MjDeBMEfd/)

按资源键和系列纹样确认 MK12 涂鸦 SMOKE35 的蓝白图，以及 GALIL 热带雨林的浅色斜纹图。两项详情均保留对照原图。18 款外观仍待配图，其中 14 项指向原型，3 项指向共用图，1 项资源地址返回 404。 [MK12 热血变体对照](https://www.crossfirehd.com/CFHD/SGUI_Textures_Weapon/MK12_SPR_SKIN_SMOKE_RED.png) · [MK12 热带雨林纹样对照](https://www.crossfirehd.com/CFHD/SGUI_Textures_Weapon/MK12_SPR_SKIN_TAIGA.png)

### 三角洲行动与使命召唤端游

三角洲保留官方 B 站原片和 Garena 赛季选集，展示、检视与来源确认分别标记。端游包括 MWII Slaughter King 和 MW4 的 Bellum 两款蓝图。Slaughter King 采用 GamesAtlas 游戏资源图。来源见[造物纪元实录](https://www.bilibili.com/video/BV11jdbB8EsB/) · [Garena Aurora](https://deltaforce.garena.com/en/news/all/STZAUY) · [GamesAtlas 刀具条目](https://www.gamesatlas.com/cod-warzone-2-blueprints/modern-warfare-2/slaughter-king) · [Activision Bellum 蓝图](https://www.callofduty.com/blog/2026/11/call-of-duty-modern-warfare-4-season-1-battle-pass-blackcell-store-bundles)。

## 媒体、页面与公开构建

官方宣传图、视频封面、系列总览、套装图与社区游戏资源图分别标注真实托管方和图注。保留原图比例，缩略展示不改变素材归属；原有模式和基础更新的官方配图要求不变。

MP4 提供原生控制、半速、重播和循环。B 站 / YouTube 点击后才加载原站播放器，始终保留原片链接，可播性受平台和地区影响。GIF 作为循环动图展示，切换与关闭详情会清理媒体。没有下载或转存视频平台的原片，也没有付费 3D 服务。

支持中英文搜索、枪械 / 近战、基础武器、原生品质、媒体筛选、炫彩切换、收藏和 Markdown / Canvas 导出。大目录只在进入武器外观或收藏时读取。图鉴收录与逐动作核验分开。

`python scripts/build_public_site.py` 以明确白名单打包八款游戏的 ready 目录、索引、前端模块和实际引用的配图。公开目录 gzip 压缩，清除本地历史快照和待补炫彩；原始采集缓存、执行日志及其他本地研究不进入构建。浏览器按索引选择 `.json.gz` 并解压，本地开发可直接读取普通 JSON。

发布沿用本项目 GitHub Pages 工作流。独立发布工作区以远程最新版本为基线，只合入武器外观功能；原工作区其他未发布的模式、地图和 UGC 研究继续保留。容量检查限 1 GB；大封面可引用已有明确官方 CDN，本地原图和 FF 全部正文档案保留。

## 更新与验证

APEX 图片质量检查依赖 Pillow；各脚本的源缓存保存在被忽略的 `local-only/weapon-skins/`，首次 live 同步需要联网。源失败时保留上次成功快照，离线重建不伪造新的来源核查时间。

```powershell
python -X utf8 scripts/sync_weapon_catalogs.py
python -X utf8 scripts/sync_weapon_curated.py
python -X utf8 scripts/sync_weapon_apex.py
python -X utf8 scripts/sync_weapon_codm.py
python -X utf8 scripts/sync_weapon_crossfire.py
python scripts/build_weapon_manifest.py
node scripts/validate_weapon_skins.cjs
python scripts/build_public_site.py
```

所有同步脚本支持 `--offline`；APEX 另支持 `--resume`，复用中断前 12 小时内的成功请求。CFM / CFHD 默认复用成功缓存，联网强制更新使用 `--refresh`。其余脚本的 `--game` 选项以 `--help` 为准，CODM 与 APEX 为独立单游戏脚本。旧精选脚本 `--game apex` 会转调新的 APEX 同步器，默认只维护三角洲和使命召唤端游，避免覆盖扩充目录。

校验包括各游戏稳定 ID、来源、日期、图片哈希、动作类型、URL 安全、独立模式计数、筛选、收藏和导出。公开构建还须验证压缩内容、ready 过滤、配图引用和容量；页面验收分别检查 CFM 动图、CFHD 图片与 MP4、CODM 图鉴和 APEX 缺图说明。

本地预览：`python -m http.server 4173 --bind 127.0.0.1`，访问 `http://127.0.0.1:4173/index.html#skins`。
