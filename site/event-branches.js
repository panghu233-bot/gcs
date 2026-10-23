/* Bounded structural editing: only plain label choices in the audited reed-flat entry. */
(function(root){
'use strict';
const p=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const flow=typeof module!=='undefined'?require('./event-flow.js'):root.GCSEventFlow;
const contract=typeof module!=='undefined'?require('./event-flow-contract.js'):root.GCSEventFlowContract;
const enc=new TextEncoder(),clone=x=>JSON.parse(JSON.stringify(x));
const allowed=spec=>spec.sourcePath==='scripts/cultivation/cultivation_story_events.gd'&&!spec.className&&spec.functionName==='get_reed_flat_part1_lines'&&spec.adapter==='literal';
async function verify(read){try{for(const c of contract){const file=await read(c.path);if(!file)return false;const all=p.lex(await file.text()),ts=c.functionName?p.scope(all,'func',c.functionName):all,bytes=enc.encode(JSON.stringify(ts.map(t=>[t.kind,t.value,t.prefix]))),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==c.hash)return false;}return true;}catch{return false;}}
function choices(graph){return graph.nodes.filter(n=>n.kind==='choice');}
function eligible(graph,spec){const ts=graph.parsed.structure.ts,a=graph.arrays[0]?.array;return !!a&&p.sameTokens(ts.slice(0,a.start),'static func get_reed_flat_part1_lines() -> Array[Dictionary]: return')&&a.end===ts.length-1&&allowed(spec)&&graph.arrays.length===1&&graph.arrays[0].rows.every(r=>r.node&&r.node.end===r.expr.end-1)&&choices(graph).length>0&&choices(graph).every(n=>n.optionRange&&n.options.length&&n.options.every(o=>o.simple&&o.target!==null))&&!graph.nodes.some(n=>n.kind==='unknown');}
function validate(graph,n,options){
 if(!Array.isArray(options)||options.length<1||options.length>12)throw Error('每个选择保留 1 至 12 个选项');
 const labels=graph.arrays[n.arrayIndex].labels;
 for(const o of options){if(Object.keys(o).some(k=>!['text','targetLabel'].includes(k))||typeof o.text!=='string'||!o.text.trim()||o.text.length>20000||typeof o.targetLabel!=='string'||!labels.has(o.targetLabel)||labels.get(o.targetLabel)<=n.rowIndex)throw Error('选项只能连接到当前数组中已确认的后续标签');p.encode(o.text,{quote:'"',prefix:''});}
}
function replace(source,edits){let out=source;for(const e of [...edits].sort((a,b)=>b.start-a.start))out=out.slice(0,e.start)+e.value+out.slice(e.end);return out;}
const json=options=>'['+options.map(o=>'{"text": '+p.encode(o.text,{quote:'"',prefix:''})+', "next_label": '+p.encode(o.targetLabel,{quote:'"',prefix:''})+'}').join(', ')+']';
function structuralPlan(bytes,spec,overrides){
 const g=flow.read(bytes,spec);if(!eligible(g,spec))throw Error('当前事件结构无法安全编辑');const edits=[];
 for(const [id,options] of Object.entries(overrides)){const n=g.nodes.find(n=>n.id===id&&n.kind==='choice');if(!n)throw Error('选择身份已变化');validate(g,n,options);const raw=g.parsed.source.slice(n.optionRange.start,n.optionRange.end);const rt=p.lex(raw);let cursor=0,comments='';for(const t of rt){comments+=raw.slice(cursor,t.start);cursor=t.end;}comments+=raw.slice(cursor);if(comments.includes('#'))throw Error('选项数组含注释，结构编辑已锁定');edits.push({...n.optionRange,value:json(options)});}
 const source=replace(g.parsed.source,edits),output=enc.encode(source),after=flow.read(output,spec);
 if(!eligible(after,spec)||choices(after).length!==choices(g).length)throw Error('结构写后验证失败');
 return {kind:'branch-options',bytes:output,edits:[]};
}
function protectedMask(g){
 const ranges=choices(g).map(n=>({...n.optionRange,value:'<OPTIONS>'}));
 for(const l of g.parsed.lines)if(l.editable&&l.token&&!ranges.some(r=>l.token.start>=r.start&&l.token.end<=r.end))ranges.push({start:l.token.start,end:l.token.end,value:'<TEXT>'});
 const {start,end}=g.parsed.scope;return replace(g.parsed.source.slice(start,end),ranges.map(r=>({...r,start:r.start-start,end:r.end-start})));
}
function restore(originalBytes,backupBytes,spec){
 const a=flow.read(originalBytes,spec),b=flow.read(backupBytes,spec);
 if(!eligible(a,spec)||!eligible(b,spec)||protectedMask(a)!==protectedMask(b))throw Error('受保护的剧情、战斗或分支配置已变化，停止结构恢复');
 for(const n of choices(b))validate(b,n,n.options.map(o=>({text:o.text,targetLabel:o.targetLabel})));
 const source=a.parsed.source,range=a.parsed.scope,body=b.parsed.source.slice(b.parsed.scope.start,b.parsed.scope.end),bytes=enc.encode(source.slice(0,range.start)+body+source.slice(range.end));
 if(p.equal(bytes,originalBytes))throw Error('当前事件与备份一致，无需恢复');return {kind:'branch-options',bytes};
}
function attach(w){
 let overrides={},undo=[],redo=[];const old={set:w.set,undo:w.undo,redo:w.redo,discard:w.discard,saved:w.saved,plan:w.plan};
 const desc=Object.getOwnPropertyDescriptors(w),graph=()=>flow.read(w.originalBytes,w.manifest);
 const structural=()=>Object.keys(overrides).length>0;
 const changes=()=>Object.entries(overrides).map(([id,options])=>{const n=graph().nodes.find(n=>n.id===id);return {kind:'options',index:n.rowIndex,context:n.group+' / '+n.label,before:JSON.stringify(n.options.map(o=>({text:o.text,targetLabel:o.targetLabel})),null,2),after:JSON.stringify(options,null,2)};});
 const editable=()=>!!w.branchVerified&&eligible(graph(),w.manifest);
 w.branch={get enabled(){return editable();},get reason(){return editable()?'已核对播放器和回调；只允许纯文字选项连接到已有后续标签。':'结构只读：选项序号、奖励副作用、动态构造或运行契约未证明；保留现有文字权限。';},get overrides(){return clone(overrides);},
  options(id){const n=graph().nodes.find(n=>n.id===id);return clone(overrides[id]||n?.options.map(o=>({text:o.text,targetLabel:o.targetLabel}))||[]);},
  set(id,options){if(w.locked||w.blocked||!editable())throw Error('分支结构已锁定');const g=graph(),n=g.nodes.find(n=>n.id===id&&n.kind==='choice');if(!n)throw Error('选择节点已变化');validate(g,n,options);if(JSON.stringify(options)===JSON.stringify(this.options(id)))return;undo.push({kind:'branch',before:clone(overrides),after:null});redo=[];overrides[id]=clone(options);if(JSON.stringify(options)===JSON.stringify(n.options.map(o=>({text:o.text,targetLabel:o.targetLabel}))))delete overrides[id];undo.at(-1).after=clone(overrides);}
 };
 Object.defineProperties(w,{changes:{get:()=>[...desc.changes.get.call(w),...changes()]},hasStructuralChanges:{get:()=>desc.hasStructuralChanges.get.call(w)||structural()},canUndo:{get:()=>undo.length>0||desc.canUndo.get.call(w)},canRedo:{get:()=>redo.length>0||desc.canRedo.get.call(w)}});
 w.set=(i,value)=>{const before=w.lines[i]?.text;old.set(i,value);if(before!==value){undo.push({kind:'text'});redo=[];}};
 w.undo=()=>{if(w.locked||w.blocked)throw Error('当前事件已锁定');const x=undo.pop();if(!x)return old.undo();if(x.kind==='text')old.undo();else overrides=clone(x.before);redo.push(x);};
 w.redo=()=>{if(w.locked||w.blocked)throw Error('当前事件已锁定');const x=redo.pop();if(!x)return old.redo();if(x.kind==='text')old.redo();else overrides=clone(x.after);undo.push(x);};
 w.discard=()=>{old.discard();overrides={};undo=[];redo=[];};w.saved=bytes=>{old.saved(bytes);overrides={};undo=[];redo=[];};
 w.plan=()=>{const plan=old.plan();if(!structural())return plan;if(!editable())throw Error('分支运行契约未确认');return structuralPlan(plan.bytes,w.manifest,overrides);};
 return w;
}
const api={allowed,verify,eligible,structuralPlan,restore,attach};if(typeof module!=='undefined')module.exports=api;root.GCSEventBranches=api;
})(typeof window!=='undefined'?window:globalThis);
