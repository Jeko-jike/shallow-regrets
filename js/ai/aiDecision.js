/**
 * AI 决策理由生成（M4 战斗日志的可观测依据）。
 * 把 AI 的动作翻译成人类可读的中文说明，展示其"判定路径"。
 */
import { CARD_BY_ID } from '../core/cards.js';
import { ABILITY_DESCRIPTIONS } from '../core/abilities.js';

/** 描述一个 AI 动作（用于战斗日志逐条记录） */
export function describeAction(state, action) {
  const p = state.players[state.currentPlayer];
  switch (action.type) {
    case 'USE_ABILITY': {
      const card = CARD_BY_ID[action.cardId];
      const desc = ABILITY_DESCRIPTIONS[card.ability] || '';
      return `${p.name} 发动「${card.name}」的能力：${desc}`;
    }
    case 'PASS_ABILITIES':
      return `${p.name} 不发动能力，进入抽牌`;
    case 'DRAW': {
      const from = action.from.map((i) => `浅滩${i + 1}`).join('、');
      return `${p.name} 从 ${from} 抽牌`;
    }
    case 'CATCH': {
      const card = CARD_BY_ID[action.cardId];
      const foul = card.type === 'foul' ? '（污秽）' : '';
      return `${p.name} 钓走「${card.name}」${foul}：${card.points} 分，需 ${card.strength} 钩`;
    }
    case 'THROW_BACK': {
      const card = CARD_BY_ID[action.cardId];
      return `${p.name} 将「${card.name}」放回浅滩${action.shoalIndex + 1}`;
    }
    default:
      return `${p.name} 执行动作 ${action.type}`;
  }
}

/** 生成 AI 的决策路径说明（用于 M4 战斗日志的"评估理由"） */
export function explainDecision(state, action) {
  const p = state.players[state.currentPlayer];
  const parts = [`[${p.name}]`];

  if (action.type === 'CATCH') {
    const card = CARD_BY_ID[action.cardId];
    const hooks = state.players[state.currentPlayer].caught.reduce(
      (sum, id) => sum + CARD_BY_ID[id].hooks,
      0
    );
    parts.push(`钩数 ${hooks} ≥ 所需 ${card.strength}，可钓`);
    if (card.type === 'foul') parts.push('污秽鱼，价值折减');
    if (card.ability) parts.push(`含能力「${ABILITY_DESCRIPTIONS[card.ability]}」，加分`);
    parts.push(`综合价值 ${card.points} 分`);
  } else if (action.type === 'THROW_BACK') {
    parts.push('无可钓牌或已钓一条，放回合法浅滩');
  } else if (action.type === 'DRAW') {
    parts.push('按顶牌可钓性与价值选择浅滩');
  } else if (action.type === 'USE_ABILITY') {
    const card = CARD_BY_ID[action.cardId];
    parts.push(`评估「${card.name}」能力：${ABILITY_DESCRIPTIONS[card.ability]}`);
  } else if (action.type === 'PASS_ABILITIES') {
    parts.push('无值得发动的能力');
  }

  return parts.join(' → ');
}
