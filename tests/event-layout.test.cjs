const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');

test('real event layout and preview opening never leak into NPC, cards or disconnected routes',()=>{
 const app=fs.readFileSync('site/app.js','utf8'),fn=app.match(/function syncWorkspaceLayout\(\)\s*\{([^]*?)\n  \}/);assert(fn);
 const classes=new Set(),query=selector=>{assert.equal(selector,'.workspace');return {classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}};};
 const sync=new Function('$','realEvents','window',fn[1]);
 for(const [real,open] of [[false,false],[true,false],[true,true],[false,true],[true,true],[true,false]]){
  sync(query,()=>real,{GCSEventStudio:{isPreviewOpen:()=>open},GCSProject:{getState:()=>({eventWorkspace:{}})}});
  assert.equal(classes.has('event-workspace'),real);assert.equal(classes.has('event-preview-open'),real&&open);
 }
 assert.match(app,/function render\(\)\s*\{\s*syncWorkspaceLayout\(\);/);
});

test('closed event preview gives its column to the editor and keeps comfortable reading width',()=>{
 const css=fs.readFileSync('site/styles.css','utf8');
 assert(/\.workspace\.event-workspace:not\(\.event-preview-open\)\s*>\s*#preview\s*\{[^}]*display:\s*none/.test(css));
 assert(/\.workspace\.event-workspace:not\(\.event-preview-open\)\s*>\s*#editor\s*\{[^}]*grid-column:\s*3\s*\/\s*-1/.test(css));
 assert(/\.workspace\.event-workspace\s*>\s*#editor\s*>\s*\*\s*\{[^}]*max-width:\s*860px/.test(css));
});

test('expanded event preview retains scoped desktop and narrow-screen layouts',()=>{
 const css=fs.readFileSync('site/styles.css','utf8');
 assert(/\.workspace\.event-workspace\.event-preview-open\s*>\s*#editor\s*\{[^}]*grid-column:\s*3/.test(css));
 assert(/\.workspace\.event-workspace\.event-preview-open\s*>\s*#preview\s*\{[^}]*grid-column:\s*4/.test(css));
 assert(/@media\s*\(max-width:\s*1000px\)\s*\{\s*\.workspace\.event-workspace\.event-preview-open/.test(css));
});
