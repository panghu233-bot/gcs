const {test}=require('node:test'),assert=require('node:assert/strict');
const performance=require('../site/event-performance.js'),event=require('../site/event-project.js');
const {fixture,enc}=require('./helpers/synthetic-event.cjs');
const visuals='const PORTRAIT_BASE_PATH := "res://assets/portraits/"\nconst SPEAKER_PORTRAIT_MAP: Dictionary = {"顾清寒":"hero", "顾飞雪":"mother", "老人":"npc"}\nconst SPEAKER_FILENAME_MAP: Dictionary = {"老人":"old_man"}\nfunc load_portrait_for_speaker():\n filename = mood\n';
const player='func _apply_portrait_override(\n left_override: String,\n right_override: String\n):\n left_mood = "normal" if left_override != "顾清寒" else mood\n right_mood = "normal" if right_override != "顾清寒" else mood\n';
const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
function setup(overrides={}){
 const files=new Map([[performance.paths.visuals,new Blob([visuals])],[performance.paths.player,new Blob([player])],['assets/portraits/hero/normal.png',new Blob([png])],['assets/portraits/hero/shy.png',new Blob([png])],['assets/portraits/mother/normal.png',new Blob([png])],['assets/portraits/npc/old_man.png',new Blob([png])]]);
 const reads=[],made=[],revoked=[];const p=performance.create({read:async path=>{reads.push(path);return files.get(path)||null;},makeUrl:f=>{const url='blob:local-'+made.length;made.push({f,url});return url;},revokeUrl:u=>revoked.push(u),...overrides});return {p,files,reads,made,revoked};
}

test('normal/shy use real local PNGs, keep empty left and reuse URLs without enumerating action images',async()=>{
 const x=setup();assert.equal(x.reads.length,0);
 const normal=await x.p.load({left:'',right:'顾清寒',mood:'normal'}),shy=await x.p.load({left:'',right:'顾清寒',mood:'shy'});
 assert(normal.left.empty);assert.equal(shy.right.path,'assets/portraits/hero/shy.png');assert.equal(shy.right.mood,'shy');assert.notEqual(shy.right.image,normal.right.image);
 const again=await x.p.load({right:'顾清寒',mood:'normal'});assert.equal(again.right.image,normal.right.image);assert.equal(x.made.length,2);
 for(const mood of ['attack','fishing','practice_guqin']){const r=await x.p.load({right:'顾清寒',mood});assert(!r.right.image);assert.match(r.right.error,/动作/);}
 assert(!x.reads.some(p=>/attack|fishing|practice_guqin/.test(p)));x.p.release();assert.equal(x.revoked.length,2);x.p.release();assert.equal(x.revoked.length,2);await assert.rejects(x.p.load({}),/释放/);
});

test('mother and NPC use fixed normal portraits; missing files and fallback are explicit',async()=>{
 const x=setup();const r=await x.p.load({left:'顾飞雪',right:'老人',mood:'shy'});assert.equal(r.left.path,'assets/portraits/mother/normal.png');assert.equal(r.right.path,'assets/portraits/npc/old_man.png');assert.equal(r.right.mood,'normal');assert(r.right.fixed);
 const missing=await x.p.load({right:'未知人物',mood:'normal'});assert.match(missing.right.error,/未识别/);assert(!missing.right.image);
 const y=setup();y.files.delete('assets/portraits/hero/shy.png');const fallback=await y.p.load({right:'顾清寒',mood:'shy'});assert.equal(fallback.right.mood,'normal');assert.match(fallback.right.warning,/回退/);
 const z=setup();z.files.delete('assets/portraits/npc/old_man.png');const absent=await z.p.load({right:'老人'});assert.match(absent.right.error,/缺失/);assert(!absent.right.image);
});

test('changed runtime rules, unsafe paths, malformed PNG and released pending loads fail closed',async()=>{
 assert.throws(()=>performance.rules(visuals,player.replaceAll('顾清寒','其他人物')),/规则已变化/);
 for(const path of ['res://assets/../secret.png','https://example.com/portrait.png','res://assets/x/../../private.png'])assert.throws(()=>performance.safePath(path));
 const x=setup();x.files.set('assets/portraits/hero/normal.png',new Blob(['bad PNG']));await assert.rejects(x.p.load({right:'顾清寒'}),/PNG/);assert.equal(x.made.length,0);
 let resume;const y=setup({read:path=>path===performance.paths.visuals?new Promise(r=>resume=r):Promise.resolve(new Blob([player]))});const pending=y.p.load({right:'顾清寒'});y.p.release();resume(new Blob([visuals]));await assert.rejects(pending,/释放/);assert.equal(y.made.length,0);
});

test('folder and file-list event readers attach lazy preview without reading any portrait until requested',async()=>{
 const files=fixture(),reads=[];
 function dir(prefix=''){return {getDirectoryHandle:async n=>dir(prefix+n+'/'),getFileHandle:async n=>({getFile:async()=>{const path=prefix+n;reads.push(path);if(!files[path])throw Object.assign(Error('missing'),{name:'NotFoundError'});return new Blob([files[path]]);}})};}
 const w=await event.fromHandle(dir());assert(w.performance);assert.deepEqual(reads,[...require('../site/event-catalog.js').paths,performance.paths.player]);assert(!reads.some(p=>p.startsWith('assets/')));w.release();
 const list=Object.entries(files).map(([path,bytes])=>{const b=new Blob([bytes]);b.webkitRelativePath='game/'+path;return b;});const other=await event.fromFileList(list);assert(other.performance);other.release();
});


test('edit choices come from actual mappings and present ordinary PNGs; NPC portraits stay fixed',async()=>{
 const x=setup();x.files.set('assets/portraits/hero/attack.png',new Blob([png]));x.files.set('assets/portraits/hero/fishing.png',new Blob([png]));
 const c=await x.p.choices({left:'',right:'顾清寒'});assert.deepEqual([...c.names].sort(),['顾清寒','顾飞雪','老人'].sort());assert.deepEqual(c.moods,['normal','shy']);assert(c.moodEnabled);assert.equal(x.made.length,0);
 const n=await x.p.choices({speaker:'顾清寒',left:'老人',right:'顾飞雪'});assert.deepEqual(n.moods,['normal']);assert(!n.moodEnabled);assert(!x.reads.some(p=>/attack|fishing/.test(p)));
 const r=await x.p.load({speaker:'老人',left:'顾清寒',right:'顾飞雪',mood:'shy'});assert.equal(r.left.path,'assets/portraits/hero/shy.png');assert.equal(r.right.path,'assets/portraits/mother/normal.png');
 const y=setup();y.files.delete('assets/portraits/hero/shy.png');assert.deepEqual((await y.p.choices({right:'顾清寒'})).moods,['normal']);
});


test('speaker synchronization immediately resolves the new solo character portrait and undo restores it',async()=>{
 const x=setup(),w=event.parse(fixture());w.setPerformance(0,'speaker','顾清寒');const original=w.lines[0];w.setPerformance(0,'speaker','顾飞雪');assert.equal(w.lines[0].right,'顾飞雪');let preview=await x.p.load(w.lines[0]);assert.equal(preview.right.path,'assets/portraits/mother/normal.png');assert(preview.left.empty);
 w.undo();assert.deepEqual(w.lines[0],original);preview=await x.p.load(w.lines[0]);assert.equal(preview.right.path,'assets/portraits/hero/normal.png');w.redo();assert.equal(w.lines[0].right,'顾飞雪');x.p.release();
});
