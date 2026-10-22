/* A reviewed single-source write. Entry source is a read-only dependency. */
(function(root){
'use strict';
const events=typeof module!=='undefined'?require('./event-project.js'):root.GCSEventProject,patch=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const jobs=new WeakMap(),read=async h=>new Uint8Array(await (await h.getFile()).arrayBuffer());
async function writeVerified(handle,bytes){let stream;try{stream=await handle.createWritable({mode:'exclusive'});await stream.write(bytes);await stream.close();}catch(e){if(stream)await stream.abort().catch(()=>{});throw e;}if(!patch.equal(await read(handle),bytes))throw Error('备份读回校验失败');}
// A selected backup is an input, never a whole-file replacement authority.
const restores=new WeakMap();
async function boundedRead(handle,max){const f=await handle.getFile();if(!Number.isSafeInteger(f.size)||f.size<1||f.size>max)throw Error('备份文件大小无效');const bytes=new Uint8Array(await f.arrayBuffer());if(bytes.length!==f.size)throw Error('备份文件大小与内容不符');return bytes;}
async function verifyRestore(r){
 if(!patch.equal(await boundedRead(r.backupFile,8*1024*1024),r.backupBytes)||!patch.equal(await boundedRead(r.noteFile,16384),r.noteBytes))throw Error('所选备份已变化，请重新选择并审阅');
}
async function reviewRestore({project,backupDirectory,originalBytes,entryBytes}){
 const spec=events.manifest,filename=spec.sourcePath.split('/').at(-1);
 if(!backupDirectory||!/^gcs-event-backup-[a-zA-Z0-9-]+$/.test(backupDirectory.name))throw Error('请选择已有的 gcs-event-backup-* 备份目录');
 const noteFile=await backupDirectory.getFileHandle('restore.json',{create:false}),noteBytes=await boundedRead(noteFile,16384),note=JSON.parse(patch.decode(noteBytes));
 if(note.format!=='gcs-event-backup-v1'||note.eventId!==spec.id||note.path!==spec.sourcePath||note.file!==filename||!Number.isSafeInteger(note.originalSize)||note.originalSize<1||note.originalSize>8*1024*1024||!Array.isArray(note.modifiedLines)||!note.modifiedLines.length||new Set(note.modifiedLines).size!==note.modifiedLines.length||note.modifiedLines.some(n=>!Number.isInteger(n)||n<1||n>spec.expectedCount))throw Error('备份记录的事件、路径、大小或对白索引无效');
 const backupFile=await backupDirectory.getFileHandle(filename,{create:false}),backupBytes=await boundedRead(backupFile,8*1024*1024);
 if(backupBytes.length!==note.originalSize)throw Error('备份记录大小与实际内容不符');
 const current=await events.fromHandle(project);
 if(!patch.equal(current.originalBytes,originalBytes)||!patch.equal(current.entryBytes,entryBytes))throw Error('磁盘源码或执行入口已变化，请重新读取');
 const a=patch.readLinear(current.originalBytes,spec),b=patch.readLinear(backupBytes,spec);
 // Compare every source byte outside the seven text tokens, including comments,
 // indentation, BOM, line endings, other events, moods and speaker bindings.
 let ai=0,bi=0;
 for(let i=0;i<spec.expectedCount;i++){
  const at=a.lines[i].token,bt=b.lines[i].token;
  if(at.quote!==bt.quote||a.source.slice(ai,at.start)!==b.source.slice(bi,bt.start))throw Error('存在对白之外的源码或结构变化，拒绝自动恢复');
  ai=at.end;bi=bt.end;
 }
 if(a.source.slice(ai)!==b.source.slice(bi))throw Error('存在对白之外的源码变化，拒绝自动恢复');
 const changes=Object.freeze(a.lines.flatMap((l,index)=>l.text===b.lines[index].text?[]:[Object.freeze({index,before:l.text,after:b.lines[index].text})]));
 if(!changes.length)throw Error('当前七句对白与备份一致，无需恢复');
 patch.plan({originalBytes:current.originalBytes,spec,changes});
 const review=Object.freeze({backupName:backupDirectory.name,changes});restores.set(review,{project,before:current.originalBytes,entryBefore:current.entryBytes,backupFile,backupBytes,noteFile,noteBytes,changes});return review;
}
async function prepareRestore(review,{backupParent,uuid}={}){
 const r=restores.get(review);if(!r)throw Error('备份审阅已失效');await verifyRestore(r);
 if(backupParent){const token=await prepare({project:r.project,backupParent,originalBytes:r.before,entryBytes:r.entryBefore,changes:r.changes,uuid});jobs.get(token).restore=r;return token;}
 const before=new Uint8Array(r.before),entryBefore=new Uint8Array(r.entryBefore),spec=events.manifest;
 events.parse({[spec.sourcePath]:before,[spec.entryPath]:entryBefore});
 const after=patch.plan({originalBytes:before,spec,changes:r.changes}).bytes,handle=await events.locate(r.project,spec.sourcePath),entryHandle=await events.locate(r.project,spec.entryPath);
 if(!patch.equal(await read(handle),before)||!patch.equal(await read(entryHandle),entryBefore))throw Error('磁盘源码或执行入口已变化，请重新读取');
 const token=Object.freeze({backupName:review.backupName,filename:spec.sourcePath.split('/').at(-1),path:spec.sourcePath});
 jobs.set(token,{project:r.project,handle,entryHandle,before,entryBefore,after,restore:r,used:false});return token;
}
async function prepare({project,backupParent,originalBytes,entryBytes,changes,workspace=null,uuid=()=>crypto.randomUUID()}){
 const spec=events.manifest,before=new Uint8Array(originalBytes),entryBefore=new Uint8Array(entryBytes);
 // Revalidate identity as well as every requested old value before any filesystem mutation.
 events.parse({[spec.sourcePath]:before,[spec.entryPath]:entryBefore});
 const after=patch.plan({originalBytes:before,spec,changes}).bytes;
 const guard=()=>{if(!workspace)return;const planned=workspace.plan();if(!patch.equal(planned.bytes,after)||!patch.equal(workspace.originalBytes,before)||!patch.equal(workspace.entryBytes,entryBefore))throw Error('草稿或演出设置已变化，请重新审阅');};guard();
 if(!project||!backupParent||await project.resolve(backupParent)!==null)throw Error('备份目录必须在游戏项目之外');
 const handle=await events.locate(project,spec.sourcePath),entryHandle=await events.locate(project,spec.entryPath);
 async function check(){guard();if(!patch.equal(await read(handle),before)||!patch.equal(await read(entryHandle),entryBefore))throw Error('磁盘源码或执行入口已变化，请保留草稿并重新读取');}
 await check();const backupName='gcs-event-backup-'+uuid();if(!/^gcs-event-backup-[a-zA-Z0-9-]+$/.test(backupName))throw Error('无效备份名称');
 try{await backupParent.getDirectoryHandle(backupName,{create:false});throw Error('备份目录重名，拒绝覆盖');}catch(e){if(e.name!=='NotFoundError')throw e;}
 try{
  const dir=await backupParent.getDirectoryHandle(backupName,{create:true}),filename=spec.sourcePath.split('/').at(-1),backupFile=await dir.getFileHandle(filename,{create:true});
  await writeVerified(backupFile,before);
  const note=new TextEncoder().encode(JSON.stringify({format:'gcs-event-backup-v1',eventId:spec.id,path:spec.sourcePath,file:filename,originalSize:before.length,modifiedLines:changes.map(c=>c.index+1)},null,2));
  await writeVerified(await dir.getFileHandle('restore.json',{create:true}),note);await check();
  const token=Object.freeze({backupName,filename,path:spec.sourcePath});jobs.set(token,{project,handle,entryHandle,before,entryBefore,after,backupFile,guard,used:false});return token;
 }catch(e){throw Object.assign(Error('备份未完成，游戏原文件未写入：'+e.message),{backupName});}
}
async function apply(token,{project,permissionGranted=false}={}){
 const job=jobs.get(token);if(!job||job.used||job.project!==project)throw Error('对白确认已失效，请重新审阅');if(!permissionGranted)throw Error('未获得用户写入授权');job.used=true;
 let stream,attempted=false;
 async function check(){job.guard?.();if(job.restore)await verifyRestore(job.restore);if(!patch.equal(await read(job.handle),job.before)||!patch.equal(await read(job.entryHandle),job.entryBefore))throw Error('磁盘源码或执行入口已变化，已停止覆盖');if(job.backupFile&&!patch.equal(await read(job.backupFile),job.before))throw Error('备份内容已变化');}
 try{
  await check();stream=await job.handle.createWritable({mode:'exclusive'});await stream.write(job.after);await check();attempted=true;await stream.close();
  const disk=await read(job.handle);if(!patch.equal(await read(job.entryHandle),job.entryBefore))throw Error('写后执行入口已变化');if(!patch.equal(disk,job.after))throw Error('写入后读回校验失败');patch.readLinear(disk,events.manifest);
  return {bytes:new Uint8Array(job.after),backupName:token.backupName};
 }catch(e){
  if(stream)await stream.abort().catch(()=>{});let recovered=false,recoveryNeeded=false;
  if(attempted){try{
   const disk=await read(job.handle);if(patch.equal(disk,job.before))recovered=true;
   else if(patch.equal(disk,job.after)){
    let rollback;try{if(job.backupFile&&!patch.equal(await read(job.backupFile),job.before))throw Error('备份已变化');rollback=await job.handle.createWritable({mode:'exclusive'});await rollback.write(job.before);if(!patch.equal(await read(job.handle),job.after))throw Error('恢复期间存在外部修改');await rollback.close();if(!patch.equal(await read(job.handle),job.before))throw Error('恢复校验失败');recovered=true;}catch(error){if(rollback)await rollback.abort().catch(()=>{});throw error;}
   }else recoveryNeeded=true;
  }catch{recoveryNeeded=true;}}
  throw Object.assign(Error(e.message+(recovered?'；已确认原文件恢复':recoveryNeeded?(job.restore&&!job.backupFile?'；自动恢复未完成，磁盘内容可能已变化，请停止编辑并检查所选备份；本次写入前的内存快照未另存到磁盘，不会自动覆盖检测到的外部修改':'；自动恢复未完成，请检查备份手动恢复'):'；未提交原文件修改')),{recovered,recoveryNeeded,backupName:token.backupName});
 }
}
const api={prepare,apply,reviewRestore,prepareRestore};if(typeof module!=='undefined')module.exports=api;root.GCSEventWriter=api;
})(typeof window!=='undefined'?window:globalThis);
