/* Reusable linear event editor in the existing three-column workspace. */
(function(root){
'use strict';const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const dialog=el('dialog');dialog.id='event-dialog';dialog.setAttribute('aria-label','检查并应用真实对白修改');document.body.append(dialog);
let session=null,busy=false;const state=()=>root.GCSProject.getState(),work=()=>state().eventWorkspace;
function change(){window.dispatchEvent(new CustomEvent('gcs-project-change',{detail:{kind:'event-draft'}}));}
function renderList(query){const w=work(),found=w&&JSON.stringify([w.manifest.id,w.manifest.title,w.texts]).toLowerCase().includes(query.toLowerCase());$('list-count').textContent=(found?1:0)+' / '+(w?1:0);$('library-en').textContent='GAME / 真实事件';$('record-list').replaceChildren();if(found){const b=el('button',undefined,'record active');b.dataset.action='event-select';b.append(el('span','☷','record-symbol'),el('span',w.manifest.title+' · '+w.lines.length+' 句'+(w.changes.length?' · 未应用':''),'record-title'));$('record-list').append(b);}}
function render(editor,preview){
 editor.replaceChildren();preview.replaceChildren();const s=state(),w=work();
 if(!s.connected||!w){editor.append(el('h2',s.connected?'真实事件暂不可用':'连接游戏项目以读取真实事件'),el('p',s.eventError||'选择《凝顾》根目录后读取已映射事件。此页不再展示演示剧情。','notice'));return;}
 const heading=el('div',undefined,'editor-heading'),title=el('div');title.append(el('div','游戏项目 / 真实事件 / 内存编辑','breadcrumb'),el('h2',w.manifest.title),el('div',w.manifest.id,'record-id'));heading.append(title);editor.append(heading);
 editor.append(el('p',w.manifest.sourcePath+' → '+w.manifest.className+'.'+w.manifest.functionName+'()','record-id'),el('p','执行入口：'+w.manifest.entryPath+' → '+w.manifest.entryFunction+'()','record-id'));
 const tools=el('div',undefined,'card-edit-tools'),reset=el('button','撤销全部未应用对白'),review=el('button','查看差异并应用'),undo=el('button','撤销一步');undo.onclick=()=>{w.undo();change();};reset.onclick=()=>{w.discard();change();};review.onclick=()=>open(w);tools.append(undo,reset,review);editor.append(tools);
 const status=el('p',undefined,'hint');editor.append(status);
 const inputs=[];w.lines.forEach((line,index)=>{const row=el('div',undefined,'dialogue-row'),caption=el('label','第 '+(index+1)+' 句 · '+line.speaker+' · 源码第 '+line.line+' 行','field'),input=el('textarea');input.value=w.texts[index];input.maxLength=20000;input.dataset.eventLine=String(index);input.setAttribute('aria-label','第 '+(index+1)+' 句对白');input.oninput=()=>{try{w.set(index,input.value);refresh();renderList($('search').value);}catch(e){status.textContent=e.message;}};caption.append(input);row.append(caption);editor.append(row);inputs.push(input);});
 const lines=el('div');preview.append(el('div','真实对白 · 当前草稿顺序','preview-label'),lines,el('p','仅编辑已有对白文字。说话人、表情、顺序、背景、事件入口和结算均锁定。未应用草稿仅在本页内存中。','notice'));
 function refresh(){const count=w.changes.length,locked=w.locked||w.blocked||s.workspace?.locked;undo.disabled=!w.canUndo||locked;reset.disabled=!count||locked;review.disabled=!count||locked||!s.handle;status.textContent=w.blocked?'自动恢复未完成：请按备份记录检查恢复，再重新读取项目。':!s.handle?'兼容模式可阅读和编辑，直接写回需使用 Chrome / Edge 目录连接。':count?count+' 句对白未应用；保存前将逐句显示完整原文和新文。':'已读取 '+w.lines.length+' 句真实对白；当前无未应用修改。';for(const input of inputs)input.disabled=!!locked;lines.replaceChildren();w.texts.forEach((text,i)=>{lines.append(el('strong',(i+1)+'. '+w.lines[i].speaker),el('pre',text,'event-text'));});}
 refresh();
}
function valid(s){const now=state();return now.connected&&now.status==='connected'&&now.handle===s.project&&now.eventWorkspace===s.work;}
function lock(s,value){s.work.setLocked(value);s.cards?.setLocked(value);busy=value;change();}
function open(w){
 const s=state();if(!s.handle||s.status!=='connected'||w.locked||w.blocked||s.workspace?.locked||busy)return;
 try{w.plan();}catch(e){root.GCSProject.report('对白校验失败：'+e.message);return;}
 session={work:w,project:s.handle,cards:s.workspace,changes:w.changes};const job=session;dialog.replaceChildren(el('h2','检查全部对白修改'),el('p',w.manifest.title+' / '+w.manifest.id+' → '+w.manifest.sourcePath,'record-id'));
 for(const c of job.changes){const block=el('div',undefined,'apply-change');block.append(el('strong','第 '+(c.index+1)+' 句 · '+w.lines[c.index].speaker),el('p','原文'),el('pre',c.before,'event-text event-before'),el('p','修改后'),el('pre',c.after,'event-text event-after'));dialog.append(block);}
 dialog.append(el('p','先选择游戏项目外的目录并验证原文件备份，再点击授权写入。浏览器无法消除最后检查与提交间的并发竞争；请先关闭游戏及正在编辑此源码的程序。备份按 restore.json 的 path 可人工恢复。','hint'));
 const backup=el('button','选择项目外目录并备份'),apply=el('button','授权写入并应用','primary'),close=el('button','关闭'),message=el('p','尚未备份');message.setAttribute('role','status');apply.disabled=true;dialog.append(backup,message,el('div',undefined,'dialog-actions'));dialog.lastChild.append(close,apply);
 function controls(){backup.disabled=busy||job.done;apply.disabled=busy||!job.token||job.done||w.blocked;close.disabled=busy;}
 backup.onclick=async()=>{if(busy||!valid(job))return;job.token=null;lock(job,true);controls();try{job.parent=await window.showDirectoryPicker({id:'gcs-event-backup',mode:'readwrite'});if(!valid(job))throw Error('项目连接已变化');job.token=await root.GCSEventWriter.prepare({project:job.project,backupParent:job.parent,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:job.changes});message.textContent='备份已验证：'+job.parent.name+' / '+job.token.backupName+' / '+job.token.filename;}catch(e){message.textContent=e.name==='AbortError'?'已取消，原文件未写入。':e.message+(e.backupName?'；备份：'+job.parent.name+' / '+e.backupName:'');}finally{lock(job,false);controls();}};
 apply.onclick=async()=>{if(busy||!valid(job)||!job.token||w.blocked||JSON.stringify(w.changes)!==JSON.stringify(job.changes))return;let authorization;try{authorization=job.project.requestPermission({mode:'readwrite'});}catch(e){message.textContent=e.message;return;}lock(job,true);controls();try{if(await authorization!=='granted')throw Error('未获得写入权限，原文件未修改');if(!valid(job))throw Error('项目连接已变化');const result=await root.GCSEventWriter.apply(job.token,{project:job.project,permissionGranted:true});w.saved(result.bytes);job.done=true;message.textContent='对白应用成功，已逐字节读回并重新解析七句。备份：'+job.parent.name+' / '+result.backupName;change();}catch(e){if(e.recoveryNeeded)w.block();message.textContent=e.message+'；备份：'+job.parent.name+' / '+job.token.backupName+'；恢复路径：'+w.manifest.sourcePath;job.token=null;}finally{lock(job,false);controls();change();}};
 close.onclick=()=>{if(!busy)dialog.close();};dialog.showModal();
}
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{session=null;});window.addEventListener('gcs-project-change',()=>{if(session&&!busy&&!valid(session))dialog.close();});
root.GCSEventStudio={renderList,render};
})(window);
