/* Clickable flow canvas inside the existing event column; no resources leave the browser. */
(function(root){
'use strict';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const names={dialogue:'对白',choice:'玩家选择',condition:'条件 · 只读',combat:'战斗 · 只读',end:'结束',anchor:'汇合 / 标签',jump:'跳转',scene:'场景',unknown:'未知 · 只读',external:'外部回调 · 只读'};
function render({editor,script,w,view,editing,locked,redraw,refresh}){
 if(!w.originalBytes&&!w.rawSource)return null;
 let g;try{const bytes=w.originalBytes||new TextEncoder().encode(w.rawSource);g=root.GCSEventFlow.read(bytes,w.manifest);}catch{return null;}
 if(!g.branched||!g.nodes.some(n=>n.indices.length))return null;
 if(!w.flowVerified){g.edges=[];g.warnings.push('当前播放器或回调与已核对版本不同：仅展示源码节点，不确认运行连接；文字权限保留。');}
 for(const n of g.nodes){const row=w.lines[n.indices[0]];if(n.kind==='dialogue'&&row)n.label=(n.anchor?n.anchor+' · ':'')+(row.speaker||'旁白')+'：'+row.text+(n.indices.length>1?'\n'+n.indices.length+' 句连续对白':'');if(n.kind==='choice'){const prompt=n.indices.map(i=>w.lines[i]).find(r=>r.kind==='prompt');if(prompt)n.label=prompt.text||'玩家选择';const options=n.indices.map(i=>w.lines[i]).filter(r=>r.kind==='option');n.options=n.options.map((o,i)=>({...o,text:options[i]?.text??o.text}));}if(n.kind==='choice'&&w.branch?.overrides[n.id])n.options=w.branch.options(n.id).map((o,index)=>({...o,index,target:g.arrays[n.arrayIndex].flowRows[g.arrays[n.arrayIndex].labels.get(o.targetLabel)]?.id}));}
 // Structural targets alter only option edges; row and combat topology is immutable.
 for(const n of g.nodes.filter(n=>n.kind==='choice'&&n.options.every(o=>o.target))){g.edges=g.edges.filter(e=>e.from!==n.id);if(w.flowVerified)for(const o of n.options)g.edges.push({from:n.id,to:o.target,label:(o.index+1)+'. '+o.text});}
 let selected=g.nodes.find(n=>n.id===view.flowNode)||g.nodes.find(n=>n.indices.includes(w.selectedIndex))||g.nodes[0];view.flowNode=selected.id;
 const section=el('section',undefined,'event-flow');section.setAttribute('aria-label','真实剧情分支流程');section.append(el('p','剧情流程 · 点击节点查看所属内容。连线仅表示已确认的去向；没有连线的片段不推断先后。','hint'));
 const viewport=el('div',undefined,'event-flow-viewport'),canvas=el('div',undefined,'event-flow-canvas');viewport.append(canvas);section.append(viewport);editor.insertBefore(section,script);
 const incoming=new Map(g.nodes.map(n=>[n.id,0])),levels=new Map(g.nodes.map(n=>[n.id,0]));for(const e of g.edges)incoming.set(e.to,(incoming.get(e.to)||0)+1);
 const queue=g.nodes.filter(n=>!incoming.get(n.id)).map(n=>n.id),visited=new Set();while(queue.length){const id=queue.shift();if(visited.has(id))continue;visited.add(id);for(const e of g.edges.filter(e=>e.from===id)){levels.set(e.to,Math.max(levels.get(e.to)||0,(levels.get(id)||0)+1));incoming.set(e.to,incoming.get(e.to)-1);if(!incoming.get(e.to))queue.push(e.to);}}
 // Cycles stay visible without pretending to topologically order them.
 let tail=Math.max(0,...levels.values())+1;for(const n of g.nodes)if(!visited.has(n.id))levels.set(n.id,tail++);
 const lanes=new Map(),positions=new Map();for(const n of g.nodes){const depth=levels.get(n.id),lane=lanes.get(depth)||0;lanes.set(depth,lane+1);positions.set(n.id,{x:lane*254+20,y:depth*158+20});}
 const width=Math.max(530,...[...lanes.values()].map(n=>n*254+20)),height=(Math.max(...levels.values())+1)*158+20;canvas.style.width=width+'px';canvas.style.height=height+'px';
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('width',width);svg.setAttribute('height',height);svg.setAttribute('aria-hidden','true');canvas.append(svg);
 const defs=document.createElementNS(ns,'defs'),marker=document.createElementNS(ns,'marker');marker.id='flow-arrow';marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto-start-reverse');const arrow=document.createElementNS(ns,'path');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');marker.append(arrow);defs.append(marker);svg.append(defs);
 for(const e of g.edges){const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)continue;const siblings=g.edges.filter(x=>x.from===e.from),port=siblings.indexOf(e),path=document.createElementNS(ns,'path'),x=a.x+222*(port+1)/(siblings.length+1),y=a.y+94,tx=b.x+111,ty=b.y;path.setAttribute('d',`M${x},${y} C${x},${y+34} ${tx},${ty-34} ${tx},${ty}`);path.setAttribute('marker-end','url(#flow-arrow)');svg.append(path);if(e.label){const label=document.createElementNS(ns,'text');label.setAttribute('x',(x+tx)/2+5);label.setAttribute('y',(y+ty)/2+(port%3-1)*13);label.textContent=e.label.length>24?e.label.slice(0,24)+'…':e.label;const title=document.createElementNS(ns,'title');title.textContent=e.label;label.append(title);svg.append(label);}}
 for(const n of g.nodes){const b=el('button',undefined,'event-flow-node '+n.kind+(n.id===selected.id?' selected':'')),pos=positions.get(n.id);b.type='button';b.dataset.flowNode=n.id;b.style.left=pos.x+'px';b.style.top=pos.y+'px';b.title=n.label;b.setAttribute('aria-pressed',String(n.id===selected.id));b.append(el('strong',names[n.kind]||n.kind),el('span',n.label.slice(0,90)));b.disabled=!!locked();b.onclick=()=>{const x=viewport.scrollLeft,y=viewport.scrollTop;view.flowNode=n.id;if(n.indices.length)w.select(n.indices[0]);view.flowScroll={x,y};redraw();};canvas.append(b);}
 if(view.flowScroll){viewport.scrollLeft=view.flowScroll.x;viewport.scrollTop=view.flowScroll.y;}viewport.onscroll=()=>view.flowScroll={x:viewport.scrollLeft,y:viewport.scrollTop};
 const detail=el('div',undefined,'event-flow-detail');detail.dataset.flowDetail=selected.id;detail.append(el('h3',(names[selected.kind]||selected.kind)+' · '+selected.label.split('\n')[0]),el('p',(selected.group||'')+(selected.sourceLine?' · 源码行 '+selected.sourceLine:''),'hint'));section.append(detail);
 if(selected.fields){const info=el('details');info.append(el('summary','真实条件、奖励与跳转配置（只读）'),el('pre',JSON.stringify(selected.fields,null,2),'event-text'));detail.append(info);}
 if(selected.kind==='external'&&selected.fields?.targetFunction&&w.flowVerified){const record=w.eventRecords?.find(r=>r.manifest.sourcePath===selected.fields.sourcePath&&r.manifest.functionName===selected.fields.targetFunction);if(record){const b=el('button','查看'+record.manifest.title);b.disabled=!!locked();b.onclick=()=>{if(w.changes.length&&!window.confirm('切换将丢弃尚未应用的草稿，是否继续？'))return;root.GCSProject.selectEvent(record.manifest.id);};detail.append(b);}}
 if(selected.kind==='choice'){
  const enabled=!!(editing&&w.branch?.enabled&&!locked());detail.append(el('p',w.branch?.reason||'结构只读：未证明完整引用关系。','hint'));
  if(w.branch?.enabled){
   const options=w.branch.options(selected.id),labels=[...g.arrays[selected.arrayIndex].labels].filter(([,index])=>index>selected.rowIndex).map(([label])=>label);
   const update=next=>{try{w.branch.set(selected.id,next);redraw();}catch(e){root.GCSProject.report(e.message);}};
   options.forEach((o,index)=>{const row=el('div',undefined,'event-flow-option'),input=el('input'),target=el('select');input.value=o.text;input.maxLength=20000;input.setAttribute('aria-label','选项 '+(index+1)+' 文字');input.disabled=!enabled;input.onchange=()=>update(options.map((x,i)=>i===index?{...x,text:input.value}:x));for(const label of labels){const opt=el('option',label);opt.value=label;target.append(opt);}target.value=o.targetLabel;target.setAttribute('aria-label','选项 '+(index+1)+' 去向');target.disabled=!enabled;target.onchange=()=>update(options.map((x,i)=>i===index?{...x,targetLabel:target.value}:x));row.append(el('span',String(index+1)),input,target);
    for(const [caption,direction] of [['↑',-1],['↓',1],['删除',0]]){const b=el('button',caption);b.disabled=!enabled||(direction===0?options.length===1:index+direction<0||index+direction>=options.length);b.onclick=()=>{const next=options.slice();if(direction)[next[index],next[index+direction]]=[next[index+direction],next[index]];else next.splice(index,1);update(next);};row.append(b);}detail.append(row);});
   const add=el('button','新增选项');add.disabled=!enabled||options.length>=12;add.onclick=()=>update([...options,{text:'新选项',targetLabel:labels[0]}]);detail.append(add);
  }else{for(const o of selected.options)detail.append(el('p',(o.index+1)+'. '+o.text+' → '+(o.targetLabel??o.target??'未知'),'event-flow-option'),el('pre',JSON.stringify(o.fields,null,2),'hint'));const disabled=el('button','增删、排序与连接（只读）');disabled.disabled=true;detail.append(disabled);}
 }
 for(const warning of g.warnings)section.append(el('p',warning,'notice'));
 if(!selected.indices.length)detail.append(el('p','此节点没有可独立编辑的对白。配置保持只读。','hint'));
 // Only the selected segment is rendered in the script editor; other branches never concatenate.
 return new Set(selected.indices.filter(i=>!(w.branch?.enabled&&w.lines[i]?.kind==='option')));
}
root.GCSEventFlowView={render};
})(window);
