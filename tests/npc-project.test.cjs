'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const reader=require('../site/npc-project.js');
const f=(name,body)=>({name:name.split('/').at(-1),webkitRelativePath:'example/'+name,size:Buffer.byteLength(body),text:async()=>body});
const sources=()=>{
 const visuals='const IMAGE_MAP = {"甲乙":"res://assets/cultivation/portraits/npc/alpha.png","丙丁":"assets/cultivation/portraits/npc/beta.png"}';
 const data='const HERO_AFFINITY_CONFIG: Dictionary = {"id_alpha":{"name":"甲乙","gift":5}}\nvar lines=[{"speaker":"甲乙"},{"left":"丙丁"}]';
 return {visuals,data,story:'var lines=[{"right":"甲乙"}]',commission:'',enemies:JSON.stringify({enemies:[{id:'opponent_one',name:'甲乙',max_hp:34}]})};
};
test('NPC identities and references are derived from dedicated source files, not demo fixtures',()=>{
 const records=reader.indexFromSources(sources());
 assert.equal(records.length,2);
 const first=records.find(n=>n.name==='甲乙');
 assert.equal(first.npcKind,'hero');
 assert.deepEqual(first.events.map(x=>x.count),[1,1]);
 assert.equal(first.enemy.id,'opponent_one');
 assert.equal(first.enemy.max_hp,34);
 assert.equal(first.portraitRef,'res://assets/cultivation/portraits/npc/alpha.png');
 assert.equal(records.find(n=>n.name==='丙丁').npcKind,'unverified');
 assert.ok(records.every(n=>n.sources.includes(reader.paths.visuals)));
});
test('non-ASCII image path still belongs to an actual mapped person',()=>{
 const s=sources();s.visuals='const MAP={"甲乙":"res://assets/cultivation/portraits/npc/中文文件.png"}';
 const person=reader.indexFromSources(s).find(n=>n.name==='甲乙');
 assert.match(person.portraitRef,/中文文件/);
});
test('folder fallback reads only targeted files and never invents a missing NPC',async()=>{
 const src=sources(),files=[
 f(reader.paths.visuals,src.visuals),f(reader.paths.data,src.data),f(reader.paths.story,src.story),
 f(reader.paths.enemies,src.enemies),
 {name:'secret.txt',webkitRelativePath:'example/confidential/secret.txt',size:9,text:async()=>{throw Error('must not read');}}
 ];
 const loaded=await reader.fromFileList(files);
 assert.equal(loaded.records.length,2);assert.equal(loaded.records[0].image,'');
 loaded.release();
 await assert.rejects(reader.fromFileList(files.filter(x=>x.name!=='cultivation_scene_visuals.gd')),/缺少/);
});
test('no fabricated character fallback when source mapping is empty',()=>{
 const s=sources();s.visuals='const MAP = {}';s.data='';
 assert.deepEqual(reader.indexFromSources(s),[]);
});
