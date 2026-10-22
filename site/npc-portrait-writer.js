/* NPC portrait writes are independent of the card writer. No project writes during preparation. */
(function(root){
'use strict';
const MAX_BYTES=8*1024*1024,prepared=new WeakMap();
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const read=async h=>new Uint8Array(await (await h.getFile()).arrayBuffer());
function pngInfo(data){
 const b=new Uint8Array(data),view=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length>MAX_BYTES||b.length<57||![137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))throw Error('请选择完整的 PNG 图片，大小不超过 8 MB');
 let offset=8,width=0,height=0,idat=false,ended=false;
 while(offset+12<=b.length){
  const size=view.getUint32(offset),end=offset+12+size;if(end>b.length)throw Error('PNG 图片不完整');
  const type=String.fromCharCode(...b.slice(offset+4,offset+8));let crc=0xffffffff;
  for(let i=offset+4;i<end-4;i++){crc^=b[i];for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  if(((crc^0xffffffff)>>>0)!==view.getUint32(end-4))throw Error('PNG 图片校验失败');
  if(offset===8){if(type!=='IHDR'||size!==13)throw Error('PNG 图片缺少尺寸信息');width=view.getUint32(offset+8);height=view.getUint32(offset+12);}
  else if(type==='IHDR')throw Error('PNG 图片头重复');
  if(type==='IDAT'&&size)idat=true;
  if(type==='IEND'){if(size||end!==b.length)throw Error('PNG 图片结尾异常');ended=true;break;}
  offset=end;
 }
 if(!ended||!idat||!width||!height||width>16384||height>16384||width*height>64*1024*1024)throw Error('PNG 图片不完整或尺寸过大（最多 6400 万像素，单边不超过 16384）');
 return {width,height,size:b.length};
}
function safePath(path){
 if(typeof path!=='string'||!path.endsWith('.png')||path.split('/').some(s=>!s||s==='.'||s==='..'||/[\\:\x00-\x1f]/.test(s)))throw Error('只能替换已加载的现有 PNG 资源路径');
 return path.split('/');
}
async function targetFile(project,path){const parts=safePath(path);let dir=project;for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create:false});return dir.getFileHandle(parts.at(-1),{create:false});}
async function writeVerified(handle,data){let stream;try{stream=await handle.createWritable({mode:'exclusive'});await stream.write(data);await stream.close();}catch(e){if(stream)await stream.abort().catch(()=>{});throw e;}if(!equal(await read(handle),data))throw Error('备份读回校验失败');}
async function prepare({project,backupParent,path,originalBytes,replacementBytes,uuid=()=>crypto.randomUUID()}){
 safePath(path);if(!project||!backupParent||await project.resolve(backupParent)!==null)throw Error('备份目录必须在游戏项目之外');
 const before=new Uint8Array(originalBytes||[]),after=new Uint8Array(replacementBytes||[]);if(!before.length)throw Error('缺少原图快照，请重新读取项目');
 pngInfo(after);if(equal(before,after))throw Error('新图片与原图完全相同，无需替换');
 const handle=await targetFile(project,path);if(!equal(await read(handle),before))throw Error('磁盘原图已发生变化，请重新读取项目后再试');
 const backupName='gcs-portrait-backup-'+uuid();if(!/^gcs-portrait-backup-[a-zA-Z0-9-]+$/.test(backupName))throw Error('备份名称无效');
 try{await backupParent.getDirectoryHandle(backupName,{create:false});throw Error('备份目录重名，未覆盖已有备份');}catch(e){if(e.name!=='NotFoundError')throw e;}
 const backup=await backupParent.getDirectoryHandle(backupName,{create:true}),filename=path.split('/').at(-1);
 try{const backupFile=await backup.getFileHandle(filename,{create:true});await writeVerified(backupFile,before);
  const note=new TextEncoder().encode(JSON.stringify({format:'gcs-portrait-backup-v1',path,originalSize:before.length,replacementSize:after.length},null,2));
  await writeVerified(await backup.getFileHandle('restore.json',{create:true}),note);
  const token=Object.freeze({backupName,filename,path});prepared.set(token,{project,handle,backupFile,before,after,used:false});return token;
 }catch(e){throw Object.assign(new Error('备份未通过验证，原图未修改：'+e.message),{backupName});}
}
async function apply(token,{project,permissionGranted=false}={}){
 const job=prepared.get(token);if(!job||job.used||job.project!==project)throw Error('立绘确认已失效，请重新选择图片');
 if(!permissionGranted)throw Error('未获得写入权限，原图未修改');job.used=true;
 let stream,attempted=false,verifiedBackup=false;
 try{
  if(!equal(await read(job.backupFile),job.before))throw Error('备份内容发生变化，请重新备份');verifiedBackup=true;
  if(!equal(await read(job.handle),job.before))throw Error('磁盘原图已发生变化，请重新读取项目后再试');
  stream=await job.handle.createWritable({mode:'exclusive'});await stream.write(job.after);
  if(!equal(await read(job.handle),job.before))throw Error('暂存期间磁盘原图发生变化，已取消覆盖');
  attempted=true;await stream.close();
  if(!equal(await read(job.handle),job.after))throw Error('写入后读回校验失败');
  return {path:token.path,bytes:new Uint8Array(job.after),backupName:token.backupName};
 }catch(e){
  if(stream)await stream.abort().catch(()=>{});let recoveryNeeded=false,recovered=false;
  if(attempted&&verifiedBackup){try{const disk=await read(job.handle);
   if(equal(disk,job.before))recovered=true;
   else if(equal(disk,job.after)){
    // Never overwrite a third party's newer content while attempting recovery.
    let rollback;try{if(!equal(await read(job.backupFile),job.before))throw Error('备份发生变化');rollback=await job.handle.createWritable({mode:'exclusive'});await rollback.write(job.before);if(!equal(await read(job.handle),job.after))throw Error('恢复期间文件被外部修改');await rollback.close();if(!equal(await read(job.handle),job.before))throw Error('恢复校验失败');recovered=true;}catch(error){if(rollback)await rollback.abort().catch(()=>{});throw error;}
   }else recoveryNeeded=true;
  }catch{recoveryNeeded=true;}}
  throw Object.assign(new Error(e.message+(recovered?'；已确认原图恢复':recoveryNeeded?'；自动恢复未完成，请使用备份检查并恢复':'')),{backupName:token.backupName,recoveryNeeded,recovered});
 }
}
const api={prepare,apply,pngInfo,MAX_BYTES};if(typeof module!=='undefined')module.exports=api;root.GCSNPCPortraitWriter=api;
})(typeof window!=='undefined'?window:globalThis);
