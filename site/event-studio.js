/* Reusable linear event editor in the existing three-column workspace. */
(function(root){
'use strict';const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const dialog=el('dialog');dialog.id='event-dialog';dialog.setAttribute('aria-label','检查并应用真实对白修改');document.body.append(dialog);
let session=null,busy=false;const state=()=>root.GCSProject.getState(),work=()=>state().eventWorkspace;
function change(kind='event-draft'){window.dispatchEvent(new CustomEvent('gcs-project-change',{detail:{kind}}));}
function renderList(query){const w=work(),found=w&&JSON.stringify([w.manifest.id,w.manifest.title,w.texts]).toLowerCase().includes(query.toLowerCase());$('list-count').textContent=(found?1:0)+' / '+(w?1:0);$('library-en').textContent='GAME / 真实事件';$('record-list').replaceChildren();if(found){const b=el('button',undefined,'record active');b.dataset.action='event-select';b.append(el('span','☷','record-symbol'),el('span',w.manifest.title+' · '+w.lines.length+' 句'+(w.changes.length?' · 未应用':''),'record-title'));$('record-list').append(b);}}
const viewStates=new WeakMap();
function render(editor,preview){
 editor.replaceChildren();preview.replaceChildren();const s=state(),w=work();
 if(!s.connected||!w){editor.append(el('h2',s.connected?'真实事件暂不可用':'连接游戏项目以读取真实事件'),el('p',s.eventError||'选择《凝顾》根目录后读取已映射事件。此页不再展示演示剧情。','notice'));return;}
 let view=viewStates.get(w);if(!view){view={editing:false,previewOpen:false,renderToken:0};viewStates.set(w,view);}
 const renderToken=++view.renderToken;
 const locked=()=>w.locked||w.blocked||state().workspace?.locked;
 const heading=el('div',undefined,'editor-heading'),title=el('div');title.append(el('div',view.editing?'编辑模式 · 内存草稿':'阅读模式','breadcrumb'),el('h2',w.manifest.title));heading.append(title);editor.append(heading);
 function button(text,fn){const b=el('button',text);b.disabled=!!locked();b.onclick=()=>{if(locked())return;try{return fn();}catch(e){root.GCSProject.report(e.message);}};return b;}
 function redraw(focus=false){render(editor,preview);renderList($('search')?.value||'');change();if(focus)editor.querySelector?.('textarea')?.focus();}
 const tools=el('div',undefined,'card-edit-tools');editor.append(tools);
 tools.append(button(view.editing?'完成编辑':'编辑剧本',()=>{view.editing=!view.editing;redraw();}));
 const previewToggle=button('演出预览',()=>{view.previewOpen=!view.previewOpen;redraw();});previewToggle.setAttribute('aria-expanded',String(view.previewOpen));previewToggle.setAttribute('aria-controls','preview');tools.append(previewToggle);
 let undo,redo,reset,review,restore;
 if(view.editing){
  undo=button('撤销一步',()=>{w.undo();redraw();});redo=button('重做',()=>{w.redo();redraw();});reset=button('撤销未应用修改',()=>{w.discard();redraw();});
  review=button('查看差异并应用',()=>{if(w.hasUnsupportedChanges)return;open(w);});restore=button('从备份恢复',()=>selectRestore(w));tools.append(undo,redo,reset,review,restore);
 }
 const status=el('p',undefined,'hint');status.setAttribute('role','status');editor.append(status);
 const script=el('div',undefined,'event-script');editor.append(script);
 const current=w.lines;
 current.forEach((line,index)=>{
  const selected=w.selectedIndex===index;
  // Use a non-button container for the active row so its inputs and buttons remain independent.
  const row=el(view.editing&&!selected?'button':'article',undefined,'event-script-row'+(selected?' selected':''));
  row.append(el('span',(index+1)+'. '+line.speaker,'event-script-speaker'));
  if(!view.editing||!selected){
   if(view.editing){row.type='button';row.disabled=!!locked();}else{row.setAttribute('role','button');row.setAttribute('tabindex','0');}
   row.setAttribute('aria-pressed',String(selected));row.onclick=()=>{if(locked()||w.selectedIndex===index)return;w.select(index);redraw(view.editing);};
   if(!view.editing)row.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();row.onclick();}};
  }
  if(view.editing&&selected){
   const caption=el('label','对白文字','field event-inline-field'),input=el('textarea');input.value=line.text;input.maxLength=20000;input.dataset.eventLine=String(index);input.setAttribute('aria-label','第 '+(index+1)+' 句对白');input.disabled=!!locked();
   // Keep this input node and its value/selection untouched while updating the draft and preview.
   input.oninput=()=>{try{w.set(index,input.value);refresh();renderList($('search')?.value||'');change('event-input');}catch(e){status.textContent=e.message;}};
   caption.append(input);row.append(caption);
   const actions=el('div',undefined,'card-edit-tools event-line-actions');
   const remove=button('删除',()=>{w.remove(index);redraw(true);});remove.disabled=!!locked()||current.length===1;
   const up=button('上移',()=>{w.move(index,-1);redraw(true);}),down=button('下移',()=>{w.move(index,1);redraw(true);});up.disabled=!!locked()||index===0;down.disabled=!!locked()||index===current.length-1;
   actions.append(button('前插',()=>{w.insert(index);redraw(true);}),button('后插',()=>{w.insert(index,true);redraw(true);}),button('复制',()=>{w.duplicate(index);redraw(true);}),remove,up,down);row.append(actions);
  }else row.append(el('p',line.text||'（空白对白）','event-script-text'));
  script.append(row);
 });
 if(view.editing)editor.append(el('p','新增对白沿用相邻人物、左右立绘和表情；开场背景保留为事件配置。人物及表情可在展开的演出面板中逐句编辑，仅保存在内存。','hint'));
 let previewKey=null,previewText=null;
 function updatePreview(){
  if(!view.previewOpen){preview.replaceChildren();return;}
  const line=w.lines[w.selectedIndex],key=JSON.stringify([line.speaker,line.left,line.right,line.mood]);
  if(key===previewKey&&previewText){previewText.textContent=line.text||'（空白对白）';return;}
  previewKey=key;preview.replaceChildren(el('div','演出预览 · 第 '+(w.selectedIndex+1)+' 句','preview-label'),el('p','说话人：'+(line.speaker||'旁白'),'event-performance-speaker'));
  const stage=el('div',undefined,'event-performance-stage');stage.setAttribute('aria-label','左右人物立绘');stage.append(el('p','正在读取本地立绘…','hint'));previewText=el('pre',line.text||'（空白对白）','event-text');preview.append(stage,previewText,el('p','图片仅从所选本地项目读取。人物演出修改仅保存在内存，不写回游戏。','notice'));
  if(!w.performance){stage.replaceChildren(el('p','立绘预览尚不可用，请重新连接本地游戏项目。','notice'));return;}
  const valid=()=>work()===w&&view.previewOpen&&view.renderToken===renderToken&&previewKey===key;
  if(view.editing){
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
  if(undo){undo.disabled=!w.canUndo||isLocked;redo.disabled=!w.canRedo||isLocked;reset.disabled=!dirty||isLocked;review.disabled=!dirty||w.hasUnsupportedChanges||isLocked||!s.handle;restore.disabled=dirty||isLocked||!s.handle;}
  status.textContent=w.blocked?'自动恢复未完成：请检查备份恢复后重新读取。':w.hasUnsupportedChanges?'含人物演出或结构修改 · 仅内存草稿，暂不可写回游戏。':dirty?'有未应用的文字草稿。':'共 '+w.lines.length+' 句真实对白。';
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
 try{const dir=await window.showDirectoryPicker({id:'gcs-event-restore',mode:'read'});if(!valid(job))throw Error('项目连接已变化');review=await root.GCSEventWriter.reviewRestore({project:job.project,backupDirectory:dir,originalBytes:w.originalBytes,entryBytes:w.entryBytes});if(!valid(job))throw Error('项目连接已变化');}
 catch(e){root.GCSProject.report(e.name==='AbortError'?'已取消选择备份，游戏文件未修改。':'备份恢复检查失败：'+e.message);}
 finally{lock(job,false);}
 if(review&&valid(job))open(w,review);
}
function open(w,restoreReview=null){
 if(w.hasUnsupportedChanges)return;
 const s=state();if(!s.handle||s.status!=='connected'||w.locked||w.blocked||s.workspace?.locked||busy)return;
 try{if(!restoreReview)w.plan();}catch(e){root.GCSProject.report('对白校验失败：'+e.message);return;}
 session={work:w,project:s.handle,cards:s.workspace,changes:restoreReview?restoreReview.changes:w.changes,restoreReview};const job=session;dialog.replaceChildren(el('h2',restoreReview?'从备份恢复 · 检查全部对白差异':'检查全部对白修改'),el('p',w.manifest.title+' / '+w.manifest.id+' → '+w.manifest.sourcePath,'record-id'));
 if(restoreReview)dialog.append(el('p','所选备份：'+restoreReview.backupName+'。仅恢复以下已验证的对白，无需再次选择目录或创建新备份。','notice'));
 for(const c of job.changes){const block=el('div',undefined,'apply-change');block.append(el('strong','第 '+(c.index+1)+' 句 · '+w.lines[c.index].speaker),el('p',restoreReview?'当前游戏对白':'原文'),el('pre',c.before,'event-text event-before'),el('p',restoreReview?'备份对白（恢复后）':'修改后'),el('pre',c.after,'event-text event-after'));dialog.append(block);}
 dialog.append(el('p',(restoreReview?'点击确认恢复后授权写入。恢复前的当前版本仅保留内存快照，失败时尝试安全回滚；若无法确认磁盘内容则停止，避免覆盖外部修改。':'先选择游戏项目外的目录并验证原文件备份，再点击授权写入。')+'浏览器无法消除最后检查与提交间的并发竞争；请先关闭游戏及正在编辑此源码的程序。'+(restoreReview?'所选备份不会被修改。':'备份按 restore.json 的 path 可人工恢复。'),'hint'));
 const backup=restoreReview?null:el('button','选择项目外目录并备份'),apply=el('button',restoreReview?'确认恢复':'授权写入并应用','primary'),close=el('button','关闭'),message=el('p',restoreReview?'差异已检查，确认后将请求写入授权。':'尚未备份');message.setAttribute('role','status');apply.disabled=!restoreReview;if(backup)dialog.append(backup);dialog.append(message,el('div',undefined,'dialog-actions'));dialog.lastChild.append(close,apply);
 function controls(){if(backup)backup.disabled=busy||job.done;apply.disabled=busy||(!restoreReview&&!job.token)||job.done||w.blocked;close.disabled=busy;}
 if(backup)backup.onclick=async()=>{if(busy||!valid(job)||w.hasUnsupportedChanges||JSON.stringify(w.changes)!==JSON.stringify(job.changes))return;job.token=null;lock(job,true);controls();try{job.parent=await window.showDirectoryPicker({id:'gcs-event-backup',mode:'readwrite'});if(!valid(job))throw Error('项目连接已变化');job.token=await root.GCSEventWriter.prepare({project:job.project,backupParent:job.parent,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:job.changes,workspace:w});message.textContent='备份已验证：'+job.parent.name+' / '+job.token.backupName+' / '+job.token.filename;}catch(e){message.textContent=e.name==='AbortError'?'已取消，原文件未写入。':e.message+(e.backupName?'；备份：'+job.parent.name+' / '+e.backupName:'');}finally{lock(job,false);controls();}};
 apply.onclick=async()=>{if(busy||job.done||!valid(job)||w.hasUnsupportedChanges||(!restoreReview&&!job.token)||w.blocked||(restoreReview?w.changes.length>0:JSON.stringify(w.changes)!==JSON.stringify(job.changes)))return;let authorization;try{authorization=job.project.requestPermission({mode:'readwrite'});}catch(e){message.textContent=e.message;return;}lock(job,true);controls();try{if(await authorization!=='granted')throw Error('未获得写入权限，原文件未修改');if(!valid(job))throw Error('项目连接已变化');if(restoreReview)job.token=await root.GCSEventWriter.prepareRestore(restoreReview);if(!valid(job))throw Error('项目连接已变化');const result=await root.GCSEventWriter.apply(job.token,{project:job.project,permissionGranted:true});w.saved(result.bytes);job.done=true;message.textContent=restoreReview?'对白恢复成功，当前对白已自动刷新，已逐字节读回并重新解析七句。所选备份：'+restoreReview.backupName:'对白应用成功，已逐字节读回并重新解析七句。备份：'+job.parent.name+' / '+result.backupName;change();}catch(e){if(e.recoveryNeeded)w.block();message.textContent=e.message+'；备份：'+(restoreReview?restoreReview.backupName:job.parent.name+' / '+job.token.backupName)+'；恢复路径：'+w.manifest.sourcePath;job.token=null;}finally{lock(job,false);controls();change();}};
 close.onclick=()=>{if(!busy)dialog.close();};dialog.showModal();
}
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{session=null;});window.addEventListener('gcs-project-change',()=>{if(session&&!busy&&!valid(session))dialog.close();});
root.GCSEventStudio={renderList,render,isPreviewOpen:w=>!!viewStates.get(w)?.previewOpen};
})(window);
