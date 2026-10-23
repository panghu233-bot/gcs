/* Bounded local discovery. IDs identify source scopes, not inferred runtime event identity. */
(function(root){
'use strict';
const p=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const sourcePaths=['scripts/cultivation/cultivation_data.gd','scripts/cultivation/cultivation_story_events.gd','scripts/cultivation/teahouse_commission_dialogue.gd'];
const entryPaths=['scripts/cultivation/cultivation_ui.gd','scripts/cultivation/ui/cultivation_calendar_rest_flow.gd','scripts/cultivation/salt_peddler_resolution.gd'];
const paths=[...sourcePaths,...entryPaths],names={'Day12CountdownEvent.create_lines':'指日可待','Day19EveEvent.create_lines':'前夜','LowMoodRestInsomniaEvent.create_lines':'夜难成寐','LowMoodRiverSwordEvent.create_part1_lines':'江畔悟剑 · 前段','LowMoodRiverSwordEvent.create_part2_lines':'江畔悟剑 · 后段','SternMotherCareEvent.create_day_lines':'严师慈母 · 白天','SternMotherCareEvent.create_night_lines':'严师慈母 · 夜晚','FirstMusicTeachingEvent.create_lines':'首次授琴','MusicLineEvents.create_person_event_1_lines':'练琴观看① · 源码临时占位','MusicLineEvents.create_person_event_2_lines':'练琴观看② · 源码临时占位','MusicLineEvents.create_exam_lines':'音律考核 · 源码临时占位','get_reed_flat_part1_lines':'芦苇滩 · 前段','get_reed_flat_victory_lines':'芦苇滩 · 胜利对白','get_reed_flat_defeat_lines':'芦苇滩 · 败北对白','get_escort_lines':'镖局 · 前段','get_escort_combat_victory_lines':'镖局 · 胜利对白','get_escort_combat_defeat_lines':'镖局 · 败北对白'};
function projected(ts){
 const rows=[];for(let i=0;i<ts.length;i++)if(ts[i].value==='{'){
  let depth=1,end=i+1;while(end<ts.length&&depth){if(ts[end].value==='{')depth++;if(ts[end].value==='}')depth--;end++;}
  const row={};let inner=0;for(let j=i+1;j<end-1;j++){if(['{','['].includes(ts[j].value))inner++;if(['}',']'].includes(ts[j].value))inner--;if(inner===0&&ts[j].kind==='string'&&ts[j+1]?.value===':'&&ts[j+2]?.kind==='string'&&[',','}'].includes(ts[j+3]?.value)){row[ts[j].value]=ts[j+2].value;}}
  if(typeof row.text==='string'&&typeof row.speaker==='string')rows.push({...row,line:ts[i].line});
  else if(typeof row.prompt==='string')rows.push({text:row.prompt,speaker:'【分支选择】',line:ts[i].line});
 }return rows;
}
function discover(files,onlyId=null){
 const records=[],errors=[],entries={};for(const path of entryPaths)if(files[path])try{entries[path]=p.lex(p.decode(files[path]));}catch(e){errors.push(path+'：'+e.message);}for(const sourcePath of sourcePaths){if(!files[sourcePath])continue;let source,all;
  try{source=p.decode(files[sourcePath]);all=p.lex(source);}catch(e){errors.push(sourcePath+'：'+e.message);continue;}
  const script=all.findIndex(t=>t.value==='class_name'),scriptName=script<0?'CultivationData':all[script+1]?.value;
  for(let i=0;i<all.length-2;i++)if(all[i].value==='static'&&all[i].head&&all[i+1].value==='func'){
   const functionName=all[i+2].value;let fn;try{const tail=all.slice(i);let end=1;while(end<tail.length&&!(tail[end].head&&tail[end].column<=tail[0].column))end++;fn=tail.slice(0,end);}catch{continue;}
   let className=null;for(let j=i-1;j>=0;j--)if(all[j].head&&all[j].column===0){if(all[j].value==='class')className=all[j+1].value;break;}
   const arrow=fn.findIndex((t,k)=>t.value==='-'&&fn[k+1]?.value==='>'),array=arrow>=0&&fn[arrow+2]?.value==='Array'&&fn[arrow+3]?.value==='['&&fn[arrow+4]?.value==='Dictionary';
   const titleToken=fn.findIndex((t,k)=>t.value==='.'&&fn[k+1]?.value==='title'&&fn[k+2]?.value==='='&&fn[k+3]?.kind==='string');
   if(!array&&titleToken<0)continue;
   if(array&&titleToken<0&&!fn.some((t,k)=>t.kind==='string'&&['speaker','text','prompt'].includes(t.value)&&fn[k+1]?.value===':')&&!fn.some((t,k)=>t.kind==='id'&&t.value.startsWith('_')&&fn[k+1]?.value==='('))continue;
   const key=(className?className+'.':'')+functionName,id=key==='Day12CountdownEvent.create_lines'?'day12_countdown':sourcePath+'#'+key;
   if(onlyId&&id!==onlyId)continue;
   const call=(className?'CultivationData.'+className:scriptName)+'.'+functionName+'(',needle=p.lex(call);
   let entryPath=null;for(const path of entryPaths){if(!entries[path])continue;const tokens=entries[path];if(tokens.some((_,j)=>p.sameTokens(tokens.slice(j,j+needle.length),call))){entryPath=path;break;}}
   const spec={id,title:names[key]||(titleToken>=0?fn[titleToken+3].value:key),sourcePath,entryPath,className,functionName,adapter:id==='day12_countdown'?'legacy':'static',expectedCount:id==='day12_countdown'?7:undefined};
   if(id==='day12_countdown')spec.entryFunction='on_day12_countdown_rest_requested';
   let parsed,reason='';try{
    if(!array)throw Error('事件工厂包含奖励、分支或对象构造，仅展示源配置');
    if(!entryPath)throw Error('未确认直接执行入口；此项是源码对白片段，不推断运行时事件');
    if(fn[4]?.value!==')')throw Error('对白依赖运行参数或动态分支，当前仅支持无参数直线对白');
    parsed=p.readLinear(files[sourcePath],spec);
    if(id==='day12_countdown'){const events=typeof module!=='undefined'?require('./event-project.js'):root.GCSEventProject;events.parse(files,spec);}
    if(parsed.body.hasComments)throw Error('函数体包含注释，无法确认结构修改时的归属');
    if(parsed.lines.some(r=>!r.mood||[r.left,r.right,r.mood].includes('<inherit>')||!r.speaker&&!r.left&&!r.right))throw Error('含继承状态或无法可靠清场的演出');
    const trial=parsed.lines.map(({token,...r})=>r);trial.push({...trial[0]});p.planLines({originalBytes:files[sourcePath],spec,lines:trial,structureChanged:true});
   }catch(e){reason=e.message;}
   const rawSource=source.slice(fn[0].start,fn.at(-1).end);
   records.push({manifest:Object.freeze(spec),editable:!reason,reason,lines:parsed?.lines||projected(fn),rawSource});
  }
 }
 return {records,errors};
}
function resolve(files,id){const r=discover(files,id).records.find(r=>r.manifest.id===id);if(!r||!r.editable)throw Error('事件只读或未确认：'+(r?.reason||id));return r.manifest;}
const api={paths,sourcePaths,entryPaths,discover,resolve};if(typeof module!=='undefined')module.exports=api;root.GCSEventCatalog=api;
})(typeof window!=='undefined'?window:globalThis);
