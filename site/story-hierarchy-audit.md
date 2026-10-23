# 剧情层级目录核对（2026-10-23）

本轮仅修改 GCS 展示；不修改 Godot，不更改任何来源 ID、适配器、写入或备份机制。

## 已核实关系

| 故事 | 关系依据（Godot 相对路径） | 展示语义 |
|---|---|---|
| 木人试招 | `scripts/cultivation/cultivation_battle_tutorial_flow.gd`：`on_requested` → 战斗 → 胜利选卡后 `create_battle_tutorial_post` | 战前 → 战斗胜利后；失败重试，不伪造失败对白 |
| 藏雨阁闹事 | `cultivation_ui.gd`：`_on_shop_riot_requested` → `_run_shop_riot_combat_flow` → `create_shop_riot_post_combat(victory)` | 战前 → 战后；胜败为条件情况，不是玩家选项 |
| 严师慈母 | `scripts/cultivation/cultivation_manager.gd`：`_should_trigger_stern_mother_care_night_on_rest`；`ui/cultivation_calendar_rest_flow.gd` 白天/夜晚回调 | 白天 → 同日休息夜晚；跨日会失去夜段，不是无条件连播 |
| 江畔悟剑 | `scripts/cultivation/cultivation_ui.gd`：低心情事件前后段回调 | 前段 → 判定/行动 → 后段；回合不固定 |
| 芦苇滩 | 同文件 `_on_reed_flat_part1_finished` | 前段含玩家选择；出手后战斗胜利/失败互斥；不管闲事不进入战后 |
| 镖局 | 同文件 `_on_escort_part1_finished` | 前段含玩家选择；参战后胜败互斥，不参战直接结算 |
| 街巷遇猫 | `cultivation_story_events.gd#get_cat_feeding_lines` 显式调用两个 helper；`cultivation_ui.gd#_trigger_cat_npc_action` 根据已投喂/已再会/有鱼分发 | 遇猫 → 有鱼的玩家选择或无鱼离开；完成投喂后再会；未投喂成功可再次尝试，非连续必经阶段 |
| 茶馆偶遇 | `cultivation_data.gd#TeahouseNpcEncounter.get_dialogue_lines` 匹配 `NPC_WANJUN`/`NPC_JIANAN`；UI 传入 npc_id | 不同人物情况，互斥条件，不是先后阶段或玩家选项 |
| 商铺赶人、货场抢袋、寻访唐智 | `teahouse_commission_dialogue.gd` 三个 profile 精确映射；UI pre → combat → post(profile,victory) | 各自独立故事；战前 → 战后按胜败切换；不把三件委托合并 |

## 排序依据与未确认项

- `scripts/cultivation/pacing_config.gd`：章节1 开局立足（1–4）；章节2 城中博弈（5–10）；章节3 局势转折（11–15）；章节4 收束决断（16）。
- `cultivation_event_policy.gd#trigger_calendar` 与 manager 常量：归家1、来信2、木人3起（须授艺/练习，允许延后）、闹事4、出门5、镖局9；指日可待源码目标12。
- 委托 stage1 窗口5–10、stage2 窗口11–16；同窗口内事件无确定彼此顺序，独立归类，不冒充精确时序。
- 娘亲授艺是木人前置，但没有固定回合；严师慈母/江畔悟剑/猫线/偶遇等由条件或玩家行为触发，不能填造日期。
- `Day19EveEvent` 保留第19日来源，但现行总回合为16；实际可达性未确认，单列待确认，不塞入第16回合。
- Dialogic 9个文件的入口、相互跳转和章节时序未核实，保留独立只读分类，不按文件名猜顺序。
- 修改展示排序仅存浏览器本地偏好，不修改源码、对白顺序、事件触发与选择顺序。

## 本轮验收

- 229 项快速 Node 测试全部通过，新增9项关系与统计测试。
- 真实数据：32个故事（11组 + 21独立）、60个唯一来源；逐一打开60个来源并验证选中定位，11组父总览均无缺失来源。
- 真实 Edge 浏览器：跨分类搜索、父子展开、刷新后的排序/折叠记忆、父故事切换和同源人物子项切换的草稿拒绝/确认、战斗结果双向联动均通过。
- 原功能定向回归：自然阅读、选择结构编辑、人物演出、条件情况、差异审阅、隔离副本备份/保存/读回/精确恢复，以及 NPC/卡牌页面切换均通过。
- 实际查看桌面目录、故事阶段、人物条件、排序模式与窄屏截图；1600、1050、680宽度无横向溢出。
- 23个真实输入文件前后哈希一致；写入测试仅在临时隔离副本。截图、日志、资源及备份不提交。
