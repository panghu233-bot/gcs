const {test}=require('node:test'),assert=require('node:assert/strict');
const event=require('../site/event-project.js'),patch=require('../site/gdscript-string-patch.js'),writer=require('../site/event-writer.js');
const {fixture,enc}=require('./helpers/synthetic-event.cjs'),{diskFS}=require('./helpers/disk-event.cjs'),m=event.manifest;
const data=rows=>rows.map(({speaker,text,left,right,mood})=>({speaker,text,left,right,mood}));
const args=(fs,w,id)=>({project:fs.project,backupParent:fs.backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:w.changes,lines:w.lines,structureChanged:w.hasStructuralChanges,workspace:w,uuid:()=>id});
async function save(fs,w,id){const token=await writer.prepare(args(fs,w,id));w.saved((await writer.apply(token,{project:fs.project,permissionGranted:true})).bytes);return fs.backup.getDirectoryHandle(token.backupName);}
async function restore(fs,w,backupDirectory){const review=await writer.reviewRestore({project:fs.project,backupDirectory,originalBytes:w.originalBytes,entryBytes:w.entryBytes}),token=await writer.prepareRestore(review);w.saved((await writer.apply(token,{project:fs.project,permissionGranted:true})).bytes);return review;}

test('real isolated disk: full casting, structure, two saves, mixed syntax and structured restore retain other events',async t=>{
 const files=fixture(),fs=await diskFS(files);t.after(()=>fs.cleanup());let w=await event.fromHandle(fs.project);assert.deepEqual(w.plan().bytes,files[m.sourcePath]);assert.equal(w.changes.length,0);
 w.insert(0);w.set(0,'新增顾飞雪对白');w.setPerformance(0,'speaker','顾飞雪');w.setPerformance(0,'left','顾清寒');w.setPerformance(0,'mood','shy');w.duplicate(3);w.move(4,-1);w.remove(6);
 const desired=data(w.lines),planned=w.plan();assert.deepEqual(planned.bytes.slice(0,planned.edits[0].start),files[m.sourcePath].slice(0,planned.edits[0].start));
 const originalBackup=await save(fs,w,'first');assert(!w.changes.length);w=await event.fromHandle(fs.project);assert.deepEqual(data(w.lines),desired);assert.equal(w.openingBackground,'BG');assert.equal(w.lines[0].right,'顾飞雪');assert(w.lines.some(r=>r.form==='dictionary'));assert(w.lines.some(r=>r.form==='helper'));
 w.set(0,'再次保存');w.setPerformance(1,'left','顾飞雪');w.setPerformance(1,'right','顾清寒');w.setPerformance(1,'mood','shy');w.move(1,1);const second=data(w.lines),structuredBackup=await save(fs,w,'second');w=await event.fromHandle(fs.project);assert.deepEqual(data(w.lines),second);
 const note=JSON.parse(await (await structuredBackup.getFileHandle('restore.json')).getFile().then(f=>f.text()));assert.equal(note.format,'gcs-event-backup-v2');
 await fs.write(m.sourcePath,enc(patch.decode(await fs.read(m.sourcePath)).replace('保留所有字节','后来修改的其他事件')));w=await event.fromHandle(fs.project);
 await restore(fs,w,structuredBackup);assert.deepEqual(data(w.lines),desired);assert(patch.decode(await fs.read(m.sourcePath)).includes('后来修改的其他事件'));
 await restore(fs,w,originalBackup);assert.deepEqual(data(w.lines),data(event.parse(files).lines));assert.equal(w.openingBackground,'BG');assert(patch.decode(await fs.read(m.sourcePath)).includes('后来修改的其他事件'));assert.deepEqual(new Uint8Array(await fs.read(m.entryPath)),files[m.entryPath]);
});

test('real isolated disk: old v1 backup without hash restores text and can restore original seven after structure edits',async t=>{
 const files=fixture(),fs=await diskFS(files);t.after(()=>fs.cleanup());let w=await event.fromHandle(fs.project);w.set(0,'纯文字');const old=await save(fs,w,'legacy');const h=await old.getFileHandle('restore.json'),note=JSON.parse(await (await h.getFile()).text());assert.equal(note.format,'gcs-event-backup-v1');delete note.sourceHash;const stream=await h.createWritable();await stream.write(enc(JSON.stringify(note)));await stream.close();
 await restore(fs,w,old);assert.deepEqual(new Uint8Array(await fs.read(m.sourcePath)),files[m.sourcePath]);w.insert(0);w.set(0,'新行');w.setPerformance(0,'speaker','顾飞雪');await save(fs,w,'new-structure');await restore(fs,w,old);assert.deepEqual(new Uint8Array(await fs.read(m.sourcePath)),files[m.sourcePath]);
});

test('real isolated disk: external conflict, stale draft and corrupted backup metadata stop commits',async t=>{
 for(const mode of ['source','entry','draft','metadata']){
  const fs=await diskFS(fixture());t.after(()=>fs.cleanup());const w=await event.fromHandle(fs.project);w.duplicate(0);w.setPerformance(1,'speaker','顾飞雪');const token=await writer.prepare(args(fs,w,mode)),before=await fs.read(m.sourcePath);
  if(mode==='source'||mode==='entry')await fs.write(mode==='source'?m.sourcePath:m.entryPath,enc('external'));if(mode==='draft')w.set(1,'变化');if(mode==='metadata'){const h=await (await fs.backup.getDirectoryHandle(token.backupName)).getFileHandle('restore.json'),stream=await h.createWritable();await stream.write(enc('{}'));await stream.close();}
  await assert.rejects(writer.apply(token,{project:fs.project,permissionGranted:true}));assert.deepEqual(await fs.read(m.sourcePath),mode==='source'?Buffer.from('external'):before);
 }
});

test('real isolated disk: post-commit failure rolls back, uncertain third-party state is preserved and locked',async t=>{
 for(const external of [false,true]){const fs=await diskFS(fixture());t.after(()=>fs.cleanup());const w=await event.fromHandle(fs.project),before=await fs.read(m.sourcePath);w.setPerformance(0,'speaker','顾飞雪');w.duplicate(1);const token=await writer.prepare(args(fs,w,'fault'));let once=true;
 fs.setHook(async(at,p)=>{if(at==='after'&&p===fs.sourcePath(m.sourcePath)&&once){once=false;if(external)await fs.write(m.sourcePath,enc('external'));throw Error('故障注入');}});
 await assert.rejects(writer.apply(token,{project:fs.project,permissionGranted:true}),e=>{if(e.recoveryNeeded)w.block();return external?e.recoveryNeeded&&w.blocked:e.recovered;});assert.deepEqual(await fs.read(m.sourcePath),external?Buffer.from('external'):before);
 }
});

test('unsupported narration and ambiguous comments fail before making any backup or disk change',async t=>{
 for(const mode of ['narrator','comment']){const files=fixture();if(mode==='comment')files[m.sourcePath]=enc(patch.decode(files[m.sourcePath]).replace('return out\r\n','return out\r\n\t\t# 归属不明\r\n'));const fs=await diskFS(files);t.after(()=>fs.cleanup());const w=await event.fromHandle(fs.project);if(mode==='narrator')w.setPerformance(0,'speaker','');else w.duplicate(0);await assert.rejects(writer.prepare(args(fs,w,mode)),/清空立绘|注释/);assert.deepEqual(new Uint8Array(await fs.read(m.sourcePath)),files[m.sourcePath]);}
});
