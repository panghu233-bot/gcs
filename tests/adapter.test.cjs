const {test}=require('node:test');
const assert=require('node:assert/strict');
const a=require('../site/ninggu-adapter.js');
test('validates files and duplicate identities',()=>{
 assert.throws(()=>a.readRecords({cards:[{id:'a'},{id:'a'}]}),/重复/);
 assert.throws(()=>a.readRecords({cards:[null]}));
 assert.throws(()=>a.readBranches({branches:{a:[{id:'b'}]}}));
 assert.throws(()=>a.readBranches({branches:{a:[{id:'b',modifiers:{}},{id:'b',modifiers:{}}]}}));
});
test('branch deltas, replacements, absent properties, unknown effects and source isolation',()=>{
 const r={id:'example',value:{id:'example',damage:5,cost:1,exhaust:false,upgrade_damage:3}};
 const b={id:'variant',modifiers:{damage:2,cost:-8,heal:3,exhaust:true,mystery:{value:9}}};
 const before=JSON.stringify({r,b}); const result=a.preview(r,b,true);
 assert.equal(result.final.damage,7);assert.equal(result.final.cost,0);assert.equal(result.final.heal,3);assert.equal(result.final.exhaust,true);
 assert.deepEqual(result.unresolved,{mystery:{value:9}});assert.equal(result.final.mystery,undefined);
 assert.equal(JSON.stringify({r,b}),before);
});
test('linear numeric, boolean, conditional and nested changes match distinct operations',()=>{
 const r={value:{cost:1,damage:3,exhaust:true,upgrade_cost_reduce:2,upgrade_damage:0,upgrade_exhaust:false,upgrade_retain:true,on_discard_damage:0,upgrade_on_discard_damage:4,consume_chill_damage:{base:2,per_chill:1},upgrade_consume_chill_per_chill:2,chill_stack_damage:{bonus:0,upgrade_bonus:4},upgrade_unknown:99}};
 const p=a.preview(r,null,true);
 assert.equal(p.final.cost,0);assert.equal(p.final.damage,3);assert.equal(p.final.exhaust,false);assert.equal(p.final.retain,true);
 assert.equal(p.final.on_discard_damage,0);assert.equal(p.final.consume_chill_damage.per_chill,3);assert.equal(p.final.chill_stack_damage.bonus,4);
 assert.equal(p.unresolved.upgrade_unknown,99);assert.equal(r.value.consume_chill_damage.per_chill,1);
});
test('never calls a dynamic damage value a fixed result',()=>{
 assert.match(a.describe({damage:8,hits:2,x_cost:true}),/战斗状态/);
 assert.doesNotMatch(a.describe({damage:8,hits:2,x_cost:true}),/每次 8/);
});
