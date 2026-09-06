# 模式档案反向漏项审计

这个文件记录每轮从官方页面反向列出命名玩法后的处理结果。它和 `mode-source-coverage.json` 配合使用；`ongoing_backfill` 表示仍在持续回溯，不代表历史完整。

## 2026-09-07

### PUBG Mobile

已复核官方 0.4–4.6 版本页、2018–2026 主题页、Metro Royale、Payload、World of Wonder，以及 `RESPAWN-BATTLE` / Shadow Force 专题页。

- 已覆盖：Arcade、War、Quick Match、Sniper Training、Team Deathmatch、RageGear、Survive Till Dawn、Darkest Night、Infection、Payload、Metro Royale、主题玩法和现有 WOW 总览卡。
- 本轮新增：刀球单人练习场、刀球八人自由混战积分赛、热血刀球、刀球淘汰赛、热血刀球（随机技能）、刀球积分赛（随机技能）、刀球淘汰赛（随机技能）、冰封海战地图、冻结塔攻竞技场。
- 已排除：Imagiversary 页面中的 `Team Deathmatch`、`Gun Game`、`Jumping Snipers`、`Occupation Mode` 等“可创建游戏类型参考”，以及 World of Wonder 的设备、编辑器和通用模板；它们是创作系统的通用类型，不是该版本新增的官方全局匹配模式。后续如果用户要专门研究 WOW 模板，再拆出独立集合。
- 仍待覆盖：更早地区版本的完整索引、2026-09-07 之后的版本页，以及官方页面没有稳定索引的旧专题。

### Free Fire

已复核 Garena 2018–2026 官方补丁和活动页（包括早期 Rampage Opening、2019 Death Uprising、2022 Football Fable、2023 Color Playground，以及 OB44–OB54），重点检查 Battle Royale、Clash Squad、Bomb Squad、Lone Wolf、Zombie Hunt、Craftland 和周年/联动活动。

- 本轮新增：枪王对决：排位（2020）、枪王对决：双主动技能（2023）、彩色方块复活（2023）。
- 已覆盖：Death Race、Rush Hour、Big Head、Clash Squad、Bomb Squad、Zombie Invasion、Death Uprising、Rampage 系列、Lone Wolf、Pet Rumble、Target Arcade、Droid Apocalypse、Free For All、Color Hide & Seek、Color Spray、Mystery Town、Zombie Hunt 轮换、CS-Peak、MyZone、Undersea Mystery、Epic Fight、Fire Kickoff、Arena Showdown、Saddle Brawl 等。
- 已排除：纯系统、商店、武器/角色平衡、社交大厅和地图装饰；如果补丁把规则变化明确命名为玩法并改变对局目标或复活/经济流程，则进入候选复核。
- 仍待覆盖：更早版本的完整分页、地区差异，以及下一轮官方公告。
