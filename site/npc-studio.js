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

  // Project NPC pages display only verifiable local sources; no demo data or edit controls.
  function actualSources(n){return (n.sources||[]).map(s=>'<div class="npc-event-row"><div><strong>'+E(s)+'</strong><small>本地项目文件 · 只读</small></div></div>').join('');}
  function actualPortrait(n){return portrait(n)+'<p class="npc-muted">立绘引用：'+E(n.portraitRef||'未发现明确引用')+'</p><p class="npc-muted">图片文件：'+E(n.portraitPath||'尚未解析到本地图片文件')+'</p>';}
  function actualEvents(n){
    return (n.events||[]).map(e=>'<div class="npc-event-row"><span class="npc-event-icon">☷</span><div><strong>'+E(e.source)+'</strong><small>匹配到 '+e.count+' 处人物字段引用 · 不等同于 '+e.count+' 个独立事件</small></div></div>').join('')||
      '<div class="npc-empty">在当前读取的养成对白来源中未识别到明确的人物字段引用；不能据此认定没有出场事件。</div>';
  }
  function actualEditor(n){
    let content='';
    if(tab==='overview')content='<div class="npc-two-col">'+
      box('人物形象',actualPortrait(n))+
      box('真实项目来源','<p class="npc-muted">以下资料仅来自当前选择的本地游戏文件，未修改游戏数据。</p>'+actualSources(n)+
       '<div class="npc-action"><div><strong>出场与对白</strong><small>识别到 '+(n.events||[]).reduce((v,e)=>v+e.count,0)+' 处明确引用</small></div></div>'+
       '<div class="npc-action"><div><strong>英雄系统</strong><small>'+(n.npcKind==='hero'?'在英雄配置中找到匹配记录':'尚未核实英雄身份')+'</small></div></div>'+
       '<div class="npc-action"><div><strong>战斗身份</strong><small>'+E(n.enemy?'匹配到敌人 ID：'+n.enemy.id:'未找到同名敌人配置')+'</small></div></div>')+'</div>';
    if(tab==='portrait')content='<div class="npc-two-col">'+box('本地人物立绘',actualPortrait(n))+box('人物识别依据','<p class="npc-muted">姓名：'+E(n.name)+'</p><p class="npc-muted">稳定显示键：'+E(n.id)+'</p>'+actualSources(n)+'<p class="npc-muted">只读。没有获取到图片时不会用演示立绘替换。</p>')+'</div>';
    if(tab==='appear')content='<div class="npc-two-col">'+box('养成对白中的实际引用','<p class="npc-muted">只统计 speaker / left / right 对人物姓名的明确引用。尚未推断事件 ID、标题、触发条件或奖励。</p>'+actualEvents(n))+box('关联范围说明','<p class="npc-muted">本页仅作源文件引用检查；养成事件的流程仍归独立事件系统。未解析的事件不会编造关联。</p>')+'</div>';
    if(tab==='mechanics')content=box('英雄专属系统',n.npcKind==='hero'?
      '<p class="npc-muted">在游戏 HERO_AFFINITY_CONFIG 中识别到此人物。送礼好感、祝福与茶馆偶遇是不同系统；当前仅确认身份，没有擅自填入数值或条件。</p>'+actualSources(n):
      '<div class="npc-empty">没有足够的本地源码证据确认此人物为英雄。本页不会为其生成好感、送礼或祝福参数。</div>');
    if(tab==='combat')content=box('敌人关联',n.enemy?
      '<p class="npc-muted">通过 NPC 姓名与敌人 JSON 的唯一同名记录建立只读候选关联。</p>'+
      '<p>敌人 ID：'+E(n.enemy.id)+'</p><p>最大生命：'+E(n.enemy.max_hp==null?'来源未提供':n.enemy.max_hp)+'</p><p class="npc-muted">来源：'+E(n.enemy.source)+'</p><p class="npc-muted">特殊行为脚本与剧情入口不在此次读取范围内，不能推断已经接线。</p>':
      '<div class="npc-empty">敌人 JSON 未出现唯一同名记录。无法确认战斗关联，不自动填写敌人 ID。</div>');
    return '<div class="npc-studio"><div class="npc-head-note"><span>养成 NPC · 真实游戏数据</span><span>本地只读 · 不写回</span></div>'+tabs()+content+'</div>';
  }
  function actualPreview(n){
    return '<div class="preview-label">养成人物预览 <span>真实项目 / 只读</span></div>'+
      '<div class="portrait-frame npc-preview-portrait">'+(n.image?'<img src="'+E(n.image)+'" alt="'+E(n.name)+'的人物图">':'<span class="npc-preview-empty">◉</span>')+
      '<div class="portrait-overlay"><strong>'+E(n.name)+'</strong><small>'+E(n.role)+'</small></div></div>'+
      '<div class="npc-preview-identity">'+badge(n.npcKind==='hero'?'已确认英雄':'养成人物')+(n.enemy?badge('同名敌人定义'):'')+'</div>'+
      '<div class="preview-section"><h3>人物来源</h3>'+actualSources(n)+'</div>'+
      '<div class="metric-grid"><div class="metric"><strong>'+(n.events||[]).reduce((a,e)=>a+e.count,0)+'</strong><small>对白字段引用</small></div><div class="metric"><strong>'+(n.image?'1':'0')+'</strong><small>已加载本地立绘</small></div></div>'+
      '<div class="notice">本页来自当前游戏文件夹；关联只显示可追溯证据。不会保存或上传本地图片、剧情及其他游戏数据。</div>';
  }
  root.GCSNPCStudio={renderEditor,renderPreview,renderRealEditor:actualEditor,renderRealPreview:actualPreview,setTab(t){if(['overview','portrait','appear','mechanics','combat'].includes(t))tab=t;},getTab(){return tab;},kind};
})(typeof window!=='undefined'?window:globalThis);
