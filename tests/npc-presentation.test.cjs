'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const reader=require('../site/npc-project.js');
function sources(){return {
 visuals:`const PORTRAIT_BASE_PATH := "res://assets/cultivation/portraits/"
const SPEAKER_PORTRAIT_MAP := {"甲角色":"alpha","乙角色":"alpha","丙角色":"npc"}
const SPEAKER_FILENAME_MAP := {"丙角色":"fixed"}
func load_portrait_for_speaker(speaker, mood="normal"):
 var filename = ""
 filename = mood
 var path = PORTRAIT_BASE_PATH + folder + "/" + filename + ".png"
func detect_mood_from_text(speaker,text):
 if speaker != "甲角色":
  return "normal"
 return "sigh"`,
 player:`func update():
 var left_mood = "normal" if left_speaker != "甲角色" else current_mood
 var right_mood = "normal" if right_speaker != "甲角色" else current_mood`,
 guqin:`const TEXTURE_PATH := "res://assets/cultivation/portraits/alpha/music.png"
static func apply(portrait,host,speaker,mood):
 if speaker != "甲角色" or mood != "music":
  return false`,
 data:`class First:
 const PERSON := "甲角色"
 static func _line(text: String, mood: String = "normal") -> Dictionary:
  return {"speaker":PERSON,"text":text,"left":PERSON,"right":"","mood":mood}
 static func create():
  var e = {}
  e.event_id = &"event_one"
  e.title = "真实事件标题"
  e.lines = [{"speaker":"甲角色","text":"开场","left":"甲角色","right":"乙角色","mood":"happy"}]
  e.lines.append_array(_ending())
  return e
 static func _ending():
  return [{"type":"choice","options":[{"text":"选项甲","next_label":"end_a"}]},{"speaker":"乙角色","text":"回应","left":"甲角色","right":"乙角色","mood":"sigh","anchor_label":"end_a"}]
 static func other():
  var out = []
  out.append(_line("独立对白", "shy"))
  return out
class Second:
 const PERSON := "乙角色"
 static func _line(text: String, mood: String = "normal") -> Dictionary:
  return {"speaker":PERSON,"text":text,"mood":mood}
 static func other():
  return [_line("另一个人物", "normal")]
`,story:'',commission:'',manager:'',enemies:'{"enemies":[]}'
};}
test('source-backed portrait moods follow the actual target and scoped helper literals',()=>{
 const records=reader.indexFromSources(sources()),a=records.find(n=>n.name==='甲角色'),b=records.find(n=>n.name==='乙角色');
 assert.ok(a.portraits.some(p=>p.ref.endsWith('/shy.png')));
 assert.ok(a.portraits.some(p=>p.ref.endsWith('/happy.png')));
 assert.ok(a.portraits.some(p=>p.ref.endsWith('/music.png')));
 assert.deepEqual(b.portraits.map(p=>p.ref),['res://assets/cultivation/portraits/alpha/normal.png']);
 assert.ok(a.events.some(e=>e.dialogues.some(d=>d.text==='独立对白')));
 assert.ok(!a.events.some(e=>e.dialogues.some(d=>d.text==='另一个人物')));
});
test('unique helper call merges under its literal event while ambiguous helpers stay separate',()=>{
 const records=reader.indexFromSources(sources()),a=records.find(n=>n.name==='甲角色');
 const e=a.events.find(e=>e.eventId==='event_one');
 assert.equal(e.title,'真实事件标题');assert.equal(e.sections.length,2);
 assert.ok(e.dialogues.some(d=>d.text==='回应'));assert.ok(e.branches.some(b=>b.next_label==='end_a'));
 const s=sources();s.data+='\nclass Third:\n static func unrelated():\n  return [{"speaker":"甲角色","text":"独立来源"}]';
 assert.ok(reader.indexFromSources(s).find(n=>n.name==='甲角色').events.some(e=>e.function==='Third.unrelated'&&!e.title));
 const shared=sources();shared.data=shared.data.replace('static func other():\n  var out = []','static func other():\n  _ending()\n  var out = []');
 assert.ok(reader.indexFromSources(shared).find(n=>n.name==='甲角色').events.some(e=>e.function==='First._ending'));
});
test('all portrait URLs are local, deduplicated and released exactly once',async()=>{
 const s=sources(),files=Object.entries(reader.paths).map(([k,p])=>({webkitRelativePath:'root/'+p,size:1,text:async()=>s[k]||''}));
 for(const ref of new Set(reader.indexFromSources(s).flatMap(n=>n.portraits.map(p=>p.ref))))files.push({webkitRelativePath:'root/'+ref.slice(6),size:1});
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL,made=[],freed=[];
 URL.createObjectURL=()=>{const u='blob:portrait-'+made.length;made.push(u);return u;};URL.revokeObjectURL=u=>freed.push(u);
 try{const result=await reader.fromFileList(files);const a=result.records.find(n=>n.name==='甲角色'),b=result.records.find(n=>n.name==='乙角色');assert.equal(a.image,b.image);assert.ok(a.portraits.filter(p=>p.image).length>1);result.release();result.release();assert.deepEqual(freed,made);}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});
test('player character is excluded while NPC records and event references remain',()=>{
 const s=sources();
 s.visuals=s.visuals.replace('"丙角色":"npc"','"丙角色":"npc", "玩家主角":"guqinghan"');
 s.visuals += `
 func refresh_character_portrait():
  # load_portrait_for_speaker("乙角色", _stats_portrait_mood_key())
  var other = load_portrait_for_speaker("甲角色", "normal")
  var tex = load_portrait_for_speaker("玩家主角", _stats_portrait_mood_key())
 func apply_editor_char_sprite_preview():
  var tex = load_portrait_for_speaker("玩家主角", _stats_portrait_mood_key())`;
 s.data=s.data.replace('"right":"乙角色","mood":"happy"','"right":"玩家主角","mood":"happy"');
 const records=reader.indexFromSources(s);
 assert.equal(records.some(n=>n.name==='玩家主角'),false);
 assert.deepEqual(records.map(n=>n.name).sort(),['甲角色','乙角色','丙角色'].sort());
 const npc=records.find(n=>n.name==='甲角色');
 assert.ok(npc);
 const event=npc.events.find(e=>e.eventId==='event_one');
 assert.ok(event);
 assert.ok(event.references.includes('玩家主角'));
 assert.ok(event.dialogues.some(d=>d.right==='玩家主角'));
 assert.ok(records.every(n=>!n.portraits.some(p=>p.ref.includes('/guqinghan/'))));
});
test('real event summaries default closed and portrait selection synchronizes both renderers',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync('site/npc-studio.js','utf8'),context);const studio=context.window.GCSNPCStudio;
 const n=reader.indexFromSources(sources()).find(n=>n.name==='甲角色');n.portraits.forEach((p,i)=>p.image='blob:local-'+i);n.image=n.portraits[0].image;
 studio.setTab('appear');const html=studio.renderRealEditor(n);
 assert.match(html,/<details class="npc-real-event"/);assert.doesNotMatch(html,/<details[^>]*\bopen\b/);assert.doesNotMatch(html,/人物字段引用/);assert.match(html,/触发条件未核实/);assert.match(html,/参与人物/);assert.match(html,/end_a/);
 studio.setTab('portrait');assert.match(studio.renderRealEditor(n),/npc-portrait-select/);
 studio.selectRealPortrait(n,1);assert.match(studio.renderRealEditor(n),/src="blob:local-1"/);assert.match(studio.renderRealPreview(n),/src="blob:local-1"/);assert.doesNotMatch(studio.renderRealPreview(n),/src="blob:local-0"/);
 const single={...n,portraits:[n.portraits[0]]};assert.doesNotMatch(studio.renderRealEditor(single),/npc-portrait-select/);
});
