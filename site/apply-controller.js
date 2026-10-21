/* Explicit, reviewed write-back. No writes are started by connecting, editing, restoring or previewing. */
(function(){
 'use strict';const $=id=>document.getElementById(id),dialog=$('apply-dialog');
 let backupParent=null,reviewed=null,applying=false,recoveryRequired=false,lastWorkspace=null;
 function controls(){const s=GCSProject.getState(),w=s.workspace;if(w!==lastWorkspace){recoveryRequired=false;lastWorkspace=w;}
  $('project-apply').hidden=!s.connected;$('project-apply').disabled=!s.handle||!w?.changes.length||!!w?.invalid.length||!!w?.locked||recoveryRequired;
  $('project-apply').title=!s.handle?'当前文件夹兼容模式不支持写回，请使用支持目录访问的浏览器重新连接':recoveryRequired?'自动恢复未完成，请先检查备份并重新读取项目':'检查差异、验证备份并由你授权后写入';
 }
 function summary(){const s=GCSProject.getState(),w=s.workspace;reviewed=w;const target=$('apply-summary');target.replaceChildren();
  for(const path of Object.values(GCSNingguAdapter.projectFiles)){const p=document.createElement('p');p.className='record-id';p.textContent=path;target.append(p);}
  for(const c of w.changes){const p=document.createElement('p');p.className='apply-change';p.textContent=c.cardId+(c.branchId?' / '+c.branchId:'')+' / '+c.label+'：'+String(c.before)+' → '+String(c.after);target.append(p);}
 }
 $('project-apply').onclick=()=>{const s=GCSProject.getState();if(!s.handle||!s.workspace||recoveryRequired)return;backupParent=null;$('apply-confirm').disabled=true;$('apply-backup-status').textContent='尚未选择备份位置';$('apply-status').textContent='';summary();try{s.workspace.validate();}catch(e){$('apply-status').textContent='校验失败：'+e.message;}dialog.showModal();};
 $('apply-backup').onclick=async()=>{try{const s=GCSProject.getState();const chosen=await window.showDirectoryPicker({id:'gcs-card-backup',mode:'readwrite'});if(await s.handle.resolve(chosen)!==null)throw new Error('请选择游戏项目之外的目录');backupParent=chosen;$('apply-backup-status').textContent='备份位置：'+chosen.name+' / 自动创建独立备份子目录';$('apply-confirm').disabled=false;$('apply-status').textContent='已校验工作副本；下一步由你授权写入。';}catch(e){if(e.name!=='AbortError')$('apply-status').textContent='备份位置不可用：'+e.message;}};
 $('apply-confirm').onclick=async()=>{
  const s=GCSProject.getState(),work=s.workspace;if(applying||recoveryRequired||!backupParent||reviewed!==work)return;
  try{work.validate();}catch(e){$('apply-status').textContent='校验失败：'+e.message;return;}
  const documents=work.documents,originalBytes=s.originalBytes;
  let authorization;
  try{authorization=s.handle.requestPermission({mode:'readwrite'});}catch(e){$('apply-status').textContent='无法请求写入授权：'+e.message;return;}
  applying=true;work.setLocked(true);$('apply-confirm').disabled=true;$('apply-backup').disabled=true;$('apply-close').disabled=true;$('apply-status').textContent='等待授权；授权后将备份、校验并应用。请勿关闭页面。';
  try{
   if(await authorization!=='granted')throw new Error('未获得写入权限，原文件未修改');
   const result=await GCSGameWriter.safeApply({project:s.handle,backupParent,adapter:GCSNingguAdapter,documents,originalBytes,validate:()=>work.validate(),permissionGranted:true});
   GCSProject.applied(result.originalBytes);$('apply-status').textContent='应用成功，两份文件已读回验证。备份：'+backupParent.name+' / '+result.backupName;
  }catch(e){recoveryRequired=!!e.recoveryNeeded;const message='未完成应用：'+e.message+(e.backupName?'；备份：'+backupParent.name+' / '+e.backupName:'');$('apply-status').textContent=message;GCSProject.report(message);}
  finally{applying=false;work.setLocked(false);$('apply-backup').disabled=false;$('apply-close').disabled=false;controls();}
 };
 $('apply-close').onclick=()=>{if(!applying)dialog.close();};dialog.addEventListener('cancel',e=>{if(applying)e.preventDefault();});window.addEventListener('gcs-project-change',controls);controls();
})();
