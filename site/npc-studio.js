(function(root){
  'use strict';
  const E = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let tab='overview';
  function kind(n){return n.npcKind==='hero' || (n.npcKind==null && n.id==='npc-lin') ? 'hero':'normal';}
  function chips(n){return n.tags.split(/[,，]/).map(s=>s.trim()).filter(Boolean).map(s=>'<span class="chip">'+E(s)+'</span>').join('') || '<span class="hint">暂未设置</span>';}
  function badge(s){return '<span class="npc-tag">'+E(s)+'</span>';}
  function btn(action,title){return '<button data-action="'+action+'" class="npc-link">'+E(title)+' →</button>';}
  function field(label,key,val,type='text',max=300){return '<label class="field">'+E(label)+'<input data-npc-field="'+E(key)+'" type="'+type+'" '+(type==='number'?'min="0" max="999" step="1"':'maxlength="'+max+'"')+' value="'+E(val==null?'':val)+'"></label>';}
  function box(title,body){return '<section class="npc-panel"><h3>'+E(title)+'</h3>'+body+'</section>';}
  function card(type,title,desc,target){return '<div class="npc-action"><span class="npc-action-icon">'+type+'</span><div><strong>'+E(title)+'</strong><small>'+E(desc)+'</small></div><button data-action="npc-tab" data-tab="'+target+'" class="npc-link">打开 →</button></div>';}
  function portrait(n){return '<div class="npc-portrait-view">'+(n.image?'<img src="'+E(n.image)+'" alt="'+E(n.name)+'立绘">':'<div class="npc-empty-portrait">◉<small>暂无人物图片</small></div>')+'</div>';}
  function eventList(n,data,allowEdit){
    const linked=data.events.filter(ev=>ev.participants.includes(n.id));
    const linkedHTML=linked.map(ev=>'<div class="npc-event-row"><span class="npc-event-icon">☷</span><div><strong>'+E(ev.title)+'</strong><small>'+ev.dialogues.length+' 句对白 · '+ev.choices.length+' 个选项</small></div><button data-action="jump" data-group="events" data-id="'+E(ev.id)+'">打开 ↗</button>'+(allowEdit?'<button data-action="npc-event-remove" data-id="'+E(ev.id)+'" title="从演示事件的参与人物中移除">移除</button>':'')+'</div>').join('');
    return (linkedHTML || '<div class="npc-empty">目前没有关联的演示事件。</div>');
  }
  function tabs(){const all=[['overview','人物总览'],['portrait','人物形象'],['appear','出场与事件'],['mechanics','英雄玩法'],['combat','战斗关联']];return '<div class="npc-tabs">'+all.map(([id,title])=>'<button data-action="npc-tab" data-tab="'+id+'" class="'+(id===tab?'active':'')+'">'+title+'</button>').join('')+'</div>';}
  function overview(n,data){
    const events=data.events.filter(e=>e.participants.includes(n.id));
    return '<div class="npc-two-col">'+
      box('人物形象',portrait(n)+'<div class="npc-inline-actions">'+btn('npc-go-portrait','编辑资料和立绘')+'</div>')+
      box('在游戏中如何使用','<p class="npc-muted">以下关联来自当前 GCS 演示工作区，非已连接游戏的真实 NPC 数据。</p>'+
        card('☷','参与养成事件',events.length+' 个演示事件关联','appear')+
        card('♥','英雄专属互动',kind(n)==='hero'?'送礼、好感、祝福、偶遇':'普通 NPC 不使用英雄好感','mechanics')+
        card('⚔','战斗身份',n.npcEnemyId?'已关联演示敌人 '+n.npcEnemyId:'暂未关联','combat')+
        '<div class="npc-hint-box">点击上方功能标签可以配置。这里保存的是演示内容，不会改变游戏运行机制。</div>')+
      '</div>';
  }
  function appearance(n){
    return '<div class="npc-two-col">'+box('立绘与头像',portrait(n)+'<div class="npc-inline-actions"><button data-action="image">上传人物图片</button><button data-action="image-clear" '+(!n.image?'disabled':'')+'>移除图片</button></div><p class="npc-muted">图片保存到演示 JSON；不会替换游戏文件。</p>')+
      box('人物资料','<div class="form-grid">'+field('人物姓名','name',n.name)+field('身份 / 定位','role',n.role)+'</div>'+'<label class="field">人物类型<select data-npc-field="npcKind"><option value="normal" '+(kind(n)==='normal'?'selected':'')+'>普通 NPC</option><option value="hero" '+(kind(n)==='hero'?'selected':'')+'>英雄（专属玩法）</option></select></label>'+
        field('标签','tags',n.tags)+
        '<label class="field">创作备注<textarea data-npc-field="bio" maxlength="20000">'+E(n.bio)+'</textarea></label>'+
        '<label class="field">主题色<input data-npc-field="color" type="color" value="'+E(n.color)+'"></label>'+
        '<p class="npc-muted">人物 ID：'+E(n.id)+' · 关联使用稳定 ID；角色类型仅作为原型数据。</p>')+
      '</div>';
  }
  function appearances(n,data){
    const available=data.events.filter(ev=>!ev.participants.includes(n.id));
    return '<div class="npc-two-col">'+
      box('参与的事件','<p class="npc-muted">更改关联会同步修改当前演示剧情中的参与人物；不改变游戏中的实际事件入口。</p>'+eventList(n,data,true)+
        '<div class="npc-add-event"><select id="npc-event-candidate" aria-label="选择要加入的演示事件"><option value="">选择演示事件</option>'+available.map(e=>'<option value="'+E(e.id)+'">'+E(e.title)+'</option>').join('')+'</select><button data-action="npc-event-add" '+(!available.length?'disabled':'')+'>添加关联</button></div>')+
      box('出场路径预览','<div class="npc-flow"><div>养成行动／触发条件</div><span>↓</span><div>养成事件：'+E(data.events.find(e=>e.participants.includes(n.id))?.title||'待关联')+'</div><span>↓</span><div>人物对白与立绘：'+E(n.name)+'</div><span>↓</span><div>后续结算由事件系统处理</div></div><p class="npc-muted">这是关系示意，事件的触发条件与战斗胜负不在此修改。</p>')+'</div>';
  }
  function mechanics(n){
    if(kind(n)!=='hero')return box('英雄专属系统','<div class="npc-empty">当前人物是普通 NPC，没有好感、送礼或祝福配置。<br>如需演示英雄玩法，可在「人物形象」中切换人物类型。</div>');
    return '<div class="npc-two-col">'+
      box('茶馆偶遇（演示）','<p class="npc-muted">偶遇与好感分开配置：偶遇本身不增加好感。</p><label class="npc-toggle"><input type="checkbox" data-npc-field="npcEncounter" '+(n.npcEncounter?'checked':'')+'>参与茶馆偶遇</label>'+
        field('偶遇前置条件（备注）','npcCondition',n.npcCondition||'')+
        '<div class="npc-hint-box">仅存入演示草稿。实际茶馆候选名单和条件仍需游戏运行代码支持。</div>')+
      box('送礼、好感与祝福（演示）','<p class="npc-muted">只有英雄才使用好感系统。送礼后才计算好感变化。</p>'+
        '<div class="form-grid">'+field('单次送礼好感','npcGiftBonus',n.npcGiftBonus??10,'number')+field('祝福解锁门槛','npcBlessing',n.npcBlessing??70,'number')+'</div>'+
        '<div class="npc-flow"><div>玩家赠送礼物</div><span>↓</span><div>好感增长</div><span>↓</span><div>达到门槛后解锁祝福</div></div><div class="npc-hint-box">该区域尚未接入 Godot 的好感和祝福逻辑。</div>')+'</div>';
  }
  function combat(n){
    return '<div class="npc-two-col">'+
      box('敌人关联（演示）','<p class="npc-muted">剧情人物和战斗敌人是不同的数据对象。本页只记录演示关联。</p>'+
        field('敌人 ID（留空即不关联）','npcEnemyId',n.npcEnemyId||'')+
        field('最大生命（仅原型）','npcEnemyHP',n.npcEnemyHP??32,'number')+
        '<div class="npc-hint-box">填写敌人 ID 不会创建敌人，也不会更改真实战斗入口或特殊机制。</div>')+
      box('事件 → 战斗示意','<div class="npc-flow"><div>养成事件</div><span>↓</span><div>事件判断是否开战</div><span>↓</span><div>敌人配置：'+E(n.npcEnemyId||'尚未选择')+'</div><span>↓</span><div>战斗胜负由事件结算</div></div>')+'</div>';
  }
  function renderEditor(n,data){
    const content={overview:overview,portrait:appearance,appear:appearances,mechanics,combat};
    return '<div class="npc-studio"><div class="npc-head-note"><span>养成角色工作台 · 可交互原型</span><span>演示数据，非游戏写回</span></div>'+tabs()+content[tab](n,data)+'</div>';
  }
  function renderPreview(n,data){
    const events=data.events.filter(e=>e.participants.includes(n.id));
    return '<div class="preview-label">养成人物预览 <span>演示</span></div>'+
      '<div class="portrait-frame npc-preview-portrait">'+(n.image?'<img src="'+E(n.image)+'" alt="'+E(n.name)+'的人物图">':'<span class="npc-preview-empty">◉</span>')+
      '<div class="portrait-overlay"><strong style="color:'+E(n.color)+'">'+E(n.name)+'</strong><small>'+E(n.role)+'</small></div></div>'+
      '<div class="image-actions"><button data-action="image">上传人物图</button><button data-action="image-clear" '+(!n.image?'disabled':'')+'>移除图片</button></div>'+
      '<div class="npc-preview-identity">'+badge(kind(n)==='hero'?'英雄':'普通 NPC')+(n.npcEnemyId?badge('有战斗关联'):'')+'</div>'+
      '<div class="preview-section"><h3>人物标签</h3><div class="chips">'+chips(n)+'</div></div>'+
      '<div class="metric-grid"><div class="metric"><strong>'+events.length+'</strong><small>演示事件</small></div><div class="metric"><strong>'+data.cards.filter(c=>c.owner===n.id).length+'</strong><small>演示卡牌</small></div></div>'+
      '<div class="preview-section"><h3>参与事件</h3>'+eventList(n,data,false)+'</div>'+
      '<div class="notice">目前 NPC 与剧情为演示工作区，编辑草稿可导出 JSON，但不会写入本地游戏项目。卡牌的真实写回功能保持独立。</div>';
  }

  // Real-project rendering never consults the demo workspace.
  function actualSources(n){return (n.sources||[]).map(s=>'<p class="npc-muted">'+E(s)+' · 本地只读</p>').join('');}
  function info(label,value){return '<p class="npc-muted"><strong>'+E(label)+'：</strong>'+E(value===undefined||value===null||value===''?'—':value)+'</p>';}
  const portraitSelection=new WeakMap();
  function loadedPortraits(n){return (n.portraits||[]).filter(p=>p.image);}
  function selectedPortrait(n){const list=loadedPortraits(n),ref=portraitSelection.get(n);return list.find(p=>p.ref===ref)||list.find(p=>p.ref===n.portraitRef)||list[0]||{ref:n.portraitRef,image:n.image,path:n.portraitPath};}
  function selectRealPortrait(n,index){const p=loadedPortraits(n)[index];if(p)portraitSelection.set(n,p.ref);}
  function actualPortrait(n){
    const p=selectedPortrait(n),list=loadedPortraits(n);
    const thumbnails=list.length>1?'<div class="npc-portrait-thumbnails" role="group" aria-label="切换本地人物立绘">'+list.map((v,i)=>'<button type="button" data-action="npc-portrait-select" data-index="'+i+'" aria-pressed="'+(v.ref===p.ref)+'" title="'+E(v.label+' · '+v.ref)+'"><img src="'+E(v.image)+'" alt="'+E(v.label)+'"><span>'+E(v.label)+'</span></button>').join('')+'</div>':'';
    return portrait({...n,image:p.image})+thumbnails+'<div class="npc-inline-actions"><button type="button" data-action="npc-portrait-replace" '+(!p.image||!p.path||!p.originalBytes||!root.GCSProject?.getState().handle?'disabled':'')+'>更换图片</button></div><p class="npc-muted">'+(!root.GCSProject?.getState().handle?'当前文件夹兼容模式只读；请用支持目录访问的 Chrome / Edge 重新连接。':!p.image||!p.originalBytes?'当前图片不存在或未取得原图快照，无法替换。':'仅替换当前版本的现有 PNG。先对比、备份和授权，才会写入游戏。')+'</p>'+info('源码立绘引用',p.ref)+info('已加载文件',p.path)+(p.sources||[]).map(v=>info('立绘依据',v.source+':'+v.line)).join('')+(n.portraitRef&&!n.image?'<p class="npc-muted">主立绘引用的文件不存在或无法读取。未按相似文件名替换。</p>':'');
  }
  function actualEvents(n){
    return (n.events||[]).map(e=>{
      const sections=e.sections?.length?e.sections:[e],participants=[...new Set(e.references||(e.dialogues||[]).flatMap(d=>[d.speaker,d.left,d.right]).filter(Boolean))];
      const title=e.title||e.eventId||'对白片段 · '+(e.function||'字面量');
      return '<details class="npc-real-event"><summary><span class="npc-real-event-title">'+E(title)+'</span><small>'+E([e.eventId,(e.dialogues||[]).length+' 句对白',participants.length+' 位参与人物'].filter(Boolean).join(' · '))+'</small></summary><div class="npc-real-event-body">'+info('事件 ID',e.eventId)+info('参与人物',participants.join('、'))+'<p class="npc-muted">触发条件未核实。以下按来源片段展示，包含不同分支，不代表一次播放顺序。</p>'+sections.map(section=>'<div class="npc-real-event-section">'+info('对白片段',section.function)+info('来源',section.source+':'+section.line)+
        (section.dialogues||[]).map(d=>'<div class="npc-event-row"><div><strong>'+E(d.speaker||'旁白')+'</strong><p>'+E(d.text)+'</p><small>'+E([d.left&&'左侧：'+d.left,d.right&&'右侧：'+d.right,d.mood&&'表情：'+d.mood,d.anchor_label&&'分支锚点：'+d.anchor_label].filter(Boolean).join(' · '))+'</small></div></div>').join('')+
        ((section.branches||[]).length?'<div class="npc-real-branches"><strong>分支与跳转标记</strong>'+(section.branches||[]).map(b=>'<p class="npc-muted">'+E(Object.entries(b).map(([k,v])=>k+'：'+v).join(' · '))+'</p>').join('')+'</div>':'')+
        (section.code?'<details class="npc-source-code"><summary>查看该片段源码</summary><pre>'+E(section.code)+'</pre></details>':'')+'</div>').join('')+'</div></details>';
    }).join('')||'<div class="npc-empty">当前定向读取的养成来源中，没有找到明确的对白关联。</div>';
  }
  function actualMechanics(n){
    if(!n.hero)return box('英雄玩法',info('识别结果',n.npcKind==='unverified'?'仅发现立绘映射键，尚未确认出场':'在已读取的英雄配置中无匹配记录')+'<p class="npc-muted">好感、送礼和祝福字段留空，不使用演示数值。</p>');
    const h=n.hero,c=h.config||{},values=h.constants||{},runtime=h.runtime||{};
    const labels={affection_init:'配置初始好感',preferred_gift:'偏好礼物 ID（配置）',affection_from_gift:'送礼好感（配置）',blessing_name:'祝福名称（配置）',blessing_id:'祝福 ID（配置）'};
    const constantLabels={TEAHOUSE_AFFECTION_INITIAL:'实际初始化好感',TEAHOUSE_AFFECTION_ENCOUNTER_GAIN:'每次偶遇好感增量',TEAHOUSE_AFFECTION_BLESSING_THRESHOLD:'祝福触发好感阈值'};
    return '<div class="npc-two-col">'+box('真实英雄配置',info('英雄 ID',h.id)+Object.entries(c).map(([k,v])=>info(labels[k]||k,typeof v==='object'?JSON.stringify(v):v)).join('')+
      Object.entries(values).map(([k,v])=>info(constantLabels[k]||k,v)).join('')+info('茶馆偶遇概率',typeof h.encounterChance==='number'?(h.encounterChance*100)+'%':undefined)+
      info('运行送礼好感增量',runtime.giftGain)+info('每次消耗礼物数量',runtime.giftCost)+
      info('偏好礼物检查',typeof runtime.preferredGiftRead==='boolean'?(runtime.preferredGiftRead?'送礼函数中存在该字段引用':'送礼函数未读取偏好礼物字段'):undefined)+
      info('茶馆偶遇日期范围',runtime.dayStart!==undefined&&runtime.dayEnd!==undefined?'第 '+runtime.dayStart+' 至 '+runtime.dayEnd+' 天':undefined)+
      info('本英雄进入偶遇池的条件（源码）',runtime.encounterCondition)+
      '<p class="npc-muted">配置值与运行代码分别展示。偏好字段不代表送礼时已执行偏好加成；祝福的触发与同步以右侧源码为准。</p>')+
      box('养成运行依据（只读）',(h.rules||[]).map(r=>'<div class="npc-panel"><h3>'+E(r.name)+'</h3>'+info('来源',r.source+':'+r.line)+'<pre class="npc-muted" style="white-space:pre-wrap;overflow-wrap:anywhere">'+E(r.code)+'</pre></div>').join('')||'<p class="npc-muted">未读取到可验证的运行规则。</p>')+'</div>';
  }
  function actualCombat(n){
    const enemies=n.enemies||[];
    return box('同名敌人定义',enemies.length?enemies.map(e=>'<div class="npc-panel">'+info('敌人 ID',e.id)+info('最大生命',e.max_hp)+info('匹配依据','对白姓名与敌人 name 字段完全一致')+info('来源',e.source)+'</div>').join(''):'<p class="npc-muted">没有找到同名敌人定义。未根据立绘复用或近似姓名推断身份。</p>')+
      '<p class="npc-muted">同名定义表示可核验的关联，不代表这些对白函数必定触发该敌人的战斗。</p>';
  }
  function actualEditor(n){
    let content='';
    if(tab==='overview')content='<div class="npc-two-col">'+box('人物形象',actualPortrait(n))+box('真实人物信息',info('姓名 / 显示键',n.name)+info('身份依据',n.role)+info('事件 / 对白来源组',(n.events||[]).length)+info('同名敌人定义',(n.enemies||[]).length)+actualSources(n))+'</div>';
    if(tab==='portrait')content='<div class="npc-two-col">'+box('本地人物立绘',actualPortrait(n))+box('人物识别依据',info('显示键',n.name)+info('记录 ID',n.id)+actualSources(n)+'<p class="npc-muted">相同图片可被多个称谓共用，不据此合并人物。预览键和仅有映射的记录保留来源状态。</p>')+'</div>';
    if(tab==='appear')content=box('养成事件与对白来源','<p class="npc-muted">标题和事件 ID 来自源码。缺少标题时保留对白片段名；仅合并有唯一直接调用依据的辅助片段。</p>'+actualEvents(n));
    if(tab==='mechanics')content=actualMechanics(n);
    if(tab==='combat')content=actualCombat(n);
    return '<div class="npc-studio"><div class="npc-head-note"><span>养成角色工作台 · 真实项目</span><span>立绘可替换 · 人物资料只读</span></div>'+tabs()+content+'</div>';
  }
  function actualPreview(n){
    const image=selectedPortrait(n).image;
    return '<div class="preview-label">养成人物预览 <span>真实项目 / 立绘可替换</span></div>'+
      '<div class="portrait-frame npc-preview-portrait">'+(image?'<img src="'+E(image)+'" alt="'+E(n.name)+'的人物图">':'<span class="npc-preview-empty">◉</span>')+
      '<div class="portrait-overlay"><strong>'+E(n.name)+'</strong><small>'+E(n.role)+'</small></div></div>'+
      '<div class="npc-preview-identity">'+badge(n.name)+badge(n.role)+((n.enemies||[]).length?badge('有同名敌人定义'):'')+'</div>'+actualSources(n)+
      '<div class="metric-grid"><div class="metric"><strong>'+(n.events||[]).length+'</strong><small>对白来源组</small></div><div class="metric"><strong>'+(n.portraits?loadedPortraits(n).length:(image?1:0))+'</strong><small>已加载本地立绘</small></div></div>'+
      '<div class="notice">资料来自当前游戏文件夹。姓名相近、图片相同都不会自动合并身份；人物资料、立绘和剧情仅保留在本地内存。</div>';
  }
  root.GCSNPCStudio={renderEditor,renderPreview,renderRealEditor:actualEditor,renderRealPreview:actualPreview,selectRealPortrait,selectedPortrait,setTab(t){if(['overview','portrait','appear','mechanics','combat'].includes(t))tab=t;},getTab(){return tab;},kind};
})(typeof window!=='undefined'?window:globalThis);
