(function (root) {
  'use strict';
  const seed = {
    schemaVersion: 1,
    project: { name: '雾港来信' },
    npcs: [
      { id: 'npc-lin', name: '林望舒', role: '星图修复师', tags: '沉静, 观星, 旧友', bio: '在雾港经营一家星图工坊。她总能从破损的航图中找到被遗忘的航线，却从不谈论自己出海的那一年。\n\n一封没有署名的来信，让她重新走向码头。', image: 'assets/lin.svg', color: '#9aacf0' },
      { id: 'npc-zhou', name: '周砚', role: '渡船人', tags: '爽朗, 守信', bio: '雾港最后一班夜渡的船主。熟悉每一处暗礁，也记得每一位乘客。他答应过替故人保管一枚罗盘。', image: 'assets/zhou.svg', color: '#d2ac79' },
      { id: 'npc-su', name: '苏弥', role: '灯塔学徒', tags: '好奇, 机敏', bio: '刚来到旧灯塔的学徒，收集港口的奇闻。最近，她发现灯塔每晚都会向海上发出一段相同的信号。', image: 'assets/su.svg', color: '#8bbfad' }
    ],
    events: [
      { id: 'ev-letter', title: '01 · 雾中的来信', summary: '星图工坊收到一封来自旧灯塔的信。玩家决定接下来的目的地。', participants: ['npc-lin', 'npc-zhou'], dialogues: [{ speaker: 'npc-lin', text: '这封信的邮戳……是十年前的旧灯塔。' }, { speaker: 'npc-zhou', text: '今晚退潮，我的船可以带你过去。' }, { speaker: 'npc-lin', text: '也许，应该先找个人问问信上的符号。' }], choices: [{ text: '跟随周砚前往码头', target: 'ev-pier', rewardCard: 'card-tide' }, { text: '去旧灯塔寻找苏弥', target: 'ev-tower', rewardCard: 'card-star' }] },
      { id: 'ev-pier', title: '02 · 潮声里的约定', summary: '渡船人交出保管多年的罗盘，旅途即将开始。', participants: ['npc-lin', 'npc-zhou'], dialogues: [{ speaker: 'npc-zhou', text: '有人托我把它交给你。我想，现在是时候了。' }, { speaker: 'npc-lin', text: '指针没有指向北方……它指向那座灯塔。' }], choices: [{ text: '带着罗盘前往灯塔', target: 'ev-tower', rewardCard: '' }] },
      { id: 'ev-tower', title: '03 · 星光重明', summary: '灯塔的信号与星图重合，一条新的航线显现。', participants: ['npc-lin', 'npc-su'], dialogues: [{ speaker: 'npc-su', text: '你看！灯光的间隔，正好和你图上的星星一样。' }, { speaker: 'npc-lin', text: '原来这封信，不是要我回来。是要我继续向前。' }], choices: [{ text: '点亮灯塔，启程', target: '', rewardCard: 'card-star-plus' }] }
    ],
    cards: [
      { id: 'card-star', name: '星图微光', kind: '技能', rarity: '稀有', cost: 1, power: 6, description: '循着旧星图寻找方向。\n获得 6 点护盾，抽取 1 张牌。', owner: 'npc-lin', source: 'ev-letter', upgrades: ['card-star-plus', 'card-beacon'], image: '', color: '#9aacf0' },
      { id: 'card-star-plus', name: '群星引路', kind: '技能', rarity: '史诗', cost: 1, power: 10, description: '群星的轨迹在掌心展开。\n获得 10 点护盾，抽取 2 张牌。', owner: 'npc-lin', source: 'ev-tower', upgrades: [], image: '', color: '#ba9be8' },
      { id: 'card-beacon', name: '灯塔守望', kind: '能力', rarity: '史诗', cost: 2, power: 4, description: '只要灯光仍在，归途就不会消失。\n每回合开始时获得 4 点护盾。', owner: 'npc-su', source: 'ev-tower', upgrades: [], image: '', color: '#8bbfad' },
      { id: 'card-tide', name: '破潮一击', kind: '攻击', rarity: '普通', cost: 1, power: 8, description: '让船头对准最高的浪。\n造成 8 点伤害。', owner: 'npc-zhou', source: 'ev-pier', upgrades: [], image: '', color: '#d2ac79' }
    ]
  };
  const clone = x => JSON.parse(JSON.stringify(x));
  function validate(d) {
    const fail = msg => { throw new Error(msg); };
    if (!d || d.schemaVersion !== 1) fail('仅支持 GCS schemaVersion 1 的项目文件。');
    if (!d.project || typeof d.project.name !== 'string' || d.project.name.length > 100) fail('项目名称格式不正确。');
    for (const group of ['npcs', 'events', 'cards']) {
      if (!Array.isArray(d[group]) || d[group].length > 1000) fail('内容列表格式不正确或超过 1000 条。');
      const ids = new Set();
      for (const item of d[group]) {
        if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || ids.has(item.id)) fail('内容 ID 缺失、重复或包含非法字符。');
        ids.add(item.id);
      }
    }
    const has = (group, id) => typeof id === 'string' && d[group].some(x => x.id === id);
    const str = (obj, key, max = 20000) => { if (typeof obj[key] !== 'string' || obj[key].length > max) fail('字段 ' + key + ' 缺失或过长。'); };
    const ref = (group, id) => { if (id !== '' && !has(group, id)) fail('发现无效关联：' + String(id).slice(0,100)); };
    const image = value => { if (typeof value !== 'string' || value.length > 2800000 || !(value === '' || /^assets\/(lin|zhou|su)\.svg$/.test(value) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))) fail('图片必须为 GCS 内嵌的 PNG、JPG、WebP 或演示素材。'); };
    for (const n of d.npcs) {
      for (const key of ['name','role','tags','bio']) str(n, key);
      if (!n.name.trim()) fail('人物姓名不能为空。');
      if (!/^#[0-9a-f]{6}$/i.test(n.color)) fail('人物主题色无效。');
      image(n.image);
    }
    for (const e of d.events) {
      str(e, 'title'); str(e, 'summary');
      if (!e.title.trim()) fail('事件标题不能为空。');
      if (!Array.isArray(e.participants) || !Array.isArray(e.dialogues) || !Array.isArray(e.choices) || e.dialogues.length > 1000 || e.choices.length > 100) fail('事件结构格式不正确。');
      if (new Set(e.participants).size !== e.participants.length) fail('参与人物重复。');
      e.participants.forEach(id => { if (!has('npcs',id)) fail('参与人物不存在。'); });
      e.dialogues.forEach(line => { if (!line) fail('对白格式错误。'); str(line,'text'); ref('npcs',line.speaker); if(line.speaker && !e.participants.includes(line.speaker)) fail('对白人物必须属于事件参与人物。'); });
      e.choices.forEach(c => { if (!c) fail('选项格式错误。'); str(c,'text'); ref('events',c.target); ref('cards',c.rewardCard); });
    }
    for (const c of d.cards) {
      for (const key of ['name','kind','rarity','description']) str(c,key);
      if (!c.name.trim()) fail('卡牌名称不能为空。');
      if (!['攻击','技能','能力'].includes(c.kind) || !['普通','稀有','史诗'].includes(c.rarity)) fail('卡牌类型或稀有度无效。');
      for (const key of ['cost','power']) if (!Number.isInteger(c[key]) || c[key] < 0 || c[key] > 999) fail('费用和数值须为 0～999 的整数。');
      ref('npcs',c.owner); ref('events',c.source); image(c.image);
      if (!/^#[0-9a-f]{6}$/i.test(c.color) || !Array.isArray(c.upgrades) || new Set(c.upgrades).size !== c.upgrades.length) fail('卡牌颜色或升级分支格式无效。');
      c.upgrades.forEach(id => { if (!has('cards',id) || id === c.id) fail('升级目标不存在或指向自身。'); });
    }
    const visiting = new Set(), visited = new Set();
    const walk = id => { if(visiting.has(id)) fail('升级分支不能形成循环。'); if(visited.has(id)) return; visiting.add(id); d.cards.find(c=>c.id===id).upgrades.forEach(walk); visiting.delete(id); visited.add(id); };
    d.cards.forEach(c=>walk(c.id));
    return clone(d);
  }
  function remove(data, group, id) {
    data[group] = data[group].filter(x => x.id !== id);
    if (group === 'npcs') { data.events.forEach(e => { e.participants = e.participants.filter(x=>x!==id); e.dialogues.forEach(l=>{if(l.speaker===id) l.speaker='';}); }); data.cards.forEach(c=>{if(c.owner===id)c.owner='';}); }
    if (group === 'events') { data.events.forEach(e=>e.choices.forEach(c=>{if(c.target===id)c.target='';})); data.cards.forEach(c=>{if(c.source===id)c.source='';}); }
    if (group === 'cards') { data.cards.forEach(c=>{c.upgrades=c.upgrades.filter(x=>x!==id);}); data.events.forEach(e=>e.choices.forEach(c=>{if(c.rewardCard===id)c.rewardCard='';})); }
  }
  const api = { seed, clone, validate, remove };
  if (typeof module !== 'undefined') module.exports = api;
  root.GCSModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
