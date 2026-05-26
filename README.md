# 游戏玩法情报站 / Gameplay Mode Intel

一个用于整理、采集和复盘游戏玩法案例的静态资料站。

当前版本主要收录 Fortnite 过往 Battle Royale / LTM / 活动模式案例，用来观察这些玩法如何改变胜利目标、战斗节奏、复活规则、地图空间、PvE 压力和特殊能力。

未来会继续扩展到更多游戏，例如 Apex Legends、Call of Duty: Warzone、PUBG、The Finals，以及其他值得拆解的多人玩法、限时活动和模式实验。

## 功能

- 以卡片形式展示玩法案例
- 按玩法类型筛选，例如核心模式、目标争夺、PvE / Boss、空间规则、特殊能力
- 展示玩法上线时间、官方图、核心规则、机制变化、节奏影响和设计观察
- 支持本地采集玩法卡片
- 支持生成分享图
- 支持导出 Markdown 和 Canvas 数据

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

## 数据维护

玩法数据集中存放在：

```text
data/modes.json
```

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

`scripts/sync_fortnite.py` 是本地同步脚本雏形，用于辅助抓取 Fortnite 官方公告信息。GitHub Pages 不会运行这个脚本，数据更新后需要重新提交到仓库。
