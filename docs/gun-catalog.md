# 枪械图鉴

入口为 `#guns`，顶部可切换《战地风云 6》《瓦洛兰特》和《使命召唤：现代战争 4》。图卡显示名称、分类和已核对的预览图，搜索支持枪名、别名、枪型、配件和已收录外观。基础资料及来源位于预览下方。游戏、分类和查询条件可随详情链接保留，原有的 `#guns?entry=m4a1` 等战地 6 链接继续可用。

瓦洛兰特目录保存在 [data/gun-catalog-valorant.json](../data/gun-catalog-valorant.json)。截至 2026-11-16，用 [Valorant-API](https://valorant-api.com/) 对照 20 把基础枪械的中英文名、对局价格与默认图片，按同一枪械的 UUID 匹配中英文。模型清单来自 [Kingdom Archives](https://kingdomarchives.com/modelviewer/vandal) 的公开单枪页，已核对 20 个基础模型及 83 款额外 3D 皮肤。悍狼目前有默认模型可看。本站的皮肤菜单在嵌入窗口内切换模型，游戏素材归 Riot Games。

截至 2026-11-15，已复核 8 类共 68 把可选基础枪械：[EA 配装指南](https://www.ea.com/games/battlefield/battlefield-6/news/loadout-creation-and-weapon-classes)列出的 62 把、[等级解锁表](https://www.ea.com/games/battlefield/battlefield-6/news/progression-in-battlefield-6)列出的 RPKM、[2.1.1.0](https://www.ea.com/games/battlefield/battlefield-6/news/battlefield-6-game-update-2-1-1-0)的 Mk 24、RSPR、Z84M、ELR-40 及 [2.1.2.0](https://www.ea.com/games/battlefield/battlefield-6/news/battlefield-6-game-update-2-1-2-0)的 NSW4。Labs 预览、仅战场拾取的武器、投掷物及近战不在首批范围。指南中的赛季、活动或等级是该来源所列的解锁路径；未核实当前追赶条件时不推定仍可按旧途径获取。NSW4 的 11 月 9 日公告与 11 月 10 日赛季内容开放分别记录。

配件选录 2.1.2.0 公告的新增项及 M417 A2 的弹匣点数修正。同名配件跨枪型须按公告列出的适用范围关联，不能从一把枪推及同类全部枪械。外观首批为 EA 商店、通行证公告与年度版说明确认的 13 款套装。有明确单件对应关系的图片引用 EA 官方地址，并保留出处；图片不可用时仍可打开出处。套装的历史来源不能当作目前在售证明。

战地 6 目录保存在 [data/gun-catalog.json](../data/gun-catalog.json)。68 张枪械图按 [BF6 Tracker](https://battlefield6tracker.com/zh/weapons/) 的单枪地址匹配。详情使用本站的 Three.js 查看器，可拖动旋转、滚轮缩放、选择皮肤及切换实际有模型的配件。切换皮肤会带入源站记录的预设。查看器读取正式服清单、GLB 和贴图，使用网页实时材质近似游戏效果。

本栏目由现有 GitHub Pages 白名单打包。列表只加载缩略图，进入详情后才加载查看器。返回列表或切换游戏会卸载 3D 预览。

## 现代战争 4 模型与动画

截至 2026-11-16，目录收录首发 33 件武器和第 1 赛季开季上线的 Cronen Osprey、CSG-35，两件季中预告武器等上线后再收。官方公告中前后两处解锁等级相冲突的条目暂缺等级。[首发武器指南](https://www.callofduty.com/blog/2026/10/call-of-duty-modern-warfare-4-launch-multiplayer-operators-weapons-equipment-create-a-class) · [第 1 赛季公告](https://www.callofduty.com/blog/2026/10/call-of-duty-modern-warfare-4-warzone-season-1-announcement)。

单枪详情的「展示与动作」可按分 P 切换片段，也可打开独立播放页。播放页链接记录当前分 P。30 把枪械均将战术换弹与空仓换弹各列一 P，各有页内播放器和带时间戳的原片链接。首发枪械的普通检视和空仓检视也各列一 P。按作者目录、游戏画面及可见的余弹数字核对区间。发射器按检视、换弹收录，战斗刀保留动作演示。[火山坑换弹合集](https://www.bilibili.com/video/BV1MJxu6rEpp/) · [火山坑检视合集](https://www.bilibili.com/video/BV1hQnh6hEio/) · [一梦混剪首发换弹合集](https://www.bilibili.com/video/BV172nY6kEHv/)。

换弹优先使用动作完整、遮挡少的横屏实录。首发和第 1 赛季换弹主要使用火山坑的 4K 原片。CSG-35 的单持和双持换弹各有分 P，克洛南鱼鹰的空仓换弹仍取赛季合集片尾。原来的靶场演示和带余弹显示的合集留作动作核对来源。[火山坑首发换弹合集](https://www.bilibili.com/video/BV1MJxu6rEpp/) · [火山坑第 1 赛季合集](https://www.bilibili.com/video/BV1iw4B6zESu/) · [IW无限病房受害者的 CSG-35 靶场](https://www.bilibili.com/video/BV1D84v6XE4x/) · [双持交叉火力](https://www.bilibili.com/video/BV1Pt4B6XEY7/) · [生生爱打游戏的数字漂泊者](https://www.bilibili.com/video/BV1N24q6DEZr/) · [一梦混剪首发换弹合集](https://www.bilibili.com/video/BV172nY6kEHv/)。

B 站动作分 P 使用原站页内播放器，也可用署名链接从原片的相同时间打开。`embedFromStart` 从标注时间起播，区间末尾会继续播放原片。`playToEnd` 用于片段末尾恰好是原片结尾的区间。Call of Duty 的 Apex 配件演示和 Bellum BlackCell 短片保留官网原片链接与出处。[B 站外链播放器说明](https://player.bilibili.com/) · [官方多人玩法详解](https://www.callofduty.com/blog/2026/08/call-of-duty-modern-warfare-4-next-highlights-multiplayer-gameplay-systems) · [通行证与 BlackCell](https://www.callofduty.com/blog/2026/11/call-of-duty-modern-warfare-4-season-1-battle-pass-blackcell-store-bundles)。

M4 的普通检视和空仓检视分别从火山坑合集的 15:24 与 16:53 起播。战术换弹使用 AimlessPlayer 的短片。空仓换弹采用火山坑首发合集的 04:35 选段，并对照事Ricky 靶场视频 00:12 的动作。M4 Hurricane 的官方演示位于单枪详情的配件资料。[火山坑检视合集](https://www.bilibili.com/video/BV1hQnh6hEio/) · [AimlessPlayer 换弹短片](https://www.bilibili.com/video/BV1wC4H6qE8f/) · [火山坑首发合集的 M4 空仓换弹](https://www.bilibili.com/video/BV1MJxu6rEpp/?t=275) · [事Ricky 靶场原片](https://www.bilibili.com/video/BV1GmHA6WEdf/?t=12)。

已用 [GrayWolf 0.12.0 便携版](https://github.com/Kenshin9977/GrayWolf/releases/tag/v0.12.0) 在 Steam 构建 `26447320` 上验证读盘导出。莫辛-纳甘的游戏资源名包含 `dm_moscar`。本地 GLB 使用多人及战役包中的第一人称网格与贴图，按原资源骨骼挂点组装，包含 6 类配件和两套材质外观。网页保留外观资源编号 V06、V07。原版贴图嵌入 GLB 时最长边限制为 1024 像素。

从 `cod26/ingame_shared_mp.ff` 导出 193 段第一人称 CAST 和 SEAnim，其中 174 段含可绑定到预览模型的有效动作，已逐段放入 GLB。原版美军特战手臂模型 `rex_vm_arms_mp_milsim_us_sf_1_1` 来自 `cod26/global_stream_mp.ff`。枪挂在手臂的 `j_gun` 骨骼上，手指、手臂、枪机和弹夹在同一条动画时间线上。第一人称视角沿原动画的 `tag_camera` 运动，网页调了取景，也可切换至自由旋转观察手和枪的接触。

检视、空仓检视、扩容弹匣检视、分段换弹、快速换弹和五发换弹等共 14 段接入原版音效。预览按原动画的 `AudioOneShot` 事件帧触发，从本机包按样本名和画面动作配对，变体音效取其中一个录音。原游戏的粒子系统和动态混音尚未移植。原始网格和动画、逐段绑定索引及音效触发表保存在 `local-only/mw4-mosin-probe/`。

在单件武器详情点「选择本地 GLB」即可预览。也可将单文件放入 `local-only/cod-mw4/<武器 ID>.glb`，通过本机预览的「读取本地模型库」打开。武器 ID 见[目录数据](../data/gun-catalog-cod-mw4.json)。浏览器直接读取选中文件，`local-only/` 也在公开打包范围之外。GLB 中的每条有效动画单独列出，可切换、播放、暂停、循环、调速和拖动进度。当前片段有音效时，播放栏会显示音效开关。

使用自包含的 glTF 2.0 二进制文件，将网格和贴图嵌入，使用常规网格和 PNG 或 JPEG 贴图。用 `KHR_materials_variants` 声明可选迷彩和材质。可选的 `asset.extras.gunsmith` 提供配件槽位、蓝图和动画显示名。以下为配件节点示意。

```json
{
  "weaponId": "mosin-nagant",
  "slots": [
    {
      "id": "optic",
      "name": "瞄具",
      "default": "stock",
      "options": [
        {"id": "stock", "name": "默认", "nodes": ["Optic_Default"]},
        {"id": "alt", "name": "替换瞄具", "nodes": ["Optic_Alt"]}
      ]
    }
  ],
  "blueprints": [
    {
      "name": "示例蓝图",
      "variant": "Example finish",
      "parts": {"optic": "alt"},
      "show": ["Body_Alt"],
      "hide": ["Body_Default"]
    }
  ],
  "animationLabels": {"inspect_01": "检视 1", "reload_empty": "空仓换弹"}
}
```

配件节点须使用唯一名称并在导出时按同一骨骼和位置对齐。一个槽位只显示所选项的节点。蓝图加载预设配件和材质，之后可以换配件和叠加迷彩，缺少迷彩映射的表面会保留蓝图材质。动画轨道使用原模型的节点和骨骼绑定。用原始片段名作为 `animationLabels` 和 `animationGroups` 的键，分别设置显示名和菜单分组。

查看器也识别两个可选字段。`firstPersonCamera` 指向唯一的相机挂点节点名。`animationAudio` 以原始片段名为键，以嵌入 Ogg Opus 字节的 `bufferViews` 索引为值。音轨从第 0 秒开始，与对应动画等长。

## 模型来源核查

| 游戏 | 已确认的公开来源 | 可用范围 |
| --- | --- | --- |
| 战地风云 6 | [BF6 Tracker 改装页](https://battlefield6tracker.com/zh/weapons/m4a1/)、[EA Portal SDK 文档](https://www.ea.com/games/battlefield/battlefield-6/news/portal-101-advanced-creations) | Tracker 提供可旋转模型、部分皮肤和配件互动，公开说明确认配件效果来自游戏数据，未说明网格和贴图的具体获取方式。EA SDK 用于 Portal 体验的关卡编辑，未发现供外部网站再托管的完整枪械模型包。 |
| 无畏契约 | [Riot 公共素材目录](https://developer.riotgames.com/docs/valorant#assets)、[Kingdom Archives Vandal 查看器](https://kingdomarchives.com/modelviewer/vandal) | 官方素材目录提供图像和 JSON。社区查看器提供 Vandal 等枪械的交互模型和部分皮肤，并注明素材属于 Riot。已有 [VALTRAIN](https://www.valoranttracker.net/models) 嵌入案例。 |
| 堡垒之夜 | [Epic Fortnite Data API](https://dev.epicgames.com/documentation/fortnite/using-fortnite-data-api-in-fortnite)、[社区 api-fortnite.com](https://prod.api-fortnite.com/swagger/index.html) | 官方 API 提供岛屿与玩法指标。社区 API 的定制计划提供当日商店部分商品的 3D 网格和纹理，常规武器端点提供版本武器数据。未验证可覆盖战斗枪械与涂装的外部 3D 模型源。 |
| Counter-Strike 2 | [Valve 创意工坊资源](https://www.counter-strike.net/workshop/workshopresources) | 官方开放基础枪械几何模型和涂装工作台素材下载。公开下载面向创意工坊创作，本站托管前仍需核对适用条款。 |

[VALORANT Wiki 规则](https://wiki.playvalorant.com/en-us/VALORANT_Wiki:Rules)要求直接使用游戏文件的上传者注明 Riot 权利。[Valorant-API](https://valorant-api.com/)自述从游戏文件读取武器、皮肤等数据，对外提供图标和视频。[Fortnite Database](https://fortnite.gs/about/)也披露了从游戏物品定义和数据表提取条目的做法。逐项判断时以站点的来源说明为准，图标、检视视频、武器数值和可旋转的网格各有不同出处。

Tracker 的[条款](https://battlefield6tracker.com/zh/terms/)允许分享链接与截图，未列明可转载的模型包。[EA 内容政策](https://help.ea.com/en/articles/security-and-rules/ea-content-policy/)限制通过数据挖掘获取素材。如果有适合本站托管的正式发布物，需要核对其许可是否覆盖网格、贴图、皮肤和配件。
