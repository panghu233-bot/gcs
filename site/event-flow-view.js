/* The main graph has one proved entrance. Unconnected fragments live outside it. */
(function(root){
'use strict';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const names={dialogue:'对白',choice:'玩家选择',condition:'条件 · 只读',combat:'战斗 · 只读',end:'结束',anchor:'汇合 / 标签',jump:'跳转',scene:'场景',unknown:'未知 · 只读',external:'外部回调 · 只读'};
function render({editor,script,w,view,editing,locked,redraw}){
 if(!w.originalBytes&&!w.rawSource)return null;
 let g;try{g=root.GCSEventFlow.read(w.originalBytes||new TextEncoder().encode(w.rawSource),w.manifest);}catch{return null;}
 if(!g.branched||!g.nodes.some(n=>n.indices.length))return null;
 if(!w.flowVerified){g.edges=[];g.warnings.push('当前播放器或回调与已核对版本不同：仅展示源码片段，不确认入口顺序与运行连接；文字权限保留。');}
 const nodes=new Map(g.nodes.map(n=>[n.id,n]));
 function currentLabel(n){const row=w.lines[n.indices[0]];if(n.kind==='dialogue'&&row)return (row.speaker||'旁白')+'：'+row.text;if(n.kind==='choice'){const prompt=n.indices.map(i=>w.lines[i]).find(r=>r.kind==='prompt');return prompt?.text||'玩家选择';}return n.label;}
 for(const n of g.nodes)if(n.kind==='choice'){
  const options=n.indices.map(i=>w.lines[i]).filter(r=>r.kind==='option');n.options=n.options.map((o,i)=>({...o,text:options[i]?.text??o.text}));
  if(w.branch?.overrides[n.id])n.options=w.branch.options(n.id).map((o,index)=>({...o,index,target:g.arrays[n.arrayIndex].flowRows[g.arrays[n.arrayIndex].labels.get(o.targetLabel)]?.id}));
  if(n.options.every(o=>o.target)){g.edges=g.edges.filter(e=>e.from!==n.id);if(w.flowVerified)for(const o of n.options)g.edges.push({from:n.id,to:o.target,label:(o.index+1)+'. '+o.text});}
 }
 const layout=root.GCSEventFlowLayout.layout(g,{verified:!!w.flowVerified}),positions=layout.positions;
 const selected=nodes.get(view.flowNode)||nodes.get(layout.main[0])||g.nodes[0];view.flowNode=selected.id;
 const section=el('section',undefined,'event-flow');section.setAttribute('aria-label','真实剧情分支流程');section.dataset.entryConfirmed=String(layout.main.length>0);
 section.append(el('p',layout.main.length?'真实入口 → 前置对白 → 玩家选择 → 分支后续 → 汇合或结束':'入口或动态构造顺序尚未完整确认；以下片段不作为多个开场。','event-flow-entry-label'));
 const viewport=el('div',undefined,'event-flow-viewport'),canvas=el('div',undefined,'event-flow-canvas');viewport.append(canvas);if(layout.main.length)section.append(viewport);editor.insertBefore(section,script);
 canvas.style.width=layout.width+'px';canvas.style.height=layout.height+'px';
 function activate(id,followLabels=false){if(locked()||!nodes.has(id))return;const via=[],seen=new Set();while(followLabels&&nodes.get(id)?.kind==='anchor'&&!seen.has(id)){seen.add(id);const next=layout.edges.filter(e=>e.from===id);if(next.length!==1)break;via.push(nodes.get(id).anchor||nodes.get(id).label);id=next[0].to;}view.flowVia=via;const n=nodes.get(id),pos=positions.get(id);view.flowNode=id;if(n.indices.length)w.select(n.indices[0]);if(pos)view.flowScroll={x:Math.max(0,pos.x-120),y:Math.max(0,pos.y-180)};else view.fragmentsOpen=true;redraw();editor.querySelector('.event-flow-detail')?.scrollIntoView({block:'nearest'});}
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('width',layout.width);svg.setAttribute('height',layout.height);svg.setAttribute('aria-hidden','true');canvas.append(svg);
 const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');marker.id='flow-arrow';marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto-start-reverse');const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');marker.append(arrow);defs.append(marker);svg.append(defs);
 function optionPosition(n,index){const p=positions.get(n.id),count=n.options.length;return {x:Math.max(10,Math.min(layout.width-232,p.x+111+(index-(count-1)/2)*254-111)),y:p.y+114};}
 for(const e of layout.edges){
  const a=positions.get(e.from),b=positions.get(e.to),from=nodes.get(e.from),option=from.options?.find(o=>o.target===e.to&&e.label===(o.index+1)+'. '+o.text),back=b.level<=a.level;
  const path=document.createElementNS(ns,'path'),sx=a.x+111,sy=a.y+94,tx=b.x+111,ty=b.y;
  let d;if(option){const p=optionPosition(from,option.index),x=p.x+111,y=p.y;d=`M${sx},${sy} C${sx},${sy+12} ${x},${y-12} ${x},${y} M${x},${y+34} L${x},${Math.max(y+40,ty-34)} C${x},${ty-20} ${tx},${ty-20} ${tx},${ty}`;}
  else if(back){const x=Math.min(layout.width-8,Math.max(a.x,b.x)+238);d=`M${a.x+222},${a.y+47} C${x},${a.y+47} ${x},${b.y+47} ${b.x+222},${b.y+47}`;path.classList.add('back-edge');}
  else d=`M${sx},${sy} C${sx},${sy+34} ${tx},${ty-34} ${tx},${ty}`;
  if(nodes.get(e.to).kind==='unknown')path.classList.add('unconfirmed-edge');path.setAttribute('d',d);path.setAttribute('marker-end','url(#flow-arrow)');svg.append(path);
  if(e.label&&!option){const label=document.createElementNS(ns,'text');label.setAttribute('x',(sx+tx)/2+5);label.setAttribute('y',(sy+ty)/2);label.textContent=e.label.slice(0,28)+(e.label.length>28?'…':'');const title=document.createElementNS(ns,'title');title.textContent=e.label;label.append(title);svg.append(label);}
 }
 const snippets=new Map();
 for(const id of layout.main){
  const n=nodes.get(id),pos=positions.get(id),b=el('button',undefined,'event-flow-node '+n.kind+(n.id===selected.id?' selected':''));b.type='button';b.dataset.flowNode=n.id;b.dataset.flowEntry=String(id===g.entryId);b.dataset.flowLevel=String(pos.level);b.style.left=pos.x+'px';b.style.top=pos.y+'px';b.setAttribute('aria-pressed',String(n.id===selected.id));
  const caption=(id===g.entryId?'真实入口 · ':'')+(names[n.kind]||n.kind)+(n.kind==='dialogue'?' · '+n.indices.length+'句':'');const snippet=el('span');b.append(el('strong',caption),snippet);snippets.set(n.id,{button:b,snippet});b.disabled=!!locked();b.onclick=()=>activate(n.id);canvas.append(b);
  if(n.kind==='choice')for(const o of n.options){const p=optionPosition(n,o.index),link=el('button',(o.index+1)+'. '+o.text,'event-flow-edge-option');link.type='button';link.dataset.flowOption=String(o.index);link.dataset.flowChoice=id;link.dataset.flowTarget=o.target||'';link.setAttribute('aria-label','查看分支：'+o.text);link.title=o.text+(o.target?' → '+currentLabel(nodes.get(o.target)):'：去向未确认');link.style.left=p.x+'px';link.style.top=p.y+'px';link.disabled=!!locked()||!o.target||!positions.has(o.target);link.onclick=()=>activate(o.target,true);canvas.append(link);}
 }
 if(view.flowScroll){viewport.scrollLeft=view.flowScroll.x;viewport.scrollTop=view.flowScroll.y;}else if(layout.main.length){const entry=positions.get(g.entryId);viewport.scrollLeft=Math.max(0,entry.x+111-viewport.clientWidth/2);}viewport.onscroll=()=>view.flowScroll={x:viewport.scrollLeft,y:viewport.scrollTop};
 if(layout.detached.length){const drawer=el('details',undefined,'event-flow-fragments');drawer.open=!!view.fragmentsOpen||!layout.main.length||layout.detached.includes(selected.id);drawer.ontoggle=()=>view.fragmentsOpen=drawer.open;drawer.append(el('summary','未接入已确认入口流程的源码片段 · '+layout.detached.length+' 个节点'),el('p','以下内容可能不可达，或连接尚未确认。单独保留查阅和原有文字编辑权限；不会把它们排成开场，也不会自动补线。','hint'));for(const id of layout.detached){const n=nodes.get(id),b=el('button',(names[n.kind]||n.kind)+' · '+currentLabel(n).slice(0,65),'event-flow-fragment');b.dataset.flowFragment=id;b.disabled=!!locked();b.onclick=()=>activate(id);drawer.append(b);}section.append(drawer);}
 const detail=el('div',undefined,'event-flow-detail');detail.dataset.flowDetail=selected.id;
 const title=selected.kind==='dialogue'?(selected.id===g.entryId?'开场对白':'分支对白')+' · '+selected.indices.length+'句':(names[selected.kind]||selected.kind)+' · '+currentLabel(selected).slice(0,80);
 detail.append(el('h3',title),el('p',layout.detached.includes(selected.id)?'此片段不在已确认的入口流程内；不代表另一个开场。':selected.id===g.entryId?'从已确认入口开始，按下列顺序阅读全部前置对白。':'当前节点属于已确认入口的后续流程。','event-flow-route'),el('p',(selected.group||'')+(selected.sourceLine?' · 源码行 '+selected.sourceLine:''),'hint'));section.append(detail);
 if(view.flowVia?.length)detail.append(el('p','经由已确认标签 '+view.flowVia.join(' → ')+' 进入当前段；主图保留全部真实节点。','hint'));
 if(!w.readOnly&&selected.indices.some(i=>w.lines[i]?.editable!==false)&&!editing){const edit=el('button','编辑整段对白','event-flow-edit-segment');edit.disabled=!!locked();edit.onclick=()=>{if(locked())return;view.editing=true;redraw();editor.querySelector('.event-script')?.scrollIntoView({block:'nearest'});};detail.append(edit);}
 if(selected.fields){const info=el('details');info.append(el('summary','真实条件、奖励与跳转配置（只读）'),el('pre',JSON.stringify(selected.fields,null,2),'event-text'));detail.append(info);}
 for(const e of layout.edges.filter(e=>e.from===selected.id&&selected.kind!=='choice')){const n=nodes.get(e.to),b=el('button','查看后续：'+(e.label||names[n.kind]||'下一段'),'event-flow-next');b.disabled=!!locked();b.dataset.flowTarget=e.to;b.onclick=()=>activate(e.to,true);detail.append(b);}
 if(selected.kind==='external'&&selected.fields?.targetFunction&&w.flowVerified){const record=w.eventRecords?.find(r=>r.manifest.sourcePath===selected.fields.sourcePath&&r.manifest.functionName===selected.fields.targetFunction);if(record){const b=el('button','查看'+record.manifest.title);b.disabled=!!locked();b.onclick=()=>{if(w.changes.length&&!window.confirm('切换将丢弃尚未应用的草稿，是否继续？'))return;root.GCSProject.selectEvent(record.manifest.id);};detail.append(b);}}
 if(selected.kind==='choice'){
  const enabled=!!(editing&&w.branch?.enabled&&!locked());detail.append(el('p',w.branch?.reason||'结构只读：未证明完整引用关系。','hint'));
  if(w.branch?.enabled){
   const options=w.branch.options(selected.id),labels=[...g.arrays[selected.arrayIndex].labels].filter(([,index])=>index>selected.rowIndex).map(([label])=>label);
   const update=next=>{try{w.branch.set(selected.id,next);redraw();}catch(e){root.GCSProject.report(e.message);}};
   options.forEach((o,index)=>{const row=el('div',undefined,'event-flow-option'),input=el('input'),target=el('select');input.value=o.text;input.maxLength=20000;input.setAttribute('aria-label','选项 '+(index+1)+' 文字');input.disabled=!enabled;input.onchange=()=>update(options.map((x,i)=>i===index?{...x,text:input.value}:x));for(const label of labels){const opt=el('option',label);opt.value=label;target.append(opt);}target.value=o.targetLabel;target.setAttribute('aria-label','选项 '+(index+1)+' 去向');target.disabled=!enabled;target.onchange=()=>update(options.map((x,i)=>i===index?{...x,targetLabel:target.value}:x));row.append(el('span',String(index+1)),input,target);const open=el('button','查看分支','event-flow-open-option'),destination=selected.options[index]?.target;open.disabled=!!locked()||!destination||!positions.has(destination);open.dataset.flowTarget=destination||'';open.onclick=()=>activate(destination,true);row.append(open);
    for(const [caption,direction] of [['↑',-1],['↓',1],['删除',0]]){const b=el('button',caption);b.disabled=!enabled||(direction===0?options.length===1:index+direction<0||index+direction>=options.length);b.onclick=()=>{const next=options.slice();if(direction)[next[index],next[index+direction]]=[next[index+direction],next[index]];else next.splice(index,1);update(next);};row.append(b);}detail.append(row);});
   const add=el('button','新增选项');add.disabled=!enabled||options.length>=12;add.onclick=()=>update([...options,{text:'新选项',targetLabel:labels[0]}]);detail.append(add);
  }else{for(const o of selected.options){const row=el('div',undefined,'event-flow-option'),open=el('button','查看分支：'+o.text,'event-flow-open-option');open.disabled=!!locked()||!o.target||!positions.has(o.target);open.dataset.flowTarget=o.target||'';open.onclick=()=>activate(o.target,true);row.append(el('span',(o.index+1)+'. '+o.text+' → '+(o.targetLabel??(o.target?names[nodes.get(o.target).kind]:'去向未确认'))),open);detail.append(row);const info=el('details');info.append(el('summary','此选项的真实配置（只读）'),el('pre',JSON.stringify(o.fields,null,2),'hint'));detail.append(info);}const disabled=el('button','增删、排序与连接（只读）');disabled.disabled=true;detail.append(disabled);}
 }

 for(const warning of g.warnings)section.append(el('p',warning,'notice'));
 if(!selected.indices.length)detail.append(el('p','此节点没有可独立编辑的对白。配置保持只读。','hint'));
 const visible=new Set(selected.indices.filter(i=>!(w.branch?.enabled&&w.lines[i]?.kind==='option')));
 visible.refresh=()=>{for(const [id,{button,snippet}] of snippets){const n=nodes.get(id),label=currentLabel(n);snippet.textContent=label.slice(0,58)+(label.length>58?'…':'');button.title=label+(n.kind==='dialogue'?' · 共'+n.indices.length+'句，点击阅读全文':'');}};
 visible.refresh();return visible;
}
root.GCSEventFlowView={render};
})(window);
