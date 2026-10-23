/* Static source graph. Edges describe proved player transitions, never source proximity. */
(function(root){
'use strict';
const p=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const text=typeof module!=='undefined'?require('./event-text.js'):root.GCSEventText;
function read(bytes,spec){
 const parsed=text.read(bytes,spec),s=parsed.structure,{ts,roots,split,dictionary,rowNode,literal,pairs,atContext}=s,source=parsed.source;
 const nodes=[],edges=[],arrays=[],warnings=[];
 const raw=e=>e?source.slice(ts[e.start].start,ts[e.end-1].end):'';
 const val=(m,k)=>literal(m?.get(k))?.value;
 const add=(kind,label,extra={})=>{const n={id:'n'+nodes.length,kind,label,indices:[],...extra};nodes.push(n);return n;};
 const link=(from,to,label='')=>{if(from&&to)edges.push({from:from.id,to:to.id,label});};
 for(const [ai,array] of roots.entries()){
  const expressions=split(array),rows=expressions.map(e=>{const n=rowNode(e);return {expr:e,node:n,map:n&&dictionary(n)};}),labels=new Map(),duplicates=new Set();
  rows.forEach((r,i)=>{const label=val(r.map,'anchor_label');if(label){if(labels.has(label))duplicates.add(label);labels.set(label,i);}});
  const group=atContext(array.start)+' / 数组 '+(ai+1),flowRows=[];
  const fragmented=roots.length>1&&!roots.every(a=>ts[a.start-1]?.value==='return');
  const target=(m,fallback)=>{if(!m)return null;if(fragmented&&(m.has('next_label')||m.has('next')))return null;if(m?.has('next_label')){const label=val(m,'next_label');return label&&!duplicates.has(label)&&labels.has(label)?labels.get(label):null;}if(m?.has('next')){if(roots.length>1||s.appendRows.length)return null;const e=m.get('next');return e.end===e.start+1&&ts[e.start].kind==='number'&&Number(ts[e.start].value)<rows.length?Number(ts[e.start].value):null;}return fallback;};
  rows.forEach((r,i)=>{
   const m=r.map,type=val(m,'type'),anchor=val(m,'anchor_label'),fields=m?Object.fromEntries([...m].map(([k,e])=>[k,raw(e)])):{};
   const indices=parsed.lines.flatMap((line,index)=>r.node&&Number(line.slotId?.match(/^dict-(\d+)/)?.[1])>=r.node.start&&Number(line.slotId?.match(/^dict-(\d+)/)?.[1])<=r.node.end?[index]:[]);
   let kind=!m||m.has('type')&&!type||m.has('anchor_label')&&!anchor?'unknown':type==='choice'?'choice':type==='branch_end'?'end':type==='combat_trigger'?'combat':type==='skill_check'||type==='escort_result_jump'?'condition':type==='jump_next'?'jump':m.has('speaker')&&m.has('text')?'dialogue':anchor&&!type?'anchor':type==='scene_change'?'scene':'unknown';
   const label=kind==='dialogue'?(anchor?anchor+' · ':'')+(val(m,'speaker')||'旁白')+'：'+(val(m,'text')??raw(m.get('text'))):kind==='choice'?(val(m,'prompt')||'玩家选择'):kind==='end'?'结束当前对白':kind==='combat'?'战斗 · '+(val(m,'combat_id')||'未确认 ID'):kind==='anchor'?anchor:kind==='condition'?'条件判断 · '+type:kind==='jump'?'跳转':kind==='scene'?'场景切换': '未知 / 动态片段';
   const previous=flowRows.at(-1),canGroup=kind==='dialogue'&&!anchor&&previous?.kind==='dialogue'&&!previous.map.has('next')&&!previous.map.has('next_label')&&![...labels.values()].includes(i)&&!rows.some(x=>['next','success_next','fail_next'].some(k=>{const e=x.map?.get(k);return e&&e.end===e.start+1&&ts[e.start].kind==='number'&&Number(ts[e.start].value)===i;}))&&!rows.some(x=>{const opt=x.map?.get('options'),a=opt&&pairs.get(opt.start);return a&&split(a).some(e=>target(dictionary(pairs.get(e.start)),null)===i);} );
   let n;if(canGroup){n=previous;n.indices.push(...indices);n.rowIndices.push(i);n.label=n.label.split('\n')[0]+'\n'+n.indices.length+' 句连续对白';n.map=m;n.fields={...n.fields,['行 '+i]:fields};}
   else n=add(kind,label,{indices,rowIndices:[i],group,arrayIndex:ai,rowIndex:i,anchor,fields,map:m,sourceLine:ts[r.expr.start].line,options:[]});
   flowRows.push(n);
  });
  const end=add('end','数组结束 / 返回调用方',{group,arrayIndex:ai,syntheticEnd:true});
  const unresolved=(n,label)=>{const u=add('unknown',label+'：去向未确认',{group});link(n,u,'未知');warnings.push(label+'：去向未确认');};
  const jump=(n,t,label)=>t===null?unresolved(n,label||'跳转'):link(n,t===rows.length?end:flowRows[t],label);
  rows.forEach((r,i)=>{
   const n=flowRows[i],m=r.map;if(n.rowIndices.at(-1)!==i)return;
   if(n.kind==='choice'){
    const expr=m.get('options'),a=expr&&pairs.get(expr.start);n.optionRange=a?{start:ts[a.start].start,end:ts[a.end].end}:null;
    if(!a||a.type!=='['||a.end!==expr.end-1){unresolved(n,'动态选项');return;}
    split(a).forEach((expr,oi)=>{const d=pairs.get(expr.start),om=d&&d.end===expr.end-1&&dictionary(d),t=target(om,i+1),option={index:oi,text:val(om,'text')??raw(om?.get('text')),target:t===null?null:(t===rows.length?end:flowRows[t]).id,targetLabel:val(om,'next_label'),fields:om?Object.fromEntries([...om].map(([k,e])=>[k,raw(e)])):{},simple:!!om&&[...om.keys()].every(k=>['text','next_label'].includes(k))&&typeof val(om,'text')==='string'&&typeof val(om,'next_label')==='string'};n.options.push(option);if(om?.has('requires_stat')){const gate=add('condition','选项门槛 · '+raw(om.get('requires_stat')),{group,fields:{requires_stat:raw(om.get('requires_stat')),未满足:'此选项灰显，仍停留在当前选择；不跳转'}});option.target=gate.id;link(n,gate,(oi+1)+'. '+option.text);jump(gate,t,'满足门槛后');}else jump(n,t,(oi+1)+'. '+option.text);});
   }else if(n.kind==='end'){}else if(n.kind==='combat'){
    const id=val(m,'combat_id'),prefix=spec.sourcePath==='scripts/cultivation/cultivation_story_events.gd'&&((spec.functionName==='get_reed_flat_part1_lines'&&id==='reed_flat')?'get_reed_flat':(spec.functionName==='get_escort_lines'&&id==='escort')?'get_escort_combat':null);
    if(prefix){for(const [suffix,caption] of [['victory','胜利'],['defeat','失败']]){const fn=prefix+'_'+suffix+'_lines',u=add('external',caption+' → '+fn,{group,fields:{targetFunction:fn,sourcePath:spec.sourcePath,contract:'已核对宿主战斗回调；战斗取消另由宿主处理'}});link(n,u,caption+'（结束当前对白）');}}
    else {const u=add('external','战斗结果由调用方处理（不推断后续）',{group,fields:n.fields});link(n,u,'结束对白 → 战斗回调');}
   }else if(n.kind==='condition'&&val(m,'type')==='skill_check'){
    for(const [key,caption] of [['success','成功'],['fail','失败']]){const numeric=m.get(key+'_next'),label=val(m,key+'_label');let t=null;if(numeric&&numeric.end===numeric.start+1&&ts[numeric.start].kind==='number'&&roots.length===1)t=Number(ts[numeric.start].value);else if(!numeric&&label&&!duplicates.has(label)&&labels.has(label))t=labels.get(label);jump(n,t!==null&&t<rows.length?t:null,caption+' · '+raw(m.get('stat'))+(key==='success'?' ≥ ':' < ')+raw(m.get('threshold')));}
   }else if(n.kind==='unknown'||n.kind==='condition')unresolved(n,'运行时配置');
   else jump(n,i+1,n.kind==='jump'?'自动下一行（jump_next）':'');
  });
  if(group!=='函数主段 / 数组 '+(ai+1)){const condition=add('condition',group+'（源码作用域；不代表固定运行顺序）',{group});link(condition,flowRows[0],'包含');}
  arrays.push({array,rows,flowRows,labels,group});
 }
 const covered=new Set(nodes.flatMap(n=>n.indices));const missing=new Map();parsed.lines.forEach((line,index)=>{if(!covered.has(index)){const key=line.context;let n=missing.get(key);if(!n){n=add('unknown','独立源码片段 · '+key,{group:key,fields:{说明:'构造顺序或跨片段连接未确认；保留独立文字编辑。'}});missing.set(key,n);}n.indices.push(index);}});
 if(s.appendRows.length)warnings.push('含 append 构造：仅展示已证明的数组片段，片段间不连接。');
 const branched=nodes.some(n=>['choice','condition','combat','jump','unknown'].includes(n.kind))||arrays.length>1;
 return {nodes:nodes.filter(n=>!n.syntheticEnd||edges.some(e=>e.to===n.id)),edges,arrays,warnings,branched,parsed};
}
const api={read};if(typeof module!=='undefined')module.exports=api;root.GCSEventFlow=api;
})(typeof window!=='undefined'?window:globalThis);
