(() => {
  'use strict';
  const M = window.GCSModel;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = 'gcs.prototype.v1.workspace';
  let data = M.clone(M.seed), module = 'npcs', selected = data.npcs[0].id, query = '', toastTimer, pendingConfirm, readState, storageFailed = false;
  let loadMessage = '';
  try { const stored = localStorage.getItem(key); if(stored) { data = M.validate(JSON.parse(stored)); selected = data.npcs[0]?.id || ''; loadMessage = '已恢复上次的本地工作区'; } } catch { loadMessage = '本地暂存不可用或格式异常；已载入演示。请用 JSON 备份。'; }
  const meta = {npcs:['NPC 人物','CHARACTERS','人物'], events:['剧情事件','STORY EVENTS','事件'], cards:['卡牌设计','CARD LIBRARY','卡牌']};
  const realCards = () => module==='cards' && window.GCSProject.getState().connected;
  const realNPCs = () => module==='npcs' && window.GCSProject.getState().connected;
  const npcRecords = () => window.GCSProject.getState().npcRecords || [];
  const current = () => (realNPCs()?npcRecords():data[module]).find(x=>x.id===selected);
  const label = x => x.name || x.title || '未命名';
  const find = (g,id) => data[g].find(x=>x.id===id);
  const options = (g,value,empty='未关联',filter=()=>true) => `<option value="">${esc(empty)}</option>` + data[g].filter(filter).map(x=>`<option value="${esc(x.id)}" ${x.id===value?'selected':''}>${esc(label(x))}</option>`).join('');
  const select = (caption,bind,opts) => `<label class="field">${caption}<select data-bind="${bind}">${opts}</select></label>`;
  const input = (caption,bind,value,type='text') => `<label class="field">${caption}<input data-bind="${bind}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" max="999" step="1"':'maxlength="300"'}></label>`;
  const textarea = (caption,bind,value) => `<label class="field">${caption}<textarea data-bind="${bind}" maxlength="20000">${esc(value)}</textarea></label>`;
  const section = (title,body,extra='') => `<section class="section"><h3 class="section-title">${title}${extra}</h3>${body}</section>`;
  const jump = (g,id,text,sub='',symbol='↗') => `<button class="relation" data-action="jump" data-group="${g}" data-id="${esc(id)}"><span class="relation-icon">${symbol}</span><div><strong>${esc(text)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div><span class="arrow">↗</span></button>`;
  const empty = text => `<div class="empty">${text}</div>`;
  function toast(text) { $('#toast').textContent=text; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500); $('#status-text').textContent=text; }
  function confirmAction(title,message,callback) { $('#confirm-title').textContent=title; $('#confirm-message').textContent=message; pendingConfirm=callback; $('#confirm').showModal(); }
  function persist() {
    try { localStorage.setItem(key,JSON.stringify(data)); storageFailed=false; $('#save-state').textContent='✓ 已自动暂存 · '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}); }
    catch { $('#save-state').textContent='暂存失败 · 请保存 JSON'; if(!storageFailed)toast('浏览器本地空间不足或被禁用。修改仍在当前页面，请保存 JSON。'); storageFailed=true; }
  }
  function go(g,id) { if(g==='npcs')window.GCSNPCStudio.setTab('overview'); if(g==='cards' && id && window.GCSProject.getState().connected && !window.GCSProject.getState().records.some(r=>r.id===id)){toast('此卡牌关联属于演示项目，尚未与真实项目建立映射。');return;} module=g; selected=id; query=''; $('#search').value=''; render(); $('#editor').scrollTop=0; }
  function renderList() {
    document.querySelectorAll('[data-module]').forEach(b=>b.classList.toggle('active',b.dataset.module===module));
    $('#npc-count').textContent=window.GCSProject.getState().connected?npcRecords().length:data.npcs.length; $('#event-count').textContent=data.events.length; $('#card-count').textContent=window.GCSProject.getState().connected ? window.GCSProject.getState().records.length : data.cards.length;
    $('#library-title').textContent=meta[module][0]; $('#library-en').textContent=meta[module][1];
    $('#add-btn').hidden=realCards()||realNPCs();
    $('.library-foot').textContent=realCards()?'游戏项目 · 内存编辑':realNPCs()?'游戏人物 · 来源可追溯 · 只读':module==='cards'?'演示卡牌 · 未连接游戏项目':'演示内容工作区 · ID 稳定关联';
    const connection=window.GCSProject.getState();
    $('.project-label').textContent=connection.connected?connection.name+' / 卡牌工作副本 · NPC 只读 · 剧情演示':data.project.name+' / 演示项目';
    if(realCards()){window.GCSGameCards.renderList(connection.records,selected,query);return;}
    if(realNPCs()){
      const all=npcRecords(),hits=all.filter(x=>(x.name+' '+x.portraitRef+' '+x.sources.join(' ')).toLowerCase().includes(query.toLowerCase()));
      $('#library-en').textContent='GAME / 只读';$('#list-count').textContent=hits.length+' / '+all.length;
      $('#record-list').innerHTML=hits.length?hits.map(x=>`<button class="record ${x.id===selected?'active':''}" data-action="select" data-id="${esc(x.id)}">${x.image?`<img class="avatar" src="${esc(x.image)}" alt="">`:'<span class="record-symbol">◉</span>'}<span class="record-info"><span class="record-title">${esc(x.name)}</span><span class="record-sub">${esc(x.role||'身份未核实 · 本地来源')}</span></span></button>`).join(''):empty(connection.npcError?'NPC 识别失败，请查看中间的错误说明':query?'没有匹配的人物':'没有找到可验证的 NPC 人物');
      return;
    }
    const records=data[module].filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase()));
    $('#list-count').textContent=records.length+' / '+data[module].length;
    $('#record-list').innerHTML=records.length?records.map(x=>`<button class="record ${x.id===selected?'active':''}" data-action="select" data-id="${esc(x.id)}">${module==='npcs'&&x.image?`<img class="avatar" src="${esc(x.image)}" alt="">`:`<span class="record-symbol">${module==='events'?'☷':module==='cards'?'◇':'◉'}</span>`}<span class="record-info"><span class="record-title">${esc(label(x))}</span><span class="record-sub">${esc(module==='npcs'?x.role:module==='events'?`${x.dialogues.length} 句对白 · ${x.choices.length} 个选项`:`${x.kind} · ${x.rarity} · 费用 ${x.cost}`)}</span></span></button>`).join(''):empty(query?'没有匹配的内容':'列表为空，点击 ＋ 新建');
    if(module==='cards')$('#library-en').textContent='DEMO / 未连接游戏项目';
  }
  function render() {
    if(realNPCs()){
      const state=window.GCSProject.getState();
      if(!npcRecords().some(n=>n.id===selected))selected=npcRecords()[0]?.id||'';
      renderList();const n=current();
      if(state.npcError){$('#editor').innerHTML='<div class="npc-studio"><h2>真实 NPC 加载失败</h2><p>'+esc(state.npcError)+'</p><p>卡牌项目仍可正常使用；未回退显示演示 NPC。</p></div>';$('#preview').innerHTML='<div class="preview-label">真实 NPC / 未能加载</div>';}
      else if(!n){$('#editor').innerHTML=empty('没有从当前游戏项目识别到真实 NPC。');$('#preview').innerHTML='<div class="preview-label">真实 NPC / 无数据</div>';}
      else{$('#editor').innerHTML=window.GCSNPCStudio.renderRealEditor(n);$('#preview').innerHTML=window.GCSNPCStudio.renderRealPreview(n);}
      return;
    }
    if(realCards()){const state=window.GCSProject.getState();if(!state.records.some(r=>r.id===selected))selected=state.records[0]?.id || '';renderList();window.GCSGameCards.render(state.records.find(r=>r.id===selected),state.branches,$('#editor'),$('#preview'));return;}
    if(!current()) selected=data[module][0]?.id || '';
    renderList(); renderEditor(); renderPreview();
  }
  function renderEditor() {
    const x=current();
    if(!x) { $('#editor').innerHTML=empty(`还没有${meta[module][2]}<br><button class="primary" data-action="new">＋ 新建${meta[module][2]}</button>`); return; }
    let body='';
    if(module==='npcs') {
      body=window.GCSNPCStudio.renderEditor(x,data);
    } else if(module==='events') {
      body=section('事件资料',input('事件标题','title',x.title)+textarea('事件概要','summary',x.summary));
      body+=section('参与人物',`<div class="chips">${data.npcs.map(n=>`<label class="participant"><input type="checkbox" data-participant="${esc(n.id)}" ${x.participants.includes(n.id)?'checked':''}>${esc(n.name)}</label>`).join('')||'<span class="hint">先创建 NPC，再关联到事件。</span>'}</div><p class="check-note">勾选后可设为对白说话人；取消勾选会将该人物的对白改为旁白。</p>`);
      body+=section('对白列表',x.dialogues.map((l,i)=>`<div class="dialogue-row"><div class="dialogue-toolbar"><span class="line-number">${String(i+1).padStart(2,'0')}</span><select aria-label="第 ${i+1} 句说话人" data-line="${i}" data-line-key="speaker">${options('npcs',l.speaker,'旁白',n=>x.participants.includes(n.id))}</select><div class="row-actions"><button data-action="line-up" data-index="${i}" ${i===0?'disabled':''} aria-label="上移第 ${i+1} 句">↑</button><button data-action="line-down" data-index="${i}" ${i===x.dialogues.length-1?'disabled':''} aria-label="下移第 ${i+1} 句">↓</button><button data-action="line-delete" data-index="${i}" aria-label="删除第 ${i+1} 句">×</button></div></div><textarea data-line="${i}" data-line-key="text" aria-label="第 ${i+1} 句对白" maxlength="20000">${esc(l.text)}</textarea></div>`).join('')||empty('还没有对白，点击“添加对白”开始。'),'<button data-action="line-add">＋ 添加对白</button>');
      body+=section('选项与分支',`<p class="hint">对白结束后展示选项。目标留空表示结束；关联卡牌只记录内容关系。</p>`+x.choices.map((c,i)=>`<div class="choice-row"><div class="choice-head">分支 ${String(i+1).padStart(2,'0')}<div class="row-actions"><button data-action="choice-delete" data-index="${i}" aria-label="删除分支 ${i+1}">×</button></div></div><label class="field">选项文字<input data-choice="${i}" data-choice-key="text" value="${esc(c.text)}" maxlength="300"></label><div class="form-grid"><label class="field">跳转事件<select data-choice="${i}" data-choice-key="target">${options('events',c.target,'结束剧情')}</select></label><label class="field">关联卡牌<select data-choice="${i}" data-choice-key="rewardCard">${options('cards',c.rewardCard,'无卡牌')}</select></label></div><div class="chips">${c.target?`<button class="inline-link" data-action="jump" data-group="events" data-id="${esc(c.target)}">查看目标事件 ↗</button>`:''}${c.rewardCard?`<button class="inline-link" data-action="jump" data-group="cards" data-id="${esc(c.rewardCard)}">查看关联卡牌 ↗</button>`:''}</div></div>`).join(''),'<button data-action="choice-add">＋ 添加选项</button>');
    } else {
      body=section('卡牌属性',input('卡牌名称','name',x.name)+`<div class="form-grid">${select('卡牌类型','kind',['攻击','技能','能力'].map(s=>`<option ${s===x.kind?'selected':''}>${s}</option>`).join(''))}${select('稀有度','rarity',['普通','稀有','史诗'].map(s=>`<option ${s===x.rarity?'selected':''}>${s}</option>`).join(''))}${input('费用','cost',x.cost,'number')}${input('效果数值','power',x.power,'number')}</div>`+textarea('效果描述（演示文案）','description',x.description)+input('卡面主题色','color',x.color,'color'));
      body+=section('内容关联',`<div class="form-grid">${select('所属人物','owner',options('npcs',x.owner))}${select('来源事件','source',options('events',x.source))}</div>${x.owner?jump('npcs',x.owner,find('npcs',x.owner).name,'所属人物','◉'):''}${x.source?jump('events',x.source,find('events',x.source).title,'来源事件','☷'):''}`);
      body+=section('升级分支',`<p class="hint">将现有卡牌设为升级目标，可设置多个方向。每个目标都是独立可编辑的卡牌。</p>${x.upgrades.map((id,i)=>`<div class="upgrade-row"><select data-upgrade="${i}" aria-label="升级方向 ${i+1}">${options('cards',id,'选择升级目标',c=>c.id!==x.id)}</select><button data-action="jump" data-group="cards" data-id="${esc(id)}" aria-label="打开升级卡牌">↗</button><button data-action="upgrade-delete" data-index="${i}" aria-label="删除升级方向 ${i+1}">×</button></div>`).join('')}<div class="upgrade-row"><select id="upgrade-candidate" aria-label="新增升级目标">${options('cards','','选择新的升级目标',c=>c.id!==x.id&&!x.upgrades.includes(c.id))}</select><button data-action="upgrade-add">＋ 关联</button></div><p class="check-note">不允许重复目标、自身升级或循环升级。</p>`);
    }
    $('#editor').innerHTML=`<div class="editor-heading"><div><div class="breadcrumb">内容工作台 / ${meta[module][0]} / 编辑</div><h2 id="record-heading">${esc(label(x))}</h2><div class="record-id">${esc(x.id)}</div></div><div class="heading-actions"><button data-action="duplicate">复制</button><button data-action="delete" class="danger-link">删除</button></div></div>${body}`;
  }
  function renderPreview() {
    const x=current(); if(!x){$('#preview').innerHTML='<div class="preview-label">内容预览</div>'+empty('新建内容后在此预览');return;}
    const imageButtons=`<div class="image-actions"><button data-action="image">上传${module==='npcs'?'人物图':'卡面图'}</button><button data-action="image-clear" ${!x.image?'disabled':''}>移除图片</button></div>`;
    let html='';
    if(module==='npcs') {
      html=window.GCSNPCStudio.renderPreview(x,data);
    } else if(module==='events') {
      html=`<div class="preview-label">事件检视 <span>实时</span></div><div class="event-mini"><small>STORY / ${esc(x.id)}</small><h3>${esc(x.title)}</h3><p>${esc(x.summary)}</p><button class="primary" data-action="read">▷ 试读这段剧情</button></div><div class="metric-grid"><div class="metric"><strong>${x.dialogues.length}</strong><small>对白条数</small></div><div class="metric"><strong>${x.choices.length}</strong><small>分支选项</small></div></div><div class="preview-section"><h3>参与人物</h3>${x.participants.map(id=>jump('npcs',id,find('npcs',id).name,'编辑人物资料','◉')).join('')||'<p>暂无参与人物</p>'}</div><div class="preview-section"><h3>分支去向</h3>${x.choices.map(c=>`<div class="branch-link">${c.target?`<button class="inline-link" data-action="jump" data-group="events" data-id="${esc(c.target)}">${esc(find('events',c.target).title)}</button>`:'<span class="hint">结束剧情</span>'}</div>`).join('')||'<p>对白结束后直接结束</p>'}</div><div class="notice">试读使用当前编辑数据。不会执行奖励或游戏逻辑，可随时退出。</div>`;
    } else {
      html=`<div class="preview-label">卡面预览 <span>实时</span></div><div class="card-face" style="--card-color:${x.color}"><div class="card-top"><span class="cost">${x.cost}</span><span class="card-type">${esc(x.kind)}</span></div><div class="card-art">${x.image?`<img src="${esc(x.image)}" alt="${esc(x.name)}的卡面图">`:`<span class="sigil">${x.kind==='攻击'?'✧':x.kind==='能力'?'♜':'✦'}</span>`}</div><div class="card-name">${esc(x.name)}</div><div class="card-rarity">${esc(x.rarity)}</div><div class="card-description">${esc(x.description)}</div><div class="card-bottom"><span>${esc(find('npcs',x.owner)?.name||'未绑定人物')}</span><span>效果数值 <b>${x.power}</b></span></div></div>${imageButtons}<div class="preview-section"><h3>升级方向</h3>${x.upgrades.map(id=>jump('cards',id,find('cards',id).name,`${find('cards',id).rarity} · 费用 ${find('cards',id).cost}`,'◇')).join('')||'<p>当前卡牌没有升级分支</p>'}</div><div class="notice">卡面是可操作的内容预览。数值和描述独立编辑；描述不会自动执行或随数值改写。</div>`;
    }
    $('#preview').innerHTML=html;
  }
  function changed(full=false) { persist(); if(realCards()){render();return;} renderList(); if(full)renderEditor(); else if($('#record-heading'))$('#record-heading').textContent=label(current()); renderPreview(); }
  function mutate(callback) { callback(); changed(true); }
  function newRecord() {
    if(realCards()||realNPCs())return;
    const id=module.slice(0,-1)+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);
    const x=module==='npcs'?{id,name:'新人物',role:'待设定',tags:'',bio:'',image:'',color:'#9aacf0'}:module==='events'?{id,title:'新事件',summary:'',participants:[],dialogues:[],choices:[]}:{id,name:'新卡牌',kind:'技能',rarity:'普通',cost:1,power:0,description:'',owner:'',source:'',upgrades:[],image:'',color:'#9aacf0'};
    data[module].push(x);selected=id;query='';$('#search').value='';persist();render();toast('已新建'+meta[module][2]);
  }
  function checkUpgrade(callback) { const before=M.clone(current().upgrades); callback(); try{M.validate(data);changed(true);}catch(e){current().upgrades=before;renderEditor();toast(e.message);} }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.module){go(b.dataset.module,'');return;}
    const a=b.dataset.action;const i=Number(b.dataset.index);const x=current();
    if(module==='npcs' && a==='npc-tab'){window.GCSNPCStudio.setTab(b.dataset.tab);if(realNPCs())render();else{renderEditor();renderPreview();}return;}
    if(realNPCs()&&a!=='select')return;
    if(module==='npcs' && a==='npc-go-portrait'){window.GCSNPCStudio.setTab('portrait');renderEditor();return;}
    if(module==='npcs' && a==='npc-event-add'){
      const id=$('#npc-event-candidate')?.value,ev=data.events.find(e=>e.id===id);
      if(!ev || !current() || ev.participants.includes(current().id)){toast('请先选择尚未关联的演示事件');return;}
      ev.participants.push(current().id);changed(true);toast('已关联演示事件；不会改变游戏项目');return;
    }
    if(module==='npcs' && a==='npc-event-remove'){
      const ev=data.events.find(e=>e.id===b.dataset.id),npc=current();
      if(!ev||!npc||!ev.participants.includes(npc.id))return;
      confirmAction('移除事件关联？','这会从演示事件的参与人物中移除该 NPC，并将该人物已有对白改为旁白。不会修改游戏项目。',()=>{
        ev.participants=ev.participants.filter(id=>id!==npc.id);
        ev.dialogues.forEach(line=>{if(line.speaker===npc.id)line.speaker='';});
        changed(true);toast('已移除演示事件关联');
      });return;
    }
    if(a==='select'){selected=b.dataset.id;if(module==='npcs')window.GCSNPCStudio.setTab('overview');render();$('#editor').scrollTop=0;return;}
    if(a==='jump'){go(b.dataset.group,b.dataset.id);return;}
    if(a==='new'){newRecord();return;}
    if(realCards())return;
    if(!a||!x)return;
    if(a==='duplicate'){const copy=M.clone(x);copy.id=module.slice(0,-1)+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);copy[module==='events'?'title':'name']+=' · 副本';data[module].push(copy);selected=copy.id;query='';$('#search').value='';persist();render();toast('已复制，可独立编辑');}
    if(a==='delete'){const g=module,id=x.id;confirmAction('删除“'+label(x)+'”？','删除后会清除其他内容对它的关联。若删除人物，对白保留并改为旁白；若删除事件，指向它的分支改为结束。此操作不能撤销，建议先保存 JSON。',()=>{M.remove(data,g,id);selected='';persist();render();toast('已删除并清理关联');});}
    if(a==='line-add')mutate(()=>x.dialogues.push({speaker:x.participants[0]||'',text:''}));
    if(a==='line-delete')mutate(()=>x.dialogues.splice(i,1));
    if(a==='line-up')mutate(()=>[x.dialogues[i-1],x.dialogues[i]]=[x.dialogues[i],x.dialogues[i-1]]);
    if(a==='line-down')mutate(()=>[x.dialogues[i],x.dialogues[i+1]]=[x.dialogues[i+1],x.dialogues[i]]);
    if(a==='choice-add')mutate(()=>x.choices.push({text:'新的选项',target:'',rewardCard:''}));
    if(a==='choice-delete')mutate(()=>x.choices.splice(i,1));
    if(a==='upgrade-delete')mutate(()=>x.upgrades.splice(i,1));
    if(a==='upgrade-add'){const id=$('#upgrade-candidate').value;if(!id){toast('请先选择升级目标');return;}checkUpgrade(()=>x.upgrades.push(id));}
    if(a==='image'){$('#image-file').value='';$('#image-file').click();}
    if(a==='image-clear')mutate(()=>x.image='');
    if(a==='read'){readState={event:x.id,index:0};renderReader();$('#reader').showModal();}
  });
  function applyField(t) {
    if(realCards()||realNPCs())return;
    const x=current();if(!x)return;
    if(module==='npcs' && t.dataset.npcField){
      const k=t.dataset.npcField;
      let value=t.type==='checkbox'?t.checked:t.type==='number'?Number(t.value):t.value;
      if(t.type==='number' && (t.value===''||!t.validity.valid||!Number.isInteger(value)||value<0||value>999))return;
      if(k==='npcEnemyId' && value && !/^[a-zA-Z0-9_-]{1,100}$/.test(value))return;
      if(k==='npcKind' && !['normal','hero'].includes(value))return;
      x[k]=value;changed(t.tagName==='SELECT'||t.type==='checkbox');return;
    }
    if(t.dataset.bind){const k=t.dataset.bind;if(t.type==='number'){if(!t.validity.valid||t.value==='')return;x[k]=Number(t.value);}else{x[k]=t.value;}changed(t.tagName==='SELECT');}
    if(t.dataset.line!==undefined){x.dialogues[Number(t.dataset.line)][t.dataset.lineKey]=t.value;changed();}
    if(t.dataset.choice!==undefined){x.choices[Number(t.dataset.choice)][t.dataset.choiceKey]=t.value;changed(t.tagName==='SELECT');}
  }
  $('#editor').addEventListener('input',e=>{if(e.target.tagName!=='SELECT'&&e.target.type!=='checkbox')applyField(e.target);});
  $('#editor').addEventListener('change',e=>{
    if(realCards()||realNPCs())return;
    const t=e.target,x=current();
    if(module==='npcs' && t.dataset.npcField && (t.tagName==='SELECT'||t.type==='checkbox')){applyField(t);return;}
    if(t.tagName==='SELECT' && t.dataset.upgrade===undefined)applyField(t);
    if(t.dataset.participant){mutate(()=>{const id=t.dataset.participant;if(t.checked)x.participants.push(id);else{x.participants=x.participants.filter(n=>n!==id);x.dialogues.forEach(l=>{if(l.speaker===id)l.speaker='';});}});}
    if(t.dataset.upgrade!==undefined){if(!t.value){mutate(()=>x.upgrades.splice(Number(t.dataset.upgrade),1));}else checkUpgrade(()=>x.upgrades[Number(t.dataset.upgrade)]=t.value);}
  });
  $('#editor').addEventListener('focusout',e=>{
    if(realCards()||realNPCs())return;
    const t=e.target;
    if(t.dataset.bind==='name'||t.dataset.bind==='title'){if(!t.value.trim()){t.value='未命名'+meta[module][2];applyField(t);toast('名称不能为空，已设为“'+t.value+'”');}}
    if(t.type==='number'&&(!t.validity.valid||t.value==='')){t.value=current()[t.dataset.bind];toast('请输入 0～999 的整数；已保留上次有效数值。');}
  });
  $('#search').addEventListener('input',e=>{query=e.target.value;renderList();});
  $('#add-btn').onclick=newRecord;
  $('#help-btn').onclick=()=>$('#help').showModal();$('#close-help').onclick=()=>$('#help').close();
  $('#confirm-no').onclick=()=>{$('#confirm').close();pendingConfirm=null;};
  $('#confirm-yes').onclick=()=>{const fn=pendingConfirm;pendingConfirm=null;$('#confirm').close();fn?.();};
  $('#confirm').addEventListener('cancel',()=>pendingConfirm=null);
  $('#reset-btn').onclick=()=>confirmAction('重置演示项目？','当前工作区将被初始演示替换。请先保存 JSON，便于恢复修改。',()=>{data=M.clone(M.seed);module='npcs';selected=data.npcs[0].id;query='';$('#search').value='';persist();render();toast('已恢复初始演示数据');});
  $('#export-btn').onclick=()=>{
    try {M.validate(data);}catch(e){toast('无法保存：'+e.message);return;}
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='GCS-'+data.project.name.replace(/[^\p{L}\p{N}_-]/gu,'_')+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);toast('已生成 JSON，文件位置请查看浏览器下载记录');
  };
  $('#import-btn').onclick=()=>{$('#json-file').value='';$('#json-file').click();};
  $('#json-file').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;if(file.size>25*1024*1024){toast('文件超过 25 MB，无法导入');return;}
    try {const imported=M.validate(JSON.parse(await file.text()));confirmAction('导入“'+imported.project.name+'”？',`将用 ${imported.npcs.length} 个人物、${imported.events.length} 个事件、${imported.cards.length} 张卡牌替换当前工作区。未导出的修改会被覆盖。`,()=>{data=imported;module='npcs';selected=data.npcs[0]?.id||'';query='';$('#search').value='';persist();render();toast('JSON 导入成功，全部关联已恢复');});}catch(err){toast('导入失败，原有数据未变：'+(err instanceof SyntaxError?'JSON 文件格式错误':err.message));}
  };
  $('#image-file').onchange=async e=>{
    const file=e.target.files[0],record=current();if(realNPCs()||!file||!record)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){toast('请使用不超过 2 MB 的 PNG、JPG 或 WebP 图片');return;}
    try {const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('图片读取失败'));r.readAsDataURL(file);});await new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=()=>reject(new Error('图片内容损坏，无法预览'));im.src=url;});record.image=url;changed();toast('图片已内嵌，保存 JSON 时会一起保留');}catch(err){toast(err.message);}
  };
  function renderReader() {
    const e=find('events',readState.event),line=e.dialogues[readState.index];
    let body='';
    if(line){body=`<div class="reader-speaker">${esc(find('npcs',line.speaker)?.name||'旁白')}</div><div class="reader-line">${esc(line.text||'（空白对白）')}</div><div class="dialog-actions"><span class="reader-progress">${readState.index+1} / ${e.dialogues.length}</span><button data-reader="previous" ${readState.index===0?'disabled':''}>上一句</button><button data-reader="next" class="primary">${readState.index===e.dialogues.length-1?'查看选项 →':'下一句 →'}</button></div>`;}
    else {body=`<div class="reader-speaker">${e.choices.length?'接下来，你会……':'本段剧情结束'}</div><div class="reader-choices">${e.choices.map((c,i)=>`<button data-reader="choice" data-index="${i}">${esc(c.text||'（未命名选项）')} <span class="text-muted">${c.rewardCard?' · 关联 '+esc(find('cards',c.rewardCard).name):''}</span></button>`).join('')}</div><div class="dialog-actions">${e.dialogues.length?'<button data-reader="previous">返回对白</button>':''}<button data-reader="restart">重新试读</button><button data-reader="close">返回编辑</button></div>`;}
    $('#reader-content').innerHTML=`<div class="reader-top"><span>剧情试读 / ${esc(e.title)}</span><button data-reader="close" aria-label="关闭试读">×</button></div>${body}<div class="reader-caption">试读仅演示对白与分支路径，不执行卡牌奖励或条件判定。</div>`;
  }
  $('#reader').addEventListener('click',e=>{
    const b=e.target.closest('[data-reader]');if(!b||b.disabled)return;
    const a=b.dataset.reader;
    if(a==='close'){$('#reader').close();return;}
    if(a==='next')readState.index++;
    if(a==='previous')readState.index=Math.max(0,readState.index-1);
    if(a==='restart')readState.index=0;
    if(a==='choice'){const c=find('events',readState.event).choices[Number(b.dataset.index)];if(!c.target){$('#reader-content').innerHTML=`<div class="reader-top">试读结束<button data-reader="close">×</button></div><div class="reader-line">这段旅程暂告一段落。</div><div class="reader-caption">${c.rewardCard?'关联卡牌：'+esc(find('cards',c.rewardCard).name)+'（仅展示，未执行奖励）':'没有关联卡牌'}</div><div class="dialog-actions"><button data-reader="restart-origin">从当前编辑事件重试</button><button data-reader="close" class="primary">返回编辑</button></div>`;return;}readState={event:c.target,index:0};}
    if(a==='restart-origin')readState={event:current().id,index:0};
    renderReader();
  });
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(!$('dialog[open]'))$('#export-btn').click();}});
  window.addEventListener('gcs-project-change',event=>{if(event.detail?.kind==='draft' && realCards()){renderList();window.GCSGameCards.refresh?.();}else render();});
  render();$('#save-state').textContent=loadMessage.includes('不可用')?'暂存异常 · 请保存 JSON':loadMessage?'✓ 已恢复本地暂存':'演示项目 · 修改自动暂存';if(loadMessage)toast(loadMessage);
})();
