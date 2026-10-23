const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const p=require('../site/gdscript-string-patch.js'),flow=require('../site/event-flow.js'),branches=require('../site/event-branches.js'),contract=require('../site/event-flow-contract.js'),catalog=require('../site/event-catalog.js'),event=require('../site/event-project.js'),writer=require('../site/event-writer.js');
const {fixture,enc}=require('./helpers/synthetic-event.cjs'),{diskFS}=require('./helpers/disk-event.cjs'),{textFixture,find}=require('./helpers/synthetic-text-event.cjs');
const path=catalog.sourcePaths[1],player='scripts/cultivation/ui/cultivation_dialogue_player.gd',host=catalog.entryPaths[0];
function files(){const f=fixture();f[path]=enc(`class_name CultivationStoryEvents
static func get_reed_flat_part1_lines() -> Array[Dictionary]:
 return [
  {"speaker":"甲","text":"公共开场","left":"甲","right":"","mood":"normal"},
  {"type":"choice","prompt":"选择","options":[{"text":"同名","next_label":"a"},{"text":"同名","next_label":"b"}]},
  {"anchor_label":"a","speaker":"甲","text":"相同对白","left":"甲","right":"","mood":"normal"},
  {"type":"choice","prompt":"深入","options":[{"text":"战斗","next_label":"fight"}]},
  {"anchor_label":"fight","type":"combat_trigger","combat_id":"reed_flat"},
  {"anchor_label":"b","speaker":"甲","text":"相同对白","left":"甲","right":"","mood":"normal"},
  {"type":"branch_end"}
 ]
`);f[host]=enc('func begin():\n var lines = CultivationStoryEvents.get_reed_flat_part1_lines()\n');f[player]=enc('func player():\n pass\n');return f;}
const baseline=files();contract.splice(0,contract.length,...[host,player].map(path=>({path,functionName:null,hash:crypto.createHash('sha256').update(JSON.stringify(p.lex(p.decode(baseline[path])).map(t=>[t.kind,t.value,t.prefix]))).digest('hex')})));
const spec=f=>catalog.discover(f).records.find(r=>r.manifest.functionName==='get_reed_flat_part1_lines').manifest;
const saveArgs=(d,w,id)=>({project:d.project,backupParent:d.backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:w.changes,lines:w.lines,structureChanged:w.hasStructuralChanges,workspace:w,uuid:()=>id});
async function save(d,w,id){const token=await writer.prepare(saveArgs(d,w,id)),result=await writer.apply(token,{project:d.project,permissionGranted:true});w.saved(result.bytes);return d.backup.getDirectoryHandle(token.backupName);}

test('graph isolates opening and identical branch texts; combat never falls through to the sibling',()=>{
 const f=files(),g=flow.read(f[path],spec(f)),choice=g.nodes.find(n=>n.kind==='choice'),a=g.nodes.find(n=>n.anchor==='a'),b=g.nodes.find(n=>n.anchor==='b'),combat=g.nodes.find(n=>n.kind==='combat');
 assert.deepEqual(g.edges.filter(e=>e.from===choice.id).map(e=>e.to),[a.id,b.id]);assert.notDeepEqual(a.indices,b.indices);assert(g.nodes.find(n=>n.label.includes('公共开场')).indices.length===1);assert(!g.edges.some(e=>e.from===combat.id&&e.to===b.id));assert.equal(g.edges.filter(e=>e.from===combat.id).length,2);assert(g.nodes.filter(n=>n.kind==='end').every(n=>!g.edges.some(e=>e.from===n.id)));
});
test('numeric targets use zero-based player indexes, never comment titles or nearest dialogue',()=>{
 const f=files();f[path]=enc(p.decode(f[path]).replace('"next_label":"a"','"next":6'));const g=flow.read(f[path],spec(f)),choice=g.nodes.find(n=>n.kind==='choice'),end=g.arrays[0].flowRows[6];assert.equal(end.kind,'end');assert(g.edges.some(e=>e.from===choice.id&&e.to===end.id));
});
test('dynamic options, duplicate labels and dynamic fragments have unknown edges and no structure authority',()=>{
 for(const [from,to] of [['"next_label":"a"','"next_label":runtime_target'],['"anchor_label":"b"','"anchor_label":"a"'],['{"type":"branch_end"}','dynamic_rows']]){const f=files();f[path]=enc(p.decode(f[path]).replace(from,to));const g=flow.read(f[path],spec(f));assert(g.nodes.some(n=>n.kind==='unknown'));assert(!branches.eligible(g,spec(f)));}
});
test('source condition arrays stay separate; skill outcomes preserve exact targets and cannot merge',()=>{
 const f=textFixture(),r=find(f,'create_result'),g=flow.read(f[r.manifest.sourcePath],r.manifest);assert.equal(g.arrays.length,2);assert(g.nodes.some(n=>n.kind==='condition'&&n.label.includes('if victory')));const a=new Set(g.arrays[0].flowRows.map(n=>n.id)),b=new Set(g.arrays[1].flowRows.map(n=>n.id));assert(!g.edges.some(e=>a.has(e.from)&&b.has(e.to)));
 const f2=files();f2[path]=enc(p.decode(f2[path]).replace('"type":"choice","prompt":"选择","options":[{"text":"同名","next_label":"a"},{"text":"同名","next_label":"b"}]','"type":"skill_check","stat":"martial","threshold":15,"success_next":2,"fail_next":5'));const h=flow.read(f2[path],spec(f2)),c=h.nodes.find(n=>n.kind==='condition');assert.deepEqual(h.edges.filter(e=>e.from===c.id).map(e=>e.to),[h.arrays[0].flowRows[2].id,h.arrays[0].flowRows[5].id]);
});
test('mixed text/structure undo, redo, cancellation and future-target guards',async t=>{
 const f=files(),d=await diskFS(f);t.after(()=>d.cleanup());const w=await event.fromHandle(d.project,spec(f));assert(w.branch.enabled);const id=flow.read(w.originalBytes,w.manifest).nodes.find(n=>n.kind==='choice').id,options=w.branch.options(id);w.set(0,'开场改');w.branch.set(id,[options[1],options[0],{text:'新增 # "🌙',targetLabel:'b'}]);assert(w.hasStructuralChanges);assert.equal(w.changes.length,2);w.undo();assert(!w.hasStructuralChanges);w.undo();assert(!w.changes.length);w.redo();w.redo();assert(w.hasStructuralChanges);assert.equal(flow.read(w.plan().bytes,w.manifest).nodes.find(n=>n.id===id).options.length,3);assert.throws(()=>w.branch.set(id,[]));assert.throws(()=>w.branch.set(id,[{text:'x',targetLabel:'absent'}]));w.setLocked(true);assert.throws(()=>w.branch.set(id,options));w.setLocked(false);w.discard();assert(!w.changes.length);
});
test('isolated disk: add/delete/reorder/retarget, dialogue edit, reread, repeated save and scoped restore',async t=>{
 const f=files(),d=await diskFS(f);t.after(()=>d.cleanup());let w=await event.fromHandle(d.project,spec(f));const original=w.texts,g=flow.read(w.originalBytes,w.manifest),id=g.nodes.find(n=>n.kind==='choice').id;
 w.branch.set(id,[{text:'新增去向',targetLabel:'fight'},...w.branch.options(id).reverse()]);const a=g.nodes.find(n=>n.anchor==='a').indices[0],b=g.nodes.find(n=>n.anchor==='b').indices[0];w.set(a,'只改甲分支');const untouched=w.lines[b].text,backup=await save(d,w,'structure');w=await event.fromHandle(d.project,w.manifest);let h=flow.read(w.originalBytes,w.manifest);assert.equal(h.nodes.find(n=>n.id===id).options.length,3);assert.equal(w.lines[h.nodes.find(n=>n.anchor==='b').indices[0]].text,untouched);assert.equal(w.lines[h.nodes.find(n=>n.anchor==='a').indices[0]].text,'只改甲分支');
 w.branch.set(id,w.branch.options(id).slice(1));await save(d,w,'delete');w=await event.fromHandle(d.project,w.manifest);assert.equal(flow.read(w.originalBytes,w.manifest).nodes.find(n=>n.id===id).options.length,2);
 await d.write(path,enc(p.decode(await d.read(path))+'\nstatic func sibling() -> void:\n pass\n'));w=await event.fromHandle(d.project,w.manifest);const review=await writer.reviewRestore({project:d.project,backupDirectory:backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,spec:w.manifest});assert.equal(review.changes[0].kind,'options');const token=await writer.prepareRestore(review);w.saved((await writer.apply(token,{project:d.project,permissionGranted:true})).bytes);assert.deepEqual(w.texts,original);assert(p.decode(await d.read(path)).includes('func sibling'));assert.deepEqual(new Uint8Array(await d.read(host)),f[host]);
});
test('changed runtime, stale structure review and damaged backups stop before committing',async t=>{
 for(const mode of ['host','player','draft','backup']){const f=files(),d=await diskFS(f);t.after(()=>d.cleanup());const w=await event.fromHandle(d.project,spec(f)),id=flow.read(w.originalBytes,w.manifest).nodes.find(n=>n.kind==='choice').id;w.branch.set(id,w.branch.options(id).reverse());const token=await writer.prepare(saveArgs(d,w,mode));if(mode==='host'||mode==='player')await d.write(mode==='host'?host:player,enc('external'));else if(mode==='draft')w.branch.set(id,[{text:'other',targetLabel:'b'}]);else{const h=await (await d.backup.getDirectoryHandle(token.backupName)).getFileHandle('restore.json'),s=await h.createWritable();await s.write(enc('{}'));await s.close();}await assert.rejects(writer.apply(token,{project:d.project,permissionGranted:true}));assert.deepEqual(new Uint8Array(await d.read(path)),f[path]);}
});
test('structural failures roll back and preserve unexpected external changes',async t=>{
 for(const external of [false,true]){const f=files(),d=await diskFS(f);t.after(()=>d.cleanup());const w=await event.fromHandle(d.project,spec(f)),id=flow.read(w.originalBytes,w.manifest).nodes.find(n=>n.kind==='choice').id;w.branch.set(id,w.branch.options(id).reverse());const token=await writer.prepare(saveArgs(d,w,'fault'));let once=true;d.setHook(async(at,name)=>{if(at==='after'&&name===d.sourcePath(path)&&once){once=false;if(external)await d.write(path,enc('external'));throw Error('post commit fault');}});await assert.rejects(writer.apply(token,{project:d.project,permissionGranted:true}),e=>external?e.recoveryNeeded:e.recovered);assert.deepEqual(new Uint8Array(await d.read(path)),external?enc('external'):f[path]);}
});
test('unsupported factories keep text capability while structure remains locked',()=>{const f=textFixture(),w=event.parse(f,find(f).manifest);w.branchVerified=true;assert(!w.branch.enabled);assert.throws(()=>w.branch.set('n0',[]),/锁定/);w.set(0,'仍可改文字');assert(w.plan().bytes.length);});

test('stat requirements have a separate gate; unavailable options never advance to the next branch',()=>{
 const f=files();f[path]=enc(p.decode(f[path]).replace('"next_label":"a"','"next_label":"a","requires_stat":{"stat":"martial","min":16}'));const g=flow.read(f[path],spec(f)),choice=g.nodes.find(n=>n.kind==='choice'),gate=g.nodes.find(n=>n.kind==='condition'),a=g.nodes.find(n=>n.anchor==='a');assert(gate);assert(g.edges.some(e=>e.from===choice.id&&e.to===gate.id));assert(g.edges.some(e=>e.from===gate.id&&e.to===a.id));assert(!g.edges.some(e=>e.from===choice.id&&e.to===a.id));assert.match(gate.fields.requires_stat,/16/);assert(!branches.eligible(g,spec(f)));
});
test('unknown option values and dynamic row types cannot acquire fixed edges',()=>{
 for(const [a,b] of [['{"text":"同名","next_label":"a"}','runtime_option'],['"type":"choice","prompt":"选择"','"type":runtime_type,"prompt":"选择"']]){const f=files();f[path]=enc(p.decode(f[path]).replace(a,b));const g=flow.read(f[path],spec(f));assert(g.nodes.some(n=>n.kind==='unknown'));assert(!branches.eligible(g,spec(f)));}
});
test('every old text slot remains reachable even when append construction has unknown ordering',()=>{
 const f=files();f[path]=enc(`class_name CultivationStoryEvents
static func get_reed_flat_part1_lines() -> Array[Dictionary]:
 var lines: Array[Dictionary] = [{"speaker":"甲","text":"开场"}]
 if runtime_flag:
  lines.append({"speaker":"甲","text":"条件分支"})
 return lines
`);const g=flow.read(f[path],spec(f));assert.equal(g.parsed.lines.length,2);assert.equal(new Set(g.nodes.flatMap(n=>n.indices)).size,2);const unknown=g.nodes.find(n=>n.kind==='unknown'&&n.indices.length);assert(unknown);assert(!g.edges.some(e=>e.to===unknown.id));
});
test('structure preserves BOM/CRLF and restore refuses a changed combat trigger',async t=>{
 const f=files();f[path]=enc('\ufeff'+p.decode(f[path]).replace(/\n/g,'\r\n'));const d=await diskFS(f);t.after(()=>d.cleanup());let w=await event.fromHandle(d.project,spec(f));const id=flow.read(w.originalBytes,w.manifest).nodes.find(n=>n.kind==='choice').id;w.branch.set(id,[...w.branch.options(id).reverse(),{text:'引号 " # 🌙',targetLabel:'b'}]);const backup=await save(d,w,'bom');assert.deepEqual(w.originalBytes.slice(0,3),f[path].slice(0,3));assert(!p.decode(w.originalBytes).replace(/\r\n/g,'').includes('\n'));
 await d.write(path,enc(p.decode(await d.read(path)).replace('"combat_id":"reed_flat"','"combat_id":"other"')));w=await event.fromHandle(d.project,w.manifest);await assert.rejects(writer.reviewRestore({project:d.project,backupDirectory:backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,spec:w.manifest}),/战斗|配置/);
});
