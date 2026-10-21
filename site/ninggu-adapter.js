/* Independent, read-only Ninggu schema adapter. No project content is bundled. */
(function (root) {
  'use strict';
  const own = (o, k) => Object.hasOwn(o, k);
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = v => JSON.parse(JSON.stringify(v));
  const labels = {cost:'费用',type:'类型',target:'目标',damage:'伤害 / 每次',hits:'攻击次数',block:'格挡 / 护甲',draw:'抽牌',chill:'寒意',exhaust:'消耗',retain:'保留',tier:'阶级',tags:'标签',weak:'虚弱',freeze:'冻结',heal:'治疗',strength:'力量',agility:'敏捷',vulnerable:'易伤',discard_count:'弃牌数量',on_discard_damage:'弃牌伤害',on_discard_chill:'弃牌寒意',on_discard_strength:'弃牌力量',grant_chill_per_card_played:'每次出牌寒意',x_damage_per_energy:'每能量伤害',damage_per_battle_hit:'战斗命中成长',consume_chill_damage:'消耗寒意伤害参数',chill_stack_damage:'寒意层数伤害参数',cleanse_debuff:'驱散减益',cleanse_one_debuff:'驱散一个减益',block_equals_chill:'护甲等于寒意'};
  const additive = new Set('damage block draw weak vulnerable strength agility chill hits freeze cost heal'.split(' '));
  const replacement = new Set('cleanse_debuff cleanse_one_debuff block_equals_chill exhaust'.split(' '));
  const linear = 'damage block discard_count grant_chill_per_card_played chill draw weak x_damage_per_energy damage_per_battle_hit'.split(' ');
  function readRecords(json) {
    if (!object(json) || !Array.isArray(json.cards)) throw new Error('需要包含 cards 数组的卡牌文件。');
    if (json.cards.length > 10000) throw new Error('卡牌数量超过 10000 条。');
    const ids = new Set();
    return json.cards.map((value, i) => {
      if (!object(value) || typeof value.id !== 'string' || !value.id.trim()) throw new Error('第 '+(i+1)+' 张卡牌缺少有效 ID。');
      if (ids.has(value.id)) throw new Error('重复卡牌 ID：'+value.id);
      ids.add(value.id);
      return {id:value.id, value:clone(value)};
    });
  }
  function readBranches(json) {
    if (!object(json) || !object(json.branches)) throw new Error('需要包含 branches 对象的升级分支文件。');
    const ids = new Set();
    for (const [id, branches] of Object.entries(json.branches)) {
      if (!Array.isArray(branches) || branches.length > 1000) throw new Error('分支列表无效：'+id);
      for (const b of branches) {
        if (!object(b) || typeof b.id !== 'string' || !b.id.trim() || !object(b.modifiers)) throw new Error('升级分支缺少 ID 或 modifiers：'+id);
        if (ids.has(b.id)) throw new Error('重复分支 ID：'+b.id);
        ids.add(b.id);
      }
    }
    return clone(json.branches);
  }
  function preview(record, branch = null, upgraded = false) {
    const base = record.value, final = clone(base), changes = [], unresolved = {};
    function apply(key, value, source, mode = 'add', nested) {
      const destination = nested ? final[nested] : final;
      if (mode === 'add' && (!Number.isFinite(value) || (own(destination,key) && !Number.isFinite(destination[key])))) { unresolved[source] = value; return; }
      const before = own(destination,key) ? clone(destination[key]) : undefined;
      let after = mode === 'set' ? value : (before ?? 0) + value;
      if (key === 'cost') after = Math.max(0, after);
      Object.defineProperty(destination,key,{value:after,writable:true,enumerable:true,configurable:true});
      changes.push({key:nested ? nested+'.'+key : key, before, after, modifier:value, mode, source});
    }
    if (branch) {
      for (const [key,value] of Object.entries(branch.modifiers)) {
        if (additive.has(key)) apply(key,value,key);
        else if (replacement.has(key) && typeof value === 'boolean') apply(key,value,key,'set');
        else unresolved[key] = value;
      }
    } else if (upgraded) {
      const handled = new Set();
      for (const key of linear) {
        const source = 'upgrade_'+key;
        if (own(base,source)) { apply(key,base[source],source); handled.add(source); }
      }
      for (const key of ['on_discard_damage','on_discard_chill','on_discard_strength']) {
        const source = 'upgrade_'+key;
        if (own(base,source)) { if (base[key] > 0) apply(key,base[source],source); handled.add(source); }
      }
      for (const key of ['exhaust','retain']) {
        const source = 'upgrade_'+key;
        if (own(base,source)) { if (typeof base[source] === 'boolean') apply(key,base[source],source,'set'); else unresolved[source]=base[source]; handled.add(source); }
      }
      if (own(base,'upgrade_cost_reduce')) { if (base.upgrade_cost_reduce > 0) apply('cost',-base.upgrade_cost_reduce,'upgrade_cost_reduce'); handled.add('upgrade_cost_reduce'); }
      for (const [source,key] of [['upgrade_consume_chill_base','base'],['upgrade_consume_chill_per_chill','per_chill']]) {
        if (object(base.consume_chill_damage) && own(base,source)) { apply(key,base[source],source,'add','consume_chill_damage'); handled.add(source); }
      }
      if (object(base.chill_stack_damage)) {
        const source = 'upgrade_chill_stack_damage_bonus';
        const value = base[source] || base.chill_stack_damage.upgrade_bonus;
        if (value) apply('bonus',value,own(base,source) ? source : 'chill_stack_damage.upgrade_bonus','add','chill_stack_damage');
        if (own(base,source)) handled.add(source);
      }
      for (const [key,value] of Object.entries(base)) if (key.startsWith('upgrade_') && !handled.has(key)) unresolved[key]=value;
    }
    return {final,changes,unresolved};
  }
  function describe(data) {
    const parts = [];
    // Dynamic damage is deliberately not presented as a fixed combat result.
    if (data.consume_chill_damage || data.chill_stack_damage || data.x_cost || data.damage_per_battle_hit) parts.push('伤害取决于战斗状态，见效果原始字段');
    else if (data.damage > 0) parts.push('每次 '+data.damage+' 点伤害'+(data.hits > 1 ? ' × '+data.hits+' 次' : ''));
    if (data.block > 0) parts.push('获得 '+data.block+' 点护甲');
    if (data.chill > 0) parts.push('施加 '+data.chill+' 层寒意');
    if (data.draw > 0) parts.push('抽 '+data.draw+' 张牌');
    if (data.heal > 0) parts.push('回复 '+data.heal+' 点生命');
    if (data.exhaust) parts.push('消耗');
    if (data.retain) parts.push('保留');
    return parts.join('；') || '没有可概括的固定效果，请查看原始字段。';
  }
  const api = {readRecords,readBranches,preview,describe,labels,cardName:r=>r.value.name || r.id};
  root.GCSNingguAdapter = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
