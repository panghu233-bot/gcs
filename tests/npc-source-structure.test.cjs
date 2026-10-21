'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const reader=require('../site/npc-project.js');
const source=()=>({
 visuals:`const PORTRAIT_BASE_PATH := "res://assets/cultivation/portraits/"
const SPEAKER_PORTRAIT_MAP: Dictionary = {"甲乙":"npc", "甲掌柜":"npc", "甲公子":"npc"}
const SPEAKER_FILENAME_MAP: Dictionary = {"甲乙":"旧版/alpha", "甲掌柜":"旧版/shop"}`,
 data:`class TeahouseNpcEncounter:
 const NPC_ALPHA := &"alpha"
 static func get_display_name(npc_id: StringName) -> String:
  match npc_id:
   NPC_ALPHA:
    return "甲乙"
 static func get_dialogue_lines(npc_id: StringName) -> Array[Dictionary]:
  match npc_id:
   NPC_ALPHA:
    return [{"speaker":"甲乙","text":"问候","left":"甲乙","right":"甲公子"}]
const HERO_AFFINITY_CONFIG := {"alpha":{"preferred_gift":"gift_a","affection_init":23,"blessing_id":"bless_a","blessing_name":"祝福甲"}}
class ShopEvent:
 static func create_event() -> Dictionary:
  var e = {}
  e.event_id = &"shop_a"
  e.title = "商店事件"
  e.lines = [{"speaker":"甲掌柜","text":"欢迎"},{"speaker":"甲公子","text":"你好"}]
  return e`,
 manager:`const TEAHOUSE_AFFECTION_INITIAL := 23
const TEAHOUSE_AFFECTION_ENCOUNTER_GAIN := 7
const TEAHOUSE_AFFECTION_BLESSING_THRESHOLD := 62
func give_gift(hero_id, gift_id):
 var gain := int(CultivationData.HERO_AFFINITY_CONFIG[hero_id].get("affection_from_gift", 8))
func _build_teahouse_npc_encounter_pool(day):
 if day < 4 or day > 12:
  return []
 var pool = []
 if _quest_done:
  pool.append(CultivationData.TeahouseNpcEncounter.NPC_ALPHA)
 return pool`,
 story:'',commission:'',enemies:JSON.stringify({enemies:[{id:'a',name:'甲掌柜',max_hp:31},{id:'b',name:'甲掌柜',max_hp:42}]})
});
test('split folder/filename maps, source-backed hero IDs and distinct identities',()=>{
 const records=reader.indexFromSources(source()),hero=records.find(n=>n.name==='甲乙');
 assert.equal(hero.portraitRef,'res://assets/cultivation/portraits/npc/旧版/alpha.png');
 assert.equal(hero.npcKind,'hero');
 assert.equal(hero.hero.id,'alpha');
 assert.equal(hero.hero.config.preferred_gift,'gift_a');
 assert.ok(hero.hero.rules.some(r=>r.name==='give_gift'&&r.code.includes('8')));
 assert.ok(records.find(n=>n.name==='甲掌柜'));
 assert.ok(records.find(n=>n.name==='甲公子'));
});
test('event function, literal title, dialogue and all exact enemy definitions survive',()=>{
 const p=reader.indexFromSources(source()).find(n=>n.name==='甲掌柜');
 assert.ok(p.events.some(e=>e.eventId==='shop_a'&&e.title==='商店事件'&&e.dialogues[0].text==='欢迎'));
 assert.deepEqual(p.enemies.map(e=>e.id),['a','b']);
});
test('local Unicode resource path resolves through the folder handle and revokes URLs',async()=>{
 const src=source(),reads=[],made=[],revoked=[];
 const handle={async getDirectoryHandle(name,opts){assert.equal(opts.create,false);return tree(this.path?this.path+'/'+name:name);},path:''};
 function tree(path){return {...handle,path,async getFileHandle(name,opts){assert.equal(opts.create,false);const key=path+'/'+name;reads.push(key);let body=Object.entries(reader.paths).find(([,v])=>v===key);if(body)return {getFile:async()=>new Blob([src[body[0]]||''])};if(key==='assets/cultivation/portraits/npc/旧版/alpha.png')return {getFile:async()=>new Blob(['image'])};throw Object.assign(Error('missing'),{name:'NotFoundError'});}};}
 const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
 URL.createObjectURL=f=>{made.push(f);return 'blob:local-'+made.length;};URL.revokeObjectURL=u=>revoked.push(u);
 try{const result=await reader.fromHandle(tree(''));assert.equal(result.records.find(n=>n.name==='甲乙').image,'blob:local-1');result.release();assert.deepEqual(revoked,['blob:local-1']);assert.ok(reads.includes(reader.paths.manager));}finally{URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}
});
test('comments never create people or impersonate hero configuration',()=>{
 const s=source();s.visuals+='\n# "假人物": "res://assets/fake.png"';s.data+='\n# "假人物": {"speaker":"假人物"}';
 assert.ok(!reader.indexFromSources(s).some(n=>n.name==='假人物'));
});

test('match branches keep each hero dialogue separate, including narration',()=>{
 const s=source();s.data=s.data.replace('NPC_ALPHA:\n    return [{"speaker":"甲乙","text":"问候","left":"甲乙","right":"甲公子"}]', 'NPC_ALPHA:\n    return [{"speaker":"","text":"旁白甲"},{"speaker":"甲乙","text":"问候"}]\n   NPC_BETA:\n    return [{"speaker":"甲公子","text":"另一分支"}]');
 const records=reader.indexFromSources(s),hero=records.find(n=>n.name==='甲乙');
 const event=hero.events.find(e=>e.function.includes('get_dialogue_lines'));
 assert.match(event.function,/NPC_ALPHA/);
 assert.deepEqual(event.dialogues.map(d=>d.text),['旁白甲','问候']);
 assert.ok(!event.references.includes('甲公子'));
});
test('filename similarity alone does not assign hero identity',()=>{
 const s=source();s.data='const HERO_AFFINITY_CONFIG := {"alpha":{"affection_init":23}}';
 assert.equal(reader.indexFromSources(s).find(n=>n.name==='甲乙').hero,null);
});
test('literal runtime rules and multiline function signatures retain source evidence',()=>{
 const s=source();s.manager=s.manager.replace('func give_gift(hero_id, gift_id):','func give_gift(\n hero_id,\n gift_id\n):');
 const h=reader.indexFromSources(s).find(n=>n.name==='甲乙').hero;
 assert.equal(h.runtime.giftGain,8);assert.equal(h.runtime.preferredGiftRead,false);
 assert.deepEqual([h.runtime.dayStart,h.runtime.dayEnd],[4,12]);
 assert.match(h.runtime.encounterCondition,/_quest_done/);
});
test('partial image allocation failure releases already allocated local URLs',async()=>{
 const s={...source(),visuals:'const MAP={"甲乙":"res://assets/a.png","甲丙":"res://assets/b.png"}',data:''};
 const files=Object.entries(reader.paths).map(([k,p])=>({webkitRelativePath:'root/'+p,size:1,text:async()=>s[k]||''}));
 for(const name of ['a','b'])files.push({webkitRelativePath:'root/assets/'+name+'.png',size:1});
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL,freed=[];let count=0;
 URL.createObjectURL=()=>{if(++count===2)throw Error('allocation failed');return 'blob:first';};URL.revokeObjectURL=u=>freed.push(u);
 try{await assert.rejects(reader.fromFileList(files),/allocation failed/);assert.deepEqual(freed,['blob:first']);}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});
