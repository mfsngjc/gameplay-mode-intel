# 集成农业 · 射击玩法研究库

面向射击游戏设计的静态研究资料库，公开「玩法模式」与「地图」。采用固定导航、统一搜索、可筛选的卡片/列表与来源详情。玩法机制、关卡机制暂存为本地草稿，等待整理后再开放。

## 当前内容

截至本次页面改版（2026-09-06），保留原有 148 个模式案例，覆盖 5 款游戏；另收录国服官方地图工具公开列出的 20 张三角洲地图底图（6 张烽火地带、14 张全面战场）。原有 6 张玩法机制卡和 6 张关卡机制卡暂存本地，不加载、不公开发布。

| 游戏 | 原有模式案例 |
|------|-----------:|
| Fortnite | 32 |
| PUBG | 22 |
| 和平精英 | 24 |
| Apex Legends | 33 |
| 三角洲行动 | 37 |

## 页面结构

- 玩法模式：合并原“发现玩法”后的首页，直接浏览全部模式案例，提供推荐顺序、全文搜索、核心玩法/游戏/主题/LTM 标签筛选及排序；完整拆解收进详情。
- 地图：按游戏归档，目前收录三角洲行动地图；按烽火地带、全面战场筛选，支持中文搜索、放大预览、单图与合集下载，以及站内本地互动地图入口。互动地图保留官方点位筛选、搜索定位、楼层切换、难度／特殊事件、全面战场 PC／移动端、攻防／占领和区域阶段切换。黑鹰坠落暂无已核实的公开底图。
- 玩法机制、关卡机制：暂停公开；原稿保存在被 Git 忽略的 `local-only/research.json`。旧栏目地址回到模式首页。
- 玩法动态：按案例上线时间排列，提供近 30 天、即将上线、LTM 限时模式筛选；不将上线日期冒充收录日期。
- 时间画板：按游戏与六种核心玩法分轨；LTM 标在节点上，与同类核心模式共用轨道。
- 我的收藏：兼容原有浏览器收藏标识，支持玩法模式收藏；既有草稿收藏标识保留在浏览器，但不显示或导出未公开内容。

详情支持 Markdown 复制、PNG 分享与来源跳转；顶部可导出当前筛选的 Obsidian Canvas，或收藏的 Markdown 合集。支持分页加载、空结果提示、缺图回退、移动端导航、键盘操作与详情深链接。

## 实现与数据维护

- index.html：页面外壳、模式库与地图入口、详情容器，内含 Lucide 图标符号。
- workspace.css：新版研究工作台排版；styles.css 保留时间画板和分享组件的基础样式。
- workspace.js：导航、搜索、过滤、卡片、详情、资料关联与响应式交互。
- app.js：原有日期处理、游戏时间画板、收藏与导出/分享工具。
- data/modes.json：保留原有案例内容与标识，新增 gameplayTypes 和 isLtm 分类字段。
- data/maps.json：游戏（`game`）、地图名称、模式、官方来源、切片地址和本地图片路径；后续可添加其他游戏。
- maps.js：地图筛选、预览、缩放、下载与本地互动地图弹层。
- assets/maps/delta-interactive/：官方公开地图工具的本地静态快照、点位数据、图标、楼层配置和底图切片；`local-adapter.js` 负责本地路径、键盘操作、返回入口和缺失图标兜底。
- local-only/research.json：未公开设计提炼草稿，通过 sourceModeIds 关联原案例；禁止放入公开数据目录。

本地 research.json 中的 kind 为 mechanics 或 levels；每条资料包含独立 id、modeName、coverHeadline、sourceModeIds、topics、type、oneLineRule、designObservation、createdAt、provenance 和 reviewStatus。原案例的游戏、机制依据、节奏影响、图片和来源由关联记录提供。新增卡片时必须确保所有 sourceModeIds 都存在。

后续接入 AI 任务时应另行记录采集时间、执行结果和审阅状态，不应根据案例的上线日期推断任务成功。详细布局说明见 [研究工作台排版](docs/research-workspace.md)。

## 本地运行

不要直接打开 `index.html`，因为浏览器的 `file://` 模式无法读取 `data/modes.json`。

在 macOS 上可以双击：

```text
start.command
```

默认地址：

```text
http://127.0.0.1:4173/index.html
```

停止本地服务器：

```text
stop.command
```

也可以在终端指定端口：

```bash
PORT=5173 ./start.command
PORT=5173 ./stop.command
```

## 静态部署

项目可以直接部署为 GitHub Pages 静态页。页面通过相对路径读取：

```text
data/modes.json
```

发布通过 `python3 scripts/build_public_site.py` 构建 `_site/`，GitHub Pages 工作流仅上传此目录。脚本使用明确的公开文件白名单，排除本地草稿、采集草稿、文档及开发脚本。不要将整个项目目录作为部署产物。

`local-only/` 已加入 `.gitignore`，其中的机制与关卡草稿不应加入 Git 或公共网站。页面不请求这些文件，搜索、关联、收藏导出也不会包含它们。本地维护的副本不因此删除。

## 三角洲地图资料

核查日期：2026-09-06。来源：[国服官方地图工具](https://df.qq.com/cp/a20240729directory/)。当前归档覆盖官方工具公开列出的 6 张烽火地带地表图与 14 张全面战场 PC 攻防底图；黑鹰坠落战役暂未找到公开底图。地图名称沿用国服工具，AZ3 补充“核电站”便于理解。

`assets/maps/delta-force/` 保存 2048 × 2048 JPEG 底图与 512 × 512 缩略图，`assets/maps/delta-force-maps.zip` 提供合集及来源说明。图片由官方公开的 zoom-3 切片按原坐标拼接，未增改地形或点位。它们是二维参考图，不是 3D 模型、编辑器工程或可导入游戏的关卡文件。

每张底图保留专属官方地图链接。互动地图使用本地快照，最高层级使用官方原始切片，较低层级由本地生成；官方工具本身缺少的 24 张潮汐监狱边界切片保留为空白。归档不声称包含当前赛季的实时点位，版权归腾讯所有。

互动资源重建由 `scripts/package_delta_interactive.py` 完成。它读取被 Git 忽略的 `local-only/delta-official-source/` 与 `local-only/delta-layers.json`，将文件复制到公开资源目录并生成低层级切片索引；重新抓取官方资源时应先更新本地缓存，再运行打包脚本。

需要重建归档时安装 Pillow 后运行 `python3 scripts/archive_delta_maps.py`；已有图片默认跳过以避免重复请求。只有明确核实来源更新后才替换对应图片，并更新核查日期。

## 项目结构

```text
.
├── index.html                  # 页面结构与静态入口
├── app.js                      # 数据加载、筛选、时间画板、采集、导出、分享图
├── styles.css                  # 页面视觉与响应式布局
├── data/
│   ├── modes.json              # 玩法案例数据源，顶层为 JSON 数组
│   └── fortnite-sync-draft.json # Fortnite 同步脚本输出草稿
├── scripts/
│   └── sync_fortnite.py        # 抓取 Fortnite 官方页面 meta 信息的本地脚本
├── assets/                     # favicon 与本地图片素材
├── start.command               # 启动本地静态服务器
└── stop.command                # 停止本地静态服务器
```

## 数据结构

所有玩法数据集中存放在 `data/modes.json`，顶层是数组，每个条目是一个玩法对象。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `id` | string | 是 | 唯一标识，格式 `{game}-{mode-kebab-case}-{year}`，如 `pubg-intense-br-2023` |
| `game` | string | 是 | 游戏名，用于游戏筛选，如 `"Fortnite"`、`"PUBG"`、`"和平精英"`、`"Apex Legends"`、`"三角洲行动"` |
| `modeName` | string | 是 | 模式/玩法名称，作为卡片标题 |
| `year` | string | 是 | 年份标注，显示在卡片右上角 |
| `date` | string | 是 | 简化日期，用于分享图日期显示 |
| `gameplayTypes` | string[] | 是 | 核心玩法枚举数组，首项为主要归属，见下方分类系统 |
| `isLtm` | boolean | 是 | 该案例是否标为限时模式；独立于核心玩法 |
| `tags` | string[] | 是 | 原有标签，保留供兼容；不再作为核心玩法或 LTM 的判断依据 |
| `type` | string[] | 是 | 中文类型标签，显示在卡片标签行 |
| `oneLineRule` | string | 是 | 一句话规则描述，卡片摘要区 |
| `mechanicChange` | string | 是 | 玩法机制变化 |
| `tempoImpact` | string | 是 | 对游戏节奏、行动路径、风险收益的影响 |
| `designObservation` | string | 是 | 通用可复用的设计洞见，最核心字段 |
| `aiCommentator` | string | 否 | 设计观察署名；未填写时页面使用默认 AI 评论署名 |
| `sourceUrl` | string | 是 | 官方来源链接，卡片底部「来源」按钮使用 |
| `imageUrl` | string | 是 | 卡片顶部封面图 URL，优先使用官方公告头图 |
| `imageSource` | string | 是 | 图片来源标注，显示在图片左下角，如 `"官方公告头图"` |
| `launchDate` | string | 是 | 实际上线日期 ISO 8601，如 `"2023-01-17"` |
| `launchLabel` | string | 是 | 上线时间中文显示标签，卡片蓝条使用 |
| `launchNote` | string | 是 | 时间备注，用于说明上线时间的验证来源 |

## 核心玩法与 LTM 标签

核心玩法回答「对局以什么循环组织」，LTM 回答「这个案例是否属于限时模式」。两者分开保存与筛选。

| gameplayTypes 值 | 页面名称 | 归类依据 |
|-----------------|----------|----------|
| `br` | BR（大逃杀） | 大逃杀框架及沿用该框架的变体 |
| `warfare` | 大战场 | 大规模阵营交战、前线推进、攻防与载具战 |
| `bomb` | 爆破模式 | 回合制安装、守护或拆除目标 |
| `extraction` | 搜打撤 | 入局搜集、承担损失风险、带出收益 |
| `pve` | PVE | 以对抗 AI 敌人、合作任务或战役为主 |
| `casual` | 其他（休闲） | 不属于上述框架的死斗、枪械竞赛、派对与训练玩法 |

BR 中同时收录核心 BR 和限时 BR。例如 Reload、Zero Build 与 Floor is Lava 同在 BR 下，Floor is Lava 额外显示 LTM。选择「BR（大逃杀）」浏览全部 BR，再将「模式标签」设为「LTM（限时模式）」可只看限时 BR。

```json
{
  "gameplayTypes": ["br"],
  "isLtm": true
}
```

`isLtm` 针对案例所记录的模式版本，不表示今天仍然开放。`false` 表示未标为 LTM，不代表已确认永久开放。普通地图更新、测试招募、限时奖励活动本身不自动等于限时模式。原 `br-ltm` 混有常规变体，不能直接当成新的 LTM 判断条件。

含 PvE 元素的 BR 仍归 BR；搜打撤中的怪物或 Boss 不改变其搜打撤归属。模式内的新规则与地图更新跟随所属核心玩法。确实同时作用于多个模式的案例可有多个归属，例如三角洲夜战属于大战场与搜打撤；筛选结果按 id 去重，总数不重复计算。时间画板按数组首项归属展示一次，因此分轨数量可与多归属筛选数量不同。

玩法机制、关卡机制继承关联原案例的核心玩法，用于交叉检索；分析卡本身不标 LTM。`type` 继续补充规则细节，例如「16 人」「自动复活」「高地争夺」。

核心玩法和 LTM 筛选可由链接恢复，例如 `#modes?gameplay=br&tag=ltm`；打开或关闭详情会保留这两项筛选。

## 维护流程

展示文字以简体中文为主。模式标题使用「中文（英文原名）」；道具、地点与能力先说明含义和用途，再保留必要的原名。没有核实的官方中文名采用说明性译法，未知效果与不同版本的规则分别注明。翻译展示文字时保留 `id`、`game`、来源链接、分类和关联关系。

2026-09-06 已逐条检查全部 148 个模式，修订 140 条中文内容，并同步整理关联研究卡。覆盖范围、已核对的规则修正与待核实项目见 [中文可读性核查记录](docs/chinese-readability-review-2026-09-06.md)。

新增或更新玩法时，优先按这个顺序处理：

1. 从官方公告、补丁说明、官网玩法页、Steam 官方公告或官方社区帖子确认规则和上线时间。
2. 查阅 `data/modes.json`，确认没有重复 `id`，也没有同一玩法的重复收录。
3. 按数据结构补全字段，尤其是 `gameplayTypes`、`isLtm`、`launchDate`、`launchNote`、`mechanicChange`、`tempoImpact` 和 `designObservation`。
4. 只使用官方图片源，优先取 `og:image`、官方公告头图或官方 CDN 图片。
5. 核心玩法与游戏计数根据数据自动生成；先确认主要玩法，再单独判断是否为 LTM，不按游戏名称或旧标签猜测。
6. 启动本地服务器，验证首页动态、筛选、时间画板、卡片图片、分享图、Markdown 导出和 Canvas 导出。

常用校验命令：

```bash
node scripts/validate_taxonomy.cjs
jq 'length' data/modes.json
jq -r '.[].id' data/modes.json | sort | uniq -d
jq 'map(select(.launchDate == null or .launchLabel == null or .sourceUrl == null or .imageUrl == null)) | length' data/modes.json
jq 'group_by(.game) | map({game: .[0].game, count: length})' data/modes.json
```

## 图片规范

硬性规则：禁止使用任何非官方渠道的图片，包括第三方游戏资讯站、百科站、个人博客、视频截图、用户上传图和带水印图片。

优先级：

1. 官方公告头图，通常来自 `og:image` 或文章首张 16:9 配图。
2. 官方主站、官方活动页或官方 CDN 的视觉图。
3. Steam 官方商店、Steam 官方公告流或平台方官方素材。

图片 URL 应该是可直接访问的 CDN 地址，不加查询参数，除非确实需要缓存控制。无法确认来源时，不要用作正式封面图。

已认证图片源：

| 游戏 | 可用来源 |
|------|----------|
| PUBG / Krafton | `wstatic-prod-boc.krafton.com`、`shared.akamai.steamstatic.com` |
| Fortnite / Epic Games | `cdn2.unrealengine.com` |
| 和平精英 / 腾讯 | `game.gtimg.cn/images/gp/`、`static.gametalk.qq.com/image/`、`gp.qq.com/gicp/news/` |
| 三角洲行动 / 腾讯 | `df.qq.com`、`game.gtimg.cn/images/dfm/`、`steamcommunity.com/app/2507950`、`steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/` |
| Apex Legends / EA | `drop-assets.ea.com`、`shared.akamai.steamstatic.com` |

Apex 图片现状：截至 2026-05，wiki.gg、Fandom 和部分 EA 新闻页无法稳定获取各模式专属图标或头图。当前 Apex 多个模式使用 EA `drop-assets.ea.com` 的 Generic Keyart，图片源标注为 `"EA Official — Apex Legends Generic Keyart"`。后续如果发现可访问的官方模式专属图源，再逐一替换。

## 同步脚本

`scripts/sync_fortnite.py` 是本地同步脚本雏形，用于抓取来源页面的标题、描述和 Open Graph 图片，并写入审阅草稿。脚本当前以 Fortnite 官方页为主要使用场景，但默认会读取 `data/modes.json` 中已有的 `sourceUrl`：

```bash
python3 scripts/sync_fortnite.py
python3 scripts/sync_fortnite.py --url "https://www.fortnite.com/news/..."
```

默认输出：

```text
data/fortnite-sync-draft.json
```

脚本不会自动改写 `data/modes.json`。草稿需要人工或 Codex 审阅后，再整理成正式玩法卡片。

## 后续规划

- 继续补齐各游戏 2026 年玩法节点，并区分新模式、返场和规则微调。
- 扩展玩法时间画板：支持按年度、季度、玩法母题和游戏分轨进行更强的对比。
- 做年度玩法运营复盘：统计新模式数量、返场比例、母题分布、空窗期和节假日填充策略。
- 为数据维护补充自动化检查：重复 `id`、缺失字段、非官方图片域名、不可访问来源链接。
- 将导出的 Markdown 和 Canvas 更好地接入 Obsidian 玩法研究工作流。
