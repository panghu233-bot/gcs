const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const event=require('../site/event-project.js'),writer=require('../site/event-writer.js');
const {fixture,memoryFS,enc}=require('./helpers/synthetic-event.cjs');

test('insert/copy inherit adjacent presentation, preserve originals and opening background',()=>{
 const files=fixture();files[event.manifest.sourcePath]=enc(new TextDecoder('utf-8',{ignoreBOM:true}).decode(files[event.manifest.sourcePath]).replace('_line("合成第5句", "normal")','_line("合成第5句", "shy")'));
 const w=event.parse(files),original=w.lines;assert.equal(original[4].mood,'shy');
 assert.equal(w.openingBackground,'BG');
 w.insert(4);assert.equal(w.lines.length,8);assert.equal(w.lines[4].text,'');
 for(const k of ['speaker','left','right','mood'])assert.equal(w.lines[4][k],original[4][k]);
 assert.deepEqual(w.lines.filter(l=>original.some(o=>o.id===l.id)),original);
 w.duplicate(0);assert.equal(w.lines[1].text,original[0].text);assert.notEqual(w.lines[1].id,original[0].id);
 w.set(1,'独立副本');assert.equal(w.lines[0].text,original[0].text);
 w.move(0,1);w.remove(0);assert.equal(w.openingBackground,'BG');
 w.discard();assert.deepEqual(w.lines,original);
 w.insert(0,true);assert.equal(w.selectedIndex,1);assert.equal(w.lines[1].speaker,original[0].speaker);
});

test('undo/redo restore text, order, deletion, selection; new actions clear redo',()=>{
 const w=event.parse(fixture()),original=w.lines;
 w.select(2);w.insert(2,true);const added=w.lines[3].id;w.set(3,'新行');w.move(3,-1);w.remove(0);
 for(let i=0;i<4;i++)w.undo();assert.deepEqual(w.lines,original);assert.equal(w.selectedIndex,2);assert(!w.changes.length);
 for(let i=0;i<4;i++)w.redo();assert.equal(w.lines[1].id,added);assert.equal(w.lines[1].text,'新行');
 w.undo();w.set(0,'另一路');assert(!w.canRedo);
 const rows=w.lines;rows[0].speaker='不应泄漏';assert.notEqual(w.lines[0].speaker,'不应泄漏');
 w.discard();assert(!w.canUndo);assert(!w.canRedo);
});

test('all structural drafts reject text patch plans and writer preparation without file writes',async()=>{
 for(const mutate of [w=>w.insert(0),w=>w.insert(6,true),w=>w.duplicate(1),w=>w.remove(0),w=>w.move(1,-1),w=>w.move(1,1)]){
  const files=fixture(),w=event.parse(files),mem=memoryFS();mutate(w);assert(w.changes.length);assert(w.hasStructuralChanges);assert.throws(()=>w.plan(),/结构修改/);
  await assert.rejects(writer.prepare({project:mem.project,backupParent:mem.backup,originalBytes:w.originalBytes,entryBytes:w.entryBytes,changes:w.changes}));assert.equal(mem.writes.length,0);
  w.undo();assert(!w.hasStructuralChanges);w.set(0,'文字可继续保存');assert(w.plan().bytes);
 }
});

test('boundaries and locks guard every structural and redo operation',()=>{
 const w=event.parse(fixture());w.move(0,-1);w.move(6,1);assert(!w.canUndo);
 for(let i=0;i<6;i++)w.remove(0);assert.equal(w.lines.length,1);assert.throws(()=>w.remove(0),/至少保留/);
 w.setLocked(true);for(const run of [()=>w.insert(0),()=>w.duplicate(0),()=>w.remove(0),()=>w.move(0,1),()=>w.undo(),()=>w.redo(),()=>w.set(0,'x')])assert.throws(run,/锁定/);
});

class Element{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.listeners={};this.disabled=false;this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}get lastChild(){return this.children.at(-1);}
 setAttribute(k,v){this[k]=v;}addEventListener(k,f){this.listeners[k]=f;}showModal(){this.open=true;}close(){this.open=false;this.listeners.close?.();}
}
const descendants=n=>[n,...n.children.flatMap(descendants)];
function ui(){
 const body=new Element('body'),editor=new Element('main'),preview=new Element('aside'),ids={},events=[];
 const w=event.parse(fixture()),s={connected:true,status:'connected',handle:{},eventWorkspace:w,workspace:{}},listeners={};
 const window={GCSProject:{getState:()=>s,report:()=>{}},GCSEventWriter:writer,addEventListener:(k,f)=>(listeners[k]??=[]).push(f),dispatchEvent:e=>{events.push(e);for(const f of listeners[e.type]||[])f(e);}};
 vm.runInNewContext(fs.readFileSync('site/event-studio.js','utf8'),{window,document:{body,createElement:t=>new Element(t),getElementById:id=>ids[id]??=new Element('div')},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 const render=()=>window.GCSEventStudio.render(editor,preview),find=text=>descendants(editor).find(n=>n.tag==='button'&&n.textContent===text);
 render();return {w,editor,preview,body,find,render,events};
}

test('UI defaults to clean reading; editing selects rows, types continuously and returns with draft',()=>{
 const x=ui();assert(x.find('编辑剧本'));assert.equal(descendants(x.editor).filter(n=>n.tag==='textarea').length,0);assert(!x.find('前插'));assert.equal(descendants(x.editor).filter(n=>n.tag==='article').length,7);
 x.find('编辑剧本').onclick();const input=descendants(x.editor).find(n=>n.tag==='textarea');input.value='第一';input.oninput();input.value+='句';input.oninput();assert.equal(x.w.texts[0],'第一句');assert.equal(descendants(x.editor).find(n=>n.tag==='textarea'),input);assert.equal(x.events.at(-1).detail.kind,'event-input');
 const row=descendants(x.editor).filter(n=>n.className?.includes('event-script-row'))[3];row.onclick();assert.equal(x.w.selectedIndex,3);
 x.find('后插').onclick();assert.equal(x.w.lines.length,8);assert.equal(x.w.selectedIndex,4);assert(x.find('查看差异并应用').disabled);x.find('查看差异并应用').onclick();assert(!x.body.children[0].open);
 x.find('完成编辑').onclick();assert(x.find('编辑剧本'));assert.equal(descendants(x.editor).filter(n=>n.tag==='article').length,8);assert.equal(descendants(x.editor).filter(n=>n.tag==='textarea').length,0);assert.equal(x.w.texts[0],'第一句');
 x.find('编辑剧本').onclick();x.find('撤销一步').onclick();assert.equal(x.w.lines.length,7);assert(!x.find('查看差异并应用').disabled);x.find('重做').onclick();assert.equal(x.w.lines.length,8);assert(x.find('查看差异并应用').disabled);
});

test('UI enables only bounded row actions; copies are independent and text-only review remains available',()=>{
 const x=ui();x.find('编辑剧本').onclick();assert(x.find('上移').disabled);assert(!x.find('下移').disabled);
 x.find('复制').onclick();const id=x.w.lines[1].id;x.find('下移').onclick();assert.equal(x.w.lines[2].id,id);x.find('上移').onclick();assert.equal(x.w.lines[1].id,id);x.find('删除').onclick();assert.equal(x.w.lines.length,7);assert(!x.w.hasStructuralChanges);
 x.w.set(0,'文字草稿');x.render();x.find('查看差异并应用').onclick();assert(x.body.children[0].open);
 x.w.discard();x.render();x.find('前插').onclick();assert.equal(x.w.selectedIndex,0);assert.equal(x.w.texts[0],'');
});


test('selected dialogue owns inline controls; switching selection moves the editor without losing drafts',()=>{
 const x=ui();x.find('编辑剧本').onclick();
 const rows=()=>descendants(x.editor).filter(n=>n.className?.split(' ').includes('event-script-row'));
 const selected=()=>rows().find(n=>n.className.split(' ').includes('selected'));
 const assertInline=index=>{
  assert.equal(rows().length,x.w.lines.length);assert.equal(rows().indexOf(selected()),index);
  const own=descendants(selected());assert.equal(own.filter(n=>n.tag==='textarea').length,1,'input must be inside selected dialogue');
  for(const label of ['前插','后插','复制','删除','上移','下移'])assert(own.some(n=>n.tag==='button'&&n.textContent===label),'selected dialogue must own '+label);
  assert.notEqual(selected().tag,'button','controls cannot be nested in a button');
  for(const row of rows().filter(n=>n!==selected()))assert(!descendants(row).some(n=>n.tag==='textarea'||n.className?.includes('event-line-actions')));
 };
 assertInline(0);rows()[1].onclick();assertInline(1);
 const row=selected(),input=descendants(row).find(n=>n.tag==='textarea');input.value='第二句草稿';input.selectionStart=2;input.selectionEnd=2;input.oninput();
 assert.equal(selected(),row);assert.equal(descendants(selected()).find(n=>n.tag==='textarea'),input);assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,2);
 input.value='第二句继续输入';input.selectionStart=4;input.selectionEnd=6;input.oninput();assert.equal(input.selectionStart,4);assert.equal(input.selectionEnd,6);
 rows()[5].onclick();assertInline(5);rows()[1].onclick();assertInline(1);assert.equal(descendants(selected()).find(n=>n.tag==='textarea').value,'第二句继续输入');
 x.find('后插').onclick();assertInline(2);assert(x.w.hasStructuralChanges);assert(x.find('查看差异并应用').disabled);
 x.find('撤销一步').onclick();assertInline(1);x.find('重做').onclick();assertInline(2);
});


test('preview defaults closed; reading and editing select the same real portrait without losing input selection',async()=>{
 const x=ui(),calls=[];x.w.performance={load:async line=>{calls.push(line);return {left:{name:'',empty:true},right:{name:line.right,image:'blob:local-'+line.mood,path:'assets/test/'+line.mood+'.png',mood:line.mood}};}};
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 assert.equal(x.preview.children.length,0);assert.equal(x.find('演出预览')['aria-expanded'],'false');
 x.find('演出预览').onclick();await flush();assert.equal(x.find('演出预览')['aria-expanded'],'true');assert.equal(calls.length,1);
 assert.equal(descendants(x.preview).filter(n=>n.tag==='img').length,1);assert.equal(descendants(x.preview).find(n=>n.tag==='img').src,'blob:local-normal');
 const rows=()=>descendants(x.editor).filter(n=>n.className?.split(' ').includes('event-script-row'));
 rows()[4].onclick();await flush();assert.equal(x.w.selectedIndex,4);assert.equal(descendants(x.preview).find(n=>n.tag==='pre').textContent,x.w.texts[4]);assert.equal(descendants(x.editor).filter(n=>n.tag==='textarea').length,0);
 rows()[2].onkeydown({key:'Enter',preventDefault(){}});await flush();assert.equal(x.w.selectedIndex,2);
 x.find('编辑剧本').onclick();await flush();assert.equal(x.w.selectedIndex,2);const input=descendants(x.editor).find(n=>n.tag==='textarea');input.value='同步预览草稿';input.selectionStart=2;input.selectionEnd=2;const before=calls.length;input.oninput();await flush();assert.equal(calls.length,before);assert.equal(descendants(x.editor).find(n=>n.tag==='textarea'),input);assert.equal(input.selectionStart,2);assert.equal(descendants(x.preview).find(n=>n.tag==='pre').textContent,'同步预览草稿');
 x.find('演出预览').onclick();assert.equal(x.preview.children.length,0);assert.equal(x.w.texts[2],'同步预览草稿');x.find('完成编辑').onclick();assert.equal(x.find('演出预览')['aria-expanded'],'false');
});

test('a slow old portrait response cannot replace the newest selected line',async()=>{
 const x=ui(),pending=[];x.w.performance={load:line=>new Promise(resolve=>pending.push({line,resolve}))};const flush=()=>new Promise(resolve=>setImmediate(resolve));
 x.find('演出预览').onclick();await flush();descendants(x.editor).filter(n=>n.className?.split(' ').includes('event-script-row'))[5].onclick();await flush();
 const result=image=>({left:{name:'',empty:true},right:{name:'测试人物',image,mood:'normal'}});
 pending[1].resolve(result('blob:new'));await flush();pending[0].resolve(result('blob:old'));await flush();assert.equal(descendants(x.preview).find(n=>n.tag==='img').src,'blob:new');assert.equal(x.w.selectedIndex,5);
 x.find('演出预览').onclick();assert.equal(x.preview.children.length,0);
});
