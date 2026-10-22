const {test}=require('node:test'),assert=require('node:assert/strict');
const event=require('../site/event-project.js'),writer=require('../site/event-writer.js');
const {fixture,memoryFS}=require('./helpers/synthetic-event.cjs');
function setup(){const files=fixture(),w=event.parse(files),fs=memoryFS(Object.fromEntries(Object.entries(files).map(([p,b])=>['/project/'+p,b])));return {w,fs,before:files[event.manifest.sourcePath],args:()=>({project:fs.project,backupParent:fs.backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:w.changes,workspace:w,uuid:()=> 'performance-test'})};}

test('four performance fields edit one row independently and count as unsupported dirty drafts',()=>{
 const w=event.parse(fixture()),original=w.lines;w.select(2);
 for(const [key,value] of [['speaker','顾飞雪'],['left','老人'],['right',''],['mood','shy']]){const prior=w.lines[2];w.setPerformance(2,key,value);assert.equal(w.lines[2][key],value);for(const other of ['speaker','left','right','mood'].filter(k=>k!==key))assert.equal(w.lines[2][other],prior[other]);}
 assert.deepEqual(w.lines.filter((_,i)=>i!==2),original.filter((_,i)=>i!==2));assert(w.hasPerformanceChanges);assert(w.hasUnsupportedChanges);assert(!w.hasStructuralChanges);assert.equal(w.changes.filter(c=>c.kind==='performance').length,4);assert.throws(()=>w.plan(),/人物演出/);
 for(let i=0;i<4;i++)w.undo();assert.deepEqual(w.lines,original);assert(!w.changes.length);for(let i=0;i<4;i++)w.redo();assert.equal(w.lines[2].speaker,'顾飞雪');assert.equal(w.lines[2].right,'');
});

test('insert, duplicate, reorder and delete preserve independent per-line performance through history',()=>{
 const w=event.parse(fixture());w.setPerformance(3,'left','顾飞雪');w.setPerformance(3,'mood','shy');const source=w.lines[3];w.insert(3,true);for(const k of ['speaker','left','right','mood'])assert.equal(w.lines[4][k],source[k]);
 w.setPerformance(4,'left','');assert.equal(w.lines[3].left,'顾飞雪');w.duplicate(3);const id=w.lines[4].id;w.setPerformance(4,'right','老人');w.move(4,-1);assert.equal(w.lines[3].id,id);assert.equal(w.lines[3].right,'老人');w.remove(3);w.undo();assert.equal(w.lines[3].id,id);assert.equal(w.lines[3].right,'老人');w.redo();assert(!w.lines.some(l=>l.id===id));w.discard();assert(!w.hasUnsupportedChanges);assert(!w.canRedo);
});

test('restoring all performance fields enables only remaining pure text edits; invalid edits and locks reject',()=>{
 const w=event.parse(fixture()),original=w.lines[0];w.set(0,'文字草稿');w.setPerformance(0,'speaker','');w.setPerformance(0,'mood','shy');assert.throws(()=>w.plan());w.setPerformance(0,'speaker',original.speaker);w.setPerformance(0,'mood',original.mood);assert(!w.hasUnsupportedChanges);assert.equal(w.changes.length,1);assert(w.plan().bytes);
 assert.throws(()=>w.setPerformance(0,'bg','bad'));assert.throws(()=>w.setPerformance(0,'mood',''));assert.throws(()=>w.setPerformance(0,'left',{}));w.setLocked(true);assert.throws(()=>w.setPerformance(0,'left','老人'));w.setLocked(false);w.block();assert.throws(()=>w.setPerformance(0,'right',''));
});

test('each performance field and structural edit blocks writer preparation with zero filesystem writes',async()=>{
 for(const [key,value] of [['speaker',''],['left','老人'],['right',''],['mood','shy']]){const x=setup();x.w.set(0,'文字草稿');x.w.setPerformance(0,key,value);await assert.rejects(writer.prepare(x.args()));assert.equal(x.fs.writes.length,0);assert.deepEqual(x.fs.data.get('/project/'+event.manifest.sourcePath),x.before);}
 const x=setup();x.w.set(0,'文字草稿');x.w.insert(0);await assert.rejects(writer.prepare(x.args()));assert.equal(x.fs.writes.length,0);
});

test('guarded text review rejects later performance changes even when caller passes only captured text changes',async()=>{
 const x=setup();x.w.set(0,'纯文字');const args=x.args();x.w.setPerformance(0,'mood','shy');await assert.rejects(writer.prepare(args),/人物演出/);assert.equal(x.fs.writes.length,0);
});

test('prepared text job and staging both recheck current draft before commit',async()=>{
 for(const phase of ['before','stage']){const x=setup();x.w.set(0,'纯文字');const token=await writer.prepare(x.args());if(phase==='before')x.w.setPerformance(0,'right','');else x.fs.setHook((at,p)=>{if(at==='write'&&p==='/project/'+event.manifest.sourcePath)x.w.setPerformance(0,'mood','shy');});await assert.rejects(writer.apply(token,{project:x.fs.project,permissionGranted:true}),/人物演出/);assert.deepEqual(x.fs.data.get('/project/'+event.manifest.sourcePath),x.before);if(phase==='before')assert(!x.fs.writes.some(p=>p.startsWith('/project/')));}
});

test('pure text continues through guarded backup and write pipeline',async()=>{
 const x=setup();x.w.set(1,'纯文字');const token=await writer.prepare(x.args()),result=await writer.apply(token,{project:x.fs.project,permissionGranted:true});assert.equal(event.parse({[event.manifest.sourcePath]:result.bytes,[event.manifest.entryPath]:x.w.entryBytes}).texts[1],'纯文字');
});
