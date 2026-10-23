/* Bounded symbolic source analysis. Never runs GDScript or reads live game state. */
(function(root){
'use strict';
const p=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const flow=typeof module!=='undefined'?require('./event-flow.js'):root.GCSEventFlow;
const labels={victory:['战斗胜利','战斗失败'],has_fish:['携带鲜鱼','没有鲜鱼'],intro_seen:['已看过开场','尚未看过开场'],first_visit:['首次来访','再次来访']};
const stats={appraisal:'鉴定',martial:'武学',agility:'身法',music:'音律',wine:'酒艺',knowledge:'学识'};
const fail=message=>{throw Error(message);};
function analyse(parsed,spec){
 const s=parsed.structure,{ts,pairs,split,dictionary,rowNode}=s,source=parsed.source;
 if(!s||!p.sameTokens(ts.slice(pairs.get(3)?.end+1,ts.findIndex((t,i)=>i>pairs.get(3)?.end&&t.value===':')+1),'-> Array[Dictionary]:'))return null;
 const args=split(pairs.get(3)),params=new Map();
 for(const a of args){const t=ts.slice(a.start,a.end);if(t.length!==3||t[0].kind!=='id'||t[1].value!==':'||!['bool','StringName','String','int'].includes(t[2].value))return {blocked:true,reason:'参数声明超出已确认范围'};params.set(t[0].value,t[2].value);}
 const needsCases=params.size||s.roots.length>1||s.appendRows.length;if(!needsCases)return null;
 try{
  // Only scalar constants in this exact owner may name match arms. No calls or expressions.
  const all=p.lex(source),owner=spec.className?p.scope(all,'class',spec.className):all,constants=new Map();
  const ownerIndent=spec.className?owner.find((t,i)=>i>2&&t.head&&t.column>owner[0].column)?.column:0;
  for(let i=0;i<owner.length;i++)if(owner[i].head&&owner[i].column===ownerIndent&&owner[i].value==='const'){
   let end=i+1;while(end<owner.length&&!owner[end].head)end++;const line=owner.slice(i,end),eq=line.findIndex(t=>t.value==='=');
   if(eq>0&&line.length===eq+2&&['string','number'].includes(line[eq+1].kind)){const key=line[1].value;if(constants.has(key))fail('常量重名');constants.set(key,line[eq+1]);}
  }
  for(const name of params.keys())if(constants.has(name))fail('参数遮蔽常量');
  const headerEnd=ts.findIndex((t,i)=>i>pairs.get(3).end&&t.value===':'),units=[];
  for(let i=headerEnd+1;i<ts.length;){const start=i;if(!ts[i].head)fail('语句边界不明确');let end=i;
   while(end<ts.length){if(pairs.has(end))end=pairs.get(end).end;if(ts[end].value===';')fail('不支持并行语句');if(!ts[end+1]||ts[end+1].head)break;end++;}
   units.push({start,end:end+1,t:ts.slice(start,end+1),column:ts[start].column});i=end+1;
  }
  const unwrap=expr=>{while(expr.end-expr.start>1&&ts[expr.start].value==='('&&pairs.get(expr.start)?.end===expr.end-1)expr={start:expr.start+1,end:expr.end-1};return expr;};
  function scalar(tokens){if(tokens.length!==1)return null;const t=constants.get(tokens[0].value)||tokens[0];return ['string','number'].includes(t.kind)||['true','false'].includes(t.value)?{kind:t.kind,value:t.value}:null;}
  function predicate(tokens){let positive=true;if(tokens[0]?.value==='not'){positive=false;tokens=tokens.slice(1);}if(tokens.length===1&&params.get(tokens[0].value)==='bool')return {key:tokens[0].value,param:tokens[0].value,op:'bool',positive};
   if(positive&&tokens.length>=3&&params.has(tokens[0].value)){let j=1,op='';while(j<tokens.length&&tokens[j].kind==='symbol')op+=tokens[j++].value;const value=scalar(tokens.slice(j));if(['==','!=','>=','>','<=','<'].includes(op)&&value)return {key:tokens[0].value+op+JSON.stringify(value),param:tokens[0].value,op,value,positive:true};}fail('条件不是可静态分组的参数比较');
  }
  function rows(expr){expr=unwrap(expr);const n=pairs.get(expr.start);if(!n||n.type!=='['||n.end!==expr.end-1)fail('对白数组不是直接字面量');return split(n).map(e=>{const d=rowNode(e);if(!d||d.start!==e.start||!dictionary(d))fail('数组含动态对白或复用引用');return {start:d.start,end:d.end,map:dictionary(d)};});}
  let cursor=0;
  function block(indent){const out=[];while(cursor<units.length&&units[cursor].column===indent){const u=units[cursor++],v=u.t.map(t=>t.value),first=v[0];
    if(first==='if'){
     if(v.at(-1)!==':')fail('条件块格式不明确');const arms=[{condition:predicate(u.t.slice(1,-1)),body:suite(indent)}];
     while(units[cursor]?.column===indent&&['elif','else'].includes(units[cursor].t[0].value)){const arm=units[cursor++];if(arm.t.at(-1).value!==':')fail('条件块格式不明确');arms.push({condition:arm.t[0].value==='else'?null:predicate(arm.t.slice(1,-1)),body:suite(indent)});}
     out.push({kind:'if',arms});
    }else if(first==='match'){
     if(v.length!==3||v[2]!==':'||!params.has(v[1]))fail('只支持按参数匹配');const arms=[],caseIndent=units[cursor]?.column;if(!(caseIndent>indent))fail('缺少匹配情况');const seen=new Set();let fallback=false;
     while(units[cursor]?.column===caseIndent){const c=units[cursor++],key=c.t.slice(0,-1),value=scalar(key);if(c.t.at(-1).value!==':'||fallback||!value&&!(key.length===1&&key[0].value==='_'))fail('匹配情况含动态表达式');fallback=!value;const signature=JSON.stringify(value);if(seen.has(signature))fail('重复匹配情况');seen.add(signature);arms.push({condition:value?{key:v[1]+'=='+signature,param:v[1],op:'==',value,positive:true}:null,body:suite(caseIndent)});}
     if(!fallback)fail('匹配缺少兜底');out.push({kind:'if',arms,match:true});
    }else out.push(statement(u));
   }if(units[cursor]?.column>indent)fail('未识别的嵌套语句');return out;}
  function suite(indent){if(!(units[cursor]?.column>indent))fail('空条件块');return block(units[cursor].column);}
  function statement(u){const t=u.t,v=t.map(t=>t.value),expr={start:u.start,end:u.end};
   if(v[0]==='return'){const e=unwrap({start:u.start+1,end:u.end});if(e.end-e.start===1&&ts[e.start].kind==='id')return {kind:'returnVar',name:ts[e.start].value};return {kind:'return',rows:rows(e)};}
   if(v[0]==='var'){
    const eq=v.indexOf('=');if(eq<2||t[1].kind!=='id'||constants.has(v[1])||t.slice(2,eq).some(x=>![':', '[',']'].includes(x.value)&&!['Array','Dictionary','bool','String','StringName'].includes(x.value)))fail('变量声明不明确');const e={start:u.start+eq+1,end:u.end};
    if(ts[e.start]?.value==='[')return {kind:'init',name:v[1],rows:rows(e)};
    if(!scalar(ts.slice(e.start,e.end))){const q=ts.slice(e.start,e.end);if(!(q.length===2&&q[0].value==='not'&&params.get(q[1].value)==='bool'||q.length===1&&params.has(q[0].value)))fail('变量含动态调用');}
    return {kind:'local',name:v[1]};
   }
   const e=unwrap(expr),a=ts.slice(e.start,e.end),call=pairs.get(e.start+3);
   if(a[0]?.kind==='id'&&a[1]?.value==='.'&&['append','append_array'].includes(a[2]?.value)&&call?.type==='('&&call.end===e.end-1){
    const values=split(call);if(values.length!==1)fail('追加参数不唯一');const arg=unwrap(values[0]);
    if(a[2].value==='append'){const n=rowNode(arg);if(!n||n.start!==arg.start||!dictionary(n))fail('追加对白动态');return {kind:'append',name:a[0].value,rows:[{start:n.start,end:n.end,map:dictionary(n)}]};}
    if(ts[arg.start]?.value==='[')return {kind:'append',name:a[0].value,rows:rows(arg)};
    const helper=ts[arg.start],bracket=pairs.get(arg.start+1);if(helper?.kind==='id'&&bracket?.type==='('&&bracket.end===arg.end-1&&split(bracket).every(e=>e.end===e.start+1&&ts[e.start].kind==='id'))return {kind:'helper',name:a[0].value,functionName:helper.value};
   }
   fail('存在未支持的语句，不能证明对白顺序');
  }
  const ast=block(units[0]?.column);if(cursor!==units.length)fail('语句未完整分析');
  function constrain(state,c,positive=c.positive){const condition={...c,positive},old=state.conditions.find(x=>x.key===c.key);if(old&&old.positive!==positive)return null;if(old)return state;
   if(state.conditions.some(x=>x.param===c.param&&x.key!==c.key&&!(x.op==='=='&&c.op==='==')))fail('同一属性的复合比较不能证明互斥关系');
   if(c.op==='=='&&positive&&state.conditions.some(x=>x.param===c.param&&x.op==='=='&&x.positive&&JSON.stringify(x.value)!==JSON.stringify(c.value)))return null;
   return {...state,conditions:[...state.conditions,condition]};}
  function walk(nodes,states){for(const n of nodes){const next=[];for(const state of states){if(state.done){next.push(state);continue;}
     if(n.kind==='if'){let pending=[state];for(const arm of n.arms){const yes=[],no=[];for(const q of pending){if(arm.condition){const a=constrain(q,arm.condition),b=constrain(q,arm.condition,!arm.condition.positive);if(a)yes.push(a);if(b)no.push(b);}else yes.push(q);}next.push(...walk(arm.body,yes));pending=no;}next.push(...pending);}
     else if(n.kind==='local'){if(state.names.includes(n.name))fail('变量重名');next.push({...state,names:[...state.names,n.name]});}
     else if(n.kind==='init'){if(state.sink||state.names.includes(n.name))fail('多数组或重名变量');next.push({...state,sink:n.name,names:[...state.names,n.name],rows:n.rows});}
     else if(n.kind==='return'){if(state.sink)fail('返回与构造数组不一致');next.push({...state,rows:n.rows,done:true});}
     else {if(n.name!==state.sink)fail('数组归属不一致');if(n.kind==='returnVar')next.push({...state,done:true});else if(state.helper)fail('跨段调用后仍有构造，不能确认连接');else if(n.kind==='helper')next.push({...state,helper:n.functionName});else next.push({...state,rows:[...state.rows,...n.rows]});}
    }states=next;if(states.length>16)fail('条件组合超过安全阅读上限');}return states;}
  const states=walk(ast,[{rows:[],conditions:[],names:[],done:false,sink:null}]);if(states.some(q=>!q.done))fail('存在未确认的返回路径');
  const cases=states.map((q,index)=>{
   const originalIndices=q.rows.flatMap(d=>parsed.lines.flatMap((line,i)=>{const at=Number(line.slotId?.match(/^dict-(\d+)/)?.[1]);return at>=d.start&&at<=d.end?[i]:[];}));
   const body=q.rows.map(d=>source.slice(ts[d.start].start,ts[d.end].end)).join(',\n'),specCopy={...spec,className:null,functionName:'_gcs_case',entryPath:'static-proof'},bytes=new TextEncoder().encode('static func _gcs_case() -> Array[Dictionary]:\n return [\n'+body.split('\n').map(line=>'  '+line).join('\n')+'\n ]\n');
   const graph=flow.read(bytes,specCopy);if(graph.parsed.lines.length!==originalIndices.length||graph.parsed.lines.some((r,i)=>r.text!==parsed.lines[originalIndices[i]].text||r.kind!==parsed.lines[originalIndices[i]].kind))fail('情况文字定位不一致');
   for(const n of graph.nodes)n.indices=n.indices.map(i=>originalIndices[i]);
   if(!q.rows.length){graph.entryConfirmed=true;graph.entryId='empty';graph.nodes=[{id:'empty',kind:'end',indices:[]}];graph.edges=[];}
   // No finite numeric positions are guessed across separately constructed arrays.
   if(s.roots.length>1&&q.rows.some(d=>[...d.map.keys()].some(k=>['next','success_next','fail_next'].includes(k))||d.map.has('options')&&split(pairs.get(d.map.get('options').start)||{start:0,end:0}).some(e=>dictionary(pairs.get(e.start))?.has('next'))))fail('跨构造数组的数字跳转未确认');
   const speaker=q.rows.map(d=>s.literal(d.map.get('speaker'))?.value).find(name=>name&&name!=='顾清寒'),summary=parsed.lines[originalIndices.find(i=>parsed.lines[i].kind==='dialogue'&&parsed.lines[i].editable)]?.text;
   const positive=q.conditions.filter(c=>c.positive),named=q.conditions.filter(c=>c.op==='bool').map(c=>labels[c.param]?.[c.positive?0:1]).filter(Boolean);
   const compare=q.conditions.filter(c=>c.op!=='bool'&&stats[c.param]).map(c=>stats[c.param]+(c.positive?{'==':'等于','!=':'不等于','>=':'至少','>':'高于','<=':'至多','<':'低于'}[c.op]:'不满足')+c.value.value);
   const matchNpc=q.conditions.some(c=>c.param==='npc_id'),title=[...named,...compare].join(' · ')||(matchNpc?(positive.some(c=>c.param==='npc_id')?'遇见'+(speaker||'来客'):q.rows.length?'其他人物的对白':'其他人物 · 暂无对白'):speaker? speaker+'的对白：'+(summary||'').slice(0,20):summary?'对白：'+summary.slice(0,24):'此情况暂无对白');
   return {id:'case-'+index,title,conditions:q.conditions,graph,indices:originalIndices,helper:q.helper};
  });
  return {cases};
 }catch(e){return {blocked:true,reason:e.message};}
}
const api={analyse};if(typeof module!=='undefined')module.exports=api;root.GCSEventConditions=api;
})(typeof window!=='undefined'?window:globalThis);
