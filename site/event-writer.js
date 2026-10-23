/* A reviewed single-source write. Entry source is a read-only dependency. */
(function(root){
'use strict';
const events=typeof module!=='undefined'?require('./event-project.js'):root.GCSEventProject,patch=typeof module!=='undefined'?require('./gdscript-string-patch.js'):root.GCSGDScriptPatch;
const branches=typeof module!=='undefined'?require('./event-branches.js'):root.GCSEventBranches;
async function verifyRuntime(project){if(!await branches.verify(async path=>{try{return await (await events.locate(project,path)).getFile();}catch{return null;}}))throw Error('播放器或事件回调契约已变化，分支结构保持只读');}
const jobs=new WeakMap(),read=async h=>new Uint8Array(await (await h.getFile()).arrayBuffer());
async function writeVerified(handle,bytes){let stream;try{stream=await handle.createWritable({mode:'exclusive'});await stream.write(bytes);await stream.close();}catch(e){if(stream)await stream.abort().catch(()=>{});throw e;}if(!patch.equal(await read(handle),bytes))throw Error('备份读回校验失败');}
// A selected backup is an input, never a whole-file replacement authority.
const restores=new WeakMap();
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
async function boundedRead(handle,max){const f=await handle.getFile();if(!Number.isSafeInteger(f.size)||f.size<1||f.size>max)throw Error('备份文件大小无效');const bytes=new Uint8Array(await f.arrayBuffer());if(bytes.length!==f.size)throw Error('备份文件大小与内容不符');return bytes;}
async function verifyRestore(r){
 if(!patch.equal(await boundedRead(r.backupFile,8*1024*1024),r.backupBytes)||!patch.equal(await boundedRead(r.noteFile,16384),r.noteBytes))throw Error('所选备份已变化，请重新选择并审阅');
}
async function reviewRestore({project,backupDirectory,originalBytes,entryBytes,spec=events.manifest}){
 const filename=spec.sourcePath.split('/').at(-1);
 if(!backupDirectory||await project.resolve(backupDirectory)!==null||!/^gcs-event-backup-[a-zA-Z0-9-]+$/.test(backupDirectory.name))throw Error('请选择已有的 gcs-event-backup-* 备份目录');
 const noteFile=await backupDirectory.getFileHandle('restore.json',{create:false}),noteBytes=await boundedRead(noteFile,16384),note=JSON.parse(patch.decode(noteBytes));
 const legacy=note.format==='gcs-event-backup-v1',branchBackup=note.format==='gcs-event-branch-backup-v4',textOnly=spec.adapter==='literal';
 if(branchBackup){if(!branches.allowed(spec))throw Error('分支备份的事件范围无效');await verifyRuntime(project);}
 if(textOnly&&!branchBackup&&note.format!=='gcs-event-text-backup-v3'||!textOnly&&note.format==='gcs-event-text-backup-v3')throw Error('备份编辑能力与当前来源不符');
 if((!legacy&&!branchBackup&&note.format!=='gcs-event-backup-v2'&&note.format!=='gcs-event-text-backup-v3')||note.eventId!==spec.id||note.path!==spec.sourcePath||note.file!==filename||!Number.isSafeInteger(note.originalSize)||note.originalSize<1||note.originalSize>8*1024*1024)throw Error('备份记录的事件、路径或大小无效');
 if(legacy&&(!Array.isArray(note.modifiedLines)||!note.modifiedLines.length||new Set(note.modifiedLines).size!==note.modifiedLines.length||note.modifiedLines.some(n=>!Number.isInteger(n)||n<1||n>spec.expectedCount)))throw Error('旧版备份对白索引无效');
 if(!legacy&&(!/^[a-f0-9]{64}$/.test(note.sourceHash)||!Number.isSafeInteger(note.lineCount)||note.lineCount<1))throw Error('结构备份的校验信息无效');
 const backupFile=await backupDirectory.getFileHandle(filename,{create:false}),backupBytes=await boundedRead(backupFile,8*1024*1024);
 if(backupBytes.length!==note.originalSize||note.sourceHash&&await hash(backupBytes)!==note.sourceHash)throw Error('备份大小或内容校验不符');
 const current=await events.fromHandle(project,spec);
 if(!patch.equal(current.originalBytes,originalBytes)||!patch.equal(current.entryBytes,entryBytes))throw Error('磁盘源码或执行入口已变化，请重新读取');
 const a=patch.readLinear(current.originalBytes,spec),b=patch.readLinear(backupBytes,spec);
 if(textOnly&&!branchBackup&&(!Array.isArray(note.slotIds)||JSON.stringify(note.slotIds)!==JSON.stringify(b.lines.filter(r=>r.editable).map(r=>r.slotId))))throw Error('备份文字身份记录不符');
 if(legacy&&!b.legacyCompatible||!legacy&&b.lines.length!==note.lineCount)throw Error('备份对白格式或数量与记录不符');
 const planned=branchBackup?branches.restore(current.originalBytes,backupBytes,spec):patch.planRestore({originalBytes:current.originalBytes,backupBytes,spec});
 const changes=branchBackup?Object.freeze([Object.freeze({kind:'options',index:0,context:spec.functionName+' / 恢复全部文字与选项去向',before:patch.decode(current.originalBytes).slice(a.scope.start,a.scope.end),after:patch.decode(backupBytes).slice(b.scope.start,b.scope.end)})]):Object.freeze(events.diffRows(a.lines,b.lines).map(c=>Object.freeze(textOnly?{...c,slotId:a.lines[c.index].slotId,context:a.lines[c.index].context,textKind:a.lines[c.index].kind}:c)));
 const review=Object.freeze({backupName:backupDirectory.name,changes});restores.set(review,{branchBackup,spec,project,before:current.originalBytes,entryBefore:current.entryBytes,backupFile,backupBytes,noteFile,noteBytes,changes,after:planned.bytes});return review;
}
async function prepareRestore(review,{backupParent,uuid}={}){
 const r=restores.get(review);if(!r)throw Error('备份审阅已失效');await verifyRestore(r);
 if(backupParent){const token=await prepare({project:r.project,backupParent,spec:r.spec,originalBytes:r.before,entryBytes:r.entryBefore,lines:patch.readLinear(r.after,r.spec).lines,structureChanged:r.spec.adapter!=='literal',changes:r.changes,uuid});jobs.get(token).restore=r;return token;}
 const before=new Uint8Array(r.before),entryBefore=new Uint8Array(r.entryBefore),spec=r.spec;
 events.parse({[spec.sourcePath]:before,[spec.entryPath]:entryBefore},spec);
 if(r.branchBackup)await verifyRuntime(r.project);
 const after=(r.branchBackup?branches.restore(before,r.backupBytes,spec):patch.planRestore({originalBytes:before,backupBytes:r.backupBytes,spec})).bytes,handle=await events.locate(r.project,spec.sourcePath),entryHandle=await events.locate(r.project,spec.entryPath);
 if(!patch.equal(after,r.after)||!patch.equal(await read(handle),before)||!patch.equal(await read(entryHandle),entryBefore))throw Error('磁盘源码或执行入口已变化，请重新读取');
 const token=Object.freeze({backupName:review.backupName,filename:spec.sourcePath.split('/').at(-1),path:spec.sourcePath});
 jobs.set(token,{spec,project:r.project,handle,entryHandle,before,entryBefore,after,restore:r,runtime:r.branchBackup,used:false});return token;
}
async function prepare({project,backupParent,originalBytes,entryBytes,changes,lines,structureChanged=false,workspace=null,spec=workspace?.manifest||events.manifest,uuid=()=>crypto.randomUUID()}){
 const before=new Uint8Array(originalBytes),entryBefore=new Uint8Array(entryBytes);
 if(!Array.isArray(changes)||!changes.length)throw Error('没有经过审阅的修改，请重新查看差异');
 // Revalidate identity as well as every requested old value before any filesystem mutation.
 events.parse({[spec.sourcePath]:before,[spec.entryPath]:entryBefore},spec);
 const branchEdit=!!workspace?.branch&&Object.keys(workspace.branch.overrides).length>0;if(branchEdit)await verifyRuntime(project);
 const planned=branchEdit?workspace.plan():lines?patch.planLines({originalBytes:before,spec,lines,structureChanged}):patch.plan({originalBytes:before,spec,changes}),after=planned.bytes;
 if(spec.adapter==='literal'&&!branchEdit&&lines&&!patch.equal(patch.plan({originalBytes:before,spec,changes}).bytes,after))throw Error('已审阅文字清单与实际补丁不一致');
 if(patch.equal(before,after))throw Error('没有需要写入的修改');
 const reviewedChanges=JSON.stringify(changes);
 const guard=()=>{if(!workspace)return;const planned=workspace.plan();if(JSON.stringify(workspace.changes)!==reviewedChanges||!patch.equal(planned.bytes,after)||!patch.equal(workspace.originalBytes,before)||!patch.equal(workspace.entryBytes,entryBefore))throw Error('草稿或演出设置已变化，请重新审阅');};guard();
 if(!project||!backupParent||await project.resolve(backupParent)!==null)throw Error('备份目录必须在游戏项目之外');
 const handle=await events.locate(project,spec.sourcePath),entryHandle=await events.locate(project,spec.entryPath);
 async function check(){if(branchEdit)await verifyRuntime(project);guard();if(!patch.equal(await read(handle),before)||!patch.equal(await read(entryHandle),entryBefore))throw Error('磁盘源码或执行入口已变化，请保留草稿并重新读取');}
 await check();const backupName='gcs-event-backup-'+uuid();if(!/^gcs-event-backup-[a-zA-Z0-9-]+$/.test(backupName))throw Error('无效备份名称');
 try{await backupParent.getDirectoryHandle(backupName,{create:false});throw Error('备份目录重名，拒绝覆盖');}catch(e){if(e.name!=='NotFoundError')throw e;}
 try{
  const dir=await backupParent.getDirectoryHandle(backupName,{create:true}),filename=spec.sourcePath.split('/').at(-1),backupFile=await dir.getFileHandle(filename,{create:true});
  await writeVerified(backupFile,before);
  const legacy=planned.kind!=='function-body'&&patch.readLinear(before,spec).legacyCompatible;
  const metadata={format:branchEdit?'gcs-event-branch-backup-v4':spec.adapter==='literal'?'gcs-event-text-backup-v3':legacy?'gcs-event-backup-v1':'gcs-event-backup-v2',eventId:spec.id,path:spec.sourcePath,file:filename,originalSize:before.length,sourceHash:await hash(before),...(spec.adapter==='literal'?{slotIds:patch.readLinear(before,spec).lines.filter(r=>r.editable).map(r=>r.slotId)}:{}),...(legacy?{modifiedLines:changes.map(c=>c.index+1)}:{lineCount:patch.readLinear(before,spec).lines.length})};
  const note=new TextEncoder().encode(JSON.stringify(metadata,null,2));
  const noteFile=await dir.getFileHandle('restore.json',{create:true});await writeVerified(noteFile,note);await check();
  const token=Object.freeze({backupName,filename,path:spec.sourcePath});jobs.set(token,{spec,project,handle,entryHandle,before,entryBefore,after,backupFile,noteFile,noteBytes:note,guard,runtime:branchEdit,used:false});return token;
 }catch(e){throw Object.assign(Error('备份未完成，游戏原文件未写入：'+e.message),{backupName});}
}
async function apply(token,{project,permissionGranted=false}={}){
 const job=jobs.get(token);if(!job||job.used||job.project!==project)throw Error('对白确认已失效，请重新审阅');if(!permissionGranted)throw Error('未获得用户写入授权');job.used=true;
 let stream,attempted=false;
 async function check(){if(job.runtime)await verifyRuntime(project);job.guard?.();if(job.restore)await verifyRestore(job.restore);if(!patch.equal(await read(job.handle),job.before)||!patch.equal(await read(job.entryHandle),job.entryBefore))throw Error('磁盘源码或执行入口已变化，已停止覆盖');if(job.backupFile&&(!patch.equal(await read(job.backupFile),job.before)||!patch.equal(await read(job.noteFile),job.noteBytes)))throw Error('备份内容或恢复记录已变化');}
 try{
  await check();stream=await job.handle.createWritable({mode:'exclusive'});await stream.write(job.after);await check();attempted=true;await stream.close();
  const disk=await read(job.handle);if(!patch.equal(await read(job.entryHandle),job.entryBefore))throw Error('写后执行入口已变化');if(!patch.equal(disk,job.after))throw Error('写入后读回校验失败');events.parse({[job.spec.sourcePath]:disk,[job.spec.entryPath]:job.entryBefore},job.spec);
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
