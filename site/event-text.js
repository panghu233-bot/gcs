/* Source-bound literal slots. Never execute, rebuild, or serialize an event factory. */
(function(root){
'use strict';
const p=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch,enc=new TextEncoder();
function read(bytes,spec){
 const source=p.decode(bytes);if(!p.equal(enc.encode(source),bytes))throw Error('UTF-8 无法无损往返');
 const all=p.lex(source),owner=spec.className?p.scope(all,'class',spec.className):all,ts=p.scope(owner,'func',spec.functionName);
 if(ts.some((t,i)=>i>1&&t.value==='func'&&t.kind==='id'))throw Error('嵌套函数的文字归属未确认');
 if(ts[0].value!=='static')throw Error('文字来源必须是唯一静态函数');
 const pairs=new Map(),parents=new Map(),nodes=[],stack=[],depth=[];
 for(let i=0;i<ts.length;i++){depth[i]=stack.length;const v=ts[i].value;if(ts[i].kind!=='symbol')continue;
  if(['[','{','('].includes(v)){const n={start:i,end:null,type:v,parent:stack.at(-1)||null};if(n.parent)parents.set(i,n.parent);nodes.push(n);stack.push(n);}
  else if([']','}',')'].includes(v)){const n=stack.pop();if(!n||{'[':']','{':'}','(':')'}[n.type]!==v)throw Error('源码括号结构不明确');n.end=i;pairs.set(n.start,n);}
 }if(stack.length)throw Error('源码括号未结束');
 const split=n=>{const out=[];let start=n.start+1;for(let i=start;i<n.end;i++){if(pairs.has(i)){i=pairs.get(i).end;continue;}if(ts[i].kind==='symbol'&&ts[i].value===','){if(i>start)out.push({start,end:i});start=i+1;}}if(start<n.end)out.push({start,end:n.end});return out;};
 const literal=expr=>expr&&expr.end===expr.start+1&&ts[expr.start]?.kind==='string'&&!ts[expr.start].prefix?ts[expr.start]:null;
 function dictionary(n){if(n.type!=='{')return null;const map=new Map();for(const part of split(n)){const key=ts[part.start];if(key?.kind!=='string'||key.prefix||ts[part.start+1]?.value!==':'||map.has(key.value))return null;map.set(key.value,{start:part.start+2,end:part.end});}return map;}
 const dicts=new Map(nodes.filter(n=>n.type==='{').map(n=>[n.start,dictionary(n)]));
 const statementEnd=end=>!ts[end+1]||ts[end+1].line>ts[end].line&&ts[end+1].head;
 const returns=name=>ts.some((t,i)=>t.value==='return'&&depth[i]===0&&ts[i+1]?.value===name&&statementEnd(i+1));
 const arrayVars=new Set(),objectVars=new Set(),locals=new Map();
 for(let i=0;i<ts.length-2;i++)if(ts[i].value==='var'&&depth[i]===0){let j=i+2;while(j<ts.length&&ts[j].line===ts[i].line&&ts[j].value!=='=')j++;if(ts[j]?.value!=='=')continue;
  const name=ts[i+1].value,rhs=j+1,n=pairs.get(rhs);if(locals.has(name))throw Error('局部变量重复，不能证明文字来源');locals.set(name,{rhs,node:n});
  if(n?.type==='['&&statementEnd(n.end)&&returns(name))arrayVars.add(name);
  if(spec.className&&ts[rhs]?.value===spec.className&&p.sameTokens(ts.slice(rhs,rhs+5),spec.className+'.new()')&&statementEnd(rhs+4)&&returns(name))objectVars.add(name);
 }
 // Reject reassigned bindings; an unused or replaced local is not a proved dialogue sink.
 for(const [name,{rhs}] of locals)if(ts.some((t,i)=>t.value===name&&depth[i]===0&&ts[i+1]?.value==='='&&i+2!==rhs)){arrayVars.delete(name);objectVars.delete(name);}
 const roots=[];
 for(const n of nodes)if(n.type==='['){const i=n.start;
  if(ts[i-1]?.value==='return'&&depth[i-1]===0&&statementEnd(n.end))roots.push(n);
  else if(ts[i-1]?.value==='='&&ts[i-2]?.value==='lines'&&ts[i-3]?.value==='.'&&objectVars.has(ts[i-4]?.value)&&statementEnd(n.end))roots.push(n);
  else if([...arrayVars].some(name=>locals.get(name)?.node===n))roots.push(n);
 }
 const appendRows=[];
 for(const n of nodes)if(n.type==='('&&ts[n.start-1]?.kind==='id'&&['append','append_array'].includes(ts[n.start-1].value)&&ts[n.start-2]?.value==='.'&&arrayVars.has(ts[n.start-3]?.value)){
  const args=split(n);if(args.length!==1)continue;const arg=args[0],value=pairs.get(arg.start);if(ts[n.start-1].value==='append_array'&&value?.type==='['&&value.end===arg.end-1)roots.push(value);else if(ts[n.start-1].value==='append')appendRows.push({expr:arg,at:n.start});
 }
 function rowNode(expr){const n=pairs.get(expr.start);if(n?.type==='{'&&n.end===expr.end-1)return n;if(expr.end===expr.start+1&&ts[expr.start]?.kind==='id'){const local=locals.get(ts[expr.start].value);if(local?.node?.type==='{'&&local.node.start<expr.start&&statementEnd(local.node.end)&&!ts.some((t,i)=>t.value===ts[expr.start].value&&i!==expr.start&&i!==local.rhs-2&&ts[i+1]?.value==='='))return local.node;}return null;}
 // Context names come from source control blocks, never from evaluated conditions.
 const contexts=new Map(),controls=[];for(let i=0;i<ts.length;i++)if(ts[i].head&&depth[i]===0){const t=ts[i];while(controls.length&&t.column<=controls.at(-1).column)controls.pop();let end=i;while(end+1<ts.length&&ts[end+1].line===t.line)end++;
  const block=ts[end]?.value===':'&&(['if','elif','else','match','for','while'].includes(t.value)||controls.at(-1)?.match);
  if(block)controls.push({column:t.column,label:source.slice(t.start,ts[end].end)+'（源码行 '+t.line+'）',match:t.value==='match'});
  contexts.set(i,controls.map(c=>c.label).join(' / '));
 }
 const atContext=index=>{let found='函数主段';for(const [i,text] of contexts){if(i>index)break;found=text||'函数主段';}return found;};
 const slots=[],seen=new Set();let rootIndex=0;
 function add(map,key,n,kind,context,extra={}){const expr=map.get(key);if(!expr)return;const token=literal(expr),slotId='dict-'+n.start+':'+key;if(seen.has(slotId))throw Error('同一文字字典被重复使用，无法确认独立归属');seen.add(slotId);
  const value=k=>literal(map.get(k))?.value;
  const dynamic=source.slice(ts[expr.start]?.start??0,ts[expr.end-1]?.end??0);
  slots.push({id:slotId,slotId,text:token?.value??dynamic,speaker:kind==='dialogue'?(value('speaker')??'【动态说话人】'):kind==='option'?'【选项文字】':'【选择提示】',left:value('left'),right:value('right'),mood:value('mood'),kind,context,...extra,editable:!!token,reason:token?'':'文字包含变量、拼接、条件或格式化表达式，无法确认独立字面量',line:ts[expr.start].line,token});
 }
 function row(n,context){const map=dicts.get(n.start);if(!map)return;const type=literal(map.get('type'))?.value;
  if(map.has('speaker')&&map.has('text')&&(!type||type==='dialogue'))add(map,'text',n,'dialogue',context);
  else if(type==='choice'){
   add(map,'prompt',n,'prompt',context+' / 选择@'+n.start);
   const expr=map.get('options'),options=expr&&pairs.get(expr.start);if(!options||options.type!=='['||options.end!==expr.end-1)return;
   split(options).forEach((expr,i)=>{const opt=pairs.get(expr.start),fields=opt&&dicts.get(opt.start);if(!opt||opt.type!=='{'||opt.end!==expr.end-1||!fields)return;const next=literal(fields.get('next_label'))?.value;const numeric=fields.get('next');const target=fields.has('next_label')&&fields.has('next')?null:next??(numeric&&numeric.end===numeric.start+1&&ts[numeric.start].kind==='number'?ts[numeric.start].value:null);
    add(fields,'text',opt,'option',context+' / 选择@'+n.start+' / 选项 '+(i+1)+' → '+target,{choiceId:'choice-'+n.start,target});if(target===null){const slot=slots.at(-1);if(slot?.slotId==='dict-'+opt.start+':text'){slot.editable=false;slot.reason='选项跳转目标无法唯一确认';}}
   });
  }
 }
 for(const n of roots.sort((a,b)=>a.start-b.start)){let anchor='',uncertain=false;const group=atContext(n.start)+' / 对白数组 '+(++rootIndex);for(const expr of split(n)){const item=rowNode(expr);if(!item){anchor='';uncertain=true;continue;}const map=dicts.get(item.start);if(!map){anchor='';uncertain=true;continue;}const label=literal(map.get('anchor_label'))?.value;if(map.has('anchor_label')){anchor=label||'';uncertain=!label;}const from=slots.length;row(item,group+(anchor?' / 标签 '+anchor:uncertain?' / 分支归属未确认':''));if(uncertain)for(const slot of slots.slice(from)){slot.editable=false;slot.reason='前序动态片段或标签导致分支归属未确认';}if(literal(map.get('type'))?.value==='branch_end'){anchor='';uncertain=false;}}}
 for(const {expr,at} of appendRows){const n=rowNode(expr);if(n)row(n,atContext(at)+' / append@'+at);}
 slots.sort((a,b)=>(a.token?.start??ts.find(t=>t.line===a.line)?.start??0)-(b.token?.start??ts.find(t=>t.line===b.line)?.start??0));
 // A later indexed text assignment makes the displayed literal's ownership uncertain.
 if(ts.some((t,i)=>t.kind==='string'&&['text','prompt','options'].includes(t.value)&&ts[i-1]?.value==='['&&ts[i+1]?.value===']'&&ts[i+2]?.value==='='))for(const r of slots){r.editable=false;r.reason='函数后续存在文字或选项覆写，无法证明该字面量是独立文字来源';}
 const eligible=slots.filter(r=>r.editable),start=ts[0].start,end=ts.at(-1).end;
 let cursor=start,mask='';for(const r of eligible){mask+=source.slice(cursor,r.token.start)+'<GCS:'+r.slotId+'>';cursor=r.token.end;}mask+=source.slice(cursor,end);
 return {source,lines:slots,mask,scope:{start,end},legacyCompatible:false,openingBg:null,defaultSpeaker:'',body:{hasComments:false}};
}
function plan({originalBytes,spec,changes}){
 const before=new Uint8Array(originalBytes),parsed=read(before,spec);if(!Array.isArray(changes)||!changes.length)throw Error('没有文字修改');const seen=new Set(),edits=[];
 for(const c of changes){if(Object.keys(c).some(k=>!['index','before','after','slotId','context','textKind'].includes(k)))throw Error('仅允许已审阅的文字变化');const row=parsed.lines[c.index];if(!Number.isInteger(c.index)||!row?.editable||seen.has(c.index)||c.before!==row.text||c.slotId&&c.slotId!==row.slotId||c.context!==undefined&&c.context!==row.context||c.textKind!==undefined&&c.textKind!==row.kind||c.after===c.before)throw Error('文字来源、身份或原文不匹配');seen.add(c.index);const replacement=enc.encode(p.encode(c.after,row.token));edits.push({index:c.index,start:enc.encode(parsed.source.slice(0,row.token.start)).length,end:enc.encode(parsed.source.slice(0,row.token.end)).length,bytes:replacement});}
 edits.sort((a,b)=>a.start-b.start);let output=before;for(const e of [...edits].reverse()){const next=new Uint8Array(output.length-e.end+e.start+e.bytes.length);next.set(output.subarray(0,e.start));next.set(e.bytes,e.start);next.set(output.subarray(e.end),e.start+e.bytes.length);output=next;}
 const after=read(output,spec);if(after.mask!==parsed.mask||after.lines.length!==parsed.lines.length||after.lines.some((r,i)=>r.slotId!==parsed.lines[i].slotId||r.text!==(changes.find(c=>c.index===i)?.after??parsed.lines[i].text)))throw Error('文字补丁越界或身份回验失败');
 return {kind:'text',bytes:output,edits};
}
function planLines({originalBytes,spec,lines,structureChanged=false}){
 const before=read(originalBytes,spec);if(structureChanged||!Array.isArray(lines)||lines.length!==before.lines.length)throw Error('仅文字编辑不允许增删、复制或排序');
 const changes=[];for(let index=0;index<lines.length;index++){const row=lines[index],old=before.lines[index],keys=new Set([...Object.keys(old),...Object.keys(row)]);for(const key of keys)if(!['text','id','token','line'].includes(key)&&JSON.stringify(row[key])!==JSON.stringify(old[key]))throw Error('仅文字编辑不允许改变身份、演出或分支配置');if(row.text!==old.text)changes.push({index,slotId:old.slotId,before:old.text,after:row.text});}
 return changes.length?plan({originalBytes,spec,changes}):{kind:'unchanged',bytes:new Uint8Array(originalBytes),edits:[]};
}
function restore({originalBytes,backupBytes,spec}){
 const a=read(originalBytes,spec),b=read(backupBytes,spec);if(a.mask!==b.mask||a.lines.length!==b.lines.length||a.lines.some((r,i)=>r.slotId!==b.lines[i].slotId))throw Error('事件逻辑、分支、注释或文字身份已变化，停止仅文字恢复');
 const changes=a.lines.flatMap((r,index)=>r.text===b.lines[index].text?[]:[{index,slotId:r.slotId,before:r.text,after:b.lines[index].text}]);if(!changes.length)throw Error('当前事件与备份一致，无需恢复');return plan({originalBytes,spec,changes});
}
const api={read,plan,planLines,restore};if(typeof module!=='undefined')module.exports=api;root.GCSEventText=api;
})(typeof window!=='undefined'?window:globalThis);
