/* A non-executing reading route over the existing proved graph. No game state is evaluated. */
(function(root){
'use strict';
const flow=typeof module!=='undefined'?require('./event-flow.js'):root.GCSEventFlow;
const patch=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const stats={appraisal:'鉴定',martial:'武学',sword:'武学',agility:'身法',music:'音律',wine:'酒艺',knowledge:'学识'};
function scalar(raw){if(typeof raw!=='string')return null;try{const ts=patch.lex(raw);if(ts.length!==1)return null;const t=ts[0];return t.kind==='string'?t.value:t.kind==='number'?Number(t.value):t.value==='true'?true:t.value==='false'?false:null;}catch{return null;}}
function requirement(raw){try{const ts=patch.lex(raw),out={};if(ts[0]?.value!=='{'||ts.at(-1)?.value!=='}')return null;let i=1;while(i<ts.length-1){const key=ts[i++];if(key.kind!=='string'||ts[i++]?.value!==':')return null;const value=ts[i++];if(!['string','number'].includes(value?.kind)||Object.hasOwn(out,key.value))return null;out[key.value]=value.kind==='number'?Number(value.value):value.value;if(ts[i]?.value===',')i++;else if(ts[i]?.value!=='}')return null;}return stats[out.stat]&&Number.isSafeInteger(out.min)?{stat:stats[out.stat],min:out.min}:null;}catch{return null;}}
function title(spec){const name=spec.functionName,known={get_dialogue_lines:'茶馆偶遇',create_shop_riot_post_combat:'藏雨阁闹事 · 战后',_cat_feeding_skip_lines:'喂猫 · 离开',_cat_feeding_choice_and_branches:'喂猫 · 选择',get_cat_feeding_lines:'街巷遇猫',get_cat_third_lines:'猫儿再会',get_cat_third_retry_lines:'猫儿再会 · 后续'};if(known[name])return known[name];if(name.startsWith('_stage')){const subject=name.includes('shop_evict')?'商铺风波':name.includes('wharf')?'码头委托':name.includes('appraisal')?'鉴定委托':name.includes('tang_salt')?'寻访唐智':name.includes('jianan')?'迦南委托':'茶馆委托';return subject+(name.includes('post_combat')?' · 战后':name.includes('pre_combat')?' · 前段':'');}return /[\u3400-\u9fff]/.test(spec.title)?spec.title:'剧情片段';}
function safeText(line){return line?.editable===false&&/变量|拼接|格式化|文字包含/.test(line.reason||'')?'这段文字会随游戏状态变化，暂不能完整展示。':line?.text||'（无台词）';}
function model(w){
 const lines=w.lines;let graph=null;try{if(w.originalBytes)graph=flow.read(w.originalBytes,w.manifest);}catch{}
 if(w.capability==='full'||!w.textOnly&&!w.readOnly)return {linear:true,lines,graph,w,verified:true};
 if(!graph)return {linear:false,lines,graph:null,w,verified:false,nodes:new Map(),edges:[]};
 for(const n of graph.nodes)if(n.kind==='choice'){
  const rows=n.indices.map(i=>({line:lines[i],index:i})),prompt=rows.find(r=>r.line?.kind==='prompt'),options=rows.filter(r=>r.line?.kind==='option');n.promptIndex=prompt?.index;n.prompt=prompt?.line.text||'你会怎么做？';
  n.options=n.options.map((o,i)=>({...o,slotIndex:options[i]?.index,text:options[i]?safeText(options[i].line):o.text}));
  if(w.branch?.overrides[n.id])n.options=w.branch.options(n.id).map((o,index)=>({...o,index,slotIndex:null,target:graph.arrays[n.arrayIndex].flowRows[graph.arrays[n.arrayIndex].labels.get(o.targetLabel)]?.id}));
  if(n.options.every(o=>o.target)){graph.edges=graph.edges.filter(e=>e.from!==n.id);for(const o of n.options)graph.edges.push({from:n.id,to:o.target,label:(o.index+1)+'. '+o.text});}
 }
 return {linear:false,lines,graph,w,verified:!!w.flowVerified&&graph.entryConfirmed,nodes:new Map(graph.nodes.map(n=>[n.id,n])),edges:graph.edges};
}
function effect(option,cards=[]){const fields=option.fields||{},card=scalar(fields.card_id);if(card){const actual=cards.find(r=>r.id===card),name=actual?.value?.name||actual?.name;return name?'将领悟招式：'+name:'将领悟所选招式。';}const success=scalar(fields.set_success);if(success!==null)return success?'此选择按成功结果结算。':'此选择按未成功结果结算。';const escort=scalar(fields.escort_result);return escort===2?'护镖将进入出手相助的后续。':escort===1?'护镖将进入按兵不动的后续。':'';}
function trace(m,selections={}){
 const items=[],visited=new Set(),result={items,visited,complete:false};
 if(m.linear){m.lines.forEach((line,index)=>items.push({kind:'dialogue',index}));items.push({kind:'end'});result.complete=true;return result;}
 if(!m.verified){items.push({kind:'limit',text:'暂时无法确认这段故事的完整顺序。你可以展开下方的独立片段阅读。'});return result;}
 let id=m.graph.entryId;
 while(id){if(visited.has(id)){items.push({kind:'limit',text:'剧情将返回前面的内容。为避免重复，阅读暂时停在这里。'});return result;}visited.add(id);const n=m.nodes.get(id);if(!n){items.push({kind:'limit',text:'后续内容暂未确认，阅读在这里暂停。'});return result;}const next=m.edges.filter(e=>e.from===id);
  if(n.kind==='dialogue'){for(const index of n.indices)items.push({kind:'dialogue',index,node:id});}
  else if(n.kind==='choice'){items.push({kind:'choice',node:n,selected:selections[id]});const option=n.options[selections[id]];if(!option)return result;const note=effect(option,m.w.readingCards);if(note)items.push({kind:'note',text:note});if(!option.target){items.push({kind:'limit',text:'这个选项的后续暂未确认，无法继续展开。'});return result;}id=option.target;continue;}
  else if(n.kind==='condition'){
   const req=requirement(n.fields?.requires_stat),stat=stats[scalar(n.fields?.stat)],threshold=scalar(n.fields?.threshold);
   if(req&&next.length===1){items.push({kind:'note',text:'需要'+req.stat+'达到'+req.min+'。以下展示满足条件时的剧情。'});}
   else if(stat&&typeof threshold==='number'){items.push({kind:'outcome',node:n,text:'这里需要进行'+stat+'判定（'+threshold+'）。请选择要阅读的结果。',options:next.map((e,i)=>({target:e.to,text:i===0?'查看判定成功的后续':'查看判定失败的后续'})),selected:selections[id]});const chosen=next[selections[id]];if(!chosen)return result;id=chosen.to;continue;}
   else {items.push({kind:'limit',text:'这里的条件与后续顺序尚未完整确认，暂不继续展开。'});return result;}
  }
  else if(n.kind==='combat'){const options=next.filter(e=>m.nodes.get(e.to)?.kind==='external'&&m.nodes.get(e.to)?.fields?.targetFunction);items.push({kind:'outcome',node:n,text:'接下来进入战斗。请选择要阅读的战斗结果。',options:options.map((e,i)=>({target:e.to,text:i===0?'查看战斗胜利后的剧情':'查看战斗失败后的剧情'})),selected:selections[id]});const chosen=options[selections[id]];if(!chosen){if(!options.length)items.push({kind:'limit',text:'战斗结束后的剧情尚未确认。'});return result;}id=chosen.to;continue;}
  else if(n.kind==='external'){const record=m.w.eventRecords?.find(r=>r.manifest.sourcePath===n.fields?.sourcePath&&r.manifest.functionName===n.fields?.targetFunction);if(record?.capability==='full'){items.push({kind:'external',record});items.push({kind:'end'});result.complete=true;}else items.push({kind:'limit',text:'接下来由其他剧情继续，目前还不能在这里确认完整内容。'});return result;}
  else if(n.kind==='end'){items.push({kind:'end'});result.complete=true;return result;}
  else if(n.kind==='scene')items.push({kind:'note',text:'场景转换。'});
  else if(n.kind==='unknown'){items.push({kind:'limit',text:'后续内容暂未确认，阅读在这里暂停。'});return result;}
  if(next.length!==1){items.push({kind:'limit',text:'后续顺序尚未确认，暂不继续展开。'});return result;}id=next[0].to;
 }
 return result;
}
function fragments(m){if(m.linear)return [];if(!m.graph)return m.lines.length?[m.lines.map((_,i)=>i)]:[];const reachable=new Set(),queue=m.verified?[m.graph.entryId]:[];while(queue.length){const id=queue.shift();if(reachable.has(id))continue;reachable.add(id);for(const e of m.edges.filter(e=>e.from===id))queue.push(e.to);}const used=new Set();return m.graph.nodes.filter(n=>!reachable.has(n.id)).map(n=>n.indices.filter(i=>{if(used.has(i))return false;used.add(i);return true;})).filter(a=>a.length);}
const api={model,trace,fragments,safeText,scalar,requirement,title,effect};if(typeof module!=='undefined')module.exports=api;root.GCSEventReading=api;
})(typeof window!=='undefined'?window:globalThis);
