# 武器外观与检视资料

2026-11-02 首批本地接入，2026-11-03 扩充八款游戏，并继续补采 APEX、CFM、CFHD、CODM 国服及使命召唤端游资料。入口为 `#skins`。资料独立于模式、基础体验更新及主题道具，不增加模式数，不复用玩法分类。只有 `publicationStatus: ready` 的皮肤进入页面和公开构建；构建成功不代表已经部署。

## 本轮可浏览资料

| 游戏 | 目录 | 枪械 | 刀与近战 | 含视频 | 含动图 |
|---|---:|---:|---:|---:|---:|
| 无畏契约 | 1,391 | 1,215 | 176 | 585 | 0 |
| 三角洲行动 | 8 | 2 | 6 | 8 | 0 |
| 使命召唤 | 2,343 | 2,208 | 135 | 2 | 0 |
| 使命召唤手游 | 4,269 | 3,643 | 626 | 4 | 203 |
| 穿越火线手游 | 831 | 699 | 132 | 3 | 406 |
| CFHD | 1,560 | 1,376 | 184 | 14 | 17 |
| CS2 | 2,025 | 1,449 | 576 | 0 | 0 |
| Apex Legends | 2,849 | 2,813 | 36 | 17 | 0 |
| 合计 | 15,276 | 13,405 | 1,871 | 633 | 626 |

视频与 GIF 分别统计，同一皮肤可以同时有两类媒体。端游本次由 1 条扩为 2,343 条，新增 2,342 条；八款游戏合计 15,276 条。63 条 B 站检视视频另列资料区，不增加皮肤计数。CODM 的国服与国际服资料分别记录，跨服同款尚未逐一对照合并，统计不是全服唯一外观数量。目录记录不代表当前在售、可获取或具备专属检视；未知首发日保持 null / unverified，首次收录时间和来源发布日期不充当上线日期。

## 各游戏覆盖与来源

### 无畏契约 / 瓦洛兰特

从 [Valorant-API](https://valorant-api.com/) 的中英武器树保留武器、皮肤、等级、炫彩 UUID，并参考 [Riot 公共素材说明](https://developer.riotgames.com/docs/valorant#assets)。源 1,433 项排除 21 个默认项和 21 个随机收藏项；47 项缺顶层图标时使用真实炫彩或等级图。585 款具有预览地址，不能把它们全部称为检视。

RGX 战刀二级视频已抽帧核对，包含切出、攻击和检视；2025 全球冠军赛蝴蝶刀关联官方专门检视投稿，两种证据分别标记。没有声明全地区、全历史无遗漏。

### CS2

[ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API) 中英目录按涂装聚合 2,025 款，排除 94 项手套和 7 项装备。对应 54 种基础武器（34 枪、20 刀），使用 Valve 数字编号去重，不枚举每个磨损、模板和库存单件。上游提供静态资源，没有将游戏内检视链接当成动作视频。

### Apex Legends

合并 [Wiki 武器图库](https://apexlegends.wiki.gg/wiki/Weapon)与 [apex.source.gs 公开索引](https://apex.source.gs/api/items/)，保留[索引范围说明](https://apex.source.gs/about/)及逐条来源。索引来自 2026-10-07 客户端提取，不能作为当前官方全量 API。

扫描 31 个武器页，Hemlok 与 RE-45 的新旧共享图库去重为 29 个枪械家族；合并目录 3,069 项，其中 **2,849 项有图可浏览，220 项缺图待补**。本轮进一步枚举 Wiki 的 15,318 个公开文件及 [Apex Item Store](https://apexitemstore.com/) 的武器图库、92 页附件，取得 9,110 个实际附件；原站声称 9,126 个，16 项差额明确保留，未伪装成闭合索引。

本轮补入 127 项真实配图：63 项 Wiki 文件、55 项 Item Store 资料图、9 项官方静态图或原片画面。53 张既有客户端社区彩图保留；纯白客户端轮廓继续排除。套装、系列和官方原片截帧均标明范围，不冒充单件渲染。

17 款关联 19 条视频。新增 8 段 EA 原生检视展示，涵盖 Sky Piercer、Grand Slam、Death Duet、Beam Saber、Epyon Heat Rod、Hadoken、Horizon Gravity Maw 与 Fuse Razor’s Edge；已按 2 秒间隔抽帧核对，精确程度标为抽样。另补原作者检视章节，依据标题或章节记为 `source_confirmed`，未宣称全部逐帧核验。

220 项缺口逐项保留原因：160 项未找到精确彩图、28 项只有白轮廓、5 项同名变体映射不明、1 项别名待核、24 项独立近战配色缺材质、2 项基础近战缺少可唯一对应的图。Twin Razors 官方合照不能唯一映射基础配色，Metallic Banshee 缺独立图。**仍未取得全量彩图、全部自定义组合和完整动作包。**

### 使命召唤手游 / CODM

[Zilliongamer 武器皮肤索引](https://zilliongamer.com/call-of-duty-mobile/c/skins-list/call-of-duty-mobile-skins-list)实际链接的 134 篇页面已遍历，127 篇含皮肤图，源图记录 4,471 条。合并同名和同图别名、排除 5 项裸近战武器后收录 3,885 款，125 个基础武器标签。124 种使用远程图的武器各抽查一图，全部为可访问图片；Fennec 使用归档官方封面。旧 Fennec 新闻链接 404，保留缺口说明。

国际服社区资料中未核实的中文皮肤名保留英文。4 个旧 `codm-` ID、官方配图和视频保持；QQ9 的官方投稿标题明确为检视。端游与手游采用独立目录，端游的蓝图及检视覆盖见下节。

本轮沿[国服官网综合新闻索引](https://codm.qq.com/gicp/news/886/2/19485/1.html)实际“下一页”遍历 99 页、990 篇原稿，补入 384 条有明确命名小节和实图的蓝图资料。其中 203 条含多帧 GIF、6 条有明确检视说明。国服与国际服分列地区，不凭相似译名自动合并；该新闻索引闭合不等于国服完整图鉴。角色、投掷物、混合武器标题和宣传后缀不当成皮肤。原稿配图可能展示实战、升级或特效，图注明示范围。

GIF 经实际解码记录 MIME、帧数和 SHA-256；无扩展名的腾讯图片地址只有确认多帧后才作为动图。动作随原稿小节切换，检视标签不能延续到后面的枪身动态或福利配图。国际服刷新保留国服独立成果；部分索引、正文或图片检查失败时不覆盖上次成功快照。

### 穿越火线手游 / CFM

[4399 历史图鉴](https://news.4399.com/cfsy/)七类武器的 75 个实际分页完整遍历，枚举 464 篇历史入口。另扫描 CFM 官网枪械道具栏目：公开 API 支持 `stime` / `etime`，按年份分窗读取 169 页，逐页检查日期范围、ID、分页与 total；各窗口计数之和、去重 ID 数和总数均为 7,769。直接大偏移会重复首页，不能据此宣称扫完。

1,666 篇候选武器正文已全部读取，无不可用正文；仅明确对应单件武器的外观与动作小节进入目录。排除原型、投掷物、数据表和无法对应单件的合集后，可浏览资料为 831 条：699 枪械、132 近战。3 条记录含视频，406 条含 GIF，133 条含明确检视资料。原 252 条的身份和媒体保留。同一基础武器使用一致分类，枪械皮肤名中的“剑”等字样不作为近战判据；弓类按原稿归副武器。检视、换弹等动作按紧邻正文或图注对应，混合说明保守标为展示。栏目索引闭合不等于全游戏皮肤齐全，掌火完整图鉴和栏目外历史资料仍有缺口。

社区图鉴图片存在防盗链，按实际来源页面取得的原图归档到本地，记录 SHA-256、尺寸和原址；GIF 实际解码，不把静态 GIF 计为动作。腾讯托管的原稿可能由社区作者创作，作者身份逐条标注。[手斧·兔兔战士原稿](https://news.17173.com/content/11142025/111817866.shtml)明确两套检视，动图不增加视频数。

### CFHD

[CFHD 数据中心](https://www.crossfirehd.com/weapons.html)枚举 76 种武器、1,790 项资源；220 炫彩归入母皮肤，得到 1,570 款目录。本轮使用系统信任链、单条 HTTPS 会话、每秒最多一请求稳定补采，未关闭证书验证。**1,560 款有图可展示，220 炫彩图全部归档**；保留 10 款待补：1 项原址 404，9 项错配或共用原型图。共用图逐组审计，不将错误映射记为 ready。

原 21 张官方图保留；新增原图 1,768 张、34.93 MB，逐图记录尺寸、原址和 SHA-256。14 段 MP4、17 段官方 GIF 覆盖 22 款，已抽帧核过检视，完整视频仍标混合展示。8 条媒体精确绑定炫彩 ID，7 条基础外观 MP4 绑定基础 ID；切换外观同步图注、图片出处与动作，不借用其他配色的专属资料。社区快照覆盖不等于官方全历史或所有检视动作齐全。

### 使命召唤端游

本次把端游从 1 条精选扩展为多作品目录。沿 [GamesAtlas Warzone 蓝图图鉴](https://www.gamesatlas.com/cod-warzone-2-blueprints/)实际公开配置读取 2,369 条蓝图，配置对象不计皮肤。覆盖 Modern Warfare II、Modern Warfare III、Black Ops 6、Black Ops 7、Modern Warfare 4；Warzone 继承使用不重复算另一条蓝图。保留原 Slaughter King ID、收录时间与高清配图。2,343 条有图可浏览（2,208 枪械与远程武器、135 近战）；26 条待补，包括 21 个 Logo 占位、3 个错配图和 2 个基础武器待核。

单件图逐 URL 获取并实际解码，游戏 Logo、错配图片和未确定基础武器的记录继续待补，不进入页面。图鉴多为 320×180 缩略图，已核实详情原图的条目使用较高清的单件截图；GamesAtlas 的截图与游戏资源图均标社区渠道，不冒充官方素材。没有把这份可枚举快照称为 COD 全历史，2019 及更早、Cold War、Vanguard 等独立历史目录仍待另行对账。

用户提供的 [《COD21 特殊检视——打印命运》](https://www.bilibili.com/video/BV1cTWNz4Ey8/)引出了光辉者UNS-08 的 63 条 BO6 特殊检视合集。已通过公开 view 元数据逐条核实 BVID、作者、发表日、真实封面与 CID；页面提供独立检视视频区，按原作者标题查找并打开 B 站原片。它们不是 63 条新增皮肤，也未宣称全部逐帧审阅。8 条另外找到的组合包/合集投稿仅留研究候选，不纳入单件蓝图统计。

13 张原作者封面及种子静态首帧已抽样核对。仅两条关联经过单件图和官方文字交叉确认：打印命运 → Printed End / KOMPAKT 92；瘟疫医生 → Plague Doctor / AMES 85。前者由[官方 Craftwork Recon 商城页](https://www.callofduty.com/en/store/bundles/5411)确认基础武器与蓝图名，后者由[官方 NEXT 武器公告](https://www.callofduty.com/blog/2024/08/call-of-duty-next-black-ops-6-reveal-multiplayer-map-modes-weapons-operators-intel)确认。中文名沿用作者标题，未称为已核实的官方本地化名称。基础武器不明的视频保持独立资料，不推断英文名称或具体蓝图。

端游支持按所属作品筛选，卡片显示作品归属；“打印命运”等已确认中文别名可检索到对应蓝图。旧精选同步入口转调新端游同步器，静态刷新保留检视合集、已审媒体及中文检索别名。原作者投稿标题作为检视类型的来源依据，蓝图身份的静态图审阅与动作逐帧审阅分开记录。

### 三角洲行动

三角洲继续保留官方 B 站的 8 款精选原片，例如[造物纪元实录](https://www.bilibili.com/video/BV11jdbB8EsB/)，展示、检视与来源确认分别标记。

## 媒体、页面与公开构建

官方宣传图、视频封面、系列总览、套装图与社区游戏资源图分别标注真实托管方和图注。保留原图比例，缩略展示不改变素材归属；原有模式和基础更新的官方配图要求不变。

MP4 提供原生控制、半速、重播和循环。B 站 / YouTube 点击后才加载原站播放器，始终保留原片链接，可播性受平台和地区影响。GIF 作为循环动图展示，切换与关闭详情会清理媒体。没有下载或转存视频平台的原片，也没有付费 3D 服务。

支持中英文搜索、枪械 / 近战、基础武器、原生品质、媒体筛选、炫彩切换、收藏和 Markdown / Canvas 导出。大目录只在进入武器外观或收藏时读取。图鉴收录与逐动作核验分开。

`python scripts/build_public_site.py` 以明确白名单打包八款游戏的 ready 目录、索引、前端模块和实际引用的配图。公开目录 gzip 压缩，清除本地历史快照和待补炫彩；原始采集缓存、执行日志及其他本地研究不进入构建。浏览器按索引选择 `.json.gz` 并解压，本地开发可直接读取普通 JSON。

发布沿用本项目 GitHub Pages 工作流。独立发布工作区以远程最新版本为基线，只合入武器外观功能；原工作区其他未发布的模式、地图和 UGC 研究继续保留。容量检查限 1 GB；大封面可引用已有明确官方 CDN，本地原图和 FF 全部正文档案保留。

## 更新与验证

图片解码依赖 Pillow，CFHD 联网依赖 requests，Windows 另需 truststore 使用系统证书库（未关闭 TLS 验证）。可用 `python -m pip install Pillow requests truststore` 安装；APEX 官方原片截帧重建另需 ffmpeg / ffprobe。各脚本的源缓存保存在被忽略的 `local-only/weapon-skins/`，首次 live 同步需要联网。源失败时保留上次成功快照，离线重建不伪造新的来源核查时间。

```powershell
python -X utf8 scripts/sync_weapon_catalogs.py
python -X utf8 scripts/sync_weapon_curated.py --game delta-force
python -X utf8 scripts/sync_weapon_cod_pc.py
python -X utf8 scripts/enrich_weapon_cod_pc.py
python -X utf8 scripts/sync_weapon_apex.py
python -X utf8 scripts/sync_weapon_codm.py
python -X utf8 scripts/sync_weapon_codm_cn.py
python -X utf8 scripts/sync_weapon_cfm.py
python -X utf8 scripts/sync_weapon_cfhd.py
python scripts/build_weapon_manifest.py
node scripts/validate_weapon_skins.cjs
python -X utf8 scripts/test_weapon_codm_cn.py
python scripts/build_public_site.py
```

所有同步脚本支持 `--offline`；APEX 另支持 `--resume`，复用中断前 12 小时内的成功请求。CFM / CFHD / CODM 国服默认复用成功缓存，联网强制更新使用 `--refresh`。CFM `--index-only`、CODM 国服 `--discover-only` 只盘点索引；内容整理仍需读取正文。旧 `sync_weapon_crossfire.py` 入口转调两款独立脚本，不再覆盖扩充目录。旧精选脚本 `--game apex` 转调 APEX 同步器，`--game call-of-duty` 及默认端游任务转调新端游同步器，不会恢复成 1 条精选。

APEX 首次先运行主同步器联网建立基础目录，再运行 `sync_weapon_apex_art_indices.py` 采集 Wiki 文件、Item Store 附件与图库索引；其 `--refresh` 真正更新源站，`--offline --dry-run` 只验证既有缓存。各源有页数上限，完整遍历后才替换成功索引。

补图工具 `enrich_weapon_apex.py --apply`、`sync_weapon_apex_official.py --apply` 写入已核实素材证据，再运行主同步器 `--offline` 生成 ready 状态；两项补图工具均支持 `--offline`。首次采集不能以 `--offline` 替代联网。`build_apex_remaining_report.py` 生成逐项缺口报告。保留的补图与原作者媒体不会被主同步覆盖。

端游 `research_weapon_cod_bilibili.py` 只采集公开元数据，`enrich_weapon_cod_pc.py` 将已核合集及 `data/weapon-skins/cod-inspect-review.json` 中的审阅结论接入页面；两者支持 `--offline`。作者搜索接口返回 HTTP 412 后已停止该路径，未登录、签名绕行或转存平台原片。

校验包括各游戏稳定 ID、来源、日期、图片哈希、动作类型、URL 安全、独立模式计数、筛选、收藏和导出。公开构建还须验证压缩内容、ready 过滤、配图引用和容量；页面验收分别检查 CFM 动图、CFHD 图片与 MP4、CODM 图鉴和 APEX 缺图说明。

本地预览：`python -m http.server 4173 --bind 127.0.0.1`，访问 `http://127.0.0.1:4173/index.html#skins`。
