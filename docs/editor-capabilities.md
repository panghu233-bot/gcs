# GCS 0.9.0 分级编辑能力清单

以 2026-10-23 本机真实源码只读核对为准。列表条目是源码作用域，不等于独立剧情数量。重新连接时按当前源码重新识别能力。

原有 14 个完整编辑来源继续支持文字、增删复制、排序、说话人、左右立绘和表情。新增 33 个仅文字编辑来源，支持 371 项已有文字：319 项对白、21 项选择提示、31 项选项。另有 4 项动态文字逐项只读。

仅文字来源共同支持：编辑已确认的已有字面量、撤销/重做、差异审阅、项目外备份、授权写入、重新读取和按原文字身份恢复。共同锁定：增删复制、排序、说话人、立绘、表情、背景、选项归属、跳转、战斗和奖励。每项显示所属函数、源码条件或数组、跳转标签/选项去向和源码行；重复文字不按内容合并。

文字编辑只生成普通字符串标记范围的替换，不重建函数。新备份记录 v3 文字身份；恢复要求当前函数的全部非可编辑文字字节与备份一致，其他函数的后续修改保留。原有 v1/v2 完整编辑备份继续兼容。

## 新增仅文字来源

### scripts/cultivation/cultivation_data.gd

- 古玩鉴别（`WatchShopEvent.create_event`）：对白 7、选择提示 0、选项 0。
- 老人典当（`WatchShopEvent.create_event2`）：对白 10、选择提示 1、选项 2。
- 铜炉真伪（`WatchShopEvent.create_event3`）：对白 13、选择提示 1、选项 2。
- TeahouseNpcEncounter.get_dialogue_lines（`TeahouseNpcEncounter.get_dialogue_lines`）：对白 10、选择提示 0、选项 0。
- 钓鱼（`FishingEvent.create_event`）：对白 3、选择提示 0、选项 0。
- 音律考核 · 源码临时占位（`MusicLineEvents.create_exam_lines`）：对白 3、选择提示 1、选项 2。
- 归家（`HomeSegmentEvent.create_intro`）：对白 7、选择提示 0、选项 0。
- 娘亲授艺（`HomeSegmentEvent.create_mother_card_teaching`）：对白 3、选择提示 1、选项 2。
- 木人试招（`HomeSegmentEvent.create_battle_tutorial_intro`）：对白 2、选择提示 0、选项 0。
- 木人试招（`HomeSegmentEvent.create_battle_tutorial_post`）：对白 2、选择提示 0、选项 0。
- 藏雨阁闹事（`HomeSegmentEvent.create_shop_riot`）：对白 9、选择提示 0、选项 0。
- HomeSegmentEvent.create_shop_riot_post_combat（`HomeSegmentEvent.create_shop_riot_post_combat`）：对白 10、选择提示 0、选项 0。
- 出门（`HomeSegmentEvent.create_town_unlock`）：对白 4、选择提示 0、选项 0。
- 红夜来信（`LetterEvent.create_event`）：对白 6、选择提示 1、选项 1。
- 书店救猫（`CatRescueEvent.create_event`）：对白 13、选择提示 0、选项 0。
- 母亲指点剑术（`MotherTeachingEvent.create_sword_teaching`）：对白 9、选择提示 0、选项 0。
- 母亲传授轻功（`MotherTeachingEvent.create_agility_teaching`）：对白 11、选择提示 0、选项 0。
- 娘亲的任务（`MotherMissionEvent.create_event`）：对白 26、选择提示 0、选项 0。

### scripts/cultivation/cultivation_story_events.gd

- 芦苇滩 · 前段（`get_reed_flat_part1_lines`）：对白 6、选择提示 2、选项 3。
- 镖局 · 前段（`get_escort_lines`）：对白 17、选择提示 2、选项 4。
- _cat_feeding_skip_lines（`_cat_feeding_skip_lines`）：对白 3、选择提示 0、选项 0。
- _cat_feeding_choice_and_branches（`_cat_feeding_choice_and_branches`）：对白 6、选择提示 1、选项 0；另 4 项动态文字只读。
- get_cat_feeding_lines（`get_cat_feeding_lines`）：对白 8、选择提示 0、选项 0。
- get_cat_third_lines（`get_cat_third_lines`）：对白 22、选择提示 1、选项 2。
- get_cat_third_retry_lines（`get_cat_third_retry_lines`）：对白 8、选择提示 1、选项 2。

### scripts/cultivation/teahouse_commission_dialogue.gd

- _stage1_shop_evict_pre_combat（`_stage1_shop_evict_pre_combat`）：对白 7、选择提示 1、选项 1。
- _stage1_shop_evict_post_combat（`_stage1_shop_evict_post_combat`）：对白 6、选择提示 0、选项 0。
- _stage1_wharf_robbery_pre_combat（`_stage1_wharf_robbery_pre_combat`）：对白 14、选择提示 2、选项 2。
- _stage1_wharf_robbery_post_combat（`_stage1_wharf_robbery_post_combat`）：对白 5、选择提示 0、选项 0。
- _stage2_appraisal_event（`_stage2_appraisal_event`）：对白 7、选择提示 1、选项 2。
- _stage2_tang_salt_pre_combat（`_stage2_tang_salt_pre_combat`）：对白 26、选择提示 3、选项 3。
- _stage2_tang_salt_post_combat（`_stage2_tang_salt_post_combat`）：对白 7、选择提示 0、选项 0。
- _stage2_jianan_event（`_stage2_jianan_event`）：对白 29、选择提示 2、选项 3。

## 仍然只读的来源

- `ReedFlatEvent.create_event`：没有已确认调用入口，也没有独立对白字面量；实际芦苇滩对白由其他来源提供。
- `get_pre_combat_lines`：只依据运行参数选择其他函数，自身没有独立文字；对应委托辅助片段已开放仅文字编辑。
- `get_skill_event_lines`：只依据运行参数选择其他函数，自身没有独立文字；对应委托辅助片段已开放仅文字编辑。
- `get_post_combat_lines`：只依据运行参数选择其他函数，自身没有独立文字；对应委托辅助片段已开放仅文字编辑。
- timeline/ 下的 9 个 Dialogic 时间轴：独立的角色指令、跳转格式尚未接入安全文字定位。

动态变量、拼接、条件表达式或格式化文字不拆开猜测编辑；跳转目标无法确认、重复字典键、重复共享字典实例、未使用字典、名称遮蔽和动态标签归属不明时保持只读。完整源配置可供审阅。

## 验证边界

47 个可编辑来源均在真实源码的隔离副本内验证连续保存、回读、恢复和其他事件修改保留；全部 371 项新增文字验证字符串外字节不变。正式项目仅只读，源文件哈希未变化。浏览器检查覆盖教学对白、分支选项、动态项锁定、完全只读来源以及 NPC、卡牌模块切换。原生目录授权弹窗及 Godot 内播放不在自动验收结果中。
