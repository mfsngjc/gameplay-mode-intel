# 武器外观与检视资料

2026-11-02 首批本地接入，2026-11-03 扩充为八款游戏。入口为 `#skins`。资料独立于模式、基础体验更新及主题道具，不增加模式数，不复用玩法分类。只有 `publicationStatus: ready` 的皮肤进入页面和公开构建；构建成功不代表已经部署。

## 本轮可浏览资料

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

目录明确是国际服社区资料，未核实中文皮肤名保留英文，不声称国服或全历史齐全。4 个旧 `codm-` ID、官方配图和视频迁入 `cod-mobile.json`，收藏标识保持；QQ9 的官方投稿标题明确为检视。端游 `call-of-duty.json` 仅保留 MWII / Warzone 2 的 Slaughter King 刀，避免重复。

### 穿越火线手游 / CFM

[4399 历史图鉴](https://news.4399.com/cfsy/)首页 300 个入口排除 26 个原型、24 个投掷物和 2 个重复项，保留 248 款早期枪械及近战变体，并补入 4 款较新官方稿件精选。它不是当前 CFM 全量目录，不与 CF 端游或 CFHD 混标。

社区图鉴图片存在防盗链，按实际来源页面取得的原图归档到本地，记录 SHA-256、尺寸和原址。另有官方稿件的套装视频与 GIF 动图；[手斧·兔兔战士原稿](https://news.17173.com/content/11142025/111817866.shtml)明确两套检视，动图单独显示为 GIF，不增加视频数。2025 年精选不能弥补早期图鉴后的整体历史缺口。

### CFHD

[CFHD 数据中心](https://www.crossfirehd.com/weapons.html)枚举 76 种武器、1,790 项资源；220 炫彩归入母皮肤，得到 1,570 款目录。社区图片站本轮实测连接失败；**只有 21 款获得可核实官方原图的记录进入展示，1,549 款母皮肤与 220 款炫彩图片待补**，没有用原型图片替代对应皮肤。

11 款有官网独立 PNG 和直接公开的 MP4，另 10 款使用官方道聚城商品图，原图均本地归档。官网武器视频按实际对象关联；擎天、屠龙、USP 虹儿片内的检视标题已抽样核对，完整视频仍标混合展示。素材出处和检视复核分开记录。后续补图须重新验证源站，不能只因为元数据已遍历就称可视资源全量。

### 三角洲行动与使命召唤端游

三角洲继续保留官方 B 站的 8 款精选原片，例如[造物纪元实录](https://www.bilibili.com/video/BV11jdbB8EsB/)，展示、检视与来源确认分别标记。端游保留 Slaughter King 官方公告及 [GamesAtlas 刀具条目](https://www.gamesatlas.com/cod-warzone-2-blueprints/modern-warfare-2/slaughter-king)对应的社区资源图，两者均为有限选集。

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
