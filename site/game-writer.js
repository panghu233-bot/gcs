/* Two-file staged writer. Backups are verified outside the project before originals are opened for writing. */
(function(root){
 'use strict';
 const bytes=async file=>new Uint8Array(await file.arrayBuffer());
 const equal=(a,b)=>a.length===b.length && a.every((v,i)=>v===b[i]);
 async function locate(root,path){const parts=path.split('/');if(parts.some(p=>!p||p==='.'||p==='..'||p.includes(String.fromCharCode(92))))throw new Error('无效的目标路径');let dir=root;for(const p of parts.slice(0,-1))dir=await dir.getDirectoryHandle(p,{create:false});return dir.getFileHandle(parts.at(-1),{create:false});}
 async function writeAndVerify(handle,data){let stream;try{stream=await handle.createWritable({mode:'exclusive'});await stream.write(data);await stream.close();}catch(e){if(stream)await stream.abort().catch(()=>{});throw e;}if(!equal(await bytes(await handle.getFile()),data))throw new Error('备份读回校验失败');}
 async function safeApply({project,backupParent,adapter,documents,originalBytes,validate,permissionGranted=false,uuid=()=>crypto.randomUUID()}){
  if(!permissionGranted)throw new Error('需要用户主动授权写入');
  validate();adapter.validateDocuments(documents);
  if(!backupParent || await project.resolve(backupParent)!==null)throw new Error('备份目录必须在游戏项目之外');
  const entries=Object.entries(adapter.projectFiles);if(entries.length!==2 || new Set(entries.map(([,path])=>path.split('/').at(-1))).size!==2)throw new Error('只允许处理两份已声明 JSON');
  const targets=[],streams=[],attempted=[];let backupName='',backupVerified=false;
  try {
   for(const [key,path] of entries){const handle=await locate(project,path),before=new Uint8Array(originalBytes[key]);if(!equal(await bytes(await handle.getFile()),before))throw new Error('磁盘文件已变化，请保留草稿并重新读取后比较：'+path);
    const changed=JSON.stringify(JSON.parse(new TextDecoder().decode(before)))!==JSON.stringify(documents[key]);
    const after=changed?new TextEncoder().encode(JSON.stringify(documents[key],null,2)+'\n'):before;
    targets.push({key,path,handle,before,after,changed});
   }
   if(!targets.some(t=>t.changed))throw new Error('没有需要应用的修改');
   // Refuse an existing backup directory; never overwrite an earlier backup.
   backupName='gcs-backup-'+uuid();try{await backupParent.getDirectoryHandle(backupName,{create:false});throw new Error('备份目录重名，请重新选择备份位置');}catch(e){if(e.name!=='NotFoundError')throw e;}
   const backup=await backupParent.getDirectoryHandle(backupName,{create:true});
   for(const target of targets){const handle=await backup.getFileHandle(target.path.split('/').at(-1),{create:true});await writeAndVerify(handle,target.before);}
   backupVerified=true;
   for(const target of targets.filter(t=>t.changed)){
    const writer=await target.handle.createWritable({mode:'exclusive'});streams.push({target,writer});await writer.write(target.after);
   }
   // Check both originals again after all streams are prepared, before any commit.
   for(const target of targets)if(!equal(await bytes(await target.handle.getFile()),target.before))throw new Error('磁盘文件在应用期间发生变化：'+target.path);
   for(const stream of streams){attempted.push(stream.target);await stream.writer.close();}
   for(const target of targets)if(!equal(await bytes(await target.handle.getFile()),target.after))throw new Error('写入后的读回校验失败：'+target.path);
   return {backupName,originalBytes:Object.fromEntries(targets.map(t=>[t.key,t.after]))};
  } catch(error){
   for(const stream of streams)await stream.writer.abort().catch(()=>{});
   const failures=[];
   for(const target of attempted.reverse()){
    try{const current=await bytes(await target.handle.getFile());if(equal(current,target.before))continue;if(!equal(current,target.after))throw new Error('文件出现并发变化，未覆盖外部修改');await writeAndVerify(target.handle,target.before);}catch(e){failures.push(target.path+'：'+e.message);}
   }
   const recoveryNeeded=failures.length>0;
   const message=error.message+(attempted.length?(recoveryNeeded?'；自动恢复未完成，请从备份手动恢复：'+failures.join('；'):'；本次写入已回滚，原文件保持不变'):'；未覆盖原文件');
   throw Object.assign(new Error(message),{backupName:backupVerified?backupName:'',recoveryNeeded});
  }
 }
 const api={safeApply};root.GCSGameWriter=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
