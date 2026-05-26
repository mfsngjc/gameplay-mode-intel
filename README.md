# 游戏玩法情报站 / Gameplay Mode Intel

一个用于整理、采集和复盘游戏玩法案例的静态资料站。

当前版本收录 Fortnite、PUBG、和平精英、Apex Legends 过往 Battle Royale / LTM / 活动模式案例，用来观察这些玩法如何改变胜利目标、战斗节奏、复活规则、地图空间、PvE 压力和特殊能力。

## 功能

- 以卡片形式展示玩法案例，按游戏切换（全部 / Fortnite / PUBG / 和平精英 / Apex）
- 按玩法类型筛选：BR常驻、BR限时、娱乐玩法（切游戏时标签自动适配）
- 游戏筛选（Tab Bar）与类型筛选（胶囊标签）可叠加使用
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
| `game` | string | ✅ | 游戏名，用于游戏筛选。当前值为 `"Fortnite"` 或 `"PUBG"` |
| `modeName` | string | ✅ | 模式/玩法名称，作为卡片标题 |
| `year` | string | ✅ | 年份标注，显示在卡片右上角绿色徽章 |
| `date` | string | ✅ | 简化日期，用于分享图日期显示 |
| `tags` | string[] | ✅ | 筛选标签枚举数组，见下方标签系统 |
| `type` | string[] | ✅ | 中文类型标签，显示在卡片标签行 |
| `oneLineRule` | string | ✅ | 一句话规则描述，卡片摘要区 |
| `mechanicChange` | string | ✅ | 详细说明玩法机制上的改动 |
| `tempoImpact` | string | ✅ | 对游戏节奏的改变 |
| `designObservation` | string | ✅ | 通用可复用的设计洞见（最核心字段） |
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
| `br-core` | BR常驻 | 永久可玩的经典/变体 Battle Royale |
| `br-ltm` | BR限时 | 限时开放的 BR 规则变体（仍然遵循吃鸡框架） |
| `casual` | 娱乐玩法 | 非 BR 标准玩法（PvE、死斗、撤离、派对游戏、特殊联动） |

**动态筛选机制**：切游戏时，标签按钮自动更新——只显示当前游戏实际拥有的分类。「全部游戏」模式显示所有分类的并集。

一个模式可以携带一个标签。`type` 字段是中文标签的补充，用于更具体的归类（如 `"16 人"`、`"免搜刮出生装"`），显示在卡片的 tag row。

### UI 设计规范

**筛选器层级**：游戏筛选 + 类型筛选，双层叠加。

- **游戏筛选**：使用 **Tab Bar**（下划线指示器），选中态 = 蓝色文字 + 蓝色底线，无背景填充。三个 Tab：全部游戏 / Fortnite / PUBG。对应 CSS class `.game-tabbar`，与下方的类型筛选保持 ≥18px 间距。
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

- **Apex Legends / EA**：
  - `apexlegends.wiki.gg/images/` — **wiki.gg 官方 Apex Wiki CDN**（首选！EA 定期删除官方公告链接，wiki 图片稳定存在）
  - `drop-assets.ea.com` — EA 官方 Key Art CDN（可能被清理）
  - `media.contentapi.ea.com` — EA Content API 图片（可能被清理）

> **Apex 特殊说明**：EA 官方公告页面会定期下线或删除配图，因此 Apex 模式图片**优先从 wiki.gg CDN 获取**。可以通过 wiki.gg API (`api.php?action=query&prop=imageinfo&iiprop=url`) 查询文件 URL，无需访问受 Cloudflare 保护的 HTML 页面。

### 同步脚本

`scripts/sync_fortnite.py` 是本地同步脚本雏形，用于辅助抓取 Fortnite 官方公告信息。GitHub Pages 不会运行这个脚本，数据更新后需要重新提交到仓库。

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
