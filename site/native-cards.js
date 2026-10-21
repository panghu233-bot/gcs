/* Main-workspace view for the independent card adapter. No game content is bundled. */
(function(){
 'use strict';
 const adapter=window.GCSNingguAdapter;
  const format = v => v === undefined ? '未设置' : typeof v === 'boolean' ? (v ? '是' : '否') : typeof v === 'object' ? JSON.stringify(v,null,2) : String(v);
  function el(tag,text,className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent=String(text);
    if (className) n.className=className;
    return n;
  }
  function raw(title,data,parent) {
    const d=el('details');d.append(el('summary',title),el('pre',JSON.stringify(data,null,2),'native-json'));parent.append(d);
  }
  function fields(data,parent) {
    const table=el('table',undefined,'native-fields');
    for(const [k,v] of Object.entries(data)) {const row=el('tr');row.append(el('th',(adapter.labels[k] || k)+' · '+k),el('td',format(v)));table.append(row);}
    parent.append(table);
  }
  function compare(record,branch,parent,upgraded=false) {
    const result=adapter.preview(record,branch,upgraded);
    parent.append(el('p',adapter.describe(result.final),'native-effect'));
    const table=el('table',undefined,'native-fields native-compare'), header=el('tr');
    for(const name of ['属性','基础','升级修正','最终']) header.append(el('th',name));
    table.append(header);
    const keys=new Set([...Object.keys(record.value).filter(k=>adapter.labels[k]),...result.changes.map(c=>c.key)]);
    for(const k of keys) {
      const c=result.changes.find(c=>c.key===k), row=el('tr');
      row.className=c ? 'native-changed' : '';
      row.append(el('td',adapter.labels[k] || k),el('td',format(c ? c.before : record.value[k])),el('td',c ? (c.mode==='set' ? '设为 '+format(c.modifier) : (c.modifier >= 0 ? '+' : '')+c.modifier) : '—'),el('td',format(c ? c.after : result.final[k])));
      table.append(row);
    }
    parent.append(table);
    if(Object.keys(result.unresolved).length) {parent.append(el('p','以下修正尚未解释，未计入最终值：','native-warning'));fields(result.unresolved,parent);}
    raw('查看升级后的完整字段（含未解释字段）',result.final,parent);
    if(branch) raw('查看该分支原始数据',branch,parent);
  }

 function renderList(records,selected,query){
  const listing=document.getElementById('record-list');listing.replaceChildren();
  document.getElementById('library-en').textContent='GAME PROJECT / 内存工作副本';
  const found=records.filter(r=>JSON.stringify(r.value).toLowerCase().includes(query.toLowerCase()));
  document.getElementById('list-count').textContent=found.length+' / '+records.length;
  for(const record of found){
   const b=el('button',undefined,'record'+(record.id===selected?' active':''));b.dataset.action='select';b.dataset.id=record.id;b.setAttribute('aria-pressed',String(record.id===selected));
   const workspace=window.GCSProject.getState().workspace,modified=workspace?.changes.some(c=>c.cardId===record.id),issue=workspace?.invalid.some(c=>c.cardId===record.id);
   const info=el('span',undefined,'record-info');info.append(el('span',(issue?'⚠ ':modified?'● ':'')+adapter.cardName(record)+(issue?' · 输入待修正':modified?' · 未应用':''),'record-title'),el('span',record.id+' · '+(record.value.type || '未设置类型')+' · 费用 '+(record.value.x_cost?'X':format(record.value.cost)),'record-sub'));
   b.append(el('span','◇','record-symbol'),info);listing.append(b);
  }
  if(!found.length)listing.append(el('p','没有匹配的卡牌','empty'));
 }
 const selectedBranches=new Map();
 function render(record,branches,editor,preview){
  editor.replaceChildren();preview.replaceChildren();if(!record)return;
  const work=window.GCSProject.getState().workspace,cardId=record.id;
  const heading=el('div',undefined,'editor-heading'),title=el('div'),nameHeading=el('h2',adapter.cardName(record)),badge=el('span','内存工作副本','chip');
  title.append(el('div','游戏项目 / 真实卡牌 / 内存编辑','breadcrumb'),nameHeading,el('div',record.id+' · ID 锁定','record-id'));heading.append(title,badge);editor.append(heading);
  const tools=el('div',undefined,'card-edit-tools'),undo=el('button','撤销一步'),revert=el('button','还原此卡'),reset=el('button','还原全部'),check=el('button','校验副本'),download=el('button','导出工作副本');tools.append(undo,revert,reset,check,download);editor.append(tools);
  const feedback=el('p','修改仅保留在内存。应用前可撤销；离开页面前请导出工作副本。','hint');editor.append(feedback);
  undo.onclick=()=>work.undo();revert.onclick=()=>work.reset(cardId);reset.onclick=()=>{if(window.confirm('还原全部未应用的卡牌与分支修改？'))work.reset();};
  check.onclick=()=>{try{work.validate();feedback.textContent='校验通过：字段格式、ID 唯一性、分支关联和保留字段均有效。';}catch(e){feedback.textContent='校验未通过：'+e.message;}};
  download.onclick=()=>{try{work.validate();const url=URL.createObjectURL(new Blob([JSON.stringify({format:'gcs-card-workcopy-v1',documents:work.documents},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='GCS-card-workcopy.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback.textContent='已导出包含两份 JSON 的工作副本；未写回游戏。';}catch(e){feedback.textContent='无法导出：'+e.message;}};
  const fieldNodes=[];
  function createFields(parent,specs){
   for(const spec of specs){const label=el('label',undefined,'field game-edit-field'),input=el('input'),note=el('small',undefined,'field-diff');label.append(el('span',spec.label+' · '+spec.key),input,note);input.type=spec.type;input.value=work.inputValue(spec);if(spec.type==='number'){input.step='1';input.min=spec.min;}input.dataset.cardField=spec.key;if(spec.branchId)input.dataset.branchId=spec.branchId;input.setAttribute('aria-label',(spec.branchId?spec.branchId+' / ':'')+spec.label);input.oninput=()=>work.edit(cardId,spec.key,input.value,spec.branchId);parent.append(label);fieldNodes.push({spec,input,note,label});}
  }
  editor.append(el('h3','基础属性编辑','section-title'));const form=el('div',undefined,'form-grid game-base-fields');createFields(form,work.fields.filter(s=>s.cardId===cardId&&!s.branchId));editor.append(form);
  const diffs=el('section',undefined,'card-diffs'),comparison=el('section',undefined,'game-comparison');editor.append(diffs,comparison);
  const extra=Object.fromEntries(Object.entries(record.value).filter(([k])=>!adapter.labels[k]&&!['id','name'].includes(k)&&!k.startsWith('upgrade_')));editor.append(el('h3','其他 / 特殊效果原始字段','section-title'),el('p','以下字段保留原样，不开放未经确认的编辑；本地美术路径只作文本展示。','hint'));fields(extra,editor);
  const upgrades=Object.fromEntries(Object.entries(record.value).filter(([k])=>k.startsWith('upgrade_')));if(Object.keys(upgrades).length)raw('普通升级原始配置（保持原样）',upgrades,editor);
  const baseRaw=el('details'),basePre=el('pre',undefined,'native-json');baseRaw.append(el('summary','完整工作副本 JSON'),basePre);editor.append(baseRaw);
  preview.append(el('div','真实卡牌 · 工作副本预览','preview-label'));const face=el('div',undefined,'card-face game-card-face');preview.append(face,el('h3','升级方向','game-upgrade-heading'));
  const tabs=el('div',undefined,'native-tabs game-branch-tabs'),branchForm=el('div',undefined,'game-branch-fields'),description=el('div',undefined,'game-branch-info');preview.append(tabs,branchForm,description);
  preview.append(el('div','只修改内存；点击「应用修改到游戏」、检查差异并授权后，才备份及覆盖两份文件。','notice'));
  const options=branches[cardId]||[],choices=[{name:'基础',id:'base',upgraded:false},...options.map(b=>({name:b.name||b.id,id:b.id,upgraded:false}))];
  if(!options.length&&Object.keys(record.value).some(k=>k.startsWith('upgrade_')||k==='chill_stack_damage'&&record.value[k]?.upgrade_bonus))choices.push({name:'普通升级 +1',id:'linear',upgraded:true});
  let active=choices.find(c=>c.id===selectedBranches.get(cardId))||choices[0];
  function refresh(){
   const state=window.GCSProject.getState();record=state.records.find(r=>r.id===cardId);if(!record)return;branches=state.branches;
   const branch=active.id==='base'||active.id==='linear'?null:branches[cardId].find(b=>b.id===active.id),result=adapter.preview(record,branch,active.upgraded),data=result.final;
   const modifications=work.changes.filter(c=>c.cardId===cardId);badge.textContent=modifications.length?'未应用 · '+modifications.length+' 个字段':'内存工作副本';nameHeading.textContent=adapter.cardName(record);basePre.textContent=JSON.stringify(record.value,null,2);
   undo.disabled=!work.canUndo||work.locked;revert.disabled=(!modifications.length&&!work.invalid.length)||work.locked;reset.disabled=(!work.changes.length&&!work.invalid.length)||work.locked;download.disabled=work.locked;check.disabled=work.locked;
   for(const n of fieldNodes){if(!n.input.isConnected)continue;const error=work.error(n.spec),value=work.value(n.spec),before=work.original(n.spec);if(document.activeElement!==n.input)n.input.value=work.inputValue(n.spec);n.input.disabled=work.locked;n.input.setAttribute('aria-invalid',String(!!error));n.label.classList.toggle('edited',JSON.stringify(value)!==JSON.stringify(before));n.note.textContent=error||((value!==before)?'原始：'+format(before)+' → 副本：'+format(value):'原始：'+format(before));}
   diffs.replaceChildren();if(modifications.length){diffs.append(el('h3','此卡未应用修改','section-title'));for(const c of modifications){const row=el('div',undefined,'card-diff-row'),button=el('button','还原此字段');button.disabled=work.locked;button.onclick=()=>work.revertField(cardId,c.key,c.branchId);row.append(el('span',(c.branchId?c.branchId+' / ':'')+c.label+'：'+format(c.before)+' → '+format(c.after)),button);diffs.append(row);}}
   comparison.replaceChildren(el('h3',active.name+' · 基础 / 升级修正 / 最终属性','section-title'));compare(record,branch,comparison,active.upgraded);
   face.replaceChildren();const top=el('div',undefined,'card-top');top.append(el('span',data.x_cost?'X':format(data.cost),'cost'),el('span',data.type||'未设置','card-type'));const art=el('div',undefined,'card-art');art.append(el('span','✧','sigil'));face.append(top,art,el('div',branch?.name||adapter.cardName(record),'card-name'),el('div',active.name,'card-rarity'),el('div',adapter.describe(data),'card-description'));
   description.replaceChildren();if(branch?.description){description.append(el('p','文件原有说明（修改数值后可能未同步）：','hint'),el('p',branch.description,'native-branch-description'));}if(branch)raw('分支原始结构（工作副本）',branch,description);
   for(const button of tabs.children){const selected=button.dataset.branch===active.id;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));button.disabled=work.locked;}
  }
  function choose(choice){active=choice;selectedBranches.set(cardId,choice.id);branchForm.replaceChildren();for(let i=fieldNodes.length-1;i>=0;i--)if(!fieldNodes[i].input.isConnected)fieldNodes.splice(i,1);const specs=work.fields.filter(s=>s.cardId===cardId&&s.branchId===choice.id);if(specs.length){branchForm.append(el('h3','分支数值修正','game-upgrade-heading'));createFields(branchForm,specs);}else branchForm.append(el('p',choice.id==='base'?'编辑中间的基础属性。':'没有可编辑的已确认分支数值；其他字段保留原样。','hint'));refresh();}
  for(const choice of choices){const button=el('button',choice.name);button.dataset.branch=choice.id;button.onclick=()=>choose(choice);tabs.append(button);}
  window.GCSGameCards.refresh=refresh;choose(active);
 }
 window.GCSGameCards={renderList,render,refresh:null};
})();
