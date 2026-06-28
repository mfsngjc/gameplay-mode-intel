# 游戏玩法情报站 / Gameplay Mode Intel

一个用于整理、采集和复盘游戏玩法案例的静态资料站。当前重点追踪 BR、撤离、团队竞技和活动模式如何改变胜利目标、战斗节奏、复活规则、地图空间、PvE 压力、撤离收益和特殊能力。

页面是纯静态实现：`index.html` 负责结构，`styles.css` 负责视觉，`app.js` 负责筛选、采集、导出和分享图生成，玩法数据集中存放在 `data/modes.json`。

## 当前数据快照

快照日期：2026-06-28。

| 游戏 | 案例数 | 时间范围 |
|------|------:|----------|
| Apex Legends | 30 | 2019-02-04 至 2026-06-02 |
| Fortnite | 29 | 2017-12-08 至 2026-04-20 |
| PUBG | 18 | 2017-03-23 至 2026-07-01 |
| 三角洲行动 | 27 | 2024-09-26 至 2026-06-05 |
| 和平精英 | 18 | 2019-05-08 至 2026-04-14 |

合计：122 个玩法案例。

标签分布：

| 标签 | 含义 | 数量 |
|------|------|-----:|
| `br-core` | 核心玩法 | 12 |
| `br-ltm` | 限时/变体 | 66 |
| `casual` | 特殊玩法 | 44 |

## 功能

- 首页展示「最新动态」信息流，支持全部动态、最近更新、即将上线、玩法变体四种视角。
- 玩法案例以卡片形式展示，支持游戏筛选和玩法类型筛选叠加使用。
- 每张卡片展示上线时间、官方图片、核心规则、机制变化、节奏影响、时间备注和设计观察。
- 支持游戏级玩法时间画板；普通游戏按核心/限时/特殊分轨，三角洲行动额外细分大战场、搜打撤和双模式类 LTM。
- 支持在当前浏览器本地采集案例，采集状态保存在 `localStorage`。
- 支持复制单张卡片 Markdown、下载单张卡片 Markdown、打开分享弹窗并生成 PNG 分享图。
- 支持按当前筛选导出 Obsidian Canvas，支持导出已采集案例的 Markdown 合集。

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

部署时确保以下文件一起提交：

- `index.html`
- `app.js`
- `styles.css`
- `data/modes.json`
- `assets/`

`scripts/` 目录只用于本地辅助采集，GitHub Pages 不会执行其中脚本。

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
| `tags` | string[] | 是 | 筛选标签枚举数组，见下方标签系统 |
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

## 标签系统

`tags` 字段使用 3 个枚举值。切换游戏时，页面只显示当前游戏实际拥有的标签；「全部游戏」模式显示所有分类的并集。

| tag 值 | 中文名称 | 含义 |
|--------|---------|------|
| `br-core` | 核心玩法 | 永久可玩的经典/核心模式，或长期作为游戏主轴存在的变体 |
| `br-ltm` | 限时/变体 | 限时开放、赛季化开放，或在核心框架上改变目标、资源、节奏的玩法变体 |
| `casual` | 特殊玩法 | 非标准对局框架，包括 PvE、死斗、撤离、派对游戏、特殊联动、战役等 |

一个模式通常只携带一个 `tags` 标签。`type` 字段用于补充更细的中文分类，如 `"16 人"`、`"免搜刮出生装"`、`"PvE"`。

## 维护流程

新增或更新玩法时，优先按这个顺序处理：

1. 从官方公告、补丁说明、官网玩法页、Steam 官方公告或官方社区帖子确认规则和上线时间。
2. 查阅 `data/modes.json`，确认没有重复 `id`，也没有同一玩法的重复收录。
3. 按数据结构补全字段，尤其是 `launchDate`、`launchNote`、`mechanicChange`、`tempoImpact` 和 `designObservation`。
4. 只使用官方图片源，优先取 `og:image`、官方公告头图或官方 CDN 图片。
5. 新增游戏时，同步更新 `index.html` 里的游戏 Tab；如果需要新的筛选或特殊时间线规则，再更新 `app.js`。
6. 启动本地服务器，验证首页动态、筛选、时间画板、卡片图片、分享图、Markdown 导出和 Canvas 导出。

常用校验命令：

```bash
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
