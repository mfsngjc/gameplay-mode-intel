# 堡垒之夜战术道具专题

2026-10-11 完成首批 8 项机制与媒体详录；2026-10-12 按用户要求将扩展清单 136 项全部接入独立「主题道具」页签（`#items`）。这些对象不再显示在玩法模式、动态和时间画板中，也不计入新模式。

## 目录与详录分层

- `data/tactical-items.json` 是独立对象目录，136 项分为 14 个功能分类；按道具与功能装备、载具与炮台、场景交互物、创意模式道具筛选。
- `publicationStatus: ready` 在此数据中表示用户已选择收录的目录项可以展示，不表示版本/媒体研究完成。`researchStatus: catalogued` 的 128 项已含名称、英文名、外观配图、机制摘要、资料入口；详情明示参数、日期、视频和操作过程截图待补。3 项仅有社区资料入口，额外标记待官方复核。
- `researchStatus: documented` 的 8 项通过 `coreUpdateIds` 引用已有历史版本。每个对象可以关联多版资料。版本原始记录与图片来源仍保存在 `data/core-updates.json` 和原有账本，不复制或删改历史事实。
- 基础更新的 `ready`、官方图片与日期证据要求保持不变；目录项不得伪装成已完成的基础更新，不使用生成图；主题道具目录的社区补图仅遵守下述用户授权例外。
- `legacyIds` 将旧版本详情链接和本地收藏迁移到稳定的对象 ID。原 `#modes?game=Fortnite&content=core_update&q=战术道具` 入口自动转到新页。
- 全部 136 项可搜索、分类、收藏和导出；默认展示 24 项，每次继续加载 24 项，导出包含全部筛选结果。中英文名、说明性译名、躲猫猫/位移等词和 Driftboard 的 dashboard 别名可检索。

## 道具图片

2026-10-12 为全部 136 项补齐可辨认图片：124 项取自 Epic / Fortnite 官方公告及开发文档，12 项使用有出处的社区资料。共归档 128 张独立原图（部分官方合照由多个道具共用），全部保留原始比例和字节，不裁切、不生成替代图。

用户授权为「接受，仅用于官方缺图的条目」。适用范围限定为此目录；模式封面和基础体验更新的官方图片要求保持不变。社区图片只补足外观识别，不作为数值、发布日期、机制详录已核验的依据。已收录图片不改变 8 项详录 / 128 项待补的研究状态。

`items[].image` 保存本地 `path`、`sourceType`（official / community）、`sourceName`、`sourcePageUrl`、`assetSourceUrl`、图片类型 `kind`、图注、替代文本、尺寸、SHA-256 与获取日期。社区图片另存 `officialImageGap`、`officialSourcesChecked`。官方文档的原始 CDN 地址依据页面内 `storage_key` 和 `file_name` 元数据核实；原缩放代理地址保存在 `embeddedUrl`。

- 卡片、列表缩略图和详情直接显示图片；详情可打开原图和来源页。社区来源在卡片与详情中显式标记。
- 合照注明目标位置；道具族注明图示变体。现实种子图明确标为种植后的树苗，不用赛季通用头图代替无法识别的道具。
- Markdown / Canvas 导出包含原始远程图片、图注、来源性质及来源页；网站使用本地原图，减少防盗链影响。
- 图片加载失败时显示可读提示，保留条目和出处。图片为延迟加载，避免首页同时请求全部原图。

社区补图清单：

| 道具 | 图片出处 | 官方图片缺口 |
|---|---|---|
| 场景伪装枪 Prop-O-Matic | [Everyeye](https://www.everyeye.it/notizie/fortnite-scoperta-arma-prop-o-matic-arrivo-modalita-prop-hunt-382689.html) | 官方 v9.30 公告只有 Prop Hunt 主题图，没有可辨认的枪体图片。 |
| 诱饵分身手雷 Decoy | [Fortnite.GS 社区数据库](https://fortnite.gs/items/decoy/) | 已查阅官方资料，暂未找到可辨认的独立道具图。 |
| 暗影石 Shadow Stone | [PC Gamer](https://www.pcgamer.com/fortnite-shadow-stone-locations/) | 官方 v6.00 公告的配图为大型魔方主题图，未清晰展示可拾取的暗影石。 |
| 筋斗云 Nimbus Cloud (Kintoun) | [Eurogamer](https://www.eurogamer.de/fortnite-jindujun-kintoun-finden) | 官方联动公告的玩法配图实际展示龟派气功，未清晰呈现筋斗云道具。 |
| 小型缓冲气垫 Crash Pad Jr. | [Fortnite.GS 社区数据库](https://fortnite.gs/items/crash-pad-jr/) | 已查阅官方资料，暂未找到可辨认的独立道具图。 |
| 暗影追踪手枪 Shadow Tracker | [Sportskeeda](https://www.sportskeeda.com/fortnite/where-find-exotic-weapons-fortnite-chapter-3-season-4) | 官方 Tracker’s Armory 配图仅有强化技能的白色剪影，无法辨认枪体外观。 |
| 治疗水炮 Chug Cannon | [Inven Global](https://www.invenglobal.com/articles/15081/fortnite-season-8-weapon-tier-list) | 官方 v24.40 创意模式公告介绍该道具，但配图为通用主题图。 |
| 浮力气泡饮 FlowBerry Fizz | [Fortnite.GS 社区数据库](https://fortnite.gs/items/flowberry-fizz/) | 已查阅官方资料，暂未找到可辨认的独立道具图。 |
| 猎人披风 Hunter’s Cloak | [Fortnite.GS 社区数据库](https://fortnite.gs/items/hunter-s-cloak/) | 已查阅官方资料，暂未找到可辨认的独立道具图。 |
| 间歇泉 Geyser | [GamesRadar+](https://www.gamesradar.com/fortnite-geysers/) | 已查阅官方资料，暂未找到可辨认的独立道具图。 |
| 火山喷气口 Volcanic Vent | [Millenium](https://us.millenium.gg/guide/66.html) | 已查阅官方资料，暂未找到可辨认的独立道具图。 |
| 变装电话亭 Disguise Booth | [PC Gamer](https://www.pcgamer.com/fortnite-phone-booth-locations/) | 已查阅官方资料，暂未找到可辨认的独立道具图。 |

## 首批 8 项版本依据

| 道具 | 本条规则版本 | 官方机制来源 |
|---|---|---|
| 漂移滑板 Driftboard | v7.40 内容更新 | https://www.fortnite.com/patch-notes/v7-40-content-update |
| 女巫扫帚 Witch Broom | v26.30，2023 万圣节返场 | https://www.fortnite.com/news/fortnitemares-2023-dawns-in-the-fortnite-battle-royale-v26-30-update |
| 海盗炮 Pirate Cannon | v8.00 | https://www.fortnite.com/patch-notes/v8-00 |
| 随身裂隙 Rift-To-Go | v5.30 | https://www.fortnite.com/patch-notes/v5-30 |
| 冲击波手雷 Shockwave Grenade | v5.30 内容更新 | https://www.fortnite.com/patch-notes/v5-30-content-update |
| 抓钩枪 Grappler | v5.40 | https://www.fortnite.com/patch-notes/v5-40 |
| 便携堡垒 Port-a-Fort | v3.5 | https://www.fortnite.com/news/v3-5-patch-notes |
| 升空气球 Balloons | v6.21，首发持握版本 | https://www.fortnite.com/patch-notes/v6-21 |

每条的 `tacticalProfile` 保存原名、定位、操作、效果、获取、限制和参数。`videos` 保存 YouTube 直链、频道、发布时间、版本、观看重点及校验备注；全部通过 YouTube oEmbed 检查。共 10 个视频链接，视频属于演示资料，数值仍以官方补丁为准。

`evidenceLinks` 单独保存机制与日期来源；`screenshots` 记录官方视频帧的本地路径、视频时间点、说明、捕获日期与 SHA-256。封面为 7 张 Epic 公告图和 1 张 Fortnite 官方视频封面；均不是游戏实机截图。已收录 6 张官方视频截图，独立展示，不冒充公告原图。扫帚和海盗炮暂未取得可核实的官方操作截图，页面保留明确缺口说明，并提供官方配图与对应版本的视频链接。首批详录中的第三方实机视频仍仅提供链接；后续目录的社区外观图片按上面的限定授权补充。

## 边界与未闭合范围

- 136 项是本轮选定的历史对象/道具族目录，不是 Fortnite 全道具全集；8 项详录不等于其所在补丁的全部基础更新已完成。
- 具体原文小节、已收录 ID、同页待处理内容及下一批候选写入 `data/core-update-source-coverage.json`。模式覆盖台账不因本轮新增基础更新而改变。
- 海盗炮公告日为 2019-02-27；第 8 赛季上线公告为 2019-02-28。两者分别记录。
- 便携堡垒补丁日与官方视频发布时间相差一天；不以可能后改的视频简介倒推首次上线，精确生效日保留待核实。
- 漂移板大战的自动回血不套用到普通 BR；气球只写首发的 20 个／同时 6 个，不混入后续背部附着版本；抓钩只写本版 15 次。
- 中文名使用说明性译法；未确认的冷却、高度、半径、射程等明确留空缺，不推测。
- 本地页面和公开构建产物于 2026-10-12 接入；2026-10-16 按用户明确的「上传」指令提交发布。

## 校验

运行 `node scripts/validate_tactical_items.cjs`、`node scripts/validate_core_updates.cjs`、`node scripts/validate_taxonomy.cjs`、`node scripts/validate_ff_patches.cjs` 和 `python3 scripts/build_public_site.py`。基础更新校验同时覆盖官方图哈希、视频链接、截图来源、专题检索、收藏和 Markdown／Canvas 导出。


道具校验覆盖 136 项去重与图片完整性、124 / 12 图片来源划分、原图 SHA-256、来源域名与缺图依据、14 个分类、8 个版本关联、128 项待补状态、3 项社区机制来源标记，以及模式隔离、旧收藏迁移、检索、分页、筛选参数、详情媒体与 Markdown/Canvas 导出。浏览器补查旧入口跳转、道具收藏、创意模式范围、已有截图加载、手机布局与空结果。

2026-10-12 图片补齐验证：136 项图片均能解码，尺寸与 SHA-256 一致，公开构建完整包含 128 张独立图片。浏览器检查卡片、列表缩略图、点击图片进入详情、社区出处标记及合照定位；390px 手机宽度下无横向溢出。图片仍不代表逐版本机制研究完成。


## 2026-10-25：全目录演示短片

用户选择“真实实机素材剪辑”，并要求继续完成全部条目。本次为 136 项各加一段本地 MP4 和从该段视频提取的封面；逐项对照原片与剪辑帧审核，保留作者、原片标题、原片发布时间、起止秒数、画面类型、演示版本、文件哈希和真实审核时间。原片发布时间不作为道具上线日。官方游戏画面演示与社区实机操作明确区分；转载官方预告的社区频道仍记为社区视频来源。

详情页在名称和机制摘要后直接显示短片，支持原生暂停、拖动、全屏，以及半速、重播、后退一秒、循环播放；不自动播放，点击后加载，关闭详情或切换页面时暂停。视频移除声音，页面注明“无声片段”，保留观看原片的入口。原有外观图和图片出处收进“道具外观与图片出处”，已有官方视频、历史详录和截图继续保留。Markdown / Canvas 导出包含短片链接和出处。

每段通常约 10—15 秒，少数动作完整但原片较短的节选为 8—9 秒。画面类型使用 `gameplay`（实机操作）或 `in_engine_demo`（游戏内演示）；后者包括官方游戏内镜头和有出处的预告节选，不冒充玩家本人录屏。社区片段不声称为本站自录或官方授权素材。群魔乱舞中的悬浮喷气装置单列模式范围；首发气球继续使用持握版本；其余片段不把某一变体的操作、原片中的数值和当前赛季可用性泛化到整个道具族。

`items[].clips[]` 保存：`id`、`title`、`path`、`posterPath`、`caption`、`footageKind`、`sourceType`、`sourceName`、`sourceUrl`、`sourceTitle`、`sourceChannelUrl`、`sourcePublishedAt`、`sourceDurationSeconds`、`sourceStartSeconds`、`sourceEndSeconds`、`durationSeconds`、`versionLabel`、尺寸/编码/帧率/声音标记、视频与封面 SHA-256、封面取帧时间、`capturedAt`、`reviewedAt`、`reviewedBy`。`clipPolicy` 仅说明短片覆盖，不改变 `researchStatus`：仍为 8 项历史详录、128 项待逐版本核对。

下载原片、搜索候选、剪辑草稿和主代理验收回执保留在被忽略的 `local-only/item-demo-research/`，公开构建只复制已验收的 `assets/tactical-demos/` 与条目元数据。页面没有面向开发者的审核状态筛选。

运行 `node scripts/validate_tactical_items.cjs` 检查 136 段元数据、来源、审核时间、272 个资源哈希、MP4 快速起播结构及页面/导出；运行 `python scripts/validate_tactical_clips.py`（需 ffmpeg、ffprobe 在 PATH 中，或用同名参数指定路径）逐段检查真实编码、时长、尺寸、无声轨并完整解码。浏览器另验播放、半速、循环、关闭暂停和手机布局。
