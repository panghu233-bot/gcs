const {test}=require('node:test'),assert=require('node:assert/strict');
const flow=require('../site/event-flow.js'),catalog=require('../site/event-catalog.js');
const {textFixture,source,entry}=require('./helpers/synthetic-text-event.cjs'),{enc}=require('./helpers/synthetic-event.cjs');
function sample(){const files=textFixture();files[source]=enc(new TextDecoder().decode(files[source])+`
class EntryEvent:
 var title: String = ""
 var lines: Array[Dictionary] = []
 static func create_event() -> EntryEvent:
  var e := EntryEvent.new()
  e.title = "合成入口选择"
  e.lines = [
   {"speaker":"甲","text":"开场一"},
   {"speaker":"乙","text":"开场二"},
   {"speaker":"甲","text":"开场三"},
   {"speaker":"乙","text":"开场四"},
   {"speaker":"甲","text":"开场五"},
   {"type":"choice","prompt":"是否帮助？","options":[{"text":"帮助","next":6},{"text":"拒绝","next":8}]},
   {"speaker":"甲","text":"帮助分支一"},
   {"speaker":"乙","text":"帮助分支二"},
   {"type":"branch_end"},
   {"speaker":"甲","text":"未接入的拒绝对白一"},
   {"speaker":"乙","text":"未接入的拒绝对白二"},
   {"type":"branch_end"}
  ]
  return e
`);files[entry]=enc('func begin():\n var event = CultivationData.EntryEvent.create_event()\n');const spec=catalog.discover(files).records.find(r=>r.manifest.className==='EntryEvent').manifest;return {files,spec,graph:flow.read(files[source],spec)};}
test('confirmed entry starts with all five opening lines before the choice',()=>{const {graph:g}=sample();assert.equal(g.entryId,g.arrays[0].flowRows[0].id);assert.equal(g.entryConfirmed,true);assert.deepEqual(g.nodes.find(n=>n.id===g.entryId).indices,[0,1,2,3,4]);});
test('orphan branch cannot occupy the opening rank or become another entry',()=>{const {graph:g}=sample(),layout=require('../site/event-flow-layout.js').layout(g),choice=g.nodes.find(n=>n.kind==='choice'),orphan=g.nodes.find(n=>n.label.includes('未接入的拒绝对白'));assert(layout.detached.includes(orphan.id));assert(!layout.positions.has(orphan.id));assert.deepEqual([...layout.positions].filter(([,p])=>p.level===0).map(([id])=>id),[g.entryId]);assert(layout.positions.get(choice.id).level>layout.positions.get(g.entryId).level);for(const id of layout.main.filter(id=>id!==g.entryId&&id!==choice.id))assert(layout.positions.get(id).level>layout.positions.get(choice.id).level);});
test('a later disconnected cycle is separate; a reachable back edge keeps the actual entry at the top',()=>{const g={entryId:'start',entryConfirmed:true,nodes:['start','choice','a','end','orphan'].map(id=>({id})),edges:[{from:'start',to:'choice'},{from:'choice',to:'a'},{from:'a',to:'choice'},{from:'a',to:'end'},{from:'orphan',to:'orphan'}]},l=require('../site/event-flow-layout.js').layout(g);assert.equal(l.positions.get('start').level,0);assert(l.positions.get('choice').level>0);assert(l.positions.get('end').level>l.positions.get('a').level);assert.deepEqual(l.detached,['orphan']);assert(l.backEdges.some(e=>e.from==='a'&&e.to==='choice'));});
test('unknown entry and changed runtime never manufacture a main playback sequence',()=>{const {graph:g}=sample(),layout=require('../site/event-flow-layout.js').layout;for(const l of [layout({...g,entryConfirmed:false}),layout(g,{verified:false})]){assert.equal(l.main.length,0);assert.equal(l.detached.length,g.nodes.length);assert.equal(l.positions.size,0);}});
test('shared target ranks below every incoming option; sibling order follows the choice order',()=>{const g={entryId:'start',entryConfirmed:true,nodes:['start','choice','right','left','middle','merge','end'].map(id=>({id})),edges:[{from:'start',to:'choice'},{from:'choice',to:'left'},{from:'choice',to:'right'},{from:'left',to:'middle'},{from:'middle',to:'merge'},{from:'right',to:'merge'},{from:'merge',to:'end'}]},l=require('../site/event-flow-layout.js').layout(g);assert(l.positions.get('left').x<l.positions.get('right').x);assert(l.positions.get('merge').level>l.positions.get('middle').level);assert(l.positions.get('merge').level>l.positions.get('right').level);});
module.exports={sample};
