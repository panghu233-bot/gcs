// Opt-in local acceptance: game sources are read only; all writes use disposable OS temp copies.
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const gcs=path.resolve(__dirname,'..'),arg=process.argv.indexOf('--project');
if(arg<0||!process.argv[arg+1])throw Error('Usage: node tools/verify-events.cjs --project <read-only Godot root>');
const live=path.resolve(process.argv[arg+1]),catalog=require(gcs+'/site/event-catalog.js'),event=require(gcs+'/site/event-project.js'),patch=require(gcs+'/site/gdscript-string-patch.js'),writer=require(gcs+'/site/event-writer.js'),performance=require(gcs+'/site/event-performance.js'),{diskFS}=require(gcs+'/tests/helpers/disk-event.cjs');
const data=w=>w.lines.map(({speaker,text,left,right,mood,slotId,kind})=>({speaker,text,left,right,mood,slotId,kind}));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function outside(before,plan){let old=0,next=0;for(const edit of plan.edits){const size=edit.start-old;assert.deepEqual(plan.bytes.slice(next,next+size),before.slice(old,edit.start));next+=size+edit.bytes.length;old=edit.end;}assert.deepEqual(plan.bytes.slice(next),before.slice(old));}
(async()=>{
 const files={},hashes={};for(const name of [...catalog.paths,...Object.values(performance.paths)]){try{const b=new Uint8Array(await fs.readFile(path.join(live,name)));files[name]=b;hashes[name]=hash(b);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const discovered=catalog.discover(files),supported=discovered.records.filter(r=>r.editable);let portraits=0,textSlots=0;
 const read=async name=>{try{return new Blob([await fs.readFile(path.join(live,name))]);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const preview=performance.create({read,makeUrl:()=> 'blob:verified',revokeUrl:()=>{}});
 for(const record of supported.filter(r=>r.capability==='full'))for(const row of record.lines){const result=await preview.load(row);for(const side of ['left','right']){const value=result[side];if(value.name&&!value.error){assert(value.image);portraits++;}else if(value.name)assert(row.mood==='attack'&&value.error.includes('表情'),JSON.stringify(value));}}
 preview.release();
 const results=[];
 for(const record of supported){const spec=record.manifest,disk=await diskFS(files);try{
  let w=await event.fromHandle(disk.project,spec);const original=data(w);
  if(w.textOnly){w.lines.forEach((row,i)=>{if(row.editable){w.set(i,row.text+'（隔离验证）');textSlots++;}else assert.throws(()=>w.set(i,'blocked'));});assert.throws(()=>w.duplicate(0));assert.throws(()=>w.setPerformance(0,'speaker','顾飞雪'));}
  else {w.duplicate(0);w.set(1,'GCS隔离结构验证');w.insert(0);w.set(0,'GCS隔离新增验证');w.setPerformance(0,'speaker','顾飞雪');w.setPerformance(0,'left','顾清寒');w.setPerformance(0,'right','顾飞雪');w.setPerformance(0,'mood','shy');w.move(0,1);w.remove(w.lines.length-1);}
  const desired=data(w),plan=w.plan();assert.equal(plan.kind,w.textOnly?'text':'function-body');outside(w.originalBytes,plan);if(w.textOnly)assert.equal(patch.readLinear(w.originalBytes,spec).mask,patch.readLinear(plan.bytes,spec).mask);
  async function save(id){const token=await writer.prepare({project:disk.project,backupParent:disk.backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:w.changes,lines:w.lines,structureChanged:w.hasStructuralChanges,workspace:w,uuid:()=>id});w.saved((await writer.apply(token,{project:disk.project,permissionGranted:true})).bytes);return disk.backup.getDirectoryHandle(token.backupName);}
  const backup=await save('original');w=await event.fromHandle(disk.project,spec);assert.deepEqual(data(w),desired);
  const first=w.textOnly?w.lines.findIndex(r=>r.editable):0;w.set(first,'GCS隔离第二次保存');await save('second');w=await event.fromHandle(disk.project,spec);assert.equal(w.lines[first].text,'GCS隔离第二次保存');
  const sibling=supported.find(r=>r.manifest.sourcePath===spec.sourcePath&&r.manifest.id!==spec.id);let siblingRows=null;
  if(sibling){const other=await event.fromHandle(disk.project,sibling.manifest);other.set(other.textOnly?other.lines.findIndex(r=>r.editable):0,'GCS其他事件后续修改');const token=await writer.prepare({project:disk.project,backupParent:disk.backup,originalBytes:other.originalBytes,entryBytes:other.entryBytes,changes:other.changes,lines:other.lines,workspace:other,uuid:()=> 'sibling'});other.saved((await writer.apply(token,{project:disk.project,permissionGranted:true})).bytes);siblingRows=data(other);w=await event.fromHandle(disk.project,spec);}
  const review=await writer.reviewRestore({project:disk.project,backupDirectory:backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,spec});const token=await writer.prepareRestore(review);w.saved((await writer.apply(token,{project:disk.project,permissionGranted:true})).bytes);assert.deepEqual(data(w),original);w=await event.fromHandle(disk.project,spec);assert.deepEqual(data(w),original);
  if(sibling)assert.deepEqual(data(await event.fromHandle(disk.project,sibling.manifest)),siblingRows);
  for(const [name,b] of Object.entries(files))if(name!==spec.sourcePath)assert.deepEqual(new Uint8Array(await disk.read(name)),b);
  results.push({title:spec.title,function:spec.functionName,capability:record.capability,items:original.length,sourcePath:spec.sourcePath,passed:true});console.log('PASS '+record.capability+' '+spec.title+' / '+spec.functionName);
 }finally{await disk.cleanup();}}
 for(const record of discovered.records.filter(r=>!r.editable))assert.throws(()=>event.parse(files,record.manifest));
 for(const [name,expected] of Object.entries(hashes))assert.equal(hash(await fs.readFile(path.join(live,name))),expected,'LIVE SOURCE CHANGED '+name);
 console.log(JSON.stringify({scopes:discovered.records.length,full:supported.filter(r=>r.capability==='full').length,textOnly:supported.filter(r=>r.capability==='text').length,textSlots,readonly:discovered.records.length-supported.length,portraitChecks:portraits,results,liveFilesUnchanged:true},null,2));
 console.log('REAL_VERIFICATION_COMPLETE '+results.length+' sources; '+textSlots+' text slots; '+portraits+' portrait checks; live sources unchanged');
})().catch(e=>{console.error(e);process.exitCode=1;});
