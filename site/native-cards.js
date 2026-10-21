/* Browser view consumes an adapter; local files never enter the demo project. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id), adapter = window.GCSNingguAdapter;
  const dialog = $('native-card-dialog'), content = $('native-card-content');
  let records = [], branches = null, selectedIndex = 0, searchText = '';
  let cardTicket = 0, branchTicket = 0;
  const names = {cards:'',branches:''};
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
  function renderDetails(record,right) {
    right.append(el('div','NINGGU · LOCAL / READ ONLY','native-eyebrow'),el('h3',adapter.cardName(record)),el('p','ID：'+record.id,'native-subtitle'));
    const metrics=el('div',undefined,'native-metrics');
    for(const k of ['cost','type','damage','hits','block','chill']) if(Object.hasOwn(record.value,k)) {
      const box=el('div');box.append(el('small',adapter.labels[k]),el('strong',k==='cost' && record.value.x_cost ? 'X（原始值 '+record.value[k]+'）' : format(record.value[k])));metrics.append(box);
    }
    right.append(el('h4','基础属性'),metrics);
    const options=branches?.[record.id] || [];
    right.append(el('h4','基础与升级'),el('p',branches===null ? '未加载分支文件：暂不推断普通升级。选择升级分支 JSON 后查看完整升级。' : options.length ? '分支互斥，各自从基础计算，不叠加普通升级。' : '此卡没有特殊分支，可预览一次普通升级。','native-subtitle'));
    const tabs=el('div',undefined,'native-tabs'), detail=el('section',undefined,'native-upgrade');
    const choices=[{name:'基础',branch:null,upgraded:false},...options.map(b=>({name:b.name || b.id,branch:b,upgraded:false}))];
    if(branches!==null && !options.length && Object.keys(record.value).some(k=>k.startsWith('upgrade_') || k==='chill_stack_damage' && record.value[k]?.upgrade_bonus)) choices.push({name:'普通升级 +1',branch:null,upgraded:true});
    for(const choice of choices) {
      const b=el('button',choice.name);b.setAttribute('aria-pressed','false');
      b.onclick=()=>{for(const button of tabs.children) {button.classList.remove('active');button.setAttribute('aria-pressed','false');}b.classList.add('active');b.setAttribute('aria-pressed','true');detail.replaceChildren();if(choice.branch?.description) detail.append(el('p',choice.branch.description,'native-branch-description'));compare(record,choice.branch,detail,choice.upgraded);};
      tabs.append(b);
    }
    right.append(tabs,detail);tabs.firstChild.click();
    const special=Object.fromEntries(Object.entries(record.value).filter(([k])=>!adapter.labels[k] && !['id','name'].includes(k) && !k.startsWith('upgrade_')));
    right.append(el('h4','其他 / 特殊效果原始字段'),el('p','以下字段按原文保留，不猜测触发条件或战斗结算。art 路径仅作文本展示。','native-subtitle'));fields(special,right);
    const upgrades=Object.fromEntries(Object.entries(record.value).filter(([k])=>k.startsWith('upgrade_')));
    if(Object.keys(upgrades).length) raw('普通升级修正原始字段',upgrades,right);
    raw('完整基础 JSON',record.value,right);
  }
  function render() {
    content.replaceChildren();
    if(!records.length) {content.append(el('p','选择 basic_cards.json 和 special_upgrade_branches.json 开始。文件只保留在本页内存中。','native-empty'));return;}
    const layout=el('div',undefined,'native-layout'),left=el('div',undefined,'native-list'),right=el('section',undefined,'native-detail');
    const search=el('input');search.type='search';search.placeholder='搜索名称、ID、类型、标签';search.setAttribute('aria-label','搜索真实卡牌');search.value=searchText;
    const count=el('p','','native-subtitle'),listing=el('div');
    function list() {
      listing.replaceChildren();
      const found=records.map((r,i)=>({r,i})).filter(({r})=>(adapter.cardName(r)+' '+r.id+' '+(r.value.type || '')+' '+(r.value.tags || []).join(' ')).toLowerCase().includes(searchText.trim().toLowerCase()));
      count.textContent='匹配 '+found.length+' / '+records.length;
      if(!found.length) listing.append(el('p','没有匹配的卡牌','native-subtitle'));
      for(const {r,i} of found) {
        const b=el('button',adapter.cardName(r)+' · '+r.id,'native-record'+(i===selectedIndex ? ' active' : ''));b.setAttribute('aria-pressed',String(i===selectedIndex));
        b.onclick=()=>{selectedIndex=i;right.replaceChildren();renderDetails(r,right);list();};listing.append(b);
      }
    }
    search.oninput=()=>{searchText=search.value;list();};
    left.append(search,count,listing);renderDetails(records[selectedIndex],right);list();layout.append(left,right);content.append(layout);
  }
  function status() {
    const orphan=branches ? Object.keys(branches).filter(id=>!records.some(r=>r.id===id)) : [];
    $('native-file-status').textContent=(names.cards ? names.cards+' · '+records.length+' 张' : '未选择卡牌')+' / '+(names.branches ? names.branches+' · '+Object.values(branches).flat().length+' 个分支' : '未选择分支')+(orphan.length ? '；未关联卡牌的分支组：'+orphan.join('、') : '')+' · 仅内存查看';
  }
  async function load(kind,file) {
    if(!file) return;
    const ticket=kind==='cards' ? ++cardTicket : ++branchTicket;
    const current=()=>ticket===(kind==='cards' ? cardTicket : branchTicket);
    try {
      if(file.size>8*1024*1024) throw new Error('文件超过 8MB');
      const json=JSON.parse(await file.text());
      const value=kind==='cards' ? adapter.readRecords(json) : adapter.readBranches(json);
      if(!current()) return;
      if(kind==='cards') {records=value;selectedIndex=0;searchText='';} else branches=value;
      names[kind]=file.name;status();render();
    } catch(e) {if(current()) $('native-file-status').textContent='读取失败：'+e.message+'；保留上次有效内容';}
  }
  $('native-card-btn').onclick=()=>dialog.showModal();$('native-close').onclick=()=>dialog.close();
  $('native-card-file').onchange=e=>load('cards',e.target.files[0]);
  $('native-branch-file').onchange=e=>load('branches',e.target.files[0]);
  $('native-clear').onclick=()=>{++cardTicket;++branchTicket;records=[];branches=null;selectedIndex=0;searchText='';names.cards='';names.branches='';$('native-card-file').value='';$('native-branch-file').value='';status();render();};
  window.GCSNativeCardReader={readRecords:adapter.readRecords,cardName:adapter.cardName};
})();

