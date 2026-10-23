const {test}=require('node:test'),assert=require('node:assert/strict');
const event=require('../site/event-project.js'),catalog=require('../site/event-catalog.js'),patch=require('../site/gdscript-string-patch.js'),writer=require('../site/event-writer.js');
const {fixture,enc}=require('./helpers/synthetic-event.cjs'),{diskFS}=require('./helpers/disk-event.cjs');
const {multi,find,source,story,entry}=require('./helpers/synthetic-multi-event.cjs');
const clean=w=>w.lines.map(({speaker,text,left,right,mood})=>({speaker,text,left,right,mood}));
async function save(fs,w,id){const token=await writer.prepare({project:fs.project,backupParent:fs.backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:w.changes,lines:w.lines,structureChanged:w.hasStructuralChanges,workspace:w,uuid:()=>id.replaceAll('_','-')});w.saved((await writer.apply(token,{project:fs.project,permissionGranted:true})).bytes);return fs.backup.getDirectoryHandle(token.backupName);}
async function restore(fs,w,backupDirectory){const r=await writer.reviewRestore({project:fs.project,backupDirectory,originalBytes:w.originalBytes,entryBytes:w.entryBytes,spec:w.manifest});const token=await writer.prepareRestore(r);w.saved((await writer.apply(token,{project:fs.project,permissionGranted:true})).bytes);return r;}
test('catalog discovers scopes, shared helper rows, direct arrays and real entry evidence; branches fail closed',()=>{
 const files=multi(),r=catalog.discover(files);assert.equal(r.records.length,5);assert.equal(r.records.filter(x=>x.capability==='full').length,4);
 const day=find(files,'create_day_lines');assert(day.editable,day.reason);assert.equal(day.lines[0].right,'顾清寒');assert.equal(day.lines[0].mood,'shy');assert.equal(day.lines[1].mood,'normal');assert(day.lines.every(l=>l.token.start<patch.decode(files[source]).indexOf('static func create_night_lines')));
 assert.match(find(files,'create_branch_lines').reason,/分支/);const missing={...files};delete missing[entry];assert.match(find(missing,'create_day_lines').reason,/入口/);
});
test('static reader rejects helper logic, duplicate constants, dynamic fields, unknown fields and comments',()=>{
 const originals=multi(),text=patch.decode(originals[source]);for(const [a,b] of [
 ['return {"speaker": speaker','if true: return {"speaker": speaker'],
 ['const PORTRAIT := "顾清寒"','const PORTRAIT := "顾清寒"\n const PORTRAIT := "顾飞雪"'],
 ['_duo("顾清寒", "合成白天", "shy")','_duo("顾清寒", translate("合成白天"), "shy")'],
 ['"mood": mood}','"mood": mood, "next": 3}'],
 ['out.append(_duo("顾清寒"','# attached\n  out.append(_duo("顾清寒"']
 ]){const f={...originals,[source]:enc(text.replace(a,b))};assert(!find(f,'create_day_lines').editable,b);}
});
test('isolated disk: shared helper and literal array support full edits, repeated saves, scoped restore and other-event preservation',async t=>{
 for(const name of ['create_day_lines','create_night_lines','get_result_lines']){const files=multi(),fs=await diskFS(files);t.after(()=>fs.cleanup());const spec=find(files,name).manifest;let w=await event.fromHandle(fs.project,spec),original=clean(w);
 w.duplicate(0);w.set(1,'合成新增');w.insert(0);w.set(0,'合成插入');w.setPerformance(0,'speaker','顾飞雪');w.setPerformance(0,'left','顾清寒');w.setPerformance(0,'right','顾飞雪');w.setPerformance(0,'mood','shy');w.move(0,1);w.remove(w.lines.length-1);const desired=clean(w),plan=w.plan();assert.equal(plan.kind,'function-body');const before=files[spec.sourcePath];assert.deepEqual(plan.bytes.slice(0,plan.edits[0].start),before.slice(0,plan.edits[0].start));
 const backup=await save(fs,w,'first-'+name);w=await event.fromHandle(fs.project,spec);assert.deepEqual(clean(w),desired);w.set(0,'合成再次保存');await save(fs,w,'second-'+name);
 if(spec.sourcePath===source){await fs.write(source,enc(patch.decode(await fs.read(source)).replace('合成夜晚','其他事件后来变化')));w=await event.fromHandle(fs.project,spec);}
 await restore(fs,w,backup);assert.deepEqual(clean(w),name==='create_night_lines'?original.map(r=>({...r,text:'合成夜晚'})):original);if(name==='create_day_lines')assert(patch.decode(await fs.read(source)).includes('其他事件后来变化'));
 assert.deepEqual(new Uint8Array(await fs.read(entry)),files[entry]);
 }
});
test('cross-event backups, invented write scopes and readonly event writes fail before mutation',async t=>{
 const files=multi(),fs=await diskFS(files);t.after(()=>fs.cleanup());const day=find(files,'create_day_lines').manifest,night=find(files,'create_night_lines').manifest;let w=await event.fromHandle(fs.project,day);w.set(0,'改变');const backup=await save(fs,w,'day');const other=await event.fromHandle(fs.project,night);await assert.rejects(writer.reviewRestore({project:fs.project,backupDirectory:backup,originalBytes:other.originalBytes,entryBytes:other.entryBytes,spec:night}),/事件|路径/);
 for(const spec of [{...day,sourcePath:'private.gd'},{...find(files,'create_branch_lines').manifest,adapter:'static'},{...day,className:'Other'}])assert.throws(()=>event.parse(files,spec),/只读|映射|事件/);
 const readonly=await event.fromHandle(fs.project);const r=readonly.selectEvent(find(files,'create_branch_lines').manifest.id);assert(r.textOnly);assert.throws(()=>r.duplicate(0),/锁定/);r.set(0,'合成选择改字');assert.equal(r.plan().kind,'text');
});
test('multi-event snapshots reuse portraits, synchronize saved file bytes across switches and protect locked selection',async t=>{
 const files=multi(),fs=await diskFS(files);t.after(()=>fs.cleanup());let w=await event.fromHandle(fs.project);assert.equal(w.eventRecords.length,5);const dayId=find(files,'create_day_lines').manifest.id,nightId=find(files,'create_night_lines').manifest.id;w=w.selectEvent(dayId);const performance=w.performance;w.set(0,'合成新白天');await save(fs,w,'switched');w=w.selectEvent(nightId);assert.equal(w.performance,performance);w=w.selectEvent(dayId);assert.equal(w.lines[0].text,'合成新白天');assert(!w.changes.length);w.setLocked(true);assert.throws(()=>w.selectEvent(nightId),/锁定/);w.setLocked(false);w.block();assert.throws(()=>w.selectEvent(nightId),/锁定/);w.release();
});
module.exports={multi,find};

test('file-list mode discovers Dialogic as source-only readonly and excludes unrelated files',async()=>{
 const files=multi(),extra={'timeline/vn1/chapter.dtl':enc('join Synthetic\nSynthetic: Test local only'),'private/secret.txt':enc('do not read')},reads=[];
 const list=Object.entries({...files,...extra}).map(([path,bytes])=>({webkitRelativePath:'project/'+path,size:bytes.length,arrayBuffer:async()=>{reads.push(path);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);},text:async()=>{reads.push(path);return patch.decode(bytes);}}));
 const w=await event.fromFileList(list);assert.equal(w.eventRecords.length,6);const timeline=w.selectEvent('timeline/vn1/chapter.dtl');assert(timeline.readOnly);assert.match(timeline.reason,/Dialogic/);assert.match(timeline.rawSource,/Synthetic/);assert(!reads.includes('private/secret.txt'));timeline.release();
});

test('static text patch preserves BOM, CRLF, helper source and other event bytes',()=>{
 const files=multi();files[source]=enc('\ufeff'+patch.decode(files[source]).replace(/\r?\n/g,'\r\n'));const spec=find(files,'create_day_lines').manifest,w=event.parse(files,spec),before=files[source];w.set(0,'引号 " \\ 换行\n🌙');const plan=w.plan();assert.equal(plan.kind,'text');assert.equal(plan.edits.length,1);assert.deepEqual(plan.bytes.slice(0,plan.edits[0].start),before.slice(0,plan.edits[0].start));assert.equal(event.parse({...files,[source]:plan.bytes},spec).lines[0].text,'引号 " \\ 换行\n🌙');
});

test('readonly writes and changed shared-helper restores are refused before opening a target stream',async t=>{
 const files=multi(),disk=await diskFS(files);t.after(()=>disk.cleanup());const spec=find(files,'create_day_lines').manifest,w=await event.fromHandle(disk.project,spec);w.duplicate(0);const backup=await save(disk,w,'before-helper');const before=await disk.read(source);await disk.write(source,enc(patch.decode(before).replace('"left": "顾飞雪"','"left": "顾清寒"')));const current=await event.fromHandle(disk.project,spec);
 await assert.rejects(writer.reviewRestore({project:disk.project,backupDirectory:backup,originalBytes:current.originalBytes,entryBytes:current.entryBytes,spec}),/辅助函数|配置/);
 const branch=find(files,'create_branch_lines').manifest;await assert.rejects(writer.prepare({project:disk.project,backupParent:disk.backup,spec:branch,originalBytes:files[source],entryBytes:files[entry],changes:[{index:0,before:'a',after:'b'}]}),/身份|来源|原文/);
 assert.deepEqual(await disk.read(source),Buffer.from(current.originalBytes));
});

test('changed countdown entry becomes readonly without disabling other editable events',async t=>{
 const files=multi(),legacy=event.manifest;files[legacy.entryPath]=enc(patch.decode(files[legacy.entryPath])+'\n\tpass\n');const disk=await diskFS(files);t.after(()=>disk.cleanup());const records=catalog.discover(files).records;assert(!records.find(r=>r.manifest.id===legacy.id).editable);assert(records.find(r=>r.manifest.functionName==='create_day_lines').editable);const w=await event.fromHandle(disk.project);assert(!w.readOnly);assert.notEqual(w.manifest.id,legacy.id);w.release();
});
