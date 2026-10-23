/* Read-only story presentation over existing verified reading models; never changes game state. */
(function(root){
'use strict';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function render({editor,preview,story,w,open,view,redraw}){
 const api=root.GCSEventReading,kinds={phase:'事件阶段',condition:'条件分支',choice:'玩家选项',retry:'条件重访'};
 editor.append(el('div','完整故事 · 已确认关系总览','breadcrumb'),el('h2',story.title),el('p',story.timing,'hint'),el('p',story.flow,'story-route'));
 editor.append(el('p','这里只组合已核对的阶段。条件情况与玩家选项分别展示；不执行游戏、不写入文件。带条件的阶段并非必然连续发生。','hint'));
 if(story.missing.length)editor.append(el('p','未读到来源：'+story.missing.join('、')+'；总览不完整。','notice'));
 const evidence=el('details');evidence.append(el('summary','关系依据与边界'),el('p',story.evidence,'record-id'));editor.append(evidence);
 const button=(text,fn)=>{const b=el('button',text);b.onclick=fn;return b;};
 function source(box,c,seen=new Set()){
  const r=c.record,sourceId=r.manifest.id;
  if(seen.has(sourceId)||seen.size>7){box.append(el('p','连接重复或未确认，停止展开。','notice'));return;}
  seen=new Set(seen);seen.add(sourceId);
  const section=el('section',undefined,'story-stage');section.dataset.overviewSource=sourceId;
  const heading=el('div',undefined,'story-stage-heading');heading.append(el('h3',c.label),el('span',kinds[c.kind]||'事件阶段','story-kind'));section.append(heading);
  if(c.condition)section.append(el('p',c.condition+' · 非无条件续接','story-condition'));
  section.append(button('打开原对白编辑器',()=>open(sourceId,c.caseValue)));
  if(r.manifest.sourcePath!==w.manifest.sourcePath){section.append(el('p','来源文件未载入；请打开原对白查看。不推定内容或连接。','notice'));box.append(section);return;}
  const projection={manifest:r.manifest,capability:r.capability,originalBytes:w.originalBytes,textOnly:r.capability==='text',readOnly:!r.editable,flowVerified:w.flowVerified,lines:r.lines,eventRecords:w.eventRecords,changes:[],readingCards:[]};
  let m=api.model(projection,view.cases[c.id]||0);
  if(c.caseValue){const index=root.GCSEventStories.caseIndex(m,c.caseValue);if(index<0){section.append(el('p','当前源码的人物情况未匹配已确认条件；请打开原对白核对。','notice'));box.append(section);return;}m=api.model(projection,index);}
  else if(m.cases?.length>1){const label=el('label','阅读条件情况（不是玩家选项） '),select=el('select');select.dataset.storyCase=c.id;m.cases.forEach((entry,i)=>{const opt=el('option',entry.label||entry.title||('情况 '+(i+1)));opt.value=String(i);select.append(opt);});select.value=String(view.cases[c.id]||0);select.onchange=()=>{view.cases[c.id]=Number(select.value);for(const key of Object.keys(view.choices))if(key===c.id||key.startsWith(c.id+':'))delete view.choices[key];redraw();};label.append(select);section.append(label);}
  const selection=view.choices[c.id]||(view.choices[c.id]={});
  const battleBlock=story.blocks.find(b=>b.id==='battle'&&b.alternatives);
  if(battleBlock&&Number.isInteger(view.alternatives.battle)){const fn=battleBlock.alternatives[view.alternatives.battle]?.record.manifest.functionName;for(const node of m.nodes?.values()||[])if(node.kind==='combat'){const links=m.edges.filter(e=>e.from===node.id&&m.nodes.get(e.to)?.kind==='external'&&m.nodes.get(e.to)?.fields?.targetFunction),index=links.findIndex(e=>m.nodes.get(e.to)?.fields?.targetFunction===fn);if(index>=0)selection[node.id]=index;}}
  const trace=api.trace(m,selection),body=el('div',undefined,'story-overview-lines');
  for(const item of trace.items){
   if(item.kind==='dialogue'){const line=m.lines[item.index],row=el('p',undefined,'story-overview-line');if(line.speaker)row.append(el('strong',line.speaker+'：'));row.append(el('span',api.safeText(line)));body.append(row);}
   else if(item.kind==='choice'||item.kind==='outcome'){
    const choice=item.kind==='choice',node=item.node,block=el('div',undefined,'story-overview-choice');block.append(el('p',(choice?'玩家选项 · ':'条件结果 · ')+(choice?node.prompt:item.text)));
    (choice?node.options:item.options).forEach((o,i)=>{const b=button(o.text,()=>{selection[node.id]=i;if(!choice&&node.kind==='combat'&&battleBlock){const fn=m.nodes.get(o.target)?.fields?.targetFunction,index=battleBlock.alternatives.findIndex(a=>a.record.manifest.functionName===fn);if(index>=0)view.alternatives.battle=index;}redraw();});b.dataset.overviewChoice=choice?'player':'condition';b.setAttribute('aria-pressed',String(item.selected===i));block.append(b);});body.append(block);
   }else if(item.kind==='continuation'&&item.record){source(body,{id:c.id+':helper',label:'已确认的条件续接',kind:'condition',record:item.record},seen);}
   else if(item.kind==='external'&&item.record){body.append(el('p','已确认后续：'+root.GCSEventDirectory.title(item.record.manifest)+'；请在下方对应条件阶段阅读。','hint'));}
   else if(item.kind==='limit'||item.kind==='note'||item.kind==='continuation')body.append(el('p',item.text,'notice'));
  }
  if(!m.lines.length)section.append(el('p','该条件没有独立对白；保留真实入口。','hint'));
  if(!m.verified){const details=el('details');details.append(el('summary','独立文字片段 · 顺序未确认'));m.lines.forEach(line=>details.append(el('p',api.safeText(line))));body.append(details);}
  section.append(body);box.append(section);
 }
 for(const block of story.blocks){const box=el('div',undefined,'story-overview-block');
  if(block.alternatives){box.append(el('h3',block.label),el('p','以下为互斥结果，不能当作依次发生的阶段。','hint'));const index=view.alternatives[block.id]??0,bar=el('div',undefined,'story-alternatives');block.alternatives.forEach((c,i)=>{const b=button(c.label,()=>{view.alternatives[block.id]=i;redraw();});b.dataset.storyAlternative=c.label;b.setAttribute('aria-pressed',String(i===index));bar.append(b);});box.append(bar);source(box,block.alternatives[index]||block.alternatives[0]);}
  else if(block.child.caseValue){const choices=story.children.filter(c=>c.caseValue),index=view.alternatives.people??0;box.append(el('h3','人物条件 · 非玩家选项'));const select=el('select');select.dataset.storyPeople='true';choices.forEach((c,i)=>{const opt=el('option',c.label);opt.value=String(i);select.append(opt);});select.value=String(index);select.onchange=()=>{view.alternatives.people=Number(select.value);redraw();};box.append(select);source(box,choices[index]||choices[0]);}
  else source(box,block.child);
  editor.append(box);
 }
 preview.append(el('h3','故事结构'),el('p',story.title+' · '+story.sourceIds.length+' 个源码来源'),el('p','阅读条件用于查看情况，不是游戏中的选择。玩家选项只出现在对白对应位置。','hint'),el('p','需要改字、分支或查看演出时，打开对应的原对白编辑器。','hint'));
}
root.GCSEventStoryView={render};
})(window);
