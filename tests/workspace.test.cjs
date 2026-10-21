const {test}=require('node:test'),assert=require('node:assert/strict');
const adapter=require('../site/ninggu-adapter.js'),{createWorkspace}=require('../site/card-workspace.js');
const fixture=()=>({cards:{starter_deck:['example'],future:{keep:[1,null]},cards:[{id:'example',name:'Example',cost:1,damage:5,block:0,hits:1,unknown:{nested:[true,'keep']},upgrade_mystery:9},{id:'x',name:'X',cost:-1,x_cost:true}]},branches:{future:'keep',branches:{example:[{id:'variant',name:'Variant',description:'Keep verbatim',modifiers:{damage:2,exhaust:true,unknown:{nested:'preserve'}}}]}}});
test('editable work copy keeps original roots, unknown data and identifiers unchanged',()=>{
 const docs=fixture(),before=JSON.stringify(docs),w=createWorkspace({adapter,documents:docs});w.edit('example','damage','9');w.edit('example','name','Renamed');w.edit('example','damage','4','variant');w.validate();
 assert.equal(JSON.stringify(docs),before);assert.equal(w.changes.length,3);assert.equal(w.records[0].value.damage,9);assert.equal(adapter.preview(w.records[0],w.branches.example[0]).final.damage,13);
 assert.deepEqual(w.documents.cards.future,docs.cards.future);assert.deepEqual(w.documents.cards.cards[0].unknown,docs.cards.cards[0].unknown);assert.deepEqual(w.documents.branches.branches.example[0].modifiers.unknown,{nested:'preserve'});
 assert.equal(w.documents.branches.branches.example[0].description,'Keep verbatim');assert.throws(()=>w.edit('example','id','other'));assert.throws(()=>w.edit('example','unknown',1));
 w.undo();assert.equal(w.branches.example[0].modifiers.damage,2);w.revertField('example','name');assert.equal(w.records[0].value.name,'Example');w.reset('example');assert.equal(w.changes.length,0);
});
test('invalid text/numbers block validation; X cost is preserved; locked copies cannot edit',()=>{
 const w=createWorkspace({adapter,documents:fixture()});for(const value of ['',1.5,-1,Infinity]){w.edit('example','damage',value);assert.throws(()=>w.validate());w.undo();}w.edit('example','name',' ');assert.throws(()=>w.validate());w.undo();w.validate();
 w.setLocked(true);assert.throws(()=>w.edit('example','cost',2));w.setLocked(false);w.edit('example','cost',3);w.markSaved();assert.equal(w.changes.length,0);assert(!w.canUndo);
});
test('save validation rejects duplicate IDs, malformed structures, wrong types and orphan branches',()=>{
 for(const change of [d=>d.cards.cards.push({...d.cards.cards[0]}),d=>d.branches.branches.other=[{id:'other',modifiers:{damage:2}}],d=>d.branches.branches.example.push({...d.branches.branches.example[0]}),d=>d.cards.cards[0].cost='1',d=>d.branches.branches.example[0].modifiers.damage='2',d=>d.branches.branches.example[0].modifiers.exhaust=1,d=>d.cards.cards=null]){const d=fixture();change(d);assert.throws(()=>adapter.validateDocuments(d));}
});
module.exports={fixture};
test('final branch arithmetic cannot exceed safe integer precision',()=>{const d=fixture();d.cards.cards[0].damage=Number.MAX_SAFE_INTEGER;assert.throws(()=>adapter.validateDocuments(d),/安全整数/);});
test('unknown numeric tokens are never silently rounded or converted to null',()=>{
 const {parseJSON}=require('../site/card-workspace.js');assert.deepEqual(parseJSON('{"x":1.00,"y":1e2,"string":"123456789012345678901234567890"}'),{x:1,y:100,string:'123456789012345678901234567890'});
 for(const token of ['1e400','9007199254740993','0.10000000000000001','1e-400'])assert.throws(()=>parseJSON('{"special":'+token+'}'),/数值/);
 const d=fixture();d.cards.future.infinite=Infinity;assert.throws(()=>createWorkspace({adapter,documents:d}),/数值/);
});
