/* Presentation-only source directory. Never changes manifests, adapters, or write permissions. */
(function(root){
'use strict';
const patch=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const data='scripts/cultivation/cultivation_data.gd',story='scripts/cultivation/cultivation_story_events.gd',commission='scripts/cultivation/teahouse_commission_dialogue.gd';
const labels={
 [data+'#TeahouseNpcEncounter.get_dialogue_lines']:'茶馆偶遇',
 [data+'#HomeSegmentEvent.create_battle_tutorial_intro']:'木人试招 · 战前',
 [data+'#HomeSegmentEvent.create_battle_tutorial_post']:'木人试招 · 战后',
 [data+'#HomeSegmentEvent.create_shop_riot']:'藏雨阁闹事 · 战前',
 [data+'#HomeSegmentEvent.create_shop_riot_post_combat']:'藏雨阁闹事 · 战后',
 [data+'#ReedFlatEvent.create_event']:'芦苇滩奇遇 · 事件工厂',
 [story+'#_cat_feeding_skip_lines']:'街巷遇猫 · 离开',
 [story+'#_cat_feeding_choice_and_branches']:'街巷遇猫 · 喂食选择',
 [story+'#get_cat_feeding_lines']:'街巷遇猫',
 [story+'#get_cat_third_lines']:'猫儿再会',
 [story+'#get_cat_third_retry_lines']:'猫儿再会 · 再次尝试',
 [commission+'#get_pre_combat_lines']:'茶馆委托 · 战前分发',
 [commission+'#get_skill_event_lines']:'茶馆委托 · 技艺分发',
 [commission+'#get_post_combat_lines']:'茶馆委托 · 战后分发',
 [commission+'#_stage1_shop_evict_pre_combat']:'商铺赶人 · 战前',
 [commission+'#_stage1_shop_evict_post_combat']:'商铺赶人 · 战后',
 [commission+'#_stage1_wharf_robbery_pre_combat']:'货场抢袋 · 战前',
 [commission+'#_stage1_wharf_robbery_post_combat']:'货场抢袋 · 战后',
 [commission+'#_stage2_appraisal_event']:'鉴定委托',
 [commission+'#_stage2_tang_salt_pre_combat']:'寻访唐智 · 战前',
 [commission+'#_stage2_tang_salt_post_combat']:'寻访唐智 · 战后',
 [commission+'#_stage2_jianan_event']:'迦南委托'
};
const key=spec=>spec.sourcePath+'#'+(spec.className?spec.className+'.':'')+spec.functionName;
const timeline=spec=>/^timeline\/.+\.dtl$/.test(spec.sourcePath||'');
function title(spec){if(timeline(spec))return spec.sourcePath.split('/').at(-1);return labels[key(spec)]||(/[\u3400-\u9fff]/.test(spec.title||'')?spec.title:((spec.className?spec.className+' · ':'')+(spec.functionName||spec.id||'未命名来源')));}
// Only these exact, inspected bodies are known to contain no independent story.
// If a body changes, keep it in the main story list until it is inspected again.
const technical={};
for(const [name,profiles,targets,post]of [
 ['get_pre_combat_lines',['STAGE1_SHOP_EVICT','STAGE1_WHARF_ROBBERY','STAGE2_TANG_SALT'],['_stage1_shop_evict_pre_combat','_stage1_wharf_robbery_pre_combat','_stage2_tang_salt_pre_combat'],false],
 ['get_skill_event_lines',['STAGE2_APPRAISAL','STAGE2_JIANAN'],['_stage2_appraisal_event','_stage2_jianan_event'],false],
 ['get_post_combat_lines',['STAGE1_SHOP_EVICT','STAGE1_WHARF_ROBBERY','STAGE2_TANG_SALT'],['_stage1_shop_evict_post_combat','_stage1_wharf_robbery_post_combat','_stage2_tang_salt_post_combat'],true]
])technical[commission+'#'+name]={kind:'分发入口',explanation:'按委托类型'+(post?'和战斗结果':'')+'转到下列真实剧情，自身没有独立对白。',related:targets.map(t=>commission+'#'+t),body:'static func '+name+'(profile: StringName'+(post?', victory: bool':'')+') -> Array[Dictionary]:\n match profile:\n'+profiles.map((p,i)=>'  PROFILE_'+p+':\n   return '+targets[i]+'('+(post?'victory':'')+')').join('\n')+'\n  _:\n   return []'};
technical[data+'#ReedFlatEvent.create_event']={kind:'事件工厂',explanation:'只创建芦苇滩事件并设置标题与简介；对白来自独立的前段、胜利和败北来源。',related:['get_reed_flat_part1_lines','get_reed_flat_victory_lines','get_reed_flat_defeat_lines'].map(t=>story+'#'+t),body:'static func create_event() -> ReedFlatEvent:\n var e := ReedFlatEvent.new()\n e.title = ""\n e.description = ""\n return e'};
function describe(record){
 const spec=record.manifest,cap=record.capability||(record.editable?'full':'readonly'),capLabel={full:'完整编辑',text:'仅文字编辑',readonly:'只读'}[cap]||'只读',name=title(spec);
 if(timeline(spec))return {category:'dialogic',title:name,subtitle:'时间轴 · 原文只读 · '+spec.sourcePath.slice(9,-name.length).replace(/\/$/,''),capability:cap,related:[]};
 const known=technical[key(spec)];let verified=false;
 if(known&&!record.editable&&cap==='readonly'&&!record.lines?.length&&record.rawSource)try{verified=patch.sameTokens(patch.lex(record.rawSource).map(t=>t.kind==='string'?{...t,value:''}:t),known.body);}catch{}
 if(verified)return {category:'technical',title:name,subtitle:known.kind+' · 无独立对白 · 只读',capability:cap,explanation:known.explanation,related:known.related};
 const count=(record.lines||[]).filter(line=>!line.kind||line.kind==='dialogue').length;
 return {category:'story',title:name,subtitle:(count?count+' 句':'动态剧情 / 待解析')+' · '+capLabel,capability:cap,related:[]};
}
const categories=[{id:'story',label:'剧情',collapsed:false},{id:'dialogic',label:'Dialogic 时间轴',collapsed:false},{id:'technical',label:'技术来源',collapsed:true}];
function matches(record,query){const q=String(query||'').trim().toLowerCase();if(!q)return true;const d=describe(record),category=categories.find(c=>c.id===d.category);return JSON.stringify([d.title,d.subtitle,category.label,record.manifest.id,record.manifest.title,record.manifest.sourcePath,record.manifest.functionName,record.lines,record.rawSource]).toLowerCase().includes(q);}
function group(records,query=''){const groups=categories.map(c=>({...c,total:0,records:[]}));for(const record of records){const g=groups.find(g=>g.id===describe(record).category);g.total++;if(matches(record,query))g.records.push(record);}return {total:records.length,matched:groups.reduce((n,g)=>n+g.records.length,0),groups};}
const api={title,describe,matches,group};if(typeof module!=='undefined')module.exports=api;root.GCSEventDirectory=api;
})(typeof window!=='undefined'?window:globalThis);
