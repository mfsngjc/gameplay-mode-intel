# 玩法缺项核查与补齐（2026-10-27）

本轮按用户要求由 GPT-6 Luna（low）执行采集，主流程逐批复核分类、原文、日期与图片后入库。模式库从502条增至549条；新增47个模式案例、3条基础更新。本地构建不等于发布，所有游戏继续保持历史回填状态。

## 数量与实际补齐范围

| 游戏 | 复核前 | 当前 | 本轮补卡 |
|---|---:|---:|---:|
| Fortnite | 55 | 92 | 37 |
| PUBG | 30 | 36 | 6 |
| PUBG Mobile | 157 | 158 | 1 |
| Free Fire | 100 | 101 | 1 |
| 和平精英 | 65 | 66 | 1 |
| Apex Legends | 58 | 59 | 1 |
| 三角洲行动 | 37 | 37 | 0 |

基础更新数据源24→27条；其中8条原有Fortnite道具版本仍在独立道具栏目，模式区基础更新16→19条。Free Fire的70篇详录及其BR/CS分线保持原状，不计作新增模式。

## 缺项的主要来源

- Fortnite原库偏重早期BR变体，遗漏经典BR、OG、Ballistic、竞速、音乐、LEGO、Party Royale及Save the World父玩法与8个独立PVE循环。本轮同时补齐2019夏日官方列表中未收的12项规则；Arsenal与Wick’s Bounty已有，不重复建卡。
- PUBG遗漏历史LABS实验：复活、极简HUD、内蓝圈、8v8积分战和分轮购买淘汰赛。Arena第二轮的购买/信息改动另归基础更新，避免写进2020首版。
- PUBG Mobile和Free Fire已有大量主题变体，却漏了经典BR父卡；本轮以原厂首发公告补齐。
- Apex遗漏Battle Armor；和平精英遗漏App Store 1.37.10中明确列出的轩辕禁地·角逐。三角洲所查当前入口与近期公告未确认另一个可独立入库的模式，不能据此宣布历史无遗漏。

## 本轮入库模式与官方依据

### Fortnite

| 模式案例 | ID | 时间依据 |
|---|---|---|
| [经典大逃杀（Battle Royale）](https://www.fortnite.com/news/announcing-fortnite-battle-royale) | `fortnite-battle-royale-2017` | 2017年9月12日（公测） |
| [弹道（Ballistic）](https://www.fortnite.com/news/fortnite-goes-first-person-with-ballistic-a-tactical-5v5-shooter-launching-in-early-access-dec-11) | `fortnite-ballistic-2024` | 2024-12-07公告；官方排期：2024年12月11日（抢先体验） |
| [火箭竞速（Rocket Racing）](https://www.fortnite.com/news/race-without-limits-with-rocket-racing-in-fortnite?lang=en-US) | `fortnite-rocket-racing-2023` | 2023年12月8日 |
| [音乐节（Fortnite Festival）](https://www.fortnite.com/news/take-your-stage-in-fortnite-festival) | `fortnite-festival-2023` | 2023年12月9日 |
| [乐高生存建造（LEGO Fortnite / Odyssey）](https://www.fortnite.com/news/welcome-to-lego-fortnite) | `fortnite-lego-odyssey-2023` | 2023年12月7日 |
| [乐高大城市生活（LEGO Fortnite Brick Life）](https://www.fortnite.com/news/lego-fortnite-brick-life-build-your-life-in-the-big-city) | `fortnite-brick-life-2024` | 2024-12-09公告；官方排期：2024年12月12日 |
| [卧底（Impostors）](https://www.fortnite.com/news/trust-nobody-introducing-fortnite-impostors) | `fortnite-impostors-2021` | 2021年8月17日公告（首发日待核实） |
| [不可能的逃脱：PvE（Impossible Escape PvE）](https://www.fortnite.com/news/fortnites-impossible-escape-ltm-escape-the-hostile-island) | `fortnite-impossible-escape-pve-2021` | 2021年5月18日公告（首发日待核实） |
| [不可能的逃脱：PvP（Impossible Escape PvP）](https://www.fortnite.com/news/fortnites-impossible-escape-ltm-escape-the-hostile-island) | `fortnite-impossible-escape-pvp-2021` | 2021年5月18日公告（首发日待核实） |
| [潜行消音战（Sneaky Silencers）](https://www.fortnite.com/news/silenced-pistol-update) | `fortnite-sneaky-silencers-2018` | 2018-01-01公告；官方排期：2018年1月5日至8日（实际开放待核实） |
| [间谍游戏：护送任务（Operation: Payload）](https://www.fortnite.com/news/operation-payload-new-fortnite-spy-games-mode) | `fortnite-spy-games-payload-2020` | 2020年4月29日公告（首发日待核实） |
| [间谍游戏：情报渗透（Operation: Infiltration）](https://www.fortnite.com/news/operation-infiltration-arrives-in-fortnite-chapter-2-season-2) | `fortnite-spy-games-infiltration-2020` | 2020年5月20日（官方称当日开始） |
| [战斗实验室（Battle Lab）](https://www.fortnite.com/news/battle-royale-update-whats-new-in-v11-31) | `fortnite-battle-lab-2019` | 2019年12月18日 |
| [重金属小队（Heavy Metal Squads）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-heavy-metal-squads-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [风暴追逐者：冲浪（Storm Chasers: Surfin'）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-storm-chasers-surfin-squads-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [水花四溅小队（Splashdown Squads）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-splashdown-squads-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [能量强化单人（Power Up Solos）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-power-up-solos-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [绝不抛下队友双人（Leave None Behind Duos）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-leave-none-behind-duos-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [谨慎使用双人（Use With Care Duos）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-use-with-care-duos-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [爆头双人（Headshots Duos）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-headshots-duos-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [高耐久小队战（Tank Battle Squads）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-tank-battle-squads-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [建造者乐园小队（Builders Paradise Squads）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-builders-paradise-squads-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [小队乱斗（Rumble Squads）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-rumble-squads-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [装备轮换小队（Loadout Swap Squads）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-loadout-swap-squads-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [策略建筑小队（Strategic Structures Squads）](https://www.fortnite.com/news/14-days-of-summer?lang=en-US) | `fortnite-strategic-structures-squads-2019` | 公告日 2019年6月24日；轮换顺序和具体开放日未列 |
| [守护家园（Save the World）](https://www.fortnite.com/news/build-explore-craft-and-fight-on-july-25?lang=en-US) | `fortnite-save-the-world-2017` | 2017-06-08公告；官方抢先体验发行排期：2017年7月25日 |
| [经典回归（Fortnite OG）](https://www.fortnite.com/news/fortnite-og-is-back-and-here-to-stay?lang=en-US) | `fortnite-og-2024` | 2024-12-05公告；官方首发排期：2024年12月6日 |
| [派对空间（Party Royale）](https://www.fortnite.com/news/dillon-francis-steve-aoki-and-deadmau5-invite-you-to-the-party-royale-premiere?lang=en-US) | `fortnite-party-royale-2020` | 2020-05-06 官方说明（首次开放日未单列） |
| [音乐节对决舞台（Festival Battle Stage）](https://www.fortnite.com/news/fortnite-festival-season-4-prepare-for-battle-with-metallica?lang=en-US) | `fortnite-festival-battle-stage-2024` | 2024-06-12公告；官方首发排期：2024-06-13 |
| [冬夜生存（Frostnite）](https://www.fortnite.com/patch-notes/v7-10?lang=en-US) | `fortnite-stw-frostnite-2018` | 2018-12-18 官方说明（首次开放日未单列） |
| [踏上旅途（Hit the Road）](https://www.fortnite.com/patch-notes/v10-00-patch-notes?lang=en-US) | `fortnite-stw-hit-the-road-2019` | 2019-08-01 官方说明（首次开放日未单列） |
| [地牢（Dungeons）](https://www.fortnite.com/news/save-the-world-homebase-status-report-11-19-19?lang=en-US) | `fortnite-stw-dungeons-2019` | 2019-11-20 官方说明（首次开放日未单列） |
| [风暴护盾演习（Wargames）](https://www.fortnite.com/patch-notes/v9-00?lang=en-US) | `fortnite-stw-wargames-2019` | 2019-05-09 官方说明（首次开放日未单列） |
| [风暴护盾耐久（Storm Shield Endurance）](https://www.fortnite.com/patch-notes/v9-30?lang=en-US) | `fortnite-stw-endurance-2019` | 2019-06-18 官方说明（首次开放日未单列） |
| [风暴求生（Survive the Storm）](https://www.fortnite.com/news/survive-the-storm---release-notes) | `fortnite-stw-survive-the-storm-2017` | 2017-08-28公告；官方首发排期：2017-08-29 |
| [挑战尸潮（Challenge the Horde）](https://www.fortnite.com/news/horde-bash-announce?lang=en-US) | `fortnite-stw-challenge-the-horde-2017` | 2017-10-02公告；官方首发排期：2017-10-05 |
| [远征赛季（Ventures）](https://www.fortnite.com/news/save-the-worlds-newest-update-7-21-2020?lang=en-US) | `fortnite-stw-ventures-2020` | 2020-07-21公告；官方首发排期：2020-07-27 |

### PUBG

| 模式案例 | ID | 时间依据 |
|---|---|---|
| [复活大逃杀（Respawn Royale）](https://pubg.com/en/news/1696) | `pubg-respawn-royale-2021` | 2021-04-20公告；官方排期：PC：2021年4月28日至5月3日；主机：5月6日至10日 |
| [挑战者大逃杀（Challenger Battle Royale）](https://pubg.com/th/news/1293) | `pubg-challenger-battle-royale-2021` | 2021-03-09公告；官方排期：PC及主机：2021年3月10日至15日（各地区开服时间有差异） |
| [蓝洞模式（Bluehole Mode）](https://store.steampowered.com/news/posts/?appids=578080%2C1046180&enddate=1576658464) | `pubg-bluehole-mode-2019` | 2019-12-05公告；官方排期：PUBG Labs：2019年12月5日至8日（PST） |
| [阵营战争（Faction Warmode）](https://store.steampowered.com/news/posts/?appids=578080&enddate=1599650903) | `pubg-faction-warmode-2020` | 2020-09-04公告；官方排期：PUBG Labs：2020年9月4日至7日（KST） |
| [竞技场模式（Arena Mode，初版）](https://store.steampowered.com/news/posts/?appids=578080&enddate=1603721939) | `pubg-arena-mode-2020` | 2020-09-17公告；官方排期：PUBG Labs：2020年9月24日至10月8日（KST） |
| [硬核大逃杀（Hardcore BR）](https://store.steampowered.com/news/posts/?appids=578080&enddate=1605083783) | `pubg-hardcore-br-2020` | 2020-11-04公告；官方排期：PUBG Labs：2020年11月5日至9日（KST） |

### PUBG Mobile

| 模式案例 | ID | 时间依据 |
|---|---|---|
| [经典大逃杀（Classic Battle Royale）](https://www.pubgmobile.com/en-US/m/news_detail/webplat/info/news_version3/35372/35482/35483/35484/m20570/201805/720235.shtml) | `pubgm-classic-br-2018` | 国际版上线：2018年3月19日 |

### Free Fire

| 模式案例 | ID | 时间依据 |
|---|---|---|
| [经典大逃杀（Battle Royale）](https://ff.garena.com/en/article/7/) | `free-fire-classic-br-2017` | 官方正式上线：2017年12月4日；更早地区封测日期待核 |

### 和平精英

| 模式案例 | ID | 时间依据 |
|---|---|---|
| [轩辕禁地·角逐](https://apps.apple.com/cn/app/%E5%92%8C%E5%B9%B3%E7%B2%BE%E8%8B%B1/id1321803705?platform=vision) | `hpjy-xuanyuan-competition-2026` | 2026年6月29日版本说明（首次开放日待核实） |

### Apex Legends

| 模式案例 | ID | 时间依据 |
|---|---|---|
| [战斗护甲（Battle Armor）](https://www.ea.com/games/apex-legends/news/battle-armor-event) | `apex-battle-armor-2020` | 官方排期：2020年4月28日至5月12日 |

## 基础更新与已有资料修正

- [v11.31 修复移动端开火、HUD与交互提示](https://www.fortnite.com/news/battle-royale-update-whats-new-in-v11-31)：`fortnite-update-v11-31-controls-2019-12-18`。
- [竞技场第二轮调整购买经济、默认武器与局内信息](https://pubg.com/en/news/1675)：`pubg-update-arena-second-iteration-2021-01-13`。
- [1.37.10 加入手枪快拔与驾驶位手枪射击](https://apps.apple.com/cn/app/%E5%92%8C%E5%B9%B3%E7%B2%BE%E8%8B%B1/id1321803705?platform=vision)：`hpjy-update-pistol-input-1-37-10-2026`。
- 规范两条Apex既有记录中的economy_loot、tuning/qol和core枚举，修复类别筛选漏项。校验扩展到七款游戏的已核官方来源与图片域名，并核对逐游戏记录数。
- Bluehole官方原文是“0.5x higher”，已按增加50%处理，未误写成只有原来一半。Respawn Royale没有DBNO阶段，100秒计时从淘汰后开始。
- Spy Games原卡已逐项介绍Dropzone与Knockout，保留原ID和收藏关系，仅新增原卡未覆盖的Payload/Infiltration。重返、改名、司机/地牢子图与赛季修饰不机械增卡。

## 图片与日期边界

- 本轮47个模式案例共引用35个本地原图文件，逐一完整解码并匹配SHA-256；8个新增STW玩法均已补回对应官方正文配图。
- Apex Battle Armor沿用已核EA官方BR通用图；和平条目使用腾讯对应父玩法/海岛章节参考图，明确说明未展示本条机制。2019夏日12项使用官方活动总览。没有把通用配图称作模式实机画面。
- 公告日期、官方服务排期与实际首开分开。仅有排期或未给首次开放日者launchDate为空，已知排期另存scheduledLaunchDate并在标签注明；不能按今天已过计划日就改成上线。
- PUBG MOBILE国际版首发为2018-03-19；报道电头为3月23日、页面发布时间为4月10日，三者没有混用。Free Fire正式上线公告为2017-12-04，未冒充最早封测日。
- 新增英文玩法的中文标题按机制采用说明性译法并保留英文原名；设计观察与行为影响明确标为推断。

## 尚缺与续接范围

| 对象/范围 | 当前缺口与处置 |
|---|---|
| Fortnite：Bodyguard、Ground Game、Siphon命名LTM | 原始官方规则来源仍待找回；同名道具/机制与社区作品不当作官方模式证据。 |
| 和平精英：共闯迷雾荒岛、新春夺金 | 渠道文本给月日但年份/原始出处仍不闭合；新春夺金还需与2025同名版本区分并补完整规则。保存私有候选，不计入549。 |
| PUBG：Zombie Tag | 未核到该精确名称的原始官方模式；自定义Zombie Mode与Zombie Survival不因相似名称直接合并。 |
| 三角洲：Raven’s Deal | 已找到10月22日官方入口，属于Operations叠加活动候选；正文完整性、独立队列与完整规则仍待核查，不新建模式。 |
| 原有模式内的基础体验更新 | 6篇本轮Fortnite来源已留下逐章节/八类对象续查台账，仍有未读完、未逐项去重和入库的范围；既有system-only结论不能整体复用。其他游戏的连续历史也未闭合。 |
| 旧记录来源清理 | 基线仍有23条以Wiki/Fandom/pubg.ac为主要出处的历史记录，需要逐条替换原始官方依据；本轮新增记录没有沿用这些二级出处。 |
| FF旧SOP路径 | 用户给定/Users/Admin技能路径在本Windows环境不可读，当前技能目录也无副本；本轮未重做FF详录，只补已核首发父卡并保留原70篇详录。 |

六篇基础更新续接的正式摘要已并入 `data/core-update-source-coverage.json`；逐项候选与采集草稿保存在 `local-only/mode-completeness-2026-10-27/`。模式覆盖与基础更新覆盖分开统计。

## 验收

- `node scripts/validate_taxonomy.cjs`：通过，549条模式及筛选/导出/时间轨。
- `node scripts/validate_core_updates.cjs`：通过，27条基础更新、23张原始素材。
- `node scripts/validate_ff_patches.cjs`：通过，70篇详录、1234节、19表、307张主正文图。
- `node scripts/validate_tactical_items.cjs`：通过，136对象及原有视频/来源功能。
- `python scripts/build_public_site.py`：通过，公开构建998,403,337字节；47条新卡使用的35个本地封面全部字节一致，FF图片文件完整保留，公开数据无缺失本地资源引用。
- 构建移除JSON非语义空白与未引用的旧封面；14 MB的旧Disco Domination动画在公开版本直连已核Epic CDN（HTTP 200、CORS允许），本地完整归档不变，FF正文图仍全量打包。剩余容量约1.6 MB，后续继续增加素材需再次检查上限。
- 采集候选与证据只保存在local-only，未混入公开构建。git diff --check通过。本轮没有提交、推送或部署。
