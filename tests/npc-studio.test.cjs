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
