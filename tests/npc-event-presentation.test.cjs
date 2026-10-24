const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const npc=require('../site/npc-project.js'),stories=require('../site/event-stories.js'),directory=require('../site/event-directory.js');
const source='scripts/cultivation/cultivation_data.gd';
function record(owner,fn,title){return {manifest:{id:source+'#'+owner+'.'+fn,sourcePath:source,className:owner,functionName:fn,title},capability:'text',lines:[{speaker:'测试人物',text:'练习以后记得休息。'}]};}
function event(r){return {source:r.manifest.sourcePath,function:r.manifest.className+'.'+r.manifest.functionName,title:'',eventId:'',dialogues:r.lines};}
function render(records,events=records.map(event)){const window={GCSProject:{getState:()=>({eventWorkspace:{eventRecords:records}})},GCSNPCProject:npc,GCSEventStories:stories,GCSEventDirectory:directory};vm.runInNewContext(fs.readFileSync('site/npc-studio.js','utf8'),{window});window.GCSNPCStudio.setTab('appear');return window.GCSNPCStudio.renderRealEditor({name:'测试人物',events});}
const summaries=html=>[...html.matchAll(/<summary>([^]*?)<\/summary>/g)].map(m=>m[1].replace(/<[^>]+>/g,''));
test('NPC appearances reuse confirmed Chinese story and source names',()=>{
 const rows=[record('Day19EveEvent','create_lines','前夜'),record('SternMotherCareEvent','create_day_lines','严师慈母 · 白天'),record('SternMotherCareEvent','create_night_lines','严师慈母 · 夜晚'),record('FirstMusicTeachingEvent','create_lines','首次授琴')];
 const html=render(rows),titles=summaries(html);for(const name of ['前夜','严师慈母','严师慈母 · 白天','严师慈母 · 夜晚','首次授琴'])assert(titles.some(t=>t.includes(name)),name);
 assert.equal((html.match(/class="npc-real-story"/g)||[]).length,1);assert.equal((html.match(/data-action="npc-open-event"/g)||[]).length,4);
 assert(!titles.some(t=>/create_|SternMotherCareEvent|Day19EveEvent/.test(t)));assert.match(html,/高级信息/);
});
test('matching titles or summaries never merge unrelated or ambiguous source identities',()=>{
 const a=record('UnrelatedA','create_lines','同一标题'),b=record('UnrelatedB','create_lines','同一标题');let html=render([a,b]);assert.equal((html.match(/class="npc-real-story"/g)||[]).length,0);assert.equal((html.match(/data-npc-event-index=/g)||[]).length,2);
 const day=record('SternMotherCareEvent','create_day_lines','严师慈母 · 白天');html=render([day,{...day,manifest:{...day.manifest,id:'duplicate'}}],[event(day),event(day)]);assert.equal((html.match(/class="npc-real-story"/g)||[]).length,0);assert.doesNotMatch(html,/data-action="npc-open-event"/);
});
test('unnamed sources show readable dialogue summaries, with technical scope inside advanced details',()=>{
 const r=record('Unnamed','create_new_lines','Unnamed.create_new_lines'),e=event(r);const html=render([r],[e]);assert(summaries(html).some(t=>t.includes('练习以后记得休息')));assert(!summaries(html).some(t=>/Unnamed|create_new_lines/.test(t)));assert.match(html,/高级信息/);assert.match(html,/Unnamed.create_new_lines/);
});
