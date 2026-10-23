/* Reusable linear event editor in the existing three-column workspace. */
(function(root){
'use strict';const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const dialog=el('dialog');dialog.id='event-dialog';dialog.setAttribute('aria-label','检查并应用真实对白修改');document.body.append(dialog);
let session=null,busy=false;const state=()=>root.GCSProject.getState(),work=()=>state().eventWorkspace;
function change(kind='event-draft'){window.dispatchEvent(new CustomEvent('gcs-project-change',{detail:{kind}}));}
const directory=root.GCSEventDirectory,stories=root.GCSEventStories,groupState=new Map(),navigationGroups=new Set();let revealRequested=false,directoryRecords=null,directorySelected=null,directoryQuery='',overviewId=null,overviewAnchor=null,pendingCase=null,arranging=false;
const saved=key=>{try{return JSON.parse(root.localStorage?.getItem(key)||'null');}catch{return null;}},store=(key,value)=>{try{root.localStorage?.setItem(key,JSON.stringify(value));}catch{}};
let displayOrder=stories?.normalizeOrder(saved('gcs-story-order-v1'))||[];const expanded=saved('gcs-story-expanded-v1');for(const entry of Array.isArray(expanded)?expanded:[])if(Array.isArray(entry)&&typeof entry[0]==='string'&&typeof entry[1]==='boolean')groupState.set(entry[0],entry[1]);
const overviewViews=new Map(),blocked=()=>busy||work()?.locked||work()?.blocked||state().workspace?.locked;
function canLeave(){if(blocked())return false;return !work()?.changes.length||window.confirm('当前事件还有未应用的修改。切换将丢弃这些草稿，是否继续？');}
function clearSearch(){if($('search')?.value){$('search').value='';$('search').dispatchEvent(new Event('input',{bubbles:true}));}}
function selectEvent(id,reveal=false,caseValue){const w=work();if(!w)return;if(id===w.manifest.id&&!overviewId&&!caseValue){if(reveal){clearSearch();revealRequested=true;renderList($('search')?.value||'');}return;}if(!canLeave())return;try{overviewId=null;overviewAnchor=null;pendingCase=caseValue?{id,value:caseValue}:null;if(reveal){clearSearch();revealRequested=true;}root.GCSProject.selectEvent(id);}catch(e){root.GCSProject.report(e.message);}}
function selectStory(story){if(!canLeave())return;overviewId=story.id;overviewAnchor=story.sourceIds[0];if(!$('search')?.value.trim()){groupState.set(story.id,true);store('gcs-story-expanded-v1',[...groupState]);}root.GCSProject.selectEvent(overviewAnchor);}
function renderList(query=''){
 const w=work(),records=w?.eventRecords||(w?[{manifest:w.manifest,editable:!w.readOnly,capability:w.capability,lines:w.lines,rawSource:w.rawSource}]:[]);
 if(overviewId&&w?.manifest.id!==overviewAnchor)overviewId=null;
 const result=stories.build(records,query,displayOrder),searching=!!query.trim(),list=$('record-list'),scroll=list.scrollTop,selected=overviewId||w?.manifest.id,reveal=!searching&&(revealRequested||directorySelected!==null&&directorySelected!==selected&&!directoryQuery.trim());
 // User preferences survive search; navigation opens only the selected source's ancestors.
 if(reveal){navigationGroups.clear();const story=result.allStories.find(s=>s.id===overviewId||!overviewId&&s.sourceIds.includes(w?.manifest.id));if(story){navigationGroups.add('bucket:'+story.bucket);if(story.grouped&&!overviewId)navigationGroups.add(story.id);}else{const group=result.auxiliary.find(g=>g.records.some(r=>r.manifest.id===w?.manifest.id));if(group)navigationGroups.add(group.id);}}revealRequested=false;
 directoryRecords=records;directorySelected=selected;directoryQuery=query;
 $('library-title').textContent='剧情目录';$('library-en').textContent='GAME / 故事与来源';const foot=document.querySelector('.library-foot');if(foot)foot.textContent=result.storyCount+' 剧情事件 · '+result.sourceCount+' 源码来源（剧情 '+result.storySourceCount+' / 时间轴 '+(result.auxiliary.find(g=>g.id==='dialogic')?.total||0)+' / 技术 '+(result.auxiliary.find(g=>g.id==='technical')?.total||0)+'）';
 list.classList.add('event-directory');list.replaceChildren();$('list-count').textContent=searching?result.matchedStories+' 事件 · '+result.matchedSources+' 来源':result.storyCount+' 事件 · '+result.sourceCount+' 来源';
 const tools=el('div',undefined,'story-directory-tools'),adjust=el('button',arranging?'完成排序':'调整目录顺序');adjust.dataset.storyArrange='true';adjust.disabled=!!blocked();adjust.onclick=()=>{arranging=!arranging;renderList(query);};tools.append(adjust);
 if(arranging){const reset=el('button','恢复默认');reset.dataset.storyOrderReset='true';reset.disabled=!!blocked();reset.onclick=()=>{displayOrder=[];store('gcs-story-order-v1',[]);renderList(query);};tools.append(reset,el('small','仅调同类目录展示；不改变游戏触发或对白顺序。'));}list.append(tools);
 function disclosure(id,label,cls,open){const section=el('details',undefined,cls);section.open=searching||open||navigationGroups.has(id);const summary=el('summary',label);section.append(summary);summary.onclick=()=>{if(!searching){navigationGroups.delete(id);groupState.set(id,!section.open);store('gcs-story-expanded-v1',[...groupState]);}};return section;}
 function storyHeading(story){const line=el('span',undefined,'story-title-line'),badge=el('span',story.timeLabel,'story-time');badge.dataset.storyTime=story.timeLabel;badge.dataset.timingKind=story.timingKind;badge.title=story.cycleLabel+' · '+story.timing;line.append(el('span',story.title,'record-title'),badge);return line;}
 function recordButton(r,label,kind,caseValue,story){const d=directory.describe(r),active=!overviewId&&r.manifest.id===w?.manifest.id&&(!caseValue||(pendingCase?.value||viewStates.get(w)?.storyCase||'wanjun')===caseValue),b=el('button',undefined,'record'+(active?' active':''));b.dataset.action='event-select';b.dataset.eventId=r.manifest.id;b.dataset.capability=d.capability;if(caseValue)b.dataset.caseValue=caseValue;b.disabled=!!blocked();b.setAttribute('aria-pressed',String(active));b.title=d.title+' · '+r.manifest.sourcePath;const info=el('span',undefined,'record-info');info.append(story?storyHeading(story):el('span',label||d.title,'record-title'),el('span',(story?story.cycleLabel+' · ':'')+(kind?kind+' · ':'')+(caseValue?'共享来源 · '+({full:'完整编辑',text:'仅文字编辑',readonly:'只读'}[d.capability]||'只读'):d.subtitle)+(active&&w.changes.length?' · 未应用':''),'record-sub'));b.append(el('span','↳','record-symbol'),info);b.onclick=()=>selectEvent(r.manifest.id,false,caseValue);return b;}
 const labels={phase:'事件阶段',condition:'条件分支',choice:'玩家选项',retry:'条件重访'};
 for(const bucket of result.buckets){if(!bucket.stories.length&&(bucket.id!=='cycle2'||searching))continue;const section=disclosure('bucket:'+bucket.id,bucket.label,'event-directory-group',groupState.get('bucket:'+bucket.id)??false);section.dataset.storyBucket=bucket.id;section.title=bucket.note;section.append(el('p',bucket.note,'story-bucket-note'));if(bucket.id==='cycle1'){const hint=el('p',result.calendarNote,'story-calendar-note');hint.dataset.calendarNote='true';section.append(hint);}if(bucket.id==='cycle2'&&!bucket.stories.length){const empty=el('p','第二段养成 · R1–R16：当前没有已确认的专属日历剧情；不沿用第一段事件。','story-calendar-note');empty.dataset.emptyCycle='cycle2';section.append(empty);}const content=el('div',undefined,'event-directory-items');section.append(content);
  for(const story of bucket.stories){const row=el('div',undefined,'story-directory-root');row.dataset.storyRoot=story.id;
   if(story.grouped){const open=groupState.get(story.id)??false,tree=disclosure(story.id,'','story-directory-parent',open);tree.dataset.storyId=story.id;const title=el('button',undefined,'record story-parent-title'+(overviewId===story.id?' active':''));title.dataset.storySelect=story.id;title.setAttribute('aria-pressed',String(overviewId===story.id));title.disabled=!!blocked();const info=el('span',undefined,'record-info');info.append(storyHeading(story),el('span',story.cycleLabel+' · '+story.sourceIds.length+' 来源','record-sub'));title.append(info);title.onclick=e=>{e.preventDefault();e.stopPropagation();selectStory(story);};tree.children[0].append(title);const children=el('div',undefined,'story-directory-children');for(const c of story.children)children.append(recordButton(c.record,c.label,labels[c.kind],c.caseValue));tree.append(children);row.append(tree);
   }else row.append(recordButton(story.record,undefined,undefined,undefined,story));
   if(arranging&&!searching){const controls=el('div',undefined,'story-order-controls'),all=result.allStories.filter(s=>s.bucket===bucket.id),index=all.findIndex(s=>s.id===story.id);for(const [delta,label] of [[-1,'上移'],[1,'下移']]){const b=el('button',label);b.dataset.storyMove=String(delta);b.setAttribute('aria-label',story.title+label);b.disabled=!!blocked()||index+delta<0||index+delta>=all.length;b.onclick=()=>{const ids=result.allStories.map(s=>s.id),a=ids.indexOf(story.id),other=ids.indexOf(all[index+delta].id);[ids[a],ids[other]]=[ids[other],ids[a]];displayOrder=ids;store('gcs-story-order-v1',ids);renderList(query);};controls.append(b);}row.append(controls);}content.append(row);
  }list.append(section);
 }
 for(const g of result.auxiliary){if(!g.records.length)continue;const section=disclosure(g.id,g.label+' · '+g.total,'event-directory-group',groupState.get(g.id)??false);section.dataset.sourceCategory=g.id;const content=el('div',undefined,'event-directory-items');for(const r of g.records)content.append(recordButton(r));section.append(content);list.append(section);}
 if(!result.matchedSources)list.append(el('p','没有匹配项；搜索覆盖全部故事、时间轴和技术来源。','event-directory-empty'));
 list.scrollTop=scroll;if(reveal)list.querySelector('.record.active')?.scrollIntoView({block:'nearest'});
}
const viewStates=new WeakMap();
function render(editor,preview){
 editor.replaceChildren();preview.replaceChildren();const s=state(),w=work();
 if(!s.connected||!w){editor.append(el('h2',s.connected?'真实事件暂不可用':'连接游戏项目以读取真实事件'),el('p',s.eventError||'选择《凝顾》根目录后读取已映射事件。此页不再展示演示剧情。','notice'));return;}
 if(overviewId&&w.manifest.id===overviewAnchor&&stories&&root.GCSEventStoryView){const story=stories.build(w.eventRecords||[]).allStories.find(s=>s.id===overviewId);if(story){let v=overviewViews.get(story.id);if(!v){v={cases:{},choices:{},alternatives:{}};overviewViews.set(story.id,v);}root.GCSEventStoryView.render({editor,preview,story,w,view:v,open:(id,value)=>selectEvent(id,true,value),redraw:()=>render(editor,preview)});return;}}
 let view=viewStates.get(w);if(!view){view={editing:false,previewOpen:false,renderToken:0};viewStates.set(w,view);}
 if(pendingCase?.id===w.manifest.id){const m=root.GCSEventReading.model(w),index=stories.caseIndex(m,pendingCase.value);if(index>=0)view.readCase=index;view.storyCase=pendingCase.value;pendingCase=null;}
 if(w.manifest.className==='TeahouseNpcEncounter'&&root.GCSEventReading){const m=root.GCSEventReading.model(w);view.storyCase=['wanjun','jianan','other'].find(value=>stories.caseIndex(m,value)===(view.readCase||0));}
 if(w.readOnly)view.editing=false;
 const descriptor=directory.describe({manifest:w.manifest,capability:w.capability,editable:!w.readOnly,lines:w.lines,rawSource:w.rawSource});
 if(descriptor.category!=='story'){
  const heading=el('div',undefined,'editor-heading'),label=el('div');label.append(el('div',descriptor.category==='dialogic'?'Dialogic 时间轴 · 原文只读':'技术来源 · 只读','breadcrumb'),el('h2',descriptor.title));heading.append(label);editor.append(heading);
  const panel=el('section',undefined,'event-source-panel');panel.append(el('p',descriptor.category==='dialogic'?'此文件使用 Dialogic 指令与跳转格式。目前仅支持原文只读审阅，不解析为普通对白，也不支持编辑或演出预览。运行入口尚未确认。':descriptor.explanation,'notice'),el('p',w.manifest.sourcePath,'record-id'));
  if(descriptor.category==='technical'){const related=(w.eventRecords||[]).filter(r=>descriptor.related.includes(r.manifest.id));if(related.length){panel.append(el('h3','相关剧情'));const links=el('div',undefined,'event-source-links');for(const r of related){const b=el('button',directory.title(r.manifest));b.dataset.relatedEventId=r.manifest.id;b.disabled=!!(busy||w.locked||w.blocked||state().workspace?.locked);b.onclick=()=>selectEvent(r.manifest.id,true);links.append(b);}panel.append(links);}else panel.append(el('p','相关对白来源当前未读取；保留此入口与真实源配置。','hint'));}
  if(w.rawSource){const source=el('pre',w.rawSource,'event-text event-source-text');if(descriptor.category==='dialogic')panel.append(source);else{const details=el('details');details.append(el('summary','查看真实源配置'),source);panel.append(details);}}
  if(w.discoveryErrors?.length)panel.append(el('p','部分来源无法读取：'+w.discoveryErrors.join('；'),'notice'));
  editor.append(panel);preview.append(el('p',descriptor.category==='dialogic'?'Dialogic 原文审阅不提供人物演出预览。':'此入口没有独立对白；请选择相关剧情阅读或编辑。','hint'));return;
 }
 const renderToken=++view.renderToken;
 const locked=()=>w.locked||w.blocked||state().workspace?.locked;
 const heading=el('div',undefined,'editor-heading'),title=el('div');title.append(el('div',view.flowOpen?'流程图':view.editing?'编辑模式 · 内存草稿':'阅读模式','breadcrumb'),el('h2',root.GCSEventReading?.title(w.manifest)||w.manifest.title));heading.append(title);editor.append(heading);
 function button(text,fn){const b=el('button',text);b.disabled=!!locked();b.onclick=()=>{if(locked())return;try{return fn();}catch(e){root.GCSProject.report(e.message);}};return b;}
 function redraw(focus=false){render(editor,preview);renderList($('search')?.value||'');change();if(focus)editor.querySelector?.('textarea')?.focus();}
 if(w.blocked)editor.append(el('p','保存没有完成，请先检查备份并恢复，再继续编辑。','notice'));
 const tools=el('div',undefined,'card-edit-tools'+(root.GCSEventReadingView?' event-reading-tools':''));editor.append(tools);
 if(!w.readOnly)tools.append(button(view.editing?'完成编辑':'编辑剧本',()=>{view.editing=!view.editing;redraw();}));
 const previewToggle=button('演出预览',()=>{view.previewOpen=!view.previewOpen;redraw();});previewToggle.setAttribute('aria-expanded',String(view.previewOpen));previewToggle.setAttribute('aria-controls','preview');tools.append(previewToggle);
 if(root.GCSEventReadingView)tools.append(button(view.flowOpen?'返回剧情阅读':'查看流程图',()=>{view.flowOpen=!view.flowOpen;redraw();editor.scrollTop=0;}));
 let undo,redo,reset,review,restore;
 if(view.editing){
  undo=button('撤销一步',()=>{w.undo();redraw();});redo=button('重做',()=>{w.redo();redraw();});reset=button('撤销未应用修改',()=>{w.discard();redraw();});
  review=button('查看差异并应用',()=>open(w));restore=button('从备份恢复',()=>selectRestore(w));tools.append(undo,redo,reset,review,restore);
 }
 const advanced=el('details',undefined,'event-advanced');advanced.append(el('summary','高级信息'));
 const status=el('p',undefined,'hint');status.setAttribute('role','status');advanced.append(status);
 const script=el('div',undefined,'event-script');editor.append(script);
 const origin=el('p',w.manifest.sourcePath+' / '+(w.manifest.className?w.manifest.className+'.':'')+w.manifest.functionName+(w.manifest.entryPath?' · 执行入口：'+w.manifest.entryPath:' · 执行入口未确认'),'record-id');advanced.append(origin);
 if(w.textOnly)advanced.append(el('p',w.branch?.enabled?'文字与选择结构编辑：'+w.branch.reason:'仅文字编辑：'+w.reason+(w.manifest.reference?' 已确认引用链：'+w.manifest.reference:''),'notice'));
 if(w.readOnly){advanced.append(el('p','只读：'+w.reason+'。下面仅展示可直接确认的字面量对白；完整配置请展开源码，不将片段顺序当作实际播放顺序。','notice'));}
 if(w.rawSource){const details=el('details'),summary=el('summary','查看真实源配置');details.append(summary,el('pre',w.rawSource,'event-text'));advanced.append(details);}
 if(w.discoveryErrors?.length)advanced.append(el('p','部分来源无法读取：'+w.discoveryErrors.join('；'),'notice'));
 const useReader=!!root.GCSEventReadingView&&!view.flowOpen;let visible;
 if(!useReader)visible=root.GCSEventFlowView?.render({editor,script,w,view,editing:view.editing,locked,redraw,refresh,advanced});
 const current=w.lines;
 function renderLine(index,parent=script,{compact=false,repeatedSpeaker=false}={}){const line=current[index];if(!line)return;
  const selected=w.selectedIndex===index,segmentEditing=!!visible&&view.editing;
  // Use a non-button container for the active row so its inputs and buttons remain independent.
  const row=el(view.editing&&!selected&&!segmentEditing?'button':'article',undefined,'event-script-row'+(selected?' selected':''));
  row.dataset.textKind=line.kind||'dialogue';if(line.slotId)row.dataset.slotId=line.slotId;if(compact&&repeatedSpeaker)row.className+=' repeated-speaker';if(compact&&!line.speaker)row.className+=' narration';row.append(el('span',compact?(line.kind==='option'?'选项文字':line.kind==='prompt'?'选择提示':line.speaker==='【动态说话人】'?'角色':line.speaker):(index+1)+'. '+line.speaker,'event-script-speaker'));
  if(w.textOnly&&!compact)row.append(el('p',line.context+' · 源码行 '+line.line+' · '+(line.editable?'文字可编辑':'文字只读：'+line.reason),'hint'));
  if(!view.editing||!selected&&!segmentEditing){
   if(view.editing){row.type='button';row.disabled=!!locked();}else{row.setAttribute('role','button');row.setAttribute('tabindex','0');}
   row.setAttribute('aria-pressed',String(selected));row.onclick=()=>{if(locked()||w.selectedIndex===index)return;w.select(index);redraw(view.editing);};
   if(!view.editing)row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.onclick();}};
  }
  if(view.editing&&(selected||segmentEditing)&&(!w.textOnly||line.editable)){
   const caption=el('label',line.kind==='option'?'选项文字':line.kind==='prompt'?'选择提示':'对白文字','field event-inline-field'),input=el('textarea');input.value=line.text;input.maxLength=20000;input.dataset.eventLine=String(index);input.setAttribute('aria-label','第 '+(index+1)+' 句对白');input.disabled=!!locked();
   // Keep this input node and its value/selection untouched while updating the draft and preview.
   input.onfocus=()=>{if(locked())return;w.select(index);for(const node of script.querySelectorAll?.('.event-script-row')||[])node.classList.toggle('selected',node.querySelector('textarea')===input);refresh();};
   input.oninput=()=>{try{w.set(index,input.value);visible?.refresh?.();refresh();renderList($('search')?.value||'');change('event-input');}catch(e){status.textContent=e.message;}};
   caption.append(input);row.append(caption);
   if(!w.textOnly){const actions=el('div',undefined,'card-edit-tools event-line-actions');
   const remove=button('删除',()=>{w.remove(index);redraw(true);});remove.disabled=!!locked()||current.length===1;
   const up=button('上移',()=>{w.move(index,-1);redraw(true);}),down=button('下移',()=>{w.move(index,1);redraw(true);});up.disabled=!!locked()||index===0;down.disabled=!!locked()||index===current.length-1;
   actions.append(button('前插',()=>{w.insert(index);redraw(true);}),button('后插',()=>{w.insert(index,true);redraw(true);}),button('复制',()=>{w.duplicate(index);redraw(true);}),remove,up,down);row.append(actions);}
  }else row.append(el('p',compact?root.GCSEventReading.safeText(line):line.text||'（空白对白）','event-script-text'));
  if(w.readOnly&&!compact)row.append(el('p','左：'+(line.left??'未解析')+' / 右：'+(line.right??'未解析')+' / 表情：'+(line.mood??'未解析'),'hint'));

  parent.append(row);
 }
 function readingInput(changed=true){refresh();renderList($('search')?.value||'');if(changed)change('event-input');}
 if(useReader){w.readingCards=s.records||[];visible=root.GCSEventReadingView.render({editor,script,w,view,editing:view.editing,locked,redraw,renderLine,advanced,onInput:readingInput});}
 else if(root.GCSEventReadingView&&!visible){script.append(el('p','这段剧情按顺序播放，没有可展开的分支。请返回剧情阅读。','hint'));visible=new Set();}
 else current.forEach((_,index)=>{if(!visible||visible.has(index))renderLine(index);});
 editor.append(advanced);
 if(view.editing)advanced.append(el('p',w.branch?.enabled?'可在选择节点增删、排序选项并连接到已有后续标签；对白分别修改。战斗、奖励、标签和演出配置保持锁定。':w.textOnly?'仅开放已确认的已有文字。对白、选择提示、选项分别绑定源码身份；不能增删、排序或改变人物、演出、奖励和跳转。':'新增对白沿用相邻人物、左右立绘和表情；开场背景保留为事件配置。人物及表情可在展开的演出面板中逐句编辑，审阅全部差异并备份后可安全应用。','hint'));
 let previewKey=null,previewText=null;
 function updatePreview(){
  if(!view.previewOpen){preview.replaceChildren();return;}
  if(visible&&visible.size===0){preview.replaceChildren(el('p','当前为结束、条件或跳转节点，没有独立对白演出。请查看节点的真实配置或继续查看后续。','notice'));return;}
  const line=w.lines[w.selectedIndex];if(!line){preview.replaceChildren(el('p','此来源没有可直接解析的对白，请查看真实源配置。','notice'));return;}if((w.textOnly&&line.kind!=='dialogue')){if(useReader)preview.replaceChildren(el('p','选择的后续会在正文中展开；点击一句对白可以查看对应演出。','hint'));else preview.replaceChildren(el('p',line.speaker+'：'+line.text,'event-text'),el('p',line.context,'hint'));return;}if((w.readOnly||w.textOnly)&&['left','right','mood'].some(k=>typeof line[k]!=='string'||line[k]==='<inherit>')){preview.replaceChildren(el('p','这句对白的演出需由游戏决定，暂不显示立绘。','notice'));return;}const key=JSON.stringify([line.speaker,line.left,line.right,line.mood]);
  if(key===previewKey&&previewText){previewText.textContent=line.text||'（空白对白）';return;}
  previewKey=key;preview.replaceChildren(el('div','演出预览 · 第 '+(w.selectedIndex+1)+' 句','preview-label'),el('p','说话人：'+(line.speaker||'旁白'),'event-performance-speaker'));
  const stage=el('div',undefined,'event-performance-stage');stage.setAttribute('aria-label','左右人物立绘');stage.append(el('p','正在读取本地立绘…','hint'));previewText=el('pre',line.text||'（空白对白）','event-text');preview.append(stage,previewText,el('p',w.textOnly?'图片仅从本地项目读取。人物和演出配置保持锁定；选择结构权限在选择节点单独显示。':'图片仅从所选本地项目读取。演出修改先保留草稿，审阅并备份后写入游戏。','notice'));
  if(!w.performance){stage.replaceChildren(el('p','立绘预览尚不可用，请重新连接本地游戏项目。','notice'));return;}
  const valid=()=>!overviewId&&work()===w&&view.previewOpen&&view.renderToken===renderToken&&previewKey===key;
  if(view.editing&&!w.textOnly){
   const settings=el('div',undefined,'event-performance-settings'),fields={};settings.setAttribute('aria-label','当前句人物演出设置');
   for(const [key,label] of [['speaker','说话人'],['left','左侧立绘'],['right','右侧立绘'],['mood','表情']]){
    const field=el('label',label,'field'),select=el('select');select.dataset.performanceField=key;select.setAttribute('aria-label',label);select.disabled=true;field.append(select);settings.append(field);fields[key]=select;
   }
   const note=el('p','正在读取真实人物及表情选项…','hint');settings.append(note);preview.append(settings);
   // Move settings before portraits while retaining the existing preview and compact CSS.
   preview.insertBefore(settings,stage);
   if(!w.performance.choices)note.textContent='当前项目尚未提供人物映射选项，请重新读取项目。';
   else Promise.resolve().then(()=>w.performance.choices(line)).then(options=>{
    if(!valid())return;
    for(const key of ['speaker','left','right','mood']){
     const select=fields[key],values=key==='mood'?options.moods:['',...options.names];select.replaceChildren();
     for(const value of values){const label=key==='mood'?(value==='shy'?'shy（害羞）':value):value||(key==='speaker'?'旁白':'无人');const option=el('option',label);option.value=value;select.append(option);}
     if(!values.includes(line[key])){const option=el('option',line[key]+'（当前值，此配置未使用或不可用）');option.value=line[key];option.disabled=true;select.append(option);}
     select.value=line[key];select.disabled=!!locked()||(key==='mood'&&!options.moodEnabled);
     select.onchange=()=>{
      if(!valid()||locked()||select.disabled)return;
      if(!values.includes(select.value)){root.GCSProject.report('请选择当前项目支持的设置');return;}
      w.setPerformance(w.selectedIndex,key,select.value);redraw();
     };
    }
    note.textContent=options.moodEnabled?'表情仅作用于画面中的顾清寒；单人立绘与原说话人一致时，切换说话人会同步立绘。':'当前左右人物使用固定立绘，表情不参与显示；原表情值保留。';
   }).catch(error=>{if(valid())note.textContent='无法读取真实候选：'+error.message;});
  }
  Promise.resolve().then(()=>w.performance.load(line)).then(result=>{
   if(!valid())return;stage.replaceChildren();
   for(const side of ['left','right']){
    const portrait=result[side],cell=el('div',undefined,'event-performance-side');cell.dataset.side=side;
    cell.append(el('p',(side==='left'?'左侧':'右侧')+'：'+(portrait.name||'无人'),'event-performance-caption'));
    if(portrait.image){
     const image=el('img');image.src=portrait.image;image.alt=portrait.name+' · '+portrait.mood;image.dataset.resourcePath=portrait.path;image.onerror=()=>{image.hidden=true;cell.append(el('p','立绘图片无法解码，请检查本地文件。','notice'));};cell.append(image);
     cell.append(el('p','表情：'+portrait.mood+(portrait.mood==='shy'?'（害羞）':'')+(portrait.fixed?' · 固定立绘':''),'hint'));
    }
    if(portrait.warning||portrait.error)cell.append(el('p',portrait.warning||portrait.error,'notice'));
    stage.append(cell);
   }
  }).catch(error=>{if(valid())stage.replaceChildren(el('p','演出预览不可用：'+error.message,'notice'));});
 }
 function refresh(){
  const dirty=w.changes.length>0,isLocked=!!locked();
  if(undo){undo.disabled=!w.canUndo||isLocked;redo.disabled=!w.canRedo||isLocked;reset.disabled=!dirty||isLocked;review.disabled=!dirty||isLocked||!s.handle;restore.disabled=dirty||isLocked||!s.handle;}
  status.textContent=w.textOnly?(w.branch?.enabled?'文字与选择结构 · ':'仅文字编辑 · ')+w.lines.filter(r=>r.editable).length+' 项已确认 / '+w.lines.filter(r=>!r.editable).length+' 项只读'+(dirty?' · 有未应用修改':''):w.readOnly?'只读来源 · 已解析 '+w.lines.length+' 句；未确认的配置保留在源码中。':w.blocked?'自动恢复未完成：请检查备份恢复后重新读取。':dirty?'有未应用的剧本草稿；请查看全部差异后保存。':'共 '+w.lines.length+' 句真实对白。';
  updatePreview();
 }
 refresh();
}

function valid(s){const now=state();return now.connected&&now.status==='connected'&&now.handle===s.project&&now.eventWorkspace===s.work;}
function lock(s,value){s.work.setLocked(value);s.cards?.setLocked(value);busy=value;change();}
async function selectRestore(w){
 const s=state();if(!s.handle||s.status!=='connected'||w.locked||w.blocked||w.changes.length||s.workspace?.locked||busy)return;
 const job={work:w,project:s.handle,cards:s.workspace};let review;
 lock(job,true);
 try{const dir=await window.showDirectoryPicker({id:'gcs-event-restore',mode:'read'});if(!valid(job))throw Error('项目连接已变化');review=await root.GCSEventWriter.reviewRestore({project:job.project,backupDirectory:dir,originalBytes:w.originalBytes,entryBytes:w.entryBytes,spec:w.manifest});if(!valid(job))throw Error('项目连接已变化');}
 catch(e){root.GCSProject.report(e.name==='AbortError'?'已取消选择备份，游戏文件未修改。':'备份恢复检查失败：'+e.message);}
 finally{lock(job,false);}
 if(review&&valid(job))open(w,review);
}
function open(w,restoreReview=null){
 const s=state();if(!s.handle||s.status!=='connected'||w.locked||w.blocked||s.workspace?.locked||busy)return;
 try{if(!restoreReview)w.plan();}catch(e){root.GCSProject.report('暂时不能保存：'+e.message+'。请保留草稿，撤销相关设置；若源码已被其他程序修改，请重新读取项目。');return;}
 session={work:w,project:s.handle,cards:s.workspace,changes:restoreReview?restoreReview.changes:w.changes,lines:w.lines,structureChanged:w.hasStructuralChanges,restoreReview};const job=session;dialog.replaceChildren(el('h2',restoreReview?'从备份恢复 · 检查全部对白差异':'检查全部对白修改'),el('p',w.manifest.title+' / '+w.manifest.id+' → '+w.manifest.sourcePath,'record-id'));
 if(restoreReview)dialog.append(el('p','所选备份：'+restoreReview.backupName+'。仅恢复以下已验证的对白，无需再次选择目录或创建新备份。','notice'));
 for(const c of job.changes){const labels={insert:'新增',delete:'删除',move:'顺序调整',options:'选项内容与去向（含增删与顺序）',performance:{speaker:'说话人',left:'左侧立绘',right:'右侧立绘',mood:'表情'}[c.key]};const block=el('div',undefined,'apply-change');block.append(el('strong','第 '+(c.index+1)+' 项 · '+(labels[c.kind]||{dialogue:'对白文字',option:'选项文字',prompt:'选择提示'}[c.textKind]||'文字')));if(c.context)block.append(el('p',c.context,'hint'));if(c.kind!=='insert')block.append(el('p',restoreReview?'当前游戏对白':'原文'),el('pre',c.before,'event-text event-before'));if(c.kind!=='delete')block.append(el('p',restoreReview?'备份对白（恢复后）':'修改后'),el('pre',c.after,'event-text event-after'));dialog.append(block);}
 dialog.append(el('p',(restoreReview?'点击确认恢复后授权写入。恢复前的当前版本仅保留内存快照，失败时尝试安全回滚；若无法确认磁盘内容则停止，避免覆盖外部修改。':'先选择游戏项目外的目录并验证原文件备份，再点击授权写入。')+'浏览器无法消除最后检查与提交间的并发竞争；请先关闭游戏及正在编辑此源码的程序。'+(restoreReview?'所选备份不会被修改。':'备份包含完整源文件；恢复请使用“从备份恢复”，仅还原当前事件。'),'hint'));
 const backup=restoreReview?null:el('button','选择项目外目录并备份'),apply=el('button',restoreReview?'确认恢复':'授权写入并应用','primary'),close=el('button','关闭'),message=el('p',restoreReview?'差异已检查，确认后将请求写入授权。':'尚未备份');message.setAttribute('role','status');apply.disabled=!restoreReview;if(backup)dialog.append(backup);dialog.append(message,el('div',undefined,'dialog-actions'));dialog.lastChild.append(close,apply);
 function controls(){if(backup)backup.disabled=busy||job.done;apply.disabled=busy||(!restoreReview&&!job.token)||job.done||w.blocked;close.disabled=busy;}
 if(backup)backup.onclick=async()=>{if(busy||!valid(job)||w.hasUnsupportedChanges||JSON.stringify(w.changes)!==JSON.stringify(job.changes))return;job.token=null;lock(job,true);controls();try{job.parent=await window.showDirectoryPicker({id:'gcs-event-backup',mode:'readwrite'});if(!valid(job))throw Error('项目连接已变化');job.token=await root.GCSEventWriter.prepare({project:job.project,backupParent:job.parent,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:job.changes,lines:job.lines,structureChanged:job.structureChanged,workspace:w});message.textContent='备份已验证：'+job.parent.name+' / '+job.token.backupName+' / '+job.token.filename;}catch(e){message.textContent=e.name==='AbortError'?'已取消，原文件未写入。':e.message+(e.backupName?'；备份：'+job.parent.name+' / '+e.backupName:'');}finally{lock(job,false);controls();}};
 apply.onclick=async()=>{if(busy||job.done||!valid(job)||w.hasUnsupportedChanges||(!restoreReview&&!job.token)||w.blocked||(restoreReview?w.changes.length>0:JSON.stringify(w.changes)!==JSON.stringify(job.changes)))return;let authorization;try{authorization=job.project.requestPermission({mode:'readwrite'});}catch(e){message.textContent=e.message;return;}lock(job,true);controls();try{if(await authorization!=='granted')throw Error('未获得写入权限，原文件未修改');if(!valid(job))throw Error('项目连接已变化');if(restoreReview)job.token=await root.GCSEventWriter.prepareRestore(restoreReview);if(!valid(job))throw Error('项目连接已变化');const result=await root.GCSEventWriter.apply(job.token,{project:job.project,permissionGranted:true});w.saved(result.bytes);job.done=true;message.textContent=restoreReview?'对白恢复成功，当前对白已自动刷新，已逐字节读回并验证全部对白及演出字段。所选备份：'+restoreReview.backupName:'对白应用成功，已逐字节读回并验证全部对白及演出字段。备份：'+job.parent.name+' / '+result.backupName;change();}catch(e){if(e.recoveryNeeded)w.block();message.textContent=e.message+'；备份：'+(restoreReview?restoreReview.backupName:job.parent.name+' / '+job.token.backupName)+'；恢复路径：'+w.manifest.sourcePath;job.token=null;}finally{lock(job,false);controls();change();}};
 close.onclick=()=>{if(!busy)dialog.close();};dialog.showModal();
}
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{session=null;});window.addEventListener('gcs-project-change',()=>{if(session&&!busy&&!valid(session))dialog.close();});
root.GCSEventStudio={renderList,render,isPreviewOpen:w=>!overviewId&&!!viewStates.get(w)?.previewOpen};
})(window);
