const {test}=require('node:test'),assert=require('node:assert/strict');
const event=require('../site/event-project.js'),patch=require('../site/gdscript-string-patch.js'),writer=require('../site/event-writer.js');
const {fixture,enc,memoryFS}=require('./helpers/synthetic-event.cjs'),m=event.manifest;
const fields=['speaker','text','left','right','mood'];
const data=lines=>lines.map(l=>Object.fromEntries(fields.map(k=>[k,l[k]])));
function changed(files,transform){return {...files,[m.sourcePath]:enc(transform(patch.decode(files[m.sourcePath])))};}
function checkOutside(before,plan){assert.equal(plan.edits.length,1);const e=plan.edits[0];assert.deepEqual(plan.bytes.slice(0,e.start),before.slice(0,e.start));assert.deepEqual(plan.bytes.slice(e.start+e.bytes.length),before.slice(e.end));}
function nondefault(w,index=0){w.setPerformance(index,'speaker','顾飞雪');w.setPerformance(index,'left','顾清寒');w.setPerformance(index,'right','老人');w.setPerformance(index,'mood','shy');}

test('legacy rows read all five fields and unchanged seven-line draft returns identical bytes',()=>{
 for(const eol of ['\n','\r\n'])for(const bom of [false,true])for(const quote of ['"',"'",'"""',"'''"]){
  const f=fixture({eol,bom,quote}),w=event.parse(f),p=w.planDraft();assert.equal(p.kind,'unchanged');assert.equal(p.edits.length,0);assert.deepEqual(p.bytes,f[m.sourcePath]);assert(w.lines.every(l=>l.left===''&&l.right==='测试人物'&&l.speaker==='测试人物'&&l.mood==='normal'));
 }
});

test('pure text draft uses exactly the existing string-token patch',()=>{
 const f=fixture(),w=event.parse(f);w.set(0,'中文 "引号" \\ 换行\n😀');w.set(5,'第二处');const p=w.planDraft(),old=w.plan();assert.equal(p.kind,'text');assert.deepEqual(p.bytes,old.bytes);assert.deepEqual(p.edits,old.edits);assert.equal(patch.readLinear(p.bytes,m).lines[0].text,w.texts[0]);
});

test('nondefault full dictionaries coexist with original calls and reread preserves casting independently of entry speaker',()=>{
 const f=fixture(),w=event.parse(f);nondefault(w);const p=w.planDraft();assert.equal(p.kind,'function-body');checkOutside(f[m.sourcePath],p);
 const parsed=patch.readLinear(p.bytes,m);assert.equal(parsed.lines[0].form,'dictionary');assert(parsed.lines.slice(1).every(l=>l.form==='helper'));assert.deepEqual(data(parsed.lines),data(w.lines));assert.equal(parsed.defaultSpeaker,'测试人物');
 const loaded=event.parse({...f,[m.sourcePath]:p.bytes});assert.equal(loaded.lines[0].speaker,'顾飞雪');assert.equal(loaded.lines[0].left,'顾清寒');assert.equal(loaded.lines[0].right,'老人');assert(!loaded.hasUnsupportedChanges);assert.equal(loaded.plan().kind,'unchanged');assert.equal(loaded.planDraft().kind,'unchanged');
 loaded.set(1,'新格式纯文字');const textPlan=loaded.planDraft();assert.equal(textPlan.kind,'text');assert.equal(textPlan.edits.length,1);assert.deepEqual(data(patch.readLinear(textPlan.bytes,m).lines),data(loaded.lines));assert.equal(loaded.plan().kind,'text');
});

test('insert copy delete and reorder generate the exact final sequence with the background on the new first row',()=>{
 for(const operation of ['insert','delete','copy','reorder','combined']){
  const f=fixture(),w=event.parse(f);
  if(operation==='insert'||operation==='combined'){w.insert(0);w.set(0,'新增第一句');nondefault(w);}
  if(operation==='delete'||operation==='combined')w.remove(operation==='combined'?3:0);
  if(operation==='copy'||operation==='combined'){w.duplicate(2);w.set(3,'独立复制');w.setPerformance(3,'left','顾飞雪');}
  if(operation==='reorder'||operation==='combined')w.move(w.lines.length-1,-1);
  const p=w.planDraft(),after=patch.readLinear(p.bytes,m);assert.equal(p.kind,'function-body');assert.equal(after.openingBg,'BG');assert.deepEqual(data(after.lines),data(w.lines));assert.equal((patch.decode(p.bytes).match(/first\["bg"\] = BG/g)||[]).length,1);checkOutside(f[m.sourcePath],p);
  const w2=event.parse({...f,[m.sourcePath]:p.bytes});assert.deepEqual(data(w2.lines),data(w.lines));assert.equal(w2.plan().kind,'unchanged');
 }
});

test('function-body patch preserves BOM, line endings, other events, constants, helper and entry',()=>{
 for(const eol of ['\n','\r\n'])for(const bom of [false,true]){
  const f=fixture({eol,bom}),w=event.parse(f);nondefault(w,3);const p=w.planDraft();checkOutside(f[m.sourcePath],p);const source=patch.decode(p.bytes);
  assert.equal(source.startsWith('\ufeff'),bom);assert.equal(source.includes('\r\n'),eol==='\r\n');if(eol==='\r\n')assert(!/(?<!\r)\n/.test(source));
  assert(source.includes('class Other:'+eol+'\tconst TEXT = "保留所有字节"'));assert(source.includes('const UNRELATED = "keep\\u4e2d" # 不改'));assert.deepEqual(w.entryBytes,f[m.entryPath]);
 }
});

test('parser accepts complete reordered multiline dictionary fields and default _line mood',()=>{
 const f=changed(fixture({eol:'\n'}),s=>s.replace('_line("合成第1句", "normal")','{\n\t\t\t"right": "顾飞雪", "text": "独立说话人",\n\t\t\t"mood": "shy", "left": "顾清寒", "speaker": "老人",\n\t\t}').replace('_line("合成第2句", "normal")','_line("合成第2句")'));
 const w=event.parse(f);assert.equal(w.lines[0].speaker,'老人');assert.equal(w.lines[0].left,'顾清寒');assert.equal(w.lines[0].right,'顾飞雪');assert.equal(w.lines[0].mood,'shy');assert.equal(w.lines[1].mood,'normal');w.set(0,'只改字典文本');assert.equal(w.planDraft().kind,'text');
});

test('ambiguous narration clearing and runtime inheritance refuse plans, while explicit speaking without portraits is supported',()=>{
 const w=event.parse(fixture());w.setPerformance(0,'speaker','');assert.throws(()=>w.planDraft(),/旁白.*清空立绘/);
 w.undo();w.setPerformance(0,'left','');w.setPerformance(0,'right','');assert.equal(w.planDraft().kind,'function-body');
 const f=fixture(),base=event.parse(f).lines;
 for(const key of ['left','right','mood'])assert.throws(()=>patch.planLines({originalBytes:f[m.sourcePath],spec:m,lines:base.map((l,i)=>i===0?{...l,[key]:'<inherit>'}:l)}),/继承/);
});

test('unknown syntax, unknown duplicate or incomplete dictionary fields and changed helper all fail closed',()=>{
 const explicit='{"speaker":"顾飞雪","text":"内容","left":"","right":"顾飞雪","mood":"normal"}';
 for(const expr of [explicit.replace('"mood":"normal"','"mood":"normal","type":"choice"'),explicit.replace('"speaker":"顾飞雪"','"speaker":"顾飞雪","speaker":"老人"'),explicit.replace(',"left":""',''),explicit.replace('"text":"内容"','"text": build_text()')]){
  const f=changed(fixture(),s=>s.replace('_line("合成第1句", "normal")',expr));assert.throws(()=>event.parse(f));
 }
 for(const transform of [s=>s.replace('out.append(first)','out.append(first)\n\t\tpass'),s=>s.replace('"right": PORTRAIT_SPEAKER','"right": "其他人"'),s=>s.replace('const PORTRAIT_SPEAKER := "测试人物"','const PORTRAIT_SPEAKER := "测试人物" + "别名"')])assert.throws(()=>event.parse(changed(fixture(),transform)));
});

test('body comments stop structural rewrites but provable text-token edits and hash characters inside strings remain safe',()=>{
 for(const comment of ['\t\t# 行间注释\n','']){
  const f=changed(fixture({eol:'\n'}),s=>comment?s.replace('\t\tvar out:',comment+'\t\tvar out:'):s.replace('return out\n','return out # 行末注释\n'));
  const w=event.parse(f);w.set(0,'只改文字');assert.equal(w.planDraft().kind,'text');w.duplicate(0);assert.throws(()=>w.planDraft(),/注释/);
 }
 const w=event.parse(fixture());w.set(0,'# 字符属于对白，不是注释');w.duplicate(0);assert.equal(w.planDraft().kind,'function-body');
});

test('empty events, unknown draft fields, invalid unicode, missing background and mixed newlines are rejected',()=>{
 const f=fixture(),w=event.parse(f);
 assert.throws(()=>patch.planLines({originalBytes:f[m.sourcePath],spec:m,lines:[]}),/至少/);
 assert.throws(()=>patch.planLines({originalBytes:f[m.sourcePath],spec:m,lines:w.lines.map((l,i)=>i===0?{...l,type:'choice'}:l)}),/未知字段/);
 assert.throws(()=>patch.planLines({originalBytes:f[m.sourcePath],spec:m,lines:w.lines.map((l,i)=>i===0?{...l,text:'\ud800'}:l)}),/Unicode/);
 const missing=event.parse(changed(f,s=>s.replace('\t\tfirst["bg"] = BG\r\n','')));missing.duplicate(0);assert.throws(()=>missing.planDraft(),/背景/);
 const mixed=event.parse(changed(fixture({eol:'\n'}),s=>s.replace('out.append(first)\n','out.append(first)\r\n')));mixed.duplicate(0);assert.throws(()=>mixed.planDraft(),/换行混用/);
});

test('legacy text-only writer arguments cannot silently save structural or performance drafts',async()=>{
 const f=fixture(),w=event.parse(f);nondefault(w);w.duplicate(1);const p=w.planDraft();assert.equal(p.kind,'function-body');assert(!w.hasUnsupportedChanges);assert.equal(w.plan().kind,'function-body');
 const mem=memoryFS();await assert.rejects(writer.prepare({project:mem.project,backupParent:mem.backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:w.changes,workspace:w}));assert.equal(mem.writes.length,0);
});
