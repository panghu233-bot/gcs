/* A reviewed single-source write. Entry source is a read-only dependency. */
(function(root){
'use strict';
const events=typeof module!=='undefined'?require('./event-project.js'):root.GCSEventProject,patch=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const jobs=new WeakMap(),read=async h=>new Uint8Array(await (await h.getFile()).arrayBuffer());
async function writeVerified(handle,bytes){let stream;try{stream=await handle.createWritable({mode:'exclusive'});await stream.write(bytes);await stream.close();}catch(e){if(stream)await stream.abort().catch(()=>{});throw e;}if(!patch.equal(await read(handle),bytes))throw Error('备份读回校验失败');}
async function prepare({project,backupParent,originalBytes,entryBytes,changes,uuid=()=>crypto.randomUUID()}){
 const spec=events.manifest,before=new Uint8Array(originalBytes),entryBefore=new Uint8Array(entryBytes);
 // Revalidate identity as well as every requested old value before any filesystem mutation.
 events.parse({[spec.sourcePath]:before,[spec.entryPath]:entryBefore});
 const after=patch.plan({originalBytes:before,spec,changes}).bytes;
 if(!project||!backupParent||await project.resolve(backupParent)!==null)throw Error('备份目录必须在游戏项目之外');
 const handle=await events.locate(project,spec.sourcePath),entryHandle=await events.locate(project,spec.entryPath);
 async function check(){if(!patch.equal(await read(handle),before)||!patch.equal(await read(entryHandle),entryBefore))throw Error('磁盘源码或执行入口已变化，请保留草稿并重新读取');}
 await check();const backupName='gcs-event-backup-'+uuid();if(!/^gcs-event-backup-[a-zA-Z0-9-]+$/.test(backupName))throw Error('无效备份名称');
 try{await backupParent.getDirectoryHandle(backupName,{create:false});throw Error('备份目录重名，拒绝覆盖');}catch(e){if(e.name!=='NotFoundError')throw e;}
 try{
  const dir=await backupParent.getDirectoryHandle(backupName,{create:true}),filename=spec.sourcePath.split('/').at(-1),backupFile=await dir.getFileHandle(filename,{create:true});
  await writeVerified(backupFile,before);
  const note=new TextEncoder().encode(JSON.stringify({format:'gcs-event-backup-v1',eventId:spec.id,path:spec.sourcePath,file:filename,originalSize:before.length,modifiedLines:changes.map(c=>c.index+1)},null,2));
  await writeVerified(await dir.getFileHandle('restore.json',{create:true}),note);await check();
  const token=Object.freeze({backupName,filename,path:spec.sourcePath});jobs.set(token,{project,handle,entryHandle,before,entryBefore,after,backupFile,used:false});return token;
 }catch(e){throw Object.assign(Error('备份未完成，游戏原文件未写入：'+e.message),{backupName});}
}
async function apply(token,{project,permissionGranted=false}={}){
 const job=jobs.get(token);if(!job||job.used||job.project!==project)throw Error('对白确认已失效，请重新备份');if(!permissionGranted)throw Error('未获得用户写入授权');job.used=true;
 let stream,attempted=false;
 async function check(){if(!patch.equal(await read(job.handle),job.before)||!patch.equal(await read(job.entryHandle),job.entryBefore))throw Error('磁盘源码或执行入口已变化，已停止覆盖');if(!patch.equal(await read(job.backupFile),job.before))throw Error('备份内容已变化');}
 try{
  await check();stream=await job.handle.createWritable({mode:'exclusive'});await stream.write(job.after);await check();attempted=true;await stream.close();
  const disk=await read(job.handle);if(!patch.equal(await read(job.entryHandle),job.entryBefore))throw Error('写后执行入口已变化');if(!patch.equal(disk,job.after))throw Error('写入后读回校验失败');patch.readLinear(disk,events.manifest);
  return {bytes:new Uint8Array(job.after),backupName:token.backupName};
 }catch(e){
  if(stream)await stream.abort().catch(()=>{});let recovered=false,recoveryNeeded=false;
  if(attempted){try{
   const disk=await read(job.handle);if(patch.equal(disk,job.before))recovered=true;
   else if(patch.equal(disk,job.after)){
    let rollback;try{if(!patch.equal(await read(job.backupFile),job.before))throw Error('备份已变化');rollback=await job.handle.createWritable({mode:'exclusive'});await rollback.write(job.before);if(!patch.equal(await read(job.handle),job.after))throw Error('恢复期间存在外部修改');await rollback.close();if(!patch.equal(await read(job.handle),job.before))throw Error('恢复校验失败');recovered=true;}catch(error){if(rollback)await rollback.abort().catch(()=>{});throw error;}
   }else recoveryNeeded=true;
  }catch{recoveryNeeded=true;}}
  throw Object.assign(Error(e.message+(recovered?'；已确认原文件恢复':recoveryNeeded?'；自动恢复未完成，请检查备份手动恢复':'；未提交原文件修改')),{recovered,recoveryNeeded,backupName:token.backupName});
 }
}
const api={prepare,apply};if(typeof module!=='undefined')module.exports=api;root.GCSEventWriter=api;
})(typeof window!=='undefined'?window:globalThis);
