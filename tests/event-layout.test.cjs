const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');

test('real event layout is removed when switching to NPC, cards or a disconnected project',()=>{
 const app=fs.readFileSync('site/app.js','utf8');
 const fn=app.match(/function syncWorkspaceLayout\(\)\s*\{([^]*?)\n  \}/);assert(fn,'layout state must be synchronized by the application route');
 const classes=new Set();let real=false;
 const sync=new Function('$','realEvents',fn[1]);
 const query=selector=>{assert.equal(selector,'.workspace');return {classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}};};
 for(const isReal of [false,true,true,false,true,false]){real=isReal;sync(query,()=>real);assert.equal(classes.has('event-workspace'),real);}
 assert.match(app,/function render\(\)\s*\{\s*syncWorkspaceLayout\(\);/);
});

test('only real event layout hides preview, gives its column to editor and limits reading width',()=>{
 const css=fs.readFileSync('site/styles.css','utf8');
 assert.match(css,/\.workspace\.event-workspace:not\(\.event-preview-open\)\s*>\s*#preview\s*\{[^}]*display:\s*none/);
 assert.match(css,/\.workspace\.event-workspace:not\(\.event-preview-open\)\s*>\s*#editor\s*\{[^}]*grid-column:\s*3\s*\/\s*-1/);
 assert.match(css,/\.workspace\.event-workspace\s*>\s*#editor\s*>\s*\*\s*\{[^}]*max-width:\s*860px/);
 assert.match(css,/\.workspace\.event-workspace\s*>\s*#editor\s*\{[^}]*min-width:\s*0/);
});

test('future expanded event panel has a scoped layout extension without changing default modules',()=>{
 const css=fs.readFileSync('site/styles.css','utf8');
 assert.match(css,/\.workspace\.event-workspace\.event-preview-open\s*>\s*#editor\s*\{[^}]*grid-column:\s*3/);
 assert.match(css,/\.workspace\.event-workspace\.event-preview-open\s*>\s*#preview\s*\{[^}]*grid-column:\s*4/);
 assert.match(css,/@media\s*\(max-width:\s*1000px\)\s*\{\s*\.workspace\.event-workspace\.event-preview-open/);
});
