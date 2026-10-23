# GCS 0.10.1 编辑能力与安全边界

核对日期：2026-10-23。60 个来源 = 51 个 GDScript 作用域 + 9 个 Dialogic 时间轴；不等于 60 个独立事件。14 个完整编辑、33 个文字来源（其中芦苇滩前段额外开放选择结构）、13 个整体只读。旧 47 个可编辑来源没有减少。

## 最高优先级：真实入口与播放顺序

主图只能从已确认的实际入口与数组首行开始，依次展示前置对白、玩家选择、各选项后续、汇合或结束。仅展示该入口可达的节点，不能把无入线的后续片段也排成第一层。回边与汇合按真实连接布局，不因为存在循环改变开场位置。未确认入口的来源只提供明确标注的源码片段，不伪造主流程。

《老人典当》的主图是五句公共开场 → “要不要帮助他？” → 已确认后续与结束。源码未接入的拒绝对白保留在“未接入已确认入口流程的源码片段”折叠区，可独立查阅和编辑，不能被暗接到选项。真实 next=9 仍进入结束节点。

对白节点点击后展示整段所有对白，编辑模式每句都有独立输入框；选项在图中和节点面板均可点击查看目标。纯标签可以沿唯一已确认的自动前进关系直达正文，并显示经过的标签，主图保留原始节点与连线。条件、结束、战斗节点不沿用上一句的演出预览。

22 个来源中，当前 15 个可确认单一入口，7 个仅以条件或动态片段形式展示；未确认部分不冒充固定运行顺序。浏览器验收覆盖真实老人典当的节点位置、五句全文与同时编辑、两选项实际去向、未接入片段隔离、保存回读与恢复；铜炉的门槛与标签、芦苇滩的选择结构、动态入口和窄窗口也有验证。

## 可视化分支范围：22 个来源

15 个玩家选择来源：

- 老人典当（WatchShopEvent.create_event2）
- 铜炉真伪（WatchShopEvent.create_event3）
- 音律考核 · 源码临时占位（MusicLineEvents.create_exam_lines）
- 娘亲授艺（HomeSegmentEvent.create_mother_card_teaching）
- 红夜来信（LetterEvent.create_event）
- 芦苇滩 · 前段（get_reed_flat_part1_lines）
- 镖局 · 前段（get_escort_lines）
- _cat_feeding_choice_and_branches（_cat_feeding_choice_and_branches）
- get_cat_third_lines（get_cat_third_lines）
- get_cat_third_retry_lines（get_cat_third_retry_lines）
- _stage1_shop_evict_pre_combat（_stage1_shop_evict_pre_combat）
- _stage1_wharf_robbery_pre_combat（_stage1_wharf_robbery_pre_combat）
- _stage2_appraisal_event（_stage2_appraisal_event）
- _stage2_tang_salt_pre_combat（_stage2_tang_salt_pre_combat）
- _stage2_jianan_event（_stage2_jianan_event）

7 个条件或动态构造来源：

- TeahouseNpcEncounter.get_dialogue_lines（get_dialogue_lines）
- HomeSegmentEvent.create_shop_riot_post_combat（create_shop_riot_post_combat）
- 娘亲的任务（create_event）
- get_cat_feeding_lines（get_cat_feeding_lines）
- _stage1_shop_evict_post_combat（_stage1_shop_evict_post_combat）
- _stage1_wharf_robbery_post_combat（_stage1_wharf_robbery_post_combat）
- _stage2_tang_salt_post_combat（_stage2_tang_salt_post_combat）

这些视图只陈述可证明的字面量和连接。条件构造的多个数组用作用域分开；append 片段未确认的顺序不连线。动态选项、动态标签、重复标签、未知表达式不伪装成固定分支。未知片段仍保留已有独立文字的访问入口。

选项 requires_stat 使用单独的门槛节点显示源码条件，未满足时选项不可选而不跳转。skill_check 的成功/失败按真实索引或标签分别连接。branch_end 结束整个当前对白，不是跳到下一分支。combat_trigger 结束当前对白并交给宿主；芦苇滩和镖局展示已核对的胜败回调来源，并可查看对应来源，战斗取消由宿主处理，不伪造固定胜败。娘亲授艺两个选项汇入同一结束标签，card_id 保持只读。

《老人典当》第二个选项真实 next=9 指向分支结束；编辑器照实显示，不按注释将它接到后面的拒绝对白。该事件还以选项序号结算，结构锁定。本版本不修正式游戏源码。

## 选择结构编辑：1 个来源

scripts/cultivation/cultivation_story_events.gd 的 get_reed_flat_part1_lines（芦苇滩前段），两个选择节点均支持：

- 修改提示和各选项文字，分别编辑每段已有对白。
- 新增、删除、排序纯文字选项，每个节点 1–12 项。
- 将选项连接到当前数组中已有且在该选择之后的标签；不能循环、跨事件或输入未知目标。
- 撤销、重做、清除草稿；审阅前后选项完整列表，包括顺序、文字与去向。
- 项目外备份、写入、重新读取、再次保存、从 v4 结构备份恢复当前事件。

不支持新建标签、增删对白分支段、改条件、奖励、战斗、背景、角色演出或运行时逻辑。此范围称为“选择结构编辑”，不声称可任意重构整棵剧情树。

许可要求：函数必须是直接返回单一字面量数组，行、选项、目标与标签都可确认；选项只含 text 和 next_label。播放器与整个宿主的静态标记 SHA-256 必须匹配版本契约，防止序号或回调语义变化。修改只替换该事件的已审阅文字及 options 范围。v4 恢复要求事件受保护部分一致，其他函数的修改保留。契约只包含指纹，不包含游戏源码或资源。

## 只能改文字的分支范围

其余 14 个含玩家选择来源，以及上述 7 个条件/动态构造来源，保留已有独立字面量文字权限；动态文字逐项锁定。共 33 个文字来源原有 371 项文字（319 对白、21 提示、31 选项）没有减少。4 项动态文字保持只读。

老人典当及喂猫含选项序号结算；娘亲授艺含卡牌发放；铜炉、镖局、音律和茶馆选择含门槛、结果状态或委托结算。当前没有对所有引用和消费语义作完整结构证明，不能通过复制或删除选项改变玩法。条件表达式、stat、set_success、escort_result、card_id、salt_route、combat_id 和奖励配置只展示真实源码。

## 原有完整编辑范围

14 个来源继续文字、增删复制对白、排序、说话人、左右立绘和表情编辑：指日可待、前夜、夜难成寐、江畔悟剑前后段、严师慈母白天/夜晚、首次授琴、练琴观看①/②、芦苇滩胜败对白、镖局胜败对白。普通线性事件仍用剧本编辑器。

## 整体只读：13 个来源

- ReedFlatEvent.create_event：旧工厂无已确认入口及独立文字，实际事件使用其他来源。
- 茶馆 get_pre_combat_lines、get_skill_event_lines、get_post_combat_lines：按运行参数分发，无自己的独立文字；对应辅助片段可编辑。
- 9 个 Dialogic 时间轴：指令、角色和跳转是独立格式，未接入安全定位。

未知字典键、变量遮蔽、重复字典实例、重复键、动态标签和无法确认文字归属时不猜测授权。

## 验证与边界

自动测试包含旧 NPC、卡牌和事件功能，以及选择结构、图连接、单分支隔离、未知配置锁定、运行契约、过期审阅、损坏备份、冲突、写后失败回滚、外部修改保留、BOM/CRLF 和恢复保护。

47 个真实可编辑来源逐一在临时磁盘副本完成保存、回读、二次保存、当前事件恢复和其他事件修改保留；371 项文字与字符串外字节验证通过，136 次真实立绘检查通过。浏览器通过真实芦苇滩的流程选择、增删排序与改连、单分支对白、立绘、审阅备份、两次保存和原始结构恢复。所有写入均在隔离副本；读取的正式文件 SHA-256 保持一致。

原生目录授权弹窗与 Godot 内实际播放待人工测试。本版本按真实静态播放器与宿主代码核实，不执行动态 GDScript，也不修改正式项目或播放器。浏览器最终复查与提交之间仍存在并发窗口；保存前应关闭其他源码写入程序。
