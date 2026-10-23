/* Bounded local discovery. IDs identify source scopes, not inferred runtime event identity. */
(function(root){
'use strict';
const p=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const sourcePaths=['scripts/cultivation/cultivation_data.gd','scripts/cultivation/cultivation_story_events.gd','scripts/cultivation/teahouse_commission_dialogue.gd'];
const entryPaths=['scripts/cultivation/cultivation_ui.gd','scripts/cultivation/ui/cultivation_calendar_rest_flow.gd','scripts/cultivation/salt_peddler_resolution.gd','scripts/cultivation/cultivation_battle_tutorial_flow.gd'];
const paths=[...sourcePaths,...entryPaths],names={'Day12CountdownEvent.create_lines':'指日可待','Day19EveEvent.create_lines':'前夜','LowMoodRestInsomniaEvent.create_lines':'夜难成寐','LowMoodRiverSwordEvent.create_part1_lines':'江畔悟剑 · 前段','LowMoodRiverSwordEvent.create_part2_lines':'江畔悟剑 · 后段','SternMotherCareEvent.create_day_lines':'严师慈母 · 白天','SternMotherCareEvent.create_night_lines':'严师慈母 · 夜晚','FirstMusicTeachingEvent.create_lines':'首次授琴','MusicLineEvents.create_person_event_1_lines':'练琴观看① · 源码临时占位','MusicLineEvents.create_person_event_2_lines':'练琴观看② · 源码临时占位','MusicLineEvents.create_exam_lines':'音律考核 · 源码临时占位','get_reed_flat_part1_lines':'芦苇滩 · 前段','get_reed_flat_victory_lines':'芦苇滩 · 胜利对白','get_reed_flat_defeat_lines':'芦苇滩 · 败北对白','get_escort_lines':'镖局 · 前段','get_escort_combat_victory_lines':'镖局 · 胜利对白','get_escort_combat_defeat_lines':'镖局 · 败北对白'};
function projected(ts){
 const rows=[];for(let i=0;i<ts.length;i++)if(ts[i].value==='{'){
  let depth=1,end=i+1;while(end<ts.length&&depth){if(ts[end].value==='{')depth++;if(ts[end].value==='}')depth--;end++;}
  const row={};let inner=0;for(let j=i+1;j<end-1;j++){if(['{','['].includes(ts[j].value))inner++;if(['}',']'].includes(ts[j].value))inner--;if(inner===0&&ts[j].kind==='string'&&ts[j+1]?.value===':'&&ts[j+2]?.kind==='string'&&[',','}'].includes(ts[j+3]?.value)){row[ts[j].value]=ts[j+2].value;}}
  if(typeof row.text==='string'&&typeof row.speaker==='string')rows.push({...row,line:ts[i].line});
  else if(typeof row.prompt==='string')rows.push({text:row.prompt,speaker:'【分支选择】',line:ts[i].line});
 }return rows;
}
// Follow only named static calls in the same owner and explicit preload aliases.
function shadowed(tokens,name){const end=tokens.findIndex((t,i)=>i>2&&t.value===')');return tokens.some((t,i)=>['var','const'].includes(t.value)&&tokens[i+1]?.value===name)||tokens.slice(0,end).some((t,i)=>t.value===name&&(tokens[i+1]?.value===':'||['(',','].includes(tokens[i-1]?.value)));}
function enclosing(tokens,index){for(let i=index;i>=0;i--)if(tokens[i].value==='func'&&(tokens[i].head||tokens[i-1]?.head&&tokens[i-1].value==='static')){const start=tokens[i-1]?.value==='static'?i-1:i;let end=start+1;while(end<tokens.length&&!(tokens[end].head&&tokens[end].column<=tokens[start].column))end++;if(index<end)return tokens.slice(start,end);}return [];}
function reference(sourcePath,className,functionName,all,entries){
 const script=all.findIndex(t=>t.value==='class_name'),scriptName=script<0?'CultivationData':all[script+1]?.value,owner=className?p.scope(all,'class',className):all;
 const scopes=[];for(let i=0;i<owner.length-2;i++)if(owner[i].head&&owner[i].value==='static'&&owner[i+1].value==='func'&&owner[i].column===(className?owner.find(t=>t.value==='static')?.column:0)){try{const name=owner[i+2].value;scopes.push({name,tokens:p.scope(owner,'func',name)});}catch{}}
 const queue=[{name:functionName,chain:[functionName]}],seen=new Set();
 while(queue.length){const next=queue.shift();if(seen.has(next.name))continue;seen.add(next.name);
  for(const [path,tokens] of Object.entries(entries)){
   const aliases=[scriptName];for(let i=0;i<tokens.length-6;i++)if(tokens[i].value==='const'){let j=i+2;while(j<tokens.length&&tokens[j].line===tokens[i].line&&tokens[j].value!=='=')j++;if(tokens[j+1]?.value==='preload'&&tokens[j+2]?.value==='('&&tokens[j+3]?.kind==='string'&&tokens[j+3].value==='res://'+sourcePath&&tokens[j+4]?.value===')')aliases.push(tokens[i+1].value);}
   for(const alias of aliases){const call=alias+'.'+(className?className+'.':'')+next.name+'(',needle=p.lex(call);if(tokens.some((_,j)=>p.sameTokens(tokens.slice(j,j+needle.length),call)&&!shadowed(enclosing(tokens,j),alias)))return {entryPath:path,reference:next.chain.slice().reverse().join(' → ')};}
  }
  for(const caller of scopes){if(shadowed(caller.tokens,next.name))continue;const call=next.name+'(',needle=p.lex(call);if(caller.tokens.some((_,i)=>!['func','.'].includes(caller.tokens[i-1]?.value)&&p.sameTokens(caller.tokens.slice(i,i+needle.length),call)))queue.push({name:caller.name,chain:[...next.chain,caller.name]});}
 }return null;
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
   let entryPath=null;for(const path of entryPaths){if(!entries[path])continue;const tokens=entries[path];if(tokens.some((_,j)=>p.sameTokens(tokens.slice(j,j+needle.length),call)&&!shadowed(enclosing(tokens,j),className?'CultivationData':scriptName))){entryPath=path;break;}}
   let spec={id,title:names[key]||(titleToken>=0?fn[titleToken+3].value:key),sourcePath,entryPath,className,functionName,adapter:id==='day12_countdown'?'legacy':'static',expectedCount:id==='day12_countdown'?7:undefined};
   if(id==='day12_countdown')spec.entryFunction='on_day12_countdown_rest_requested';
   let parsed,reason='';try{
    if(!array)throw Error('事件工厂包含对象或其他配置，不允许重建函数');
    if(!entryPath)throw Error('未确认直接执行入口；此项是源码对白片段，不推断运行时事件');
    if(fn[4]?.value!==')')throw Error('对白依赖运行参数或动态分支，当前仅支持无参数直线对白');
    parsed=p.readLinear(files[sourcePath],spec);
    if(id==='day12_countdown'){const events=typeof module!=='undefined'?require('./event-project.js'):root.GCSEventProject;events.parse(files,spec);}
    if(parsed.body.hasComments)throw Error('函数体包含注释，无法确认结构修改时的归属');
    if(parsed.lines.some(r=>!r.mood||[r.left,r.right,r.mood].includes('<inherit>')||!r.speaker&&!r.left&&!r.right))throw Error('含继承状态或无法可靠清场的演出');
    const trial=parsed.lines.map(({token,...r})=>r);trial.push({...trial[0]});p.planLines({originalBytes:files[sourcePath],spec,lines:trial,structureChanged:true});
   }catch(e){reason=e.message;}
   let capability=reason?'readonly':'full',textParsed=null;
   if(reason){try{
    const ref=reference(sourcePath,className,functionName,all,entries);if(!ref)throw Error('未确认调用入口及静态引用链');
    const textSpec={...spec,...ref,adapter:'literal'};const text=typeof module!=='undefined'?require('./event-text.js'):root.GCSEventText;textParsed=text.read(files[sourcePath],textSpec);
    if(!textParsed.lines.some(r=>r.editable))throw Error('没有能证明归属的独立对白或选项字面量');
    spec=textSpec;capability='text';reason='仅替换已确认的已有文字；人物、演出、结构、分支、战斗与奖励保持锁定。完整编辑受限：'+reason;
   }catch(e){reason+='；文字编辑受限：'+e.message;}}
   const rawSource=source.slice(fn[0].start,fn.at(-1).end);
   records.push({manifest:Object.freeze(spec),capability,editable:capability!=='readonly',reason,lines:capability==='text'?textParsed.lines:(parsed?.lines||textParsed?.lines||projected(fn)),rawSource});
  }
 }
 return {records,errors};
}
function resolve(files,id){const r=discover(files,id).records.find(r=>r.manifest.id===id);if(!r||!r.editable)throw Error('事件只读或未确认：'+(r?.reason||id));return r.manifest;}
const api={paths,sourcePaths,entryPaths,discover,resolve};if(typeof module!=='undefined')module.exports=api;root.GCSEventCatalog=api;
})(typeof window!=='undefined'?window:globalThis);
