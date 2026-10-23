/* Audited presentation relationships only. Never writes manifests, source order or game state.
 * Evidence and unresolved edges: docs/story-hierarchy-audit.md. Exact source owners, never prefixes.
 */
(function(root){
'use strict';
const directory=typeof module!=='undefined'?require('./event-directory.js'):root.GCSEventDirectory;
const data='scripts/cultivation/cultivation_data.gd',script='scripts/cultivation/cultivation_story_events.gd',commission='scripts/cultivation/teahouse_commission_dialogue.gd';
const key=(path,owner,fn)=>path+'#'+(owner?owner+'.':'')+fn;
const D=(owner,fn)=>key(data,owner,fn),S=fn=>key(script,null,fn),C=fn=>key(commission,null,fn);
const child=(key,label,kind='phase',extra={})=>({key,label,kind,...extra});
const buckets=[
 {id:'chapter1',label:'第一章 · 开局立足',note:'已确认回合节点；条件未满足时可能延后。'},
 {id:'chapter2',label:'第二章 · 城中博弈',note:'已确认的日历节点。'},
 {id:'window1',label:'茶馆委托 · 第5–10回合',note:'同窗口内没有固定先后；不是一条连续剧情。'},
 {id:'chapter3',label:'第三章 · 局势转折',note:'已确认的日历节点。'},
 {id:'window2',label:'茶馆委托 · 第11–16回合',note:'跨第三、四章；同窗口内顺序未定。'},
 {id:'conditional',label:'条件触发 · 回合未定',note:'按行为、属性、地点或人物触发；此处排列不代表游戏发生顺序。'},
 {id:'unconfirmed',label:'时间 / 接续待确认',note:'保留真实来源，不推定章节、日期或相互连接。'}
];
const definitions=[
 {id:'wood',title:'木人试招',bucket:'chapter1',rank:30,timing:'第3回合起 · 授艺及练习后，可延后',flow:'战前 → 木人战斗 → 胜利选卡 → 战后。失败仅提示重试，没有独立战后对白。',evidence:'cultivation_battle_tutorial_flow.gd：on_requested / _resolve_victory；manager._should_run_battle_tutorial',children:[child(D('HomeSegmentEvent','create_battle_tutorial_intro'),'战前'),child(D('HomeSegmentEvent','create_battle_tutorial_post'),'战后 · 仅胜利后','phase',{condition:'战斗胜利且已选卡'})]},
 {id:'shop-riot',title:'藏雨阁闹事',bucket:'chapter1',rank:40,timing:'第4回合 · 木人未完成时先补教程',flow:'战前 → 战斗 → 战后按胜利 / 失败切换；两种结果互斥。',evidence:'cultivation_ui.gd：_on_shop_riot_requested → _run_shop_riot_combat_flow → create_shop_riot_post_combat(victory)',children:[child(D('HomeSegmentEvent','create_shop_riot'),'战前'),child(D('HomeSegmentEvent','create_shop_riot_post_combat'),'战后 · 胜败情况','phase',{condition:'由 victory 决定，非玩家选项'})]},
 {id:'escort',title:'镖局',bucket:'chapter2',rank:90,timing:'第9回合 · 日历事件',flow:'前段含玩家选择 → 若参战，进入战斗 → 胜利或失败对白（二选一）。不参战直接结算。',evidence:'cultivation_event_policy.gd#trigger_calendar(day == 9)；cultivation_ui.gd#_on_escort_part1_finished',children:[child(S('get_escort_lines'),'前段 · 含玩家选择'),child(S('get_escort_combat_victory_lines'),'战斗胜利','condition',{condition:'选择参战且战斗胜利',branch:'battle'}),child(S('get_escort_combat_defeat_lines'),'战斗失败','condition',{condition:'选择参战且战斗失败',branch:'battle'})]},
 {id:'mother-care',title:'严师慈母',bucket:'conditional',rank:20,timing:'授艺后达到剑术门槛 · 具体回合未定',flow:'白天练功房段 → 同一日休息后夜晚段。错过当日休息会失去夜段；并非无条件连播。',evidence:'cultivation_manager.gd：_should_trigger_stern_mother_care / _should_trigger_stern_mother_care_night_on_rest；ui/cultivation_calendar_rest_flow.gd',children:[child(D('SternMotherCareEvent','create_day_lines'),'白天'),child(D('SternMotherCareEvent','create_night_lines'),'夜晚 · 同日休息后','phase',{condition:'白天段完成且同日休息，非必然触发'})]},
 {id:'river-sword',title:'江畔悟剑',bucket:'conditional',rank:30,timing:'低心情条件事件 · 具体回合未定',flow:'前段 → 事件判定 / 行动结算 → 后段。没有证据将其接到其他故事。',evidence:'cultivation_ui.gd：low_mood_river_sword_event → _on_low_mood_river_sword_part1_done / _on_low_mood_river_sword_upgrade_resolved → create_part2_lines',children:[child(D('LowMoodRiverSwordEvent','create_part1_lines'),'前段'),child(D('LowMoodRiverSwordEvent','create_part2_lines'),'后段')]},
 {id:'reed-flat',title:'芦苇滩',bucket:'conditional',rank:40,timing:'第一段养成 · 条件触发，回合未定',flow:'前段含玩家选择 → 若出手，进入战斗 → 胜利或失败对白（二选一）。选择不管闲事则结束，不进入战后。',evidence:'cultivation_ui.gd：reed_flat_event → _on_reed_flat_part1_finished → 按 _reed_flat_result 调胜利 / 失败来源',children:[child(S('get_reed_flat_part1_lines'),'前段 · 含玩家选择'),child(S('get_reed_flat_victory_lines'),'战斗胜利','condition',{condition:'选择出手且战斗胜利',branch:'battle'}),child(S('get_reed_flat_defeat_lines'),'战斗失败','condition',{condition:'选择出手且战斗失败',branch:'battle'})]},
 {id:'cats',title:'街巷遇猫',bucket:'conditional',rank:50,timing:'投喂进度与携鱼条件 · 具体回合未定',flow:'遇猫开场 → 有鱼时进入投喂 / 不投喂的玩家选择；无鱼直接离开。投喂完成后可再会；再会未投喂成功且后来有鱼，可再次尝试。不是五段必经连播。',evidence:'cultivation_story_events.gd#get_cat_feeding_lines 显式调用两个 helper；cultivation_ui.gd#_trigger_cat_npc_action 按进度分发再会和重试',children:[child(S('get_cat_feeding_lines'),'遇猫 · 条件开场'),child(S('_cat_feeding_choice_and_branches'),'有鱼 · 投喂 / 不投喂','choice',{condition:'携带鲜鱼才出现；玩家决定投喂与否',helper:true}),child(S('_cat_feeding_skip_lines'),'无鱼 · 直接离开','condition',{condition:'没有鲜鱼；不是一次玩家选项',helper:true}),child(S('get_cat_third_lines'),'完成投喂后 · 再会','phase',{condition:'已完成首次投喂，尚未看过再会'}),child(S('get_cat_third_retry_lines'),'再会后 · 再次投喂','retry',{condition:'再会尚未投喂成功，后来携带鲜鱼'})]},
 {id:'teahouse-encounter',title:'茶馆偶遇',bucket:'conditional',rank:60,timing:'入茶馆时按人物决定 · 回合未定',flow:'入茶馆 → 按 npc_id 阅读遇见万钧或遇见迦南。人物情况彼此替代，不是先后阶段，也不是玩家选项。其他人物暂无对白。',evidence:'cultivation_data.gd#TeahouseNpcEncounter.get_dialogue_lines match npc_id；cultivation_ui.gd#teahouse_npc_encounter_event',children:[child(D('TeahouseNpcEncounter','get_dialogue_lines'),'遇见万钧','condition',{caseValue:'wanjun'}),child(D('TeahouseNpcEncounter','get_dialogue_lines'),'遇见迦南','condition',{caseValue:'jianan'}),child(D('TeahouseNpcEncounter','get_dialogue_lines'),'其他人物 · 暂无对白','condition',{caseValue:'other'})]}
];
for(const [id,title,fn,bucket,rank]of [['shop-evict','商铺赶人','_stage1_shop_evict','window1',10],['wharf-robbery','货场抢袋','_stage1_wharf_robbery','window1',20],['tang-salt','寻访唐智','_stage2_tang_salt','window2',20]])definitions.push({id,title,bucket,rank,timing:bucket==='window1'?'委托阶段1 · 第5–10回合，窗口内顺序未定':'委托阶段2 · 第11–16回合，窗口内顺序未定',flow:'战前 → 委托战斗 → 战后按胜利 / 失败切换；结果互斥，非玩家选项。'+(id==='tang-salt'?'唐智逃脱走单独结算，不能假作普通胜败。':''),evidence:'teahouse_commission_dialogue.gd profile 精确映射；cultivation_ui.gd pre → combat → post(profile,victory)；salt_peddler_resolution.gd 逃脱结算',children:[child(C(fn+'_pre_combat'),'战前'),child(C(fn+'_post_combat'),'战后 · 胜败情况','phase',{condition:'由胜败条件切换'})]});
const facts=new Map([
 [D('HomeSegmentEvent','create_intro'),{bucket:'chapter1',rank:10,timing:'第1回合 · 归家'}],
 [D('LetterEvent','create_event'),{bucket:'chapter1',rank:20,timing:'第2回合 · 红夜来信'}],
 [D('HomeSegmentEvent','create_town_unlock'),{bucket:'chapter2',rank:50,timing:'第5回合 · 出门开放'}],
 [D('Day12CountdownEvent','create_lines'),{bucket:'chapter3',rank:120,timing:'第12回合 · 休息时触发'}],
 [D('Day19EveEvent','create_lines'),{bucket:'unconfirmed',rank:10,timing:'源码目标第19日；现行16回合，实际可达性待确认'}],
 [D('HomeSegmentEvent','create_mother_card_teaching'),{bucket:'conditional',rank:10,timing:'首次练功房授艺 · 木人前置，回合未定'}],
 [C('_stage2_appraisal_event'),{bucket:'window2',rank:10,timing:'委托阶段2 · 第11–16回合，窗口内顺序未定'}],
 [C('_stage2_jianan_event'),{bucket:'window2',rank:30,timing:'委托阶段2 · 第11–16回合，窗口内顺序未定'}]
]);
function sourceKey(r){const m=r.manifest;return key(m.sourcePath,m.className,m.functionName);}
function normalizeOrder(order){return Array.isArray(order)?[...new Set(order.filter(x=>typeof x==='string'&&x.length<600))].slice(0,256):[];}
function build(records,query='',order=[]){
 const sourceGroups=directory.group(records),storyRows=sourceGroups.groups.find(g=>g.id==='story').records,byKey=new Map(storyRows.map(r=>[sourceKey(r),r])),used=new Set(),all=[];
 for(const def of definitions){const children=def.children.filter(c=>byKey.has(c.key)).map((c,i)=>({...c,id:def.id+':'+c.key+':'+(c.caseValue||''),record:byKey.get(c.key)}));if(!children.length)continue;const sourceIds=[...new Set(children.map(c=>c.record.manifest.id))];sourceIds.forEach(id=>used.add(id));const missing=def.children.filter(c=>!byKey.has(c.key)).map(c=>c.label),blocks=[];
  for(const c of children){if(c.helper||c.caseValue&&blocks.length)continue;if(c.branch){if(!blocks.some(b=>b.id===c.branch))blocks.push({id:c.branch,label:'条件后续 · 战斗结果（互斥）',alternatives:children.filter(x=>x.branch===c.branch)});}else blocks.push({id:c.id,label:c.caseValue?'人物情况 · 非玩家选项':c.label,child:c});}
  all.push({...def,id:'story:'+def.id,children,sourceIds,missing,blocks,grouped:true});
 }
 for(const r of storyRows){if(used.has(r.manifest.id))continue;const fact=facts.get(sourceKey(r))||{bucket:'conditional',rank:100,timing:'独立剧情 · 触发回合与其他事件先后未确认'};all.push({...fact,id:'source:'+r.manifest.id,title:directory.title(r.manifest),sourceIds:[r.manifest.id],record:r,children:[],missing:[],grouped:false});}
 const rank=new Map(buckets.map((b,i)=>[b.id,i]));all.sort((a,b)=>rank.get(a.bucket)-rank.get(b.bucket)||(a.rank||0)-(b.rank||0)||a.title.localeCompare(b.title,'zh-CN'));
 const ordered=normalizeOrder(order),positions=new Map(ordered.map((id,i)=>[id,i]));if(ordered.length)all.sort((a,b)=>(positions.get(a.id)??1e6)-(positions.get(b.id)??1e6));
 const q=String(query||'').trim().toLowerCase(),hits=new Set();const stories=all.map(s=>{const parentHit=q&&[s.title,s.timing,s.flow,buckets.find(b=>b.id===s.bucket)?.label].join(' ').toLowerCase().includes(q),matches=r=>!q||parentHit||directory.matches(r,q),children=s.children.filter(c=>matches(c.record)||[c.label,c.kind,c.condition].join(' ').toLowerCase().includes(q));if(s.grouped){children.forEach(c=>hits.add(c.record.manifest.id));return {...s,children};}if(matches(s.record)){hits.add(s.record.manifest.id);return s;}return null;}).filter(s=>s&&(!s.grouped||s.children.length));
 const auxiliary=sourceGroups.groups.filter(g=>g.id!=='story').map(g=>({...g,records:g.records.filter(r=>directory.matches(r,q))}));auxiliary.forEach(g=>g.records.forEach(r=>hits.add(r.manifest.id)));
 return {stories,allStories:all,buckets:buckets.map(b=>({...b,stories:stories.filter(s=>s.bucket===b.id),total:all.filter(s=>s.bucket===b.id).length})),auxiliary,storyCount:all.length,matchedStories:stories.length,sourceCount:records.length,matchedSources:hits.size,storySourceCount:storyRows.length};
}
function caseIndex(model,value){return model.cases?.findIndex(c=>value==='other'?c.conditions.every(q=>q.param!=='npc_id'||!q.positive):c.conditions.some(q=>q.param==='npc_id'&&q.positive&&q.value?.value===value))??-1;}
const api={build,normalizeOrder,caseIndex};if(typeof module!=='undefined')module.exports=api;root.GCSEventStories=api;
})(typeof window!=='undefined'?window:globalThis);
