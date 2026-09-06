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
- 追加核对 2026-09-01 发布的 4.6.0 更新预告：`Midnight Hunters` 已由主题模式卡覆盖；公告只给出名称、上线日和下线的旧主题模式，没有公开新的人数、目标或地图规则，因此继续保留 `needs_review`，不凭空补写机制。
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
- 追加核对 Garena 2026-08-01 动画公告与 2026-09-03 年度奖项公告：两篇内容分别是 Free Fire: Daybreak 宣传和 Naruto Shippuden 联动回顾，没有新增可游玩的局内模式；9 周年公告、OB54 玩法日志中的 Epic Fight、Anniversary Tasks、Arena Showdown、Saddle Brawl 均已有对应卡片。
- 追加复核 PUBG Mobile 官方日本站 4.2.0、4.3.0 更新/补丁页：`Primewood Genesis`、`Evolving Universe`、`Racing Challenge` 已有独立卡；协力跑酷属于功能层，`Ancient Secret: Arise` 是既有玩法回归，Arena Ranked 属于团队死斗排位层。已把三张相关卡的来源切换到官方日本站页面，未发现新的独立模式遗漏。
- 追加复核三角洲行动官方 Global 第 11 赛季 `Reorientation` 公告（2026-09-04）：`Fishing`、`Polaris Patrol` 与 `Operations 1v1` 均已有卡；Layali Grove 2.0 和 The Mog 属于地图/地图规则卡，Rover 是干员能力，不新增重复模式。公告中的钓鱼等级、两种钓法、首领身份切换和零损耗 1v1 规则已与卡片逐项核对。

### Apex Legends

- 本轮复核 EA 官方模式总览、2026 Breach 补丁、2025 Prodigy 补丁、2025 Astral Anomaly 活动和 Wildcard 公告，发现此前未收录的四个明确玩法：`Wildcard` 常驻快速 BR、`Bot Royale Evolved` 人机混合 BR、`Launch Royale` 怀旧 LTM，以及 `Arenas: Prodigy` 的 3v3 回合制限时回归。
- `Mixtape`、Ranked、Unranked 属于总览中的播放列表/竞技层；地图轮换和装备调整不另拆模式。四张新增卡均已写入中文规则、来源和待确认范围，并生成稳定本地封面。

### Fortnite

- 本轮复核 Epic 官方新闻索引和模式公告，发现此前未收录的两个明确玩法：`Fall Guys Crown Jam`（3v3 物理篮球障碍竞技）和 `Fortnite: Delulu`（80 人单人开局、最多四人临时组队、最终单人获胜的 BR LTM）。两张卡已补入中文规则、LTM 分类、官方来源和本地封面。
- Ranked 选项、俱乐部奖励和近距离语音属于玩法内规则；普通赛季、联动装饰和地图宣传不另拆模式。

- 追加复核 PUBG 官方 2026 Arcade/高质量玩法公告：`Xeno Point` 是 4 人合作 PVE 副本，包含 HUB 分区推进、随机技能构筑、三档难度与母舰首领；`PAYDAY` 是最多 4 人的合作劫案，包含潜入/警报、职业分工、随机安保和战利品撤离；`Prop Hunt` 是 3 Hunters 对 9 Props 的非对称躲猫猫，包含伪装能力、误射扣血和末段 Fever Time。三者均有独立胜负流程与服务期，本轮新增三张卡；普通地图、事件通行证和职业内容仍归玩法内部机制。

### 和平精英

- 追加复核官方 App Store 版本历史（2024-11-04、2025-01-13、2025-06-23、2025-09-08、2026-01-26 更新条目）：新增 `快速爆破`（5v5、7 回合爆破）、`冰河夺金`（4v4 搜索/搬运夺金）、`奇幻大乱斗`（职业与装备成长 BR 变体）、`征服模式`（5 据点分数竞速）、`个人竞技`（6 人个人死斗）、`核爆对决`（超体角色+炸弹攻防）、`FPP-爆破团竞`、`FPP-仓库团竞`、`苏尔南冲突`（有限撤离点搜打撤）、`冰封列车`（合作护送生存）和 `牛仔的复仇`（身份争夺限时特殊模式）。以上条目有独立胜负条件或明确的合作/撤离流程，已分别入库并标注来源为官方版本说明。
- 负向检查：大唐西安、动物丛林、夏日海豚岛、创乐园 2.0 等主要是主题地图与局内交互；超体对抗新角色、双排入口、插件和单人巅峰赛属于角色/队伍规模/竞技层；地铁逃生的首领、天气、避难所、冰河禁区地图与珍宝系统归父模式或地图机制，未重复建卡。`牛仔的复仇`虽已公开身份争夺目标，但完整任务链仍待正式开放后核对。

- 继续回溯官方 App Store 版本历史（2020-09-16 至 2023-09-12）：新增 `极限追猎`、`电竞模式`、`重启未来`、`谁是内鬼：查证模式`、`光影冒险`、`和平之翼`、`度假岛`、`龙狮迎冰雪`、`空投行动`、`突变团竞 2.0`、`狙击团竞`、`冒险列车`、`天空赛场`。这些条目均有独立的特殊目标、复活/缩圈规则、角色能力、视角限制、交通系统或非对称战斗流程，已分别入库。
- 负向检查：创乐园、绿洲世界、家园、天空赛场下城区的观光/装饰区域，以及常规地图重制、武器平衡、训练岛和赛事功能未单独建卡；“谁是内鬼”单排匹配、极限追猎月度轮换、超体对抗双排属于队列或开放层，保留在父模式说明中。后续继续检查更早的 2019–2020 版本和官方创意工坊历史页。
- 追加回溯 2020-11-17 官方“突变”版本 FAQ：此前只收录了团队竞技的“突变团竞”，但遗漏了经典 BR 内的“突变矿场”。该玩法有独立的随机矿场事件、低重力区域、突变敌人、矩阵基地火焰喷射器/固定机枪和 PVE 奖励流程，已补为 `hpjy-mutant-mine-2020`；两者不再合并。
- 继续回溯 2019–2021 官方玩法公告：补入 `占点竞技`（三据点、限时占领、无限返场）、`战术团队竞技`（4v4、队友附近返场、遗迹地图）、`圣诞模式`（海岛/雪地概率进入的节日 BR）、`军备团竞`（击杀升级武器、平底锅终局）、`夺宝战场`（金条商店与三类撤离）和 `免耳麦模式`（关闭其他玩家 3D 音效）。
- 同轮核对《海岛 2.0》娱乐模式轮换表，发现 `极速对决`、`鹰眼特训`、`空降奇兵`、`赛场行动`、`极限竞技` 五个独立入口此前没有卡片；已先以官方确认的模式名称、轮换日期和中文待补说明入库，并统一标记 `needs_review`，不猜测未公开的局内参数。

## 2026-09-07 和平精英 1.38.12 / 古墓迷途 / 地铁逃生回溯

继续核对[和平精英官方 TapTap 版本说明](https://www.taptap.cn/app/70056/all-info?platform=ios)与官方 App Store 版本页，补入以下此前没有独立卡片的命名玩法：

- `冰河夺金·异变`：2026-06-30 版本明确为限时特殊模式，加入随机能力插件；与 2024 年的基础 `冰河夺金` 分开记录。
- `少将的反攻`：2026-09-02 版本明确为限时特殊模式，包含卡德尔少将扮演凭证、黑鹰小队、动力装甲争夺和任务奖励。
- `死斗竞技`：官方说明给出 4v4/1v1、地铁币入场、装备不掉落、连胜奖金、信号干扰区与回合缩圈规则；上线时间仍以后续公告为准，因此卡片标记 `needs_review`。
- `苏尔南冲突·冰河禁区`：明确为冰河禁区地图变体，包含高资源区域、两个先后开放的占点撤离点、信号干扰区和 90 万战备值门槛。
- `怪物扮演·蝾螈小宝`：官方预告已给出蝾螈小宝的技能、任务互动和专属掉落，预计 2026-09-19 上线；正式胜负与匹配参数待上线公告补档，卡片标记 `needs_review`。

`异变密林·演练`、`异变密林·冲突`继续作为 `hpjy-metro-mutant-jungle-2026` 的分支规则保留，不重复拆成仅有地图后缀的卡片。`金秋龙狮城`属于主题海岛与场景机制，也不作为独立玩法卡片。

## 2026-09-07 PUBG Mobile / Free Fire 追加负向审计

### PUBG Mobile

- 复核日本官方新闻分页 1–20：覆盖 Version 3.5.0–4.6.0 的更新通知与补丁页，并交叉检查全球/地区主题页、Metro Royale、Payload、World of Wonder。4.6.0 只明确新增 `Midnight Hunters`，已有 `pubgm-midnight-hunters-2026` 卡；公告中的 `Metro Royale: Reunion` 是父模式回归和开放时间调整，不拆新卡。
- 负向检查：版本页中的 RANKED/UNRANKED、Arena Ranked、地图轮换、Metro 地图/首领、CRAFTGROUND 编辑器入口和活动宣传不构成新的独立胜负规则；规则只写到名称的创意工坊入口继续保留 `needs_review`。

### Free Fire

- 复核 Garena 2026 最新公告与补丁页：1690、1683、1673/1678、1664、1655、1649/1640、1634、1617、1605、1604，以及 2026-09-03 奖项公告。
- 已覆盖：`Pitch Showdown Revival` 归入 `Fire Kickoff`，`On-the-Spot Revival`、周年任务和 `Epic Fight` 归入九周年卡，`CS Random Events` 归入枪王对决随机事件，`Saddle Brawl` 与 `Arena Showdown` 已有独立卡。
- 负向检查：动画/奖项宣传、地图换肤、技能与武器成长、赛事赛制、社交大厅活动和奖励小游戏没有新的独立对局胜负规则，未重复建卡。
- 追加发现并补入 `Armory Arena`：官方 2020-07-31 公告明确给出 4v4、18 种武器、击杀换枪、平底锅终局和时间结束比较进度规则；Library 与 Hangar 是同一模式的地图变体，因此只建一张模式卡。
- 继续复核日本官方 2020–2021 历史页，补入 `Halloweek Mode`（万圣主题 BR、随机首领）、`Extreme Hunt`（Livik 动力外骨骼、矩阵事件与召回）和 `Graffiti Prank`（小丑商店、代币情报兑换）。同页 `Playground Zombie Challenge` 与已有 `Halloween Battle: Capture the Camp` 的单人 5 分钟 6 波 PVE 规则一致，作为别名/子挑战处理，不重复建卡。

### PUBG 2026 路线图追加复核

- 官方 2026 路线图明确预告 `Rumble`：每周末组队参加轻量竞技模式，周榜前三小队会在下一周大厅展示。已新增 `pubg-rumble-2026`，按休闲小队竞技归类；公告没有公布正式开放日期、人数、地图、计分或胜负规则，卡片保留 `needs_review`，不自行推断。
- 路线图中的 Destructible Terrain、Interactive Smoke、Blue Chip Towers 等属于 BR 内系统或地图交互；UGC 规则与社区模式入口属于创作平台，不另拆为独立官方匹配模式。

### Fortnite Override 追加复核

- 官方 Override 公告再次核对：`Sprite Garden` 虽被称为 mode，但正文只描述收集精灵、展示收藏和与朋友互动，没有独立匹配胜负流程；因此归为社交/收藏系统，不重复新增模式卡。Override 的 BR 规则控制台、小队强化和宝箱掉落定制已由 `fortnite-override-2026` 覆盖。

### PUBG Mobile 日本官方分页追加复核

- 逐页检查日本官方新闻分页后，发现 `オフロードレース（Off-road Racing）` 未在现有卡片中出现。官方公告确认它是 UNRANKED 下的独立竞速射击竞技：4 支四人小队共 16 人、米拉玛参考赛道、三阶段竞速与射击区、检查点、车辆加速、颜色目标扣分和最终冲线。已新增 `pubgm-offroad-racing-2023`，使用官方公告头图。
- `Ultimate Arena`、`Ladder Arena`、`Royale Arena: Assault`、`React Survival`、`Gear Front`、`Graffiti Prank`、`Extreme Hunt`、`Armory Arena` 和各主题模式均与现有卡片逐项对应；夏季大合战、企业对抗战和线下赛事属于赛事活动，不拆成新匹配玩法。

### Free Fire 2026-09 最新公告追加复核

- Garena 最新文章 1701（2026-09-03）是 Pocket Gamer 奖项公告，正文回顾 NARUTO SHIPPUDEN 联动、忍术能力和线下赛事，没有新增可独立匹配的玩法；相关联动规则已有卡片覆盖，因此不重复建卡。

### PUBG 2025-10 马桶人限时街机 PVE

- 复核 [PUBG 中国官方《街机模式：PUBG x 马桶人》](https://pubg.com/zh-cn/news/9270) 与 38.1 更新说明后，确认此前漏收一张独立的限时 PVE：4 人小队在米拉玛按投票选择三档难度，清理普通与首领马桶人，使用售货机/补给箱取得武器，收集化学罐制作强化装备，并在阶段推进中处理可被打断的首领范围攻击。已新增 `pubg-skibidi-toilet-2025`，使用官方公告头图并标记为 `pve` / LTM。
- 同期核对 [PUBG 2026 路线图](https://pubg.com/en/news/9855)：`Rumble` 仍只有周末小队竞技的路线图描述，已单独记录为 `needs_review`；Project Cyclops、SLB: Miramar 等仍是计划/内容预告，没有找到对应的正式上线规则公告，因此继续不建卡。

## 2026-09-07 最新官方模式负向复核

- **PUBG 42.3**：核对 [Update 42.3](https://pubg.com/en/news/10885) 与 PUBG Playgrounds 说明。Playgrounds 是浏览、筛选和直接进入社区创作模式的入口，不是新的官方局内胜负规则；补丁中的地图轮换、武器/附件和 POBG 维护状态也不拆成模式卡。已有 `pubg-playgrounds-2026`，无需重复新增。
- **Apex Legends Marked**：核对 [Marked 补丁](https://www.ea.com/games/apex-legends/apex-legends/news/marked-patch-notes)。公告列出的 Pubs/Ranked、Mixtape 和 Wildcard 均与现有模式卡或播放列表层对应；新 Playground 武器查看页是大厅功能，不是可匹配玩法，没有发现新的独立模式。
- **PUBG Mobile 4.6.0**：核对 [日本官方更新预告](https://www.pubgmobile.jp/version-4-6-0-update-notice-20260901/)，只确认新主题模式 `Midnight Hunters`，已存在 `pubgm-midnight-hunters-2026` 并保留 `needs_review`，等待完整玩法页补齐规则。Spider-Man 主题、NARUTO 主题和 Metro Royale: Reunion 是关闭/回归公告中的已有内容，不重复建卡。
- **Free Fire 9 周年与最新公告**：核对 [9 周年公告](https://ff.garena.com/en/article/1683/) 与 [1701 奖项公告](https://ff.garena.com/en/article/1701/)。Epic Fight、技能强化、武器觉醒和周年任务属于 BR/Clash Squad 内的系统与任务，1701 仅回顾联动和奖项，没有新的独立匹配模式；相关卡片已覆盖或保留在父模式说明中。

### 和平精英 1.38.12 最新版本复核

- 核对 [官方 TapTap 1.38.12（2026-09-02）版本说明](https://www.taptap.cn/app/70056/all-info?platform=android)：`金秋龙狮城`是主题海岛与地图交互，`团竞排位·图书馆`沿用已有军备团竞规则，`怪物扮演·蝾螈小宝`已由 `hpjy-monster-role-salamander-2026` 记录；`异变密林·演练`是下线通知，不新增模式卡。未发现另一张具有独立胜负流程的命名玩法。
- TapTap 的“战场进化”预约页只提供版本包装、新地图和新玩法宣传，没有公开独立模式名称、匹配入口或胜负规则；暂不将其作为模式卡，后续待官方版本页给出可核对规则后再判断。

### 三角洲行动第 11 赛季官方补丁登记

- 追加登记 [S11 Reorientation 官方补丁](https://deltaforce.garena.com/en/news/announcement/PA6CZD)：它明确列出 `Polaris Patrol`、`Fishing` 和 Operations 1v1；三张卡已逐项核对身份成本、钓鱼装备/图鉴、零损耗单挑和开放时间。`Layali Grove 2.0`、`The Mog` 是地图更新，Rover 是干员能力，不重复建卡。

### Fortnite 2026 Reload 变体复核

- 核对 [Lantern Fest 2026 8 人小队 Reload](https://www.fortnite.com/news/lantern-fest-2026-brings-8-player-reload-teams-to-fortnite?lang=en-US)：活动期允许最多 8 人组队，排位 Reload 不开放，但公告没有改变 Reload 的复活、淘汰和胜利条件；它是临时队伍规模变体，归入 `fortnite-reload-2024`，不重复建卡。

### Apex War Games 官方来源修正

- EA 旧的 Apex 路径已返回 404，但同一官方文章目前可从 [EA War Games 存档](https://www.ea.com/games/battlefield/news/war-games)访问；已将 `Second Chance`、`Ultra Zones`、`Auto Banners`、`Killing Time`、`Armor Regen` 五张卡的来源切换到该可访问官方页面，规则未改动。

### PUBG Mobile 4.0 Unfail 状态与封面修正

- 复核 [PUBG MOBILE 4.0 全球官方页面](https://www.pubgmobile.com/en/event/PUBG-MOBILE-Version-400/) 后，确认 `Unfail` 页面写明“Available Now”，同时提示各地区正式开放时间以后续公告为准。已把卡片从“仅预告”改为“已公布玩法、地区时间待核对”，并换用官方 `s3_pic1.png` 配图。

### PUBG Mobile React Survival 来源修正

- 找到并核对 [PUBG MOBILE 官方 1.8 更新公告](https://www.pubgmobile.com/webplat/info/news_version3/35372/60662/60663/60724/60725/60726/m22521/202201/908153.shtml)：它确认 React Survival 的关闭时间和历史状态。已将该卡的 YouTube 辅助来源替换为官方公告，保留 React Survival 2.0 作为后续回归记录。

## 2026-09-07 全库完成性校验

- 当前 `data/modes.json` 共 453 张卡：Fortnite 34、PUBG 27、和平精英 65、Apex Legends 37、三角洲行动 37、PUBG Mobile 156、Free Fire 97；每个游戏的 `modeIds` 与来源台账完全一致。
- 逐卡检查结果：335 张本地封面、118 张官方远程封面，远程封面全部返回 `200 image/*`，本地封面全部存在；`modeName`、规则、机制、节奏、设计观察、上线信息和图片来源字段均包含中文可读内容。
- 这项校验只证明当前入库卡片没有漏图或不可读字段；官方历史模式的回溯仍保持 `ongoing_backfill`，定时任务继续按未覆盖年份、版本和分页推进。

### Free Fire 来源台账对账（2026-09-07）

将 23 个已经写入 Free Fire 卡片、但此前未登记到 `officialSourceUrls` 的官方页面补入来源台账，覆盖早期地区页、2018–2025 历史活动页以及 2026 年近期公告。卡片数量与规则未改动；后续定时任务会沿着完整的 2017–2026 URL 集合继续做负向审计。

## 2026-09-07 PUBG 街机历史补漏

- 复核 [PUBG 34.1 官方补丁](https://pubg.com/en/news/8170) 时发现 `1v1 Arena` 只在官方页面出现，原库没有独立卡片。它有两人回合制对决、回合前选装备、按胜利回合数结算、连胜显示和自定义比赛入口，属于独立的街机玩法，已新增 `pubg-1v1-arena-2025`。
- `Hot Drop` 的 42.2 回归仍归入已有卡片；`Solo Deathmatch`、`Prop Hunt`、`PAYDAY`、`Xeno Point` 和 `Playgrounds` 均已逐项对应现有记录。

- 同页复核 [PUBG 13.2 主机补丁](https://pubg.com/en/news/1718) 时发现 `Casual Mode` 原库也没有独立记录。它是主机专属的轻量 BR 队列：艾伦格、第三人称、小队、每场最多 12 人，空位由 AI 填充，单日最多 3 场，并保留任务/战绩/奖励进度；已新增 `pubg-casual-mode-2021`，不与标准 BR 合并。
- `Hungers Left Behind` 是 2024 年对已有 `Survivors Left Behind` 的回归命名，规则仍是同一合作 PVE 撤离流程，已在来源台账登记回归页，不重复建卡。

## 2026-09-07 Apex 2024–2025 模式补漏

复核 EA 官方活动页与 Apex 官方补丁后，补入原库缺失且规则独立的模式/变体：

- `Lockdown`：四队自由混战争夺据点；
- `Big TDM`：12v12、60 分上限、强化生命恢复；
- `Knockout`：60 人/20 队占区得分，分轮淘汰并进入突然死亡；
- `Power Sword Royale`：BR 开局与每轮获得能量剑；
- `Three Strikes: Mystery Legends`：三次机会结合随机英雄与返场保留进化等级；
- `EPG Extreme`：18 人、6 队三人、第三人称固定 EPG-1/能量剑、无搜刮快速返场；
- `Straight Shot Revival Quads`：32 人四人小队、固定落点、简化搜刮与前中期返场；
- `Arenas: Duels without abilities` 与 `Arenas: Duels with abilities`：分别记录无能力与开放能力的 1v1 竞技场阶段；
- `Solos: Respawn Token`：30 人单人、统一复活代币、后期关闭返场。

这些条目均有官方页面给出的名称和局内规则，已写入中文卡片、来源台账与封面字段。普通 Pubs/Ranked、Mixtape 轮换和英雄/武器平衡继续作为播放列表或系统更新处理。

### Apex 2024–2025 追加反向核对

继续从 EA 的 Shockwave、Temporal Chaos、Double Take 和 Takeover 官方补丁逐项读取 `MODES`：

- 新增 `Trios Revival`、`Straight Shot Revival`、`Quads Takeover` 和 `Akimbo & LMG Only Loadouts`；它们分别改变返场时机、快速 BR 的生命结构、队伍人数/技能和团队死斗武器池。
- 新增 `Mythic Mayhem Royale`、`Redemption Trios & Duos`、`Relic Weapons Trios & Duos`；它们分别改变神话武器效果、可消耗返场经济和整套武器池。
- `Straight Shot Revival` 的两篇官方说明对返场关闭节点分别写作“第 3 轮结束”和“第 4 轮”，卡片保留这一版本差异，不自行统一成未经核实的数字。
- 纯 Mixtape 地图轮换、武器平衡和普通 Pubs/Ranked 队列继续归到父模式，不重复建卡。

## 2026-09-07 Apex 官方点名但规则不完整的玩法补录

- 复核 EA 官方 [Beast Mode 活动公告](https://forums.ea.com/blog/apex-legends-game-info-hub-en/breakthrough-in-the-beast-mode-event/12042675)：公告明确列出 `LTM: April Fools`，开放窗口为 2025-04-01 至 2025-04-07，并说明这是回归的 remix 版本；正文没有公开本次具体武器、道具、地图或胜负改动。新增 `apex-april-fools-2025`，中文字段只记录已确认事实，加入 `needs_review`，不沿用历年愚人节规则推断本次内容。
- 复核 EA 官方 [Temporal Chaos 活动公告](https://www.ea.com/games/apex-legends/apex-legends/news/temporal-chaos-event)：开篇明确点名 `Straight Shot Rumble` 与 Straight Shot Revival 同期回归，但正文没有给出该乱斗的参赛人数、计分、复活、奖励或准确开放窗口。新增 `apex-straight-shot-rumble-2024`，加入 `needs_review`，不把其他 Straight Shot 变体规则套用到本卡。
- 这两张卡均使用官方 Apex 通用/活动主视觉作为封面，并保留官方来源链接；后续定时任务应继续扫描 EA 活动页、补丁说明和游戏内排期，拿到正式规则后更新中文字段并移除 `needs_review`。
