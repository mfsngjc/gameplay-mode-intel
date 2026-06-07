# 游戏玩法情报站 / Gameplay Mode Intel

一个用于整理、采集和复盘游戏玩法案例的静态资料站。

当前版本收录 Fortnite、PUBG、和平精英、Apex Legends、三角洲行动过往核心模式、限时变体与活动玩法案例，用来观察这些玩法如何改变胜利目标、战斗节奏、复活规则、地图空间、撤离收益、PvE 压力和特殊能力。

## 功能

- 以卡片形式展示玩法案例，按游戏切换（全部 / Fortnite / PUBG / 和平精英 / Apex / 三角洲行动）
- 按玩法类型筛选：核心玩法、限时/变体、特殊玩法（切游戏时标签自动适配）
- 游戏筛选（Tab Bar）与类型筛选（胶囊标签）可叠加使用
- 支持游戏级玩法时间画板；当前先启用三角洲行动玩法更新节点
- 展示玩法上线时间、官方图、核心规则、机制变化、节奏影响和设计观察
- 支持本地采集玩法卡片、生成分享图、导出 Markdown 和 Canvas

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

## 静态部署

这个项目可以直接部署为 GitHub Pages 静态页。

页面通过相对路径读取数据：

```text
data/modes.json
```

因此只要 `index.html`、`app.js`、`styles.css`、`data/` 和 `assets/` 一起提交到仓库，GitHub Pages 就可以正常显示玩法数据。

---

## 规范

### 玩法卡片数据结构

所有玩法数据集中存放在 `data/modes.json`，每个条目为一个 JSON 对象，字段如下：

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `id` | string | ✅ | 唯一标识，格式 `{game}-{mode-kebab-case}-{year}`，如 `pubg-intense-br-2023` |
| `game` | string | ✅ | 游戏名，用于游戏筛选，如 `"Fortnite"`、`"PUBG"`、`"和平精英"`、`"Apex Legends"`、`"三角洲行动"` |
| `modeName` | string | ✅ | 模式/玩法名称，作为卡片标题 |
| `year` | string | ✅ | 年份标注，显示在卡片右上角绿色徽章 |
| `date` | string | ✅ | 简化日期，用于分享图日期显示 |
| `tags` | string[] | ✅ | 筛选标签枚举数组，见下方标签系统 |
| `type` | string[] | ✅ | 中文类型标签，显示在卡片标签行 |
| `oneLineRule` | string | ✅ | 一句话规则描述，卡片摘要区 |
| `mechanicChange` | string | ✅ | 详细说明玩法机制上的改动 |
| `tempoImpact` | string | ✅ | 对游戏节奏的改变 |
| `designObservation` | string | ✅ | 通用可复用的设计洞见（最核心字段） |
| `aiCommentator` | string |  | 可选，设计观察署名；未填写时页面使用默认 AI 评论署名 |
| `sourceUrl` | string | ✅ | 官方来源链接，卡片底部「来源」按钮 |
| `imageUrl` | string | ✅ | 卡片顶部封面图 URL，优先使用官方公告头图 |
| `imageSource` | string | ✅ | 图片来源标注，显示在图片左下角，格式如 `"官方公告头图"` |
| `launchDate` | string | ✅ | 实际上线日期 ISO 8601，如 `"2023-01-17"` |
| `launchLabel` | string | ✅ | 上线时间中文显示标签，卡片蓝条 |
| `launchNote` | string | ✅ | 时间备注，验证上线时间的信息来源说明 |

### 标签系统

`tags` 字段使用 3 个枚举值，游戏级动态展示：

| tag 值 | 中文名称 | 含义 |
|--------|---------|------|
| `br-core` | 核心玩法 | 永久可玩的经典/核心模式，或长期作为游戏主轴存在的变体 |
| `br-ltm` | 限时/变体 | 限时开放、赛季化开放，或在核心框架上改变目标/资源/节奏的玩法变体 |
| `casual` | 特殊玩法 | 非标准对局框架（PvE、死斗、撤离、派对游戏、特殊联动、战役等） |

**动态筛选机制**：切游戏时，标签按钮自动更新——只显示当前游戏实际拥有的分类。「全部游戏」模式显示所有分类的并集。

一个模式可以携带一个标签。`type` 字段是中文标签的补充，用于更具体的归类（如 `"16 人"`、`"免搜刮出生装"`），显示在卡片的 tag row。

### UI 设计规范

**筛选器层级**：游戏筛选 + 类型筛选，双层叠加。

- **游戏筛选**：使用 **Tab Bar**（下划线指示器），选中态 = 蓝色文字 + 蓝色底线，无背景填充。对应 CSS class `.game-tabbar`，与下方的类型筛选保持 ≥18px 间距。
- **类型筛选**：使用 **胶囊按钮**（`border-radius: 999px`），选中态 = 黑色背景 + 白色文字。对应 CSS class `.filters button[data-filter]`。

**设计语言区分原则**：两个筛选器必须使用**不同的视觉语言**—— Tab Bar 是「线性轻量」风格（底线表达状态），胶囊标签是「实体重量」风格（填充表达状态）。禁止两者使用相同的选中文案/填充方案。

**卡片布局**：2 列 Grid (`grid-template-columns: repeat(2, minmax(0, 1fr))`)，移动端降为 1 列。卡片顶部图片 16:7 aspect ratio。

### 新增游戏/模式流程

1. 研究该游戏的 BR/LTM 模式，从官方公告、Wiki、补丁说明获取准确信息
2. 查阅 `data/modes.json` 确认现有条目，避免 id 重复
3. 按卡片数据结构逐条编写，特别关注 `designObservation` 字段的深度
4. 从官方公告页抓取图片 URL（优先 Krafton CDN / Unreal Engine CDN / Steam CDN），禁止使用推测路径。如果无法获取，将 `imageSource` 标注为占位并记录 TODO
5. `id` 命名规则：`{game-kebab}-{mode-kebab}-{year}`
6. 每新增一个游戏，同步更新 `.game-tabbar` 添加对应 Tab 按钮
7. 修改后重启本地服务器验证渲染效果

### 图片规范

> **⚠️ 硬性规则：禁止使用任何非官方渠道的图片。** 包括但不限于：TapTap 头图、百度百科/快懂百科、九游/4399/17173 等第三方游戏资讯站、个人博客/视频截图、小红书/抖音/B站用户上传图、任何存在水印的图片。图片必须来自以下认证渠道之一。

- **优先使用官方公告头图**（`og:image` 或页面首张 16:9 配图）
- 图片 URL 必须是可直接访问的 CDN 地址，不加 `?` 查询参数除非是缓存 bust
- 图片来源标注在卡片左下角，格式：`"官方公告头图"`、`"Steam 商店头图"` 等
- 若官方页面的文章配图无法直接抓取（如 JS 动态加载），使用该游戏官方主站 CDN 的视觉图，并在 `imageSource` 明确标注来源（如 `"gp.qq.com 官方主站 — 游戏模式主视觉"`）
- **绝对禁止**使用第三方来源的「脏图」作为占位或替代方案

**各游戏认证图片源：**

- **PUBG / Krafton**：
  - `wstatic-prod-boc.krafton.com` — 文章内容图片
  - `shared.akamai.steamstatic.com` — Steam 商店/库图片
  
- **Fortnite / Epic Games**：
  - `cdn2.unrealengine.com` — 官方公告图

- **和平精英 / 腾讯**：
  - `game.gtimg.cn/images/gp/` — gp.qq.com 官方 CDN（主站视觉、功能图）
  - `static.gametalk.qq.com/image/` — GameTalk CMS CDN（官方内容图）
  - `gp.qq.com/gicp/news/` — 官方公告页面（文章通常为纯文字，配图可能 JS 动态加载）

- **三角洲行动 / 腾讯**：
  - `df.qq.com` — 官方主站与玩法介绍页
  - `game.gtimg.cn/images/dfm/` — df.qq.com 官方玩法区图片 CDN
  - `steamcommunity.com/app/2507950` / `steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/` — Delta Force 官方 Steam 公告流（海外版本玩法更新、活动模式规则与配图）

- **Apex Legends / EA**：
  - `drop-assets.ea.com` — EA 官方 Key Art / News CDN，支持 CORS（当前 Apex 默认图来源）
  - `shared.akamai.steamstatic.com` — Steam 商店截图（通用游戏画面，非模式专属）
  - ~~`apexlegends.wiki.gg/images/`~~ — 已不可用：2026 年 5 月起 Cloudflare 返回 403 + `cross-origin-resource-policy: same-origin`，浏览器无法加载
  - ~~`apexlegends.fandom.com`~~ — 同样受 Cloudflare 保护，且 Gamepedia 迁移后图片路径全部失效

> **Apex 图片现状（2026-05）**：wiki.gg / Fandom / EA 官方新闻页均无法获取各模式的专属图标或头图。当前 18 个 Apex 模式统一使用 EA drop-assets.ea.com 的 Generic Keyart（16:9），图片源标注 `"EA Official — Apex Legends Generic Keyart"`。若后续发现可访问的模式专属图源，再逐一替换。

### 同步脚本

`scripts/sync_fortnite.py` 是本地同步脚本雏形，用于辅助抓取 Fortnite 官方公告信息。GitHub Pages 不会运行这个脚本，数据更新后需要重新提交到仓库。

---

## 后续规划

### 玩法排期图（Mode Release Timeline）

基于各个游戏的玩法上线节奏，输出一张可视化排期图：

- **横轴**：时间（按年份/季度/月度），覆盖每款游戏从首发到当前版本的完整生命周期
- **纵轴**：按游戏分轨（Fortnite / PUBG / 和平精英 / Apex Legends / 三角洲行动）
- **节点大小**：玩法规模权重 — 核心模式（常驻 BR 变体）> 大型 LTM（独立规则 + 专属地图/资产）> 小型活动（参数微调 / 限时返场）
- **节点颜色/形状**：玩法母题分类（复活规则 / 胜利条件 / PvE 威胁 / 移动空间 / 特殊能力 / 联动活动）

目标：一眼看出每款游戏在什么时间点做了什么类型的玩法、全年节奏是否有「玩法空缺」、哪些季度是集中爆发期 vs 维护静默期。

### 年度玩法运营复盘

对每款游戏按年份拉片分析：

- **玩法产出量**：每年新上线模式数量 vs 返场复用数量
- **母题分布**：这一年主攻了哪几类设计方向（比如今年重点搞复活变体、明年开始大量 PvE）
- **复用策略**：哪些模式从 LTM 升格为常驻？哪些直接放弃？哪些每年固定返场形成「赛季传统」？
- **覆盖逻辑**：全年 12 个月是否有玩法空白期？节假日/赛季末/过渡期靠什么内容填坑？
- **可持续思路**：观察每款游戏的「玩法工具体系」— 是否建立了可组合的玩法组件（Fortnite 的 UEFN 编辑器、Apex 的 Mixtape 轮换框架），还是每次从零搭一个新模式

这份复盘的目标是提炼一套**泛 BR 游戏玩法运营方法论**：如何用有限的母题组合 + 参数调校，持续产出差异化的玩法内容，覆盖全年不同时间段的玩家活跃需求。

---

## 数据维护

后续更新其他游戏时，会继续把每个玩法整理成结构化字段，包括：

- 游戏名
- 玩法名
- 上线时间
- 玩法类型
- 一句话规则
- 机制变化
- 节奏影响
- 设计观察
- 来源链接
- 官方图片
