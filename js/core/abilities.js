/**
 * 能力效果解析器：效果 = {类型, 目标, 参数} 的纯函数表。
 * 每种能力整局仅一次（发动后该鱼横置 exhausted）。
 * 能力只在"回合开始的能力阶段"发动（官方规则）。
 *
 * 能力类型：
 *  - draw_extra      多抽1张：本回合额外抽 1 张牌
 *  - peek_shoal      偷看某浅滩顶牌
 *  - force_exhaust   强制对方横置其一条鱼（对方免疫时不可用）
 *  - swap_fish       与对方交换一条鱼（对方免疫时不可用）
 *  - shuffle_shoals  洗牌并重置浅滩
 *  - immunity        本回合免疫（对方无法对你横置/交换）
 */
import { createRng } from '../utils/rng.js';
import { ensureSmallTops, NUM_SHOALS, CARDS_PER_SHOAL } from './gameState.js';

export const ABILITY_TYPES = {
  DRAW_EXTRA: 'draw_extra',
  PEEK_SHOAL: 'peek_shoal',
  FORCE_EXHAUST: 'force_exhaust',
  SWAP_FISH: 'swap_fish',
  SHUFFLE_SHOALS: 'shuffle_shoals',
  IMMUNITY: 'immunity',
};

/** 各能力是否需要目标以及目标结构（用于校验与 UI 提示） */
export const ABILITY_TARGET_SCHEMA = {
  draw_extra: null,
  peek_shoal: { shoalIndex: 'number' },
  force_exhaust: { cardId: 'string' }, // 对方已钓的鱼
  swap_fish: { ownCardId: 'string', oppCardId: 'string' },
  shuffle_shoals: null,
  immunity: null,
};

/** 能力的中文说明（用于 UI 与规则文档） */
export const ABILITY_DESCRIPTIONS = {
  draw_extra: '本回合多抽 1 张牌',
  peek_shoal: '偷看一个浅滩的顶牌',
  force_exhaust: '强制对方横置其一条鱼',
  swap_fish: '与对方交换一条鱼',
  shuffle_shoals: '洗乱所有浅滩并重新布置',
  immunity: '本回合免疫对方的横置/交换效果',
};

/**
 * 校验能力目标是否合法。
 * @returns {string|null} 错误信息，null 表示合法
 */
export function validateAbilityTarget(state, playerIndex, abilityType, target) {
  const me = state.players[playerIndex];
  const opp = state.players[(playerIndex + 1) % state.players.length];

  switch (abilityType) {
    case ABILITY_TYPES.PEEK_SHOAL:
      if (!target || typeof target.shoalIndex !== 'number') return '偷看需要指定浅滩';
      if (target.shoalIndex < 0 || target.shoalIndex >= NUM_SHOALS) return '浅滩索引越界';
      if (state.shoals[target.shoalIndex].length === 0) return '该浅滩为空，无法偷看';
      return null;

    case ABILITY_TYPES.FORCE_EXHAUST:
      if (!target || typeof target.cardId !== 'string') return '需要指定对方的一条鱼';
      if (opp.immune) return '对方本回合免疫，无法横置其鱼';
      if (!opp.caught.includes(target.cardId)) return '对方没有钓到这条鱼';
      if (opp.exhausted.includes(target.cardId)) return '对方这条鱼已横置';
      return null;

    case ABILITY_TYPES.SWAP_FISH:
      if (!target || typeof target.ownCardId !== 'string' || typeof target.oppCardId !== 'string') {
        return '交换需要指定自己与对方各一条鱼';
      }
      if (opp.immune) return '对方本回合免疫，无法交换';
      if (!me.caught.includes(target.ownCardId)) return '你没有钓到这条鱼';
      if (!opp.caught.includes(target.oppCardId)) return '对方没有钓到这条鱼';
      return null;

    default:
      return null;
  }
}

/**
 * 应用能力效果（纯函数，返回新状态）。
 * @param {object} state 当前状态（调用方已克隆）
 * @param {number} playerIndex 发动者
 * @param {string} abilityType
 * @param {object|null} target
 * @param {{rng:object}} ctx 随机上下文
 * @returns {{events:string[]}} 产生的事件
 */
export function applyAbilityEffect(state, playerIndex, abilityType, target, ctx) {
  const events = [];
  const me = state.players[playerIndex];
  const opp = state.players[(playerIndex + 1) % state.players.length];

  switch (abilityType) {
    case ABILITY_TYPES.DRAW_EXTRA:
      state.extraDraw += 1;
      events.push('draw_extra');
      break;

    case ABILITY_TYPES.PEEK_SHOAL: {
      const shoalIndex = target.shoalIndex;
      const cardId = state.shoals[shoalIndex][0];
      state.lastPeek = { player: playerIndex, shoalIndex, cardId };
      events.push('peek_shoal');
      break;
    }

    case ABILITY_TYPES.FORCE_EXHAUST:
      opp.exhausted.push(target.cardId);
      events.push('force_exhaust');
      break;

    case ABILITY_TYPES.SWAP_FISH: {
      const i1 = me.caught.indexOf(target.ownCardId);
      const i2 = opp.caught.indexOf(target.oppCardId);
      me.caught[i1] = target.oppCardId;
      opp.caught[i2] = target.ownCardId;
      events.push('swap_fish');
      break;
    }

    case ABILITY_TYPES.SHUFFLE_SHOALS: {
      const rng = ctx.rng;
      const all = [];
      for (const shoal of state.shoals) all.push(...shoal);
      const shuffled = rng.shuffle(all);
      const newShoals = [];
      for (let i = 0; i < NUM_SHOALS; i++) {
        newShoals.push(shuffled.slice(i * CARDS_PER_SHOAL, (i + 1) * CARDS_PER_SHOAL));
      }
      // 洗乱后同样保证至少 3 个浅滩顶牌是易钓小鱼（与开局逻辑一致、确定性）
      ensureSmallTops(newShoals, rng);
      state.shoals = newShoals;
      events.push('shuffle_shoals');
      break;
    }

    case ABILITY_TYPES.IMMUNITY:
      me.immune = true;
      events.push('immunity');
      break;

    default:
      throw new Error(`未知能力类型: ${abilityType}`);
  }

  return { events };
}

/** 供状态机使用的确定性随机上下文（同一动作序列可复现） */
export function createAbilityRng(state) {
  return createRng(state.seed + state.actions.length);
}
