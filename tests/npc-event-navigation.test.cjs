const test=require('node:test'),assert=require('node:assert/strict'),npc=require('../site/npc-project.js');
const source='scripts/cultivation/cultivation_data.gd';
const event={source,function:'First.create_lines',eventId:'',dialogues:[]};
const record=(id,owner='First',fn='create_lines',path=source)=>({manifest:{id,className:owner,functionName:fn,sourcePath:path,title:'同名故事'},lines:[]});
test('resolve exact source scope, never title or function alone',()=>{
 assert.deepEqual(npc.resolveEventTarget(event,[record('right'),record('other','Second')]),{id:'right'});
 assert.equal(npc.resolveEventTarget(event,[record('wrong','First','create_lines','other.gd')]),null);
 assert.equal(npc.resolveEventTarget(event,[record('a'),record('b')]),null);
 assert.equal(npc.resolveEventTarget({...event,eventId:'conflict'},[{...record('a'),rawSource:'e.event_id = &"different"'}]),null);
});
test('merged helper uses owning scope; absent or ambiguous scope keeps details only',()=>{
 assert.deepEqual(npc.resolveEventTarget({...event,sections:[{source,function:'First._helper'}]},[record('right'),record('helper','First','_helper')]),{id:'right'});
 assert.equal(npc.resolveEventTarget({...event,function:'Unknown.create_event'},[record('right')]),null);
});

test('source-backed NPC condition constant maps the exact shared source',()=>{
 const records=npc.indexFromSources({visuals:'const SPEAKER_PORTRAIT_MAP := {}',data:'class Encounter:\n const NPC_A := &"alpha"\n static func get_dialogue_lines(npc_id: StringName) -> Array[Dictionary]:\n  match npc_id:\n   NPC_A:\n    return [{"speaker":"测试人物","text":"问候"}]',enemies:'{"enemies":[]}'});
 const e=records.find(n=>n.name==='测试人物').events[0];assert.equal(e.caseValue,'alpha');
 assert.deepEqual(npc.resolveEventTarget(e,[record('shared','Encounter','get_dialogue_lines')]),{id:'shared',caseValue:'alpha'});
});
