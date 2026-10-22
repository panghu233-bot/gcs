/* Review and authorization for a single existing NPC portrait, with no card draft reload. */
(function(root){
'use strict';
function sharedUsers(records,path){const key=p=>(p.path||p.ref?.replace(/^res:\/\//,''))?.toLocaleLowerCase('en-US');return records.filter(n=>(n.portraits||[]).some(p=>key(p)===path.toLocaleLowerCase('en-US'))).map(n=>n.name);}
const api={sharedUsers};if(typeof module!=='undefined')module.exports=api;
if(typeof window==='undefined')return;
const $=id=>document.getElementById(id),dialog=$('portrait-dialog'),input=$('portrait-file'),writer=root.GCSNPCPortraitWriter;
let session=null,busy=false,pending=false;const blocked=new WeakMap();
const message=text=>{$('portrait-status').textContent=text;};
function valid(s){const now=root.GCSProject.getState();return s&&now.connected&&now.status==='connected'&&now.handle===s.project&&now.npcRecords===s.records;}
function controls(){const active=valid(session)&&!blocked.get(session.records)?.has(session.path);$('portrait-confirm').disabled=busy||!active||!session?.token||!!session?.done||!!session?.work?.locked;$('portrait-backup').disabled=busy||!active||!session?.bytes||!!session?.done||!!session?.work?.locked;$('portrait-close').disabled=busy;}
function clear(){if(session?.url)URL.revokeObjectURL(session.url);session=null;$('portrait-before').removeAttribute('src');$('portrait-after').removeAttribute('src');}
function open(n,p){const state=root.GCSProject.getState();if(busy||pending||!state.connected||state.status!=='connected'||!state.handle||state.workspace?.locked||!p?.image||!p.path||!p.originalBytes)return;
 clear();$('portrait-after').removeAttribute('src');session={project:state.handle,records:state.npcRecords,work:state.workspace,path:p.path,before:new Uint8Array(p.originalBytes),oldImage:p.image,name:n.name,label:p.label||'当前版本'};input.value='';input.click();
}
input.addEventListener('cancel',()=>{if(!busy&&!pending)clear();});
input.onchange=async()=>{
 const s=session,file=input.files[0];if(!file||!valid(s))return;pending=true;
 try{
  if(!/\.png$/i.test(file.name)||file.size>writer.MAX_BYTES)throw Error('请选择不超过 8 MB 的 PNG 图片');
  const bytes=new Uint8Array(await file.arrayBuffer()),info=writer.pngInfo(bytes),url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));s.url=url;
  const image=new Image();image.src=url;await image.decode();if(image.naturalWidth!==info.width||image.naturalHeight!==info.height)throw Error('图片解码尺寸异常');
  if(session!==s||!valid(s)){if(session===s)clear();return;}s.bytes=bytes;
  $('portrait-target').textContent=s.name+' / '+s.label+' → '+s.path;
  const users=sharedUsers(s.records,s.path);$('portrait-shared').textContent=users.length>1?'共用资源提醒：'+users.join('、')+' 共用此图片。替换将同时影响这些人物。':'当前识别的 NPC 中，未发现其他人物共用此资源。游戏中其他引用同一路径的位置也会更新。';
  $('portrait-before').src=s.oldImage;$('portrait-after').src=url;
  $('portrait-info').textContent=file.name+' · '+info.width+' × '+info.height+' · '+(info.size/1024).toFixed(1)+' KB；仅暂存，关闭可取消。';
  $('portrait-backup-status').textContent='尚未备份';message(blocked.get(s.records)?.has(s.path)?'此前自动恢复未完成，请检查备份并重新读取项目后再试。':'图片已暂存，尚未写入游戏。');controls();dialog.showModal();
 }catch(e){if(session===s){s.bytes=null;s.token=null;message('无法暂存：'+e.message);$('portrait-target').textContent=s.path;$('portrait-shared').textContent='请关闭后重新选择有效 PNG。';$('portrait-info').textContent='未写入游戏';$('portrait-backup-status').textContent='尚未备份';$('portrait-before').src=s.oldImage;$('portrait-after').removeAttribute('src');controls();if(!dialog.open)dialog.showModal();}}
 finally{pending=false;input.value='';}
};
$('portrait-backup').onclick=async()=>{
 const s=session;if(busy||!valid(s)||!s.bytes||s.work?.locked||blocked.get(s.records)?.has(s.path))return;
 busy=true;s.token=null;controls();s.work?.setLocked(true);message('请选择游戏项目外的备份目录。');
 try{
  const parent=await window.showDirectoryPicker({id:'gcs-npc-portrait-backup',mode:'readwrite'});if(!valid(s))throw Error('项目连接已变化');s.backupParent=parent;
  message('正在备份并读回校验；尚未修改游戏原图。');
  s.token=await writer.prepare({project:s.project,backupParent:parent,path:s.path,originalBytes:s.before,replacementBytes:s.bytes});
  $('portrait-backup-status').textContent='备份已验证：'+parent.name+' / '+s.token.backupName+' / '+s.token.filename+'（restore.json 记录原路径）';
  message('备份已验证。下一步点击「授权写入并替换」，仅覆盖上方指定图片。');
 }catch(e){message(e.name==='AbortError'?'已取消备份，原图未修改。':'备份未完成：'+e.message);if(e.backupName)$('portrait-backup-status').textContent='未通过验证的备份：'+s.backupParent.name+' / '+e.backupName;}
 finally{busy=false;s.work?.setLocked(false);controls();}
};
$('portrait-confirm').onclick=async()=>{
 const s=session;if(busy||!valid(s)||!s.token||s.done||s.work?.locked||blocked.get(s.records)?.has(s.path))return;
 let authorization;try{authorization=s.project.requestPermission({mode:'readwrite'});}catch(e){message('无法请求写入授权：'+e.message);return;}
 busy=true;controls();s.work?.setLocked(true);message('等待写入授权；请勿关闭页面。');
 try{
  if(await authorization!=='granted')throw Error('未获得写入权限，原图未修改');if(!valid(s))throw Error('项目连接已变化');
  message('正在检查磁盘变化、写入并读回校验…');
  const result=await writer.apply(s.token,{project:s.project,permissionGranted:true});s.done=true;
  try{root.GCSProject.portraitApplied(s.project,s.records,result.path,result.bytes);message('替换成功，已读回验证；当前版本及共用此资源的 NPC 预览已更新。备份保留在上方位置。');}
  catch(e){message('图片已写入并验证，但预览更新失败：'+e.message+'。请先导出未应用的卡牌草稿，再重新读取项目。');}
 }catch(e){
  if(e.recoveryNeeded){if(!blocked.has(s.records))blocked.set(s.records,new Set());blocked.get(s.records).add(s.path);}
  message('替换未完成：'+e.message+(e.backupName?'。备份：'+s.backupParent.name+' / '+e.backupName+' / '+s.path.split('/').at(-1)+'；原路径：'+s.path:''));
  // Permission denial can be retried; any started writer attempt requires a fresh backup.
  if(e.backupName)s.token=null;
 }finally{busy=false;s.work?.setLocked(false);controls();}
};
$('portrait-close').onclick=()=>{if(!busy){dialog.close();clear();}};
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});dialog.addEventListener('close',()=>{if(!busy)clear();});
window.addEventListener('gcs-project-change',()=>{if(session&&!valid(session)&&!busy){dialog.close();clear();}if(dialog.open)controls();});
window.addEventListener('beforeunload',e=>{if(busy||session?.bytes&&!session.done){e.preventDefault();e.returnValue='';}});
api.open=open;root.GCSNPCPortraitController=api;
})(typeof window!=='undefined'?window:globalThis);
