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
  document.getElementById('library-en').textContent='GAME PROJECT / 本地只读';
  const found=records.filter(r=>JSON.stringify(r.value).toLowerCase().includes(query.toLowerCase()));
  document.getElementById('list-count').textContent=found.length+' / '+records.length;
  for(const record of found){
   const b=el('button',undefined,'record'+(record.id===selected?' active':''));b.dataset.action='select';b.dataset.id=record.id;b.setAttribute('aria-pressed',String(record.id===selected));
   const info=el('span',undefined,'record-info');info.append(el('span',adapter.cardName(record),'record-title'),el('span',record.id+' · '+(record.value.type || '未设置类型')+' · 费用 '+(record.value.x_cost?'X':format(record.value.cost)),'record-sub'));
   b.append(el('span','◇','record-symbol'),info);listing.append(b);
  }
  if(!found.length)listing.append(el('p','没有匹配的卡牌','empty'));
 }
 function render(record,branches,editor,preview){
  editor.replaceChildren();preview.replaceChildren();if(!record)return;
  const heading=el('div',undefined,'editor-heading'),title=el('div');title.append(el('div','游戏项目 / 真实卡牌 / 只读','breadcrumb'),el('h2',adapter.cardName(record)),el('div',record.id,'record-id'));heading.append(title,el('span','本地文件','chip'));editor.append(heading);
  const options=branches[record.id] || [];
  editor.append(el('p','选择右侧升级方向，查看基础属性、修正与最终属性。这里只预览数据，不执行战斗结算。','hint'));
  const comparison=el('section',undefined,'game-comparison');editor.append(comparison);
  const extra=Object.fromEntries(Object.entries(record.value).filter(([k])=>!adapter.labels[k] && !['id','name'].includes(k) && !k.startsWith('upgrade_')));
  editor.append(el('h3','其他 / 特殊效果原始字段','section-title'),el('p','未解释字段按原文保留，art 路径仅作文本展示。','hint'));fields(extra,editor);
  const upgrades=Object.fromEntries(Object.entries(record.value).filter(([k])=>k.startsWith('upgrade_')));
  if(Object.keys(upgrades).length)raw('普通升级修正原始字段',upgrades,editor);
  raw('完整基础 JSON',record.value,editor);
  preview.append(el('div','真实卡牌预览 · 本地只读','preview-label'));
  const face=el('div',undefined,'card-face game-card-face');preview.append(face,el('h3','升级方向','game-upgrade-heading'));
  const tabs=el('div',undefined,'native-tabs game-branch-tabs');preview.append(tabs);
  preview.append(el('p',options.length?'各分支独立从基础计算，不叠加普通升级。':'无特殊分支；配置支持时可预览普通升级 +1。','hint'));
  const description=el('div',undefined,'game-branch-info');preview.append(description,el('div','文件仅读取，不写回游戏。此预览不加载本地美术或推测未解释效果。','notice'));
  const choices=[{name:'基础',branch:null,upgraded:false},...options.map(branch=>({name:branch.name || branch.id,branch,upgraded:false}))];
  if(!options.length && Object.keys(record.value).some(k=>k.startsWith('upgrade_') || k==='chill_stack_damage' && record.value[k]?.upgrade_bonus))choices.push({name:'普通升级 +1',branch:null,upgraded:true});
  for(const choice of choices){
   const button=el('button',choice.name);button.setAttribute('aria-pressed','false');
   button.onclick=()=>{
    for(const other of tabs.children){other.classList.remove('active');other.setAttribute('aria-pressed','false');}button.classList.add('active');button.setAttribute('aria-pressed','true');
    const result=adapter.preview(record,choice.branch,choice.upgraded),data=result.final;
    comparison.replaceChildren(el('h3',choice.name+' · 属性对比','section-title'));compare(record,choice.branch,comparison,choice.upgraded);
    face.replaceChildren();const top=el('div',undefined,'card-top');top.append(el('span',data.x_cost?'X':format(data.cost),'cost'),el('span',data.type || '未设置','card-type'));
    const art=el('div',undefined,'card-art');art.append(el('span','✧','sigil'));
    face.append(top,art,el('div',choice.branch?.name || adapter.cardName(record),'card-name'),el('div',choice.name,'card-rarity'),el('div',adapter.describe(data),'card-description'));
    description.replaceChildren();if(choice.branch?.description)description.append(el('p',choice.branch.description,'native-branch-description'));if(choice.branch)raw('该分支原始数据',choice.branch,description);
   };
   tabs.append(button);
  }
  tabs.firstChild.click();
 }
 window.GCSGameCards={renderList,render};
})();
