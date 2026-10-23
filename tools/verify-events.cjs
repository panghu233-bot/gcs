// Opt-in local acceptance: game sources are read only; all writes use disposable OS temp copies.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const gcs=path.resolve(__dirname,'..'),arg=process.argv.indexOf('--project');
if(arg<0||!process.argv[arg+1])throw Error('Usage: node tools/verify-events.cjs --project <read-only Godot root>');
const live=path.resolve(process.argv[arg+1]);
const catalog=require(gcs+'/site/event-catalog.js'),event=require(gcs+'/site/event-project.js'),patch=require(gcs+'/site/gdscript-string-patch.js'),writer=require(gcs+'/site/event-writer.js'),performance=require(gcs+'/site/event-performance.js'),{diskFS}=require(gcs+'/tests/helpers/disk-event.cjs');
const data=w=>w.lines.map(({speaker,text,left,right,mood})=>({speaker,text,left,right,mood}));const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const files={},hashes={};for(const p of [...catalog.paths,...Object.values(performance.paths)]){const b=new Uint8Array(await fs.readFile(path.join(live,p)));files[p]=b;hashes[p]=hash(b);}
 const discovered=catalog.discover(files),supported=discovered.records.filter(r=>r.editable);let portraits=0;const read=async p=>{try{return new Blob([await fs.readFile(path.join(live,p))]);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const preview=performance.create({read,makeUrl:()=> 'blob:verified',revokeUrl:()=>{}});for(const r of supported)for(const row of r.lines){const result=await preview.load(row);for(const side of ['left','right']){const v=result[side];if(v.name&&!v.error){assert(v.image);portraits++;}else if(v.name){assert(row.mood==='attack'&&v.error.includes('表情'),JSON.stringify(v));}}}preview.release();
 const results=[];for(const record of supported){const spec=record.manifest,disk=await diskFS(files);try{
  let w=await event.fromHandle(disk.project,spec);const original=data(w);w.duplicate(0);w.set(1,'GCS隔离结构验证');w.insert(0);w.set(0,'GCS隔离新增验证');w.setPerformance(0,'speaker','顾飞雪');w.setPerformance(0,'left','顾清寒');w.setPerformance(0,'right','顾飞雪');w.setPerformance(0,'mood','shy');w.move(0,1);w.remove(w.lines.length-1);const desired=data(w),plan=w.plan();
  const outsideBefore=Buffer.concat([Buffer.from(w.originalBytes.slice(0,plan.edits[0].start)),Buffer.from(w.originalBytes.slice(plan.edits[0].end))]);assert.equal(plan.kind,'function-body');
  async function save(id){const token=await writer.prepare({project:disk.project,backupParent:disk.backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:w.changes,lines:w.lines,structureChanged:w.hasStructuralChanges,workspace:w,uuid:()=>id});w.saved((await writer.apply(token,{project:disk.project,permissionGranted:true})).bytes);return disk.backup.getDirectoryHandle(token.backupName);}
  const backup=await save('original');w=await event.fromHandle(disk.project,spec);assert.deepEqual(data(w),desired);const parsed=patch.readLinear(w.originalBytes,spec),bodyStart=Buffer.byteLength(parsed.source.slice(0,parsed.body.start)),bodyEnd=Buffer.byteLength(parsed.source.slice(0,parsed.body.end));assert.deepEqual(Buffer.concat([Buffer.from(w.originalBytes.slice(0,bodyStart)),Buffer.from(w.originalBytes.slice(bodyEnd))]),outsideBefore);
  w.set(0,'GCS隔离第二次保存');await save('second');w=await event.fromHandle(disk.project,spec);assert.equal(w.lines[0].text,'GCS隔离第二次保存');
  // Later changes in another event in the SAME file must survive target restoration.
  const sibling=supported.find(r=>r.manifest.sourcePath===spec.sourcePath&&r.manifest.id!==spec.id);let siblingBytes=null;
  if(sibling){const other=await event.fromHandle(disk.project,sibling.manifest);other.set(0,'GCS其他事件后续修改');const token=await writer.prepare({project:disk.project,backupParent:disk.backup,originalBytes:other.originalBytes,entryBytes:other.entryBytes,changes:other.changes,lines:other.lines,workspace:other,uuid:()=> 'sibling'});other.saved((await writer.apply(token,{project:disk.project,permissionGranted:true})).bytes);siblingBytes=data(other);w=await event.fromHandle(disk.project,spec);}
  const review=await writer.reviewRestore({project:disk.project,backupDirectory:backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,spec});const token=await writer.prepareRestore(review);w.saved((await writer.apply(token,{project:disk.project,permissionGranted:true})).bytes);assert.deepEqual(data(w),original);w=await event.fromHandle(disk.project,spec);assert.deepEqual(data(w),original);
  if(sibling)assert.deepEqual(data(await event.fromHandle(disk.project,sibling.manifest)),siblingBytes);
  for(const [p,b] of Object.entries(files))if(p!==spec.sourcePath)assert.deepEqual(new Uint8Array(await disk.read(p)),b);
  results.push({title:spec.title,lines:original.length,sourcePath:spec.sourcePath,passed:true});console.log('PASS '+spec.title);
 }finally{await disk.cleanup();}}
 for(const [p,h] of Object.entries(hashes))assert.equal(hash(await fs.readFile(path.join(live,p))),h,'LIVE SOURCE CHANGED '+p);
 console.log(JSON.stringify({scopes:discovered.records.length,editable:supported.length,readonly:discovered.records.length-supported.length,portraitChecks:portraits,results,liveFilesUnchanged:true},null,2));console.log('REAL_VERIFICATION_COMPLETE '+results.length+' events; '+portraits+' portrait checks; live sources unchanged');
})().catch(e=>{console.error(e);process.exitCode=1;});
