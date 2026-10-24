// Invoked by the existing real-project, read-only browser harness.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
module.exports=async function({page,screens,errors}){
 const npcTab=()=>page.locator('[data-module=npcs]'),eventsTab=()=>page.locator('[data-module=events]');
 async function person(id){await npcTab().click();await page.locator('#search').fill(id.slice('cultivation:'.length));await page.locator('#record-list [data-id='+JSON.stringify(id)+']').click();await page.locator('[data-tab=appear]').click();}
 const targets=await page.evaluate(()=>__directoryTest.s.npcRecords.flatMap(n=>n.events.map((e,index)=>({npc:n.id,index,target:GCSNPCProject.resolveEventTarget(e,__directoryTest.s.eventWorkspace.eventRecords)}))));
 let verified=0;
 for(const item of targets){await person(item.npc);const row=page.locator('.npc-real-event').nth(item.index);await row.locator(':scope > summary').click();
  if(!item.target){assert.equal(await row.locator('[data-action=npc-open-event]').count(),0);assert(await row.locator('.npc-real-event-section').count()>0);continue;}
  await row.locator('[data-action=npc-open-event]').click();assert(await eventsTab().evaluate(n=>n.classList.contains('active')));
  assert.equal(await page.evaluate(()=>GCSProject.getState().eventWorkspace.manifest.id),item.target.id);
  assert(await page.locator('#editor h2').isVisible());assert(await page.locator('#record-list .record.active').first().isVisible());
  if(item.target.caseValue){const active=await page.evaluate(value=>{const w=GCSProject.getState().eventWorkspace;return GCSEventStories.caseIndex(GCSEventReading.model(w),value);},item.target.caseValue);assert(active>=0);assert.equal(await page.locator('[data-reading-case="'+active+'"]').getAttribute('aria-pressed'),'true');}
  verified++;
 }
 // A real script draft is retained when either module navigation or a target switch is rejected.
 const tea=targets.find(x=>x.target?.caseValue==='jianan');assert(tea);await person(tea.npc);let row=page.locator('.npc-real-event').nth(tea.index);await row.locator(':scope > summary').click();await row.locator('[data-action=npc-open-event]').click();
 await page.getByRole('button',{name:'编辑剧本',exact:true}).click();await page.locator('.story-reading > .event-script-row').first().click();const input=page.locator('#editor textarea[data-event-line]').first(),draft=(await input.inputValue())+'〔跳转验收〕';await input.fill(draft);
 page.once('dialog',d=>d.dismiss());await npcTab().click();assert(await eventsTab().evaluate(n=>n.classList.contains('active')));assert.equal(await input.inputValue(),draft);
 page.once('dialog',d=>d.accept());await person(tea.npc);row=page.locator('.npc-real-event').nth(tea.index);await row.locator(':scope > summary').click();
 page.once('dialog',d=>d.dismiss());await row.locator('[data-action=npc-open-event]').click();assert(await npcTab().evaluate(n=>n.classList.contains('active')));assert(await page.evaluate(()=>GCSProject.getState().eventWorkspace.changes.length)>0);
 page.once('dialog',d=>d.accept());await row.locator('[data-action=npc-open-event]').click();assert(await eventsTab().evaluate(n=>n.classList.contains('active')));assert.equal(await page.evaluate(()=>GCSProject.getState().eventWorkspace.changes.length),0);
 // Duplicate source identity removes the action while preserving full details.
 await person(tea.npc);await page.evaluate(target=>{const s=__directoryTest.s,r=s.eventWorkspace.eventRecords.find(r=>r.manifest.id===target.id);s.eventWorkspace.eventRecords.push({...r,manifest:{...r.manifest,id:'ambiguous-test'}});window.dispatchEvent(new CustomEvent('gcs-project-change'));},tea.target);
 row=page.locator('.npc-real-event').nth(tea.index);await row.locator(':scope > summary').click();assert.equal(await row.locator('[data-action=npc-open-event]').count(),0);assert(await row.locator('.npc-real-event-section').count()>0);
 await page.evaluate(()=>{const a=__directoryTest.s.eventWorkspace.eventRecords;a.splice(a.findIndex(r=>r.manifest.id==='ambiguous-test'),1);window.dispatchEvent(new CustomEvent('gcs-project-change'));});
 // Card drafts and locked saves also guard the cross-module action.
 await person(tea.npc);await page.evaluate(()=>{const w=GCSProject.getState().workspace;window.__cardBefore=w.records[0].name;w.edit(w.records[0].id,'name',w.records[0].name+' check');});
 row=page.locator('.npc-real-event').nth(tea.index);await row.locator(':scope > summary').click();page.once('dialog',d=>d.dismiss());await row.locator('[data-action=npc-open-event]').click();assert(await npcTab().evaluate(n=>n.classList.contains('active')));assert(await page.evaluate(()=>GCSProject.getState().workspace.changes.length)>0);await page.evaluate(()=>GCSProject.getState().workspace.reset());

 await person(tea.npc);await page.evaluate(()=>{__directoryTest.s.workspace.setLocked(true);});row=page.locator('.npc-real-event').nth(tea.index);await row.locator(':scope > summary').click();await row.locator('[data-action=npc-open-event]').click();assert(await npcTab().evaluate(n=>n.classList.contains('active')));await page.evaluate(()=>__directoryTest.s.workspace.setLocked(false));
 await row.locator(':scope > summary').click();
 if(screens>=0){const dir=path.resolve(process.argv[screens+1]);await fs.mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,'npc-event.png')});await row.locator('[data-action=npc-open-event]').click();await page.screenshot({path:path.join(dir,'correct-story.png')});}
 assert.deepEqual(errors,[]);console.log('NPC_NAVIGATION_BROWSER_PASS '+verified+' real NPC event links; exact source scopes, stages, person cases, ambiguity, draft reject/accept and save locks.');
};
