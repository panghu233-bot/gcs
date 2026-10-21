'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const model = require('../site/model.js');
const page = fs.readFileSync('site/index.html', 'utf8');
const source = fs.readFileSync('site/npc-studio.js', 'utf8');
const context = {window:{}};
vm.runInNewContext(source, context, {filename:'npc-studio.js'});
const studio = context.window.GCSNPCStudio;
const demo = model.clone(model.seed);
const npc = demo.npcs[0];
test('GCS loads NPC UI module before main application', () => {
  assert.ok(page.indexOf('npc-studio.js') < page.indexOf('src="app.js"'));
  assert.match(page, /npc-studio\.css/);
  assert.equal(typeof studio.renderEditor, 'function');
  assert.equal(typeof studio.renderPreview, 'function');
});
test('NPC editor renders overview, portrait, actual demo event links and battle form', () => {
  studio.setTab('overview');
  assert.match(studio.renderEditor(npc,demo), /npc-go-portrait/);
  studio.setTab('portrait');
  assert.match(studio.renderEditor(npc,demo), /data-npc-field="npcKind"/);
  studio.setTab('appear');
  const e = studio.renderEditor(npc,demo);
  assert.match(e, /npc-event-add/);
  assert.match(e, /data-action="jump"/);
  studio.setTab('combat');
  assert.match(studio.renderEditor(npc,demo), /npcEnemyId/);
  assert.match(studio.renderPreview(npc,demo), /portrait-frame/);
});
test('hero-only controls never appear in ordinary NPC gameplay settings', () => {
  const regular = demo.npcs[1];
  studio.setTab('mechanics');
  assert.match(studio.renderEditor(npc,demo), /npcGiftBonus/);
  assert.doesNotMatch(studio.renderEditor(regular,demo), /npcGiftBonus/);
  assert.match(studio.renderEditor(regular,demo), /普通 NPC/);
});
test('NPC interface does not expose private game-character or game-asset examples', () => {
  for (const text of [source, fs.readFileSync('site/npc-studio.css','utf8')]) {
    assert.doesNotMatch(text,/赖三|万钧|迦南|凝顾|J:\\ninggu/);
  }
});

test('all five real tabs render only source data and expose no demo edit actions',()=>{
 const real={id:'cultivation:甲乙',name:'甲乙',role:'养成对白参与者',image:'blob:local-test',portraitRef:'res://assets/example.png',sources:['scripts/example.gd'],events:[{function:'Example.create',source:'scripts/example.gd',line:3,title:'真实事件甲',eventId:'event_a',dialogues:[{speaker:'甲乙',text:'<img src=x onerror=alert(1)>'}]}],enemies:[{id:'enemy_a',max_hp:31,source:'data/enemies/example.json'}],hero:{id:'alpha',config:{preferred_gift:'gift_a'},constants:{TEAHOUSE_AFFECTION_INITIAL:23},runtime:{giftGain:8,giftCost:1,dayStart:4,dayEnd:12,preferredGiftRead:false,encounterCondition:'if _quest_done:'},rules:[]}};
 for(const tab of ['overview','portrait','appear','mechanics','combat']){
  studio.setTab(tab);const html=studio.renderRealEditor(real);
  assert.match(html,/真实项目/);assert.match(html,/只读/);
  assert.doesNotMatch(html,/data-npc-field|data-action="(?:image|npc-event-add|npc-event-remove|jump)"|<input|<textarea|<select/);
  if(tab==='overview'||tab==='portrait')assert.match(html,/blob:local-test/);
  if(tab==='appear'){assert.match(html,/真实事件甲/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x/);}
  if(tab==='mechanics'){assert.match(html,/gift_a/);assert.match(html,/第 4 至 12 天/);assert.match(html,/送礼函数未读取/);}
  if(tab==='combat')assert.match(html,/enemy_a/);
 }
 assert.match(studio.renderRealPreview(real),/blob:local-test/);
});
test('unverified mappings and absent source fields remain explicitly unknown',()=>{
 const mapping={name:'甲映射键',role:'立绘映射键 · 出场未核实',npcKind:'unverified',portraitRef:'res://assets/missing.png',events:[],enemies:[],sources:[]};
 studio.setTab('portrait');assert.match(studio.renderRealEditor(mapping),/文件不存在或无法读取/);
 studio.setTab('mechanics');const html=studio.renderRealEditor(mapping);assert.match(html,/尚未确认出场/);assert.doesNotMatch(html,/npcGiftBonus|gift_oil|affection_init/);
});
