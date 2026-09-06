# 模式档案反向漏项审计

这个文件记录每轮从官方页面反向列出命名玩法后的处理结果。它和 `mode-source-coverage.json` 配合使用；`ongoing_backfill` 表示仍在持续回溯，不代表历史完整。

## 2026-09-07

### PUBG Mobile

已复核官方 0.4–4.6 版本页、2018–2026 主题页、Metro Royale、Payload、World of Wonder，以及 `RESPAWN-BATTLE` / Shadow Force 专题页。

- 已覆盖：Arcade、War、Quick Match、Sniper Training、Team Deathmatch、RageGear、Survive Till Dawn、Darkest Night、Infection、Payload、Metro Royale、主题玩法和现有 WOW 总览卡。
- 本轮新增：刀球单人练习场、刀球八人自由混战积分赛、热血刀球、刀球淘汰赛、热血刀球（随机技能）、刀球积分赛（随机技能）、刀球淘汰赛（随机技能）、冰封海战地图、冻结塔攻竞技场、排位团队死斗：仓库、排位团队死斗：机库，以及 Skyhigh Spectacle 页中的 6 个、Frozen Kingdom 页中的 6 个、World of Wonder 2.8 页中的 6 个，以及 Dinoground 页中的 PUBGM GO！和 WOW 2.7 页中的 Summer Brawl 明确命名 WOW 创作玩法。
- 已排除：Imagiversary 页面中的 `Team Deathmatch`、`Gun Game`、`Jumping Snipers`、`Occupation Mode` 等泛化“可创建游戏类型参考”，以及 World of Wonder 的设备、编辑器和空白模板；它们没有对应的具体版本玩法名称。对官方页面明确命名、并给出局内规则的创作模板则单独收录。
- 追加复核：Transformers 3.9 专题明确列出 Team Deathmatch - Warehouse（Ranked）与 Team Deathmatch - Hangar（Ranked），此前只有通用团队死斗卡，因此拆成两张排位地图玩法卡；与同页已覆盖的 Assault - The Ruins、Domination - Town 分开记录。
- 本轮新增：Skyhigh Spectacle 页面中明确命名且有规则描述的 WOW 创作玩法：Bio Infection、Pan and Blade Ball、2v2 Grenade Blade Ball、8-Player Grenade Blade Ball、Aerial Ship Combat、Zombie Infection Mode。
- 追加复核：4.0 官方页确认 Unfail 的 1v4 追逃规则；4.3 官方页确认 Evolving Universe 主题页入口；3.8 Steampunk Frontier 页确认 Elimination Skillfest 与 Battle Blitz。以上对应卡已存在，本轮未重复添加。
- 仍待覆盖：更早地区版本的完整索引、2026-09-07 之后的版本页，以及官方页面没有稳定索引的旧专题。
- 追加复核 Frozen Kingdom 的 WOW 创作者模板：`Zombie Station` 有双人解谜救人质、误杀即失败和 60 分钟限制，新增为独立 PVE 卡；`Battle Isle` 仅说明快速团队死斗地图与伏击空间，没有独立规则，记录为地图模板而不重复建卡。
- 追加复核 Imagiversary 的 WOW Gameplay Templates：`Erangel Mod`（12 支四人队、无载具无 AI）与 `Craft Mod`（4v4、60 击杀或 15 分钟）有明确运行规则，新增两张模板卡；`Jumping Snipers`、`Occupation Mode`、`Racing Gameplay`、`Escape Gameplay`、`Tank Battle` 等仅列为编辑器可创建类型参考，不作为已发布模式入库。
- 追加复核 4.4.0–4.6.0 官方日本站页面：Hero’s Crown、NARUTO: Shippuden、终末之谷忍术对战、木叶隐村 PVE、九尾袭来、蜘蛛侠：崭新的日子和 Midnight Hunters 均已在库中；其中 Midnight Hunters 只有 4.6.0 更新预告名称，规则保留待补。CRAFTGROUND 比赛与更新公告、修复公告不构成新增模式。
- 4.4.0 子项负向审计：Dinoground 回归已有 `pubgm-dinoground-2023` 卡；Arena Ranked（TDM 排位）是团队死斗的排位层与开放时间，不另拆为新规则模式；Metro Royale Chapter 32 的 Arctic Base 是地图/首领内容，仍归 Metro Royale 父模式；CRAFTGROUND 只写“追加新模式”而未公开名称、人数或胜负规则，标记为 `needs_review`，暂不凭空建卡。
- 追加旧版本补丁交叉核对：0.5.0、0.6.0、0.8.0、0.9.0、0.10.0、0.11.0 页面没有新的独立匹配玩法；Mini-Zone、War、Quick Match、Zombie: Survive Till Dawn 等在现有卡片中已覆盖，Miramar/Vikendi、夜间天气和出生岛小游戏属于地图或系统内容。

### Free Fire

已复核 Garena 2018–2026 官方补丁和活动页（包括早期 Rampage Opening、2019 Death Uprising、2022 Football Fable、2023 Color Playground，以及 OB44–OB54），重点检查 Battle Royale、Clash Squad、Bomb Squad、Lone Wolf、Zombie Hunt、Craftland 和周年/联动活动。

- 本轮新增：枪王对决：排位（2020）、枪王对决：双主动技能（2023）、彩色方块复活（2023）。
- 本轮新增：OB54 九周年 `Anniversary Tasks`，包含收集周年碎片、重铸骑士之剑、跳台收集空中硬币三种区域任务；它们会改变 BR 的早中期目标与区域奖励，因此单独记录为限时规则变体。
- 追加复核：Squad BEATz 官方地区公告把 Pet Ludo 明确列为 2022 年新游戏模式，新增“宠物飞行棋”限时休闲卡；四只宠物和桌游变体已确认，完整回合规则保持待确认。Coin Clash、Rampage: United、Lone Wolf Strike Out 已在库中。
- 已覆盖：Death Race、Rush Hour、Big Head、Clash Squad、Bomb Squad、Zombie Invasion、Death Uprising、Rampage 系列、Lone Wolf、Pet Rumble、Target Arcade、Droid Apocalypse、Free For All、Color Hide & Seek、Color Spray、Mystery Town、Zombie Hunt 轮换、CS-Peak、MyZone、Undersea Mystery、Epic Fight、Fire Kickoff、Arena Showdown、Saddle Brawl 等。
- 已排除：纯系统、商店、武器/角色平衡、社交大厅和地图装饰；如果补丁把规则变化明确命名为玩法并改变对局目标或复活/经济流程，则进入候选复核。
- 追加负向检查：2020 年 Rampage 补丁中的 `Close Combat modes` 是对 Clash Squad、TDM 等近距离对抗玩法的分组称呼，未定义独立胜负规则，因此不新增重复卡；Training Grounds、The Arena 和编辑器功能同样排除。
- 追加旧档案正文核对：文章 175、198、114、122、253、299、322、617、735、917、968、892、944、137、67、60、48、38、97 中的 Death Race、Solo Death Race、Rush Hour、Team Deathmatch、Kill Secured、Bomb Squad、Zombie Hunt、Coin Clash、Football Squad、Big Head、Cold Steel、Death Uprising 均已有卡；Training Grounds、The Arena、Craftland 设备/地图编辑器属于训练、社交或创作功能，不新增独立模式。
- 追加逐页复核：OB54、OB53、OB52、OB50、OB49、OB48、OB47、OB46、OB45、OB44 官方补丁（文章 1673、1640、1595、1511、1473、1456、1424、1421、1385、1357、1332、1306）。`Frosty Track`、`Aurora Event`、`Infinity Train/Infinity Ring`、Mini Peak、Clash Squad FPP、Chaos Events 均已由父模式卡覆盖；Training Grounds、Social Island 与 Craftland 编辑器属于系统/社交/创作功能，不新增模式卡。
- 追加复核官方 Announcement 页面：1690、1683、1664、1655、1649、1634、1617、1605、1604、1571、1566、1523、1506、1490、1438、1407、1261、1246、1152、854。Blue Lock、Devil May Cry、Demon Slayer 主要是联动道具/任务/外观；Spider-Verse Parkour、Naruto Chapter 2、Squid Game、Fire Kickoff、GINTAMA、Beat Carnival、Lost Treasure 等已有卡片覆盖。电竞赛事、动画预告和奖励活动不作为独立对局模式。
- 本轮对 Garena 官方 API 索引的 150 篇 2017–2026 公告做正文扫描：OB45 五周年补丁的 Craftland PVE 模板 `Creative - Rush`（检查点竞速）和 `Creative - Endurance`（倒计时生存）有明确规则，新增两张 PVE 创作模板卡；`Machine Gun Mode` 是武器行为，`Droid Apocalypse Mode Template` 是编辑器功能，不新增独立匹配卡。
- 同轮复核文章 1120 时补出 `Lone Wolf Cup`：官方给出直接匹配、3 轮 1v1、对阵 7 名玩家的明确赛制，新增为限时赛事化 1v1 卡。
- 早期 2017 闭测/首发正文也做了负向检查：Duo、Squad、Ranked 是队伍规模或排位层，地图、武器和天气更新不构成新的局内胜负规则，因此不重复建卡。
- 仍待覆盖：更早版本的完整分页、地区差异，以及下一轮官方公告。
- 本轮完成 Garena 官方 API 历史索引反向比对：类别 1、20、31、32 合计 150 篇（2017–2026），其中 75 篇此前未进入来源台账的文章已逐篇重扫并登记。新增候选均归入已有父模式、地图、系统/武器、角色能力、联动任务或 Craftland 编辑器功能；`Bomb Squad`、`Clash Squad`、`Zombie Hunt`、`Flame Arena` 等已有卡片，`Alpine`/`Ice Ground` 是地图，`Machine Gun Mode` 是武器行为，未发现另一张具有独立胜负规则的模式卡。标题只有“time-limited game mode”而正文没有名称和规则的页面保留 `needs_review`，不凭空建卡。
- 追加复核官方 OB54 更新日志文章 1678：`新迷你模式：马战` 明确为两人组队、下方玩家驾驶独轮车、上方玩家攻击的玩法，与 `Saddle Brawl` 已有卡片相同；派对大厅 Ring 的 1v1 守擂规则与 `Arena Showdown` 已覆盖，因此不重复建卡。
- 追加复核 PUBG Mobile 官方日本站 4.2.0、4.3.0 更新/补丁页：`Primewood Genesis`、`Evolving Universe`、`Racing Challenge` 已有独立卡；协力跑酷属于功能层，`Ancient Secret: Arise` 是既有玩法回归，Arena Ranked 属于团队死斗排位层。已把三张相关卡的来源切换到官方日本站页面，未发现新的独立模式遗漏。
