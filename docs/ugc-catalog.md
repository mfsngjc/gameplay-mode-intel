# UGC 全量目录：收录、封面、中文与验收规范

建立日期：2026-10-21。用户要求取消目录数量限制、加入检索和封面，由 Luna 执行，主代理验收。本文约束本轮及后续增量工作。

## 目标和边界

- 原四类保持不变：CS2 创意工坊地图、Roblox 体验作品、堡垒之夜社区岛、Minecraft Java 单体模组。沿用现有官方模式、CS:GO 旧版、皮肤、前置库排除规则；不扩成模组整合包、材质包或其他游戏。
- 新增独立的“全部收录”目录，尽量枚举来源实际公开的全部合格内容，不设作品数量上限。每批处理大小、限速和运行时间限制只用于断点接续，不能当作目录总量上限。
- 每日热榜前 100、历史榜前 200、每日实际快照及 rankingKey 保持原口径。目录条目没有榜外名次，不从全量目录制造涨跌、新入榜或旧日快照。
- “全量”仅在明确的来源与筛选范围内成立。Roblox 无公开全站作品枚举接口，Rolimon’s 收录范围不能写成 Roblox 全站；其他来源也须说明边界。私有、删除、受限、未索引作品不保证可收齐。

## 来源、枚举和接续

- 优先复用现有脚本 request、USER_AGENT、官方 API 与公开页面解析。没有 API 密钥时不依赖需要密钥的接口，不读取用户凭据，不绕过验证或访问限制。
- Steam：公开 CS2 地图分页，记录 SSR 返回的 total_count、total_pages、实际终止页和查询条件；官方深分页若需要密钥，仅记录为可选能力，不假定已授权或已配置。
- Roblox：枚举 Rolimon’s 公开 games 对象并合入已观测来源；已有官方统一作品编号时按 universeId 合并。placeId 与 universeId 不能混用，也不能凭名称合并。尚未核实统一编号的记录可保留为明确的 place 身份，并标记 identityStatus=pending；统计时分别报告来源记录数和已核实唯一作品数。
- Fortnite：沿公开分页和真实下一页继续，记录末页或失败位置。遇 403、验证、重复页、限流、无响应时停止该来源当前轮次，保存进度和原因，不换代理、规避验证或补造结果。
- Modrinth：project_type=mod，排除 library，limit 不超过 100；使用真实 offset 和 total_hits 验证末页。若出现深分页限制，再按明确、互斥的创建时间窗口分片，并验证边界去重与覆盖。
- 请求节流、超时、退避和重试上限明确配置；读到 Retry-After 时遵守。源失败保留上次成功记录、真实时间和状态。目录采集采用原子文件、断点和进程锁，重复运行幂等，不删除旧作品。
- 不要在首次运行中逐个打开数万详情页才能取得基础目录；先取来源已有标题、作者、简介、封面和指标。详情及统一编号核对使用有缓存的增量队列。
- 按平台记录 sourceUrl、sourceScope、startedAt、updatedAt、reportedTotal（无法核实则 null）、observedCount、enumerationComplete、nextPage/offset/cursor、状态与错误。动态来源跨页可能变化时记录采集窗口和计数差异，不能把页数或估算值当作准确作品总数。
- lastAttemptAt、lastSuccessfulAt、enumerationCompletedAt 分别记录真实尝试、成功请求及完成遍历的时间；只导出缓存或跳过已完成来源时不刷新成功时间。未来的 nextAttemptAt、coverNextAttemptAt 和详情退避时间须跨进程遵守。
- candidateObservationDifference 只表示来源候选数与已观测记录数的差额，可能混有筛选、重复、跨页变化及保留旧记录，不能冒称排除作品数。没有逐作品证据时 excludedCount 为 null；excludedByTypeEventCount 是可重复的排除事件数，明确排除的作品另有 exclusionRecords 证据。

## 目录接口

公开目录保存于 data/ugc/catalog/，原始证据与断点保存于被 Git 忽略的 data/ugc/catalog-cache/；不改写原榜单文件。

manifest.json 使用 schemaVersion=1、generatedAt、platforms 对象，并以 boardCoversUrl 引用原双榜缩略图映射。分片使用不可变的生成版本路径；新文件全部写妥后原子替换 manifest，避免新旧代次混读。每个平台包含 label、sourceUrl、sourceScope、status、reportedTotal、observedCount、reviewedCount、withCoverCount、identityPendingCount、enumerationComplete、progress、errors，以及 shards、searchShards 数组。分片项为 {url,count}，url 相对站点根目录；所有路径保持在 data/ugc/catalog/ 下。status 取 complete、partial、limited、unavailable。complete 仅表示已遍历该来源查询的可见末端，页面须与 scope 一起显示。

数据分片为 {schemaVersion:1,platformId,entries:[...]}。每条至少包含：

- key、platformId、id、canonicalId（未核实可为 null）、identityStatus（verified/pending）、originalTitle、creator。
- titleZh、introZh、translationStatus（reviewed/pending/needs_review）、sourceFingerprint。已有审核中文按官方身份关联复用；没有审核稿时中文字段为空，不填统一套话充数。
- descriptionOriginal、categories、url、sources；Roblox 可附 statsUrl 指向已核实统计站作品详情，官方链接另列；原文按纯文本处理，不能执行其中的脚本、启动参数或教程命令。
- image：{url,sourceUrl,kind,status,checkedAt}，见下一节。
- metricValue、metricLabel（没有指标则为空）、createdAt（源未提供则 null）、collectedAt、firstObservedAt、lastObservedAt；不得用采集时间冒充作品发布日期。

检索分片同为 schemaVersion=1、platformId、entries；每条为 {key,originalTitle,titleZh,creator,introZh,descriptionSearch,categories,detailShard,metricValue,createdAt,imageStatus,translationStatus}。detailShard 为上述完整数据分片的相对路径。保留足够的简介用于玩法检索，避免把完整长说明在多个索引中重复写入。已有内容可以直接复用 shard 作为 searchShard，但平台目录加载应异步、分页、显示进度，不能阻塞主线程。

仓库保存普通 JSON；发布构建将详情和检索分片压缩为 .json.gz，并重写 manifest 与 detailShard 引用。浏览器按 gzip 文件头识别解压，避免重复解压；不额外下载全部分片。公开构建保留原站资料，按 GitHub Pages 容量核查总大小。

分片大小按字节与记录量控制，避免单个巨大 JSON；建议每片 250–500 条，任何单文件不应超过 5 MiB。大小是传输分片，不限制收录数量。

## 封面规则

- 优先采用作品自己公开的封面或预览：Steam preview_url、Roblox 官方或 Rolimon’s 已公布的作品缩略图、Fortnite 岛屿公开预览、Modrinth icon_url/公开画廊。
- 图片必须属于该作品，并保留具体作品页/API 来源与真实核对时间。作品图标可作为列表缩略图，但 kind=icon，不能称作已取得大幅宣传封面。
- URL 只允许 HTTPS 或由真实来源解析出的 HTTPS 地址，不使用搜索引擎随意配图、AI 生成图、头像或无关图片替代作品封面。
- 有效图片 status=available；源未提供、删除或不可访问时使用 missing/unavailable，并计入缺图数量。界面明确显示“暂缺封面”，不能用统一装饰图假装封面齐全。
- 页面延迟加载图片，保持比例，失败时有可读回退。只显示当前分页或可见结果的封面，不一次下载目录全部图片。

原双榜封面文件为 {schemaVersion:1,updatedAt,entries:{...}}，键为 platformId:榜单作品编号，值为上述 image 对象。每个当前榜单作品均有明确图像或缺图状态，不改动排名文件。

## 类型复核与排除证据

- Steam 的“地图”标签由上传者填写，可能混入服务器资产、音乐、菜单和界面插件。目录先按来源标签收录；对资产、资源包、音频、界面、服务器依赖和明确“非地图”的强信号做候选复核，不把“完成来源遍历”等同于逐作品验证可玩性。
- 候选扫描可以查看名称中的 assets/resource/pack/kit/HUD/panorama/menu/music/content/addon、中文资源/菜单/界面/音频等信号，以及说明中明确的非地图和服务器依赖语句。信号只用来送审，不能直接当作排除结论。泛称 model、模型、音乐、Content、Addon 或服务器广告不足以自动排除；声音训练、准星训练、自定义模型地图、足球、国际象棋和其他完整小游戏应保留。
- 每个新候选按 key 和当前来源指纹记录判断；两位 Luna 独立核查，主代理复核全量绑定和来源，并分层抽查及裁定所有疑点。仅批准明确的非地图配套资源；资料不足或判断冲突时保留待核。相同 key/指纹的 keep、uncertain 和已批准 exclude 结论写入私有 type-audit，后续跳过未变化的内容，不重复消耗审核批次。
- 已批准排除项保存于版本控制的 `data/ugc/catalog-exclusions.json`，结构为 `{schemaVersion:1,updatedAt,entries:{key:record}}`。每条 record 包含 sourceFingerprint、originalTitle、descriptionOriginal、reason、sources、reviewedAt、reviewer 和 approval:{approvedBy,approvedAt}。所有时间均为真实审核或批准时间；批次完成时保存的实际文件时间可作为该批审核完成时间，并在私有验收回执保留来源。
- 采集器先补全源说明和指纹，再检查已批准配置；只有 key、指纹、原名及原文完全一致时排除。原文变化后重新保留并核查，不用固定编号永久拉黑内容。未批准、缺字段或指纹不实的配置不能生效。
- 排除项的完整原记录、封面、作者、首次观测时间和历史审核保存在可恢复的私有缓存；公开启动清单仅保留简要排除依据。原榜已观测作品即使退出目录，也可继续复用其已核实作品图及原核查时间，不能因为目录筛选而丢图。
- 目录筛选与原八榜独立。若原榜采集器也要调整筛选口径，必须依原监控规范更换 rankingKey 并建立新基线，不能回写旧快照或虚构涨跌。

## 中文审核

- 全部新增与源说明变化的作品进入可增量读取的队列。Luna 逐条阅读真实说明，用一两句日常中文解释做什么、怎么玩、有什么特点。原名和作者保持来源写法；中文名使用说明性译法并放在括号内参考。
- 不凭名称猜机制；只有名称、广告、连接教程或资料不足时，如实写明。不得把作者宣传效果改写成实测结论。
- 每批在 catalog-cache/reviews/pending/ 输出独立审核文件，格式为 {schemaVersion:1,entries:[...]}，每项含 key、titleZh、introZh、sources、sourceFingerprint、reviewedAt、reviewer。只有主代理验收后放入 catalog-cache/reviews/accepted/、且顶层含 acceptance:{approvedBy,approvedAt} 的批次会被导出脚本消费；公开记录保留 reviewApproval 批准信息，撤回稿不能从旧分片重新恢复；指纹变化即重新待审。待审核输入队列保存于 catalog-cache/reviews/pending/平台编号/，Luna 输出稿保存在 pending 根目录且文件名以 luna- 开头，不复制到公开站点。采用与已核查证据一致的指纹，历史已审核条目保留。
- 收录数量与中文已审核数量分别记录在维护数据与验收报告中。公开页面只展示作品收录数量，不展示审核计数、审核徽章、作品身份核实标签或维护筛选。尚无已审中文的作品仍可检索并展示原名、作者和图片，简介位置温和说明“介绍待补充”；不能计入 reviewedCount。原始说明仅在主动展开来源时查看。
- 主代理验收每批 schema、覆盖、指纹、去重、来源，并按平台、玩法类别、资料不足和高热度分层抽查。抽查通过不描述为主代理逐字复核全部原文。明显猜测或套话退回整批。

## 页面检索

- 新增“全部收录”入口，与原双榜分开。支持全部平台或单平台、原名/中文参考名/作者/编号/玩法介绍和分类检索。公开筛选保留平台选择；中文审核与封面状态属于维护数据，不作为公开筛选菜单。旧链接中的 catalogStatus、catalogCover 应清除并忽略，避免看不到筛选控件却被隐形过滤。
- 结果数量代表当前已收录范围；正在加载检索分片时显示进度，加载失败不得显示为“没有结果”。多关键词按同时匹配处理，支持中文与英文原名。
- 不同平台的下载、访问、时长不直接相加排序。平台内可按同口径热度或实际创建时间排序，缺失值说明清楚。
- 所有卡片直接展示原名（中文参考名）、作者、作品图片与已有中文介绍。四个平台及全部平台目录均提供“大图 / 小图”切换，并与全站资料栏目共用设置，默认小图。小图模式中，堡垒之夜与 CS2 使用横向缩略图，罗布乐思与我的世界使用 64 像素方形图标，保持比例；大图模式使用图片在上的图文卡。选择只改变布局，不修改作品、统计、排名或搜索条件。参见 [全站卡片规范](card-view.md)。保持现有榜单、中文介绍、作者、历史日期与导出功能。
- 全量目录分页展示，不将全部条目一次渲染到 DOM；搜索、切换筛选和路由可恢复，不在每个按键时重新下载整个目录。
- Roblox 提供可核实的统计详情入口，官方作品页另行标明；不能把统计页标成官方，也不改写到 roblox.cn。访问外部站点的地区跳转不影响本站内容查看。
- 顶部搜索栏随页面滚动保持可用，兼顾手机侧栏、键盘焦点和弹窗层级。榜单作品的新入榜等有效变化标签位于名称旁边，封面独立，不悬在缩略图下方。公开页面不展示基线横幅、基线标签或基线页脚；内部比较规则保持不变。
- 三个 UGC 视图共用同一组点击式平台切换。全部收录额外提供“全部”按钮，不使用平台下拉框；切换平台保留搜索词并回到第一页，跨视图保留当前单个平台。
- 页面只保留作品浏览需要的数量、真实更新时间、简短来源范围及必要的更新失败/来源受限提示。采集页数、断点、身份待核实数量和审核进度保留在 JSON 与维护报告中。

## 实施与验收

1. Luna 后端负责枚举、元数据、封面、断点、分片、队列、测试；Luna 前端负责目录与检索；中文工作按独立批次输出，避免同时修改同一文件。
2. 主代理负责规范、集成白名单、现有定时流程衔接、测试与浏览器验收。除 UGC 文件及必要的构建/导航集成，不修改其他模式、道具、基础体验资料。
3. 数据验证必须覆盖：唯一 key、官方身份关联、HTTPS 来源、真实时间、图片来源/状态、分片索引完整性、计数一致、失败状态与断点幂等。重试不可制造重复或丢失旧记录。
4. 检查真实样本首/中/末页、空查询、多关键词、作者、中文介绍、无图、长标题、无结果、加载失败、移动端、全平台切换及原双榜回归。测试新采集逻辑，运行原 UGC 校验。
5. 报告分别给出各平台来源可见总量、已收录、统一编号待核实、中文审核、封面覆盖、断点和失败原因。不能因抓到前几批就宣称完成全量，也不能删除未完成项隐藏缺口。
6. 用户此前授权本次功能完成后 Git 上传。仅在对应交付范围验收通过后提交，说明真实进度；长期数据接续不因一次发布而改写为全部完成。每日 09:00 原监控继续保留，目录增量和审核按断点接续，不每次重翻全部作品。
