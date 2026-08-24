/**
 * 对局状态对象与不可变更新函数。
 * 状态必须可序列化纯数据（浅滩各堆、钓获区、回合、横置标记等），
 * 用于渲染、联机同步、重连恢复与对局回放。
 */
import { createRng } from '../utils/rng.js';
import { CARDS, CARD_BY_ID, TOTAL_CARDS } from './cards.js';

export const NUM_SHOALS = 6;
export const CARDS_PER_SHOAL = 3;
export const BASE_DRAW = 2;

/**
 * 创建初始对局状态。
 * @param {{seed:number, playerNames:string[]}} opts
 * @returns {object} 初始状态
 */
export function createInitialState({ seed, playerNames }) {
  const rng = createRng(seed);
  const deck = rng.shuffle(CARDS.map((c) => c.id));
  // 分成 6 个浅滩，每个 3 张；索引 0 为顶牌
  const shoals = [];
  for (let i = 0; i < NUM_SHOALS; i++) {
    shoals.push(deck.slice(i * CARDS_PER_SHOAL, (i + 1) * CARDS_PER_SHOAL));
  }
  ensureSmallTops(shoals, rng);

  const players = playerNames.map((name, i) => ({
    id: i,
    name,
    caught: [], // 已钓获的鱼 id（按钓获顺序）
    exhausted: [], // 已横置（能力已用）的鱼 id
    immune: false, // 本回合免疫标记（Moray Eel 等）
  }));

  return {
    version: 1,
    seed,
    players,
    shoals,
    currentPlayer: 0,
    phase: 'ability', // ability | draw | catch | gameOver
    turn: 1,
    drawn: [], // 本回合抽出的牌（面朝上）
    drawnFrom: [], // 对应来源浅滩索引
    extraDraw: 0, // 本回合额外抽卡数（能力触发）
    caughtThisTurn: false, // 本回合是否已钓走一张
    lastPeek: null, // 最近一次偷看结果 {player, shoalIndex, cardId}
    actions: [], // 动作序列（可序列化，用于回放/联机）
    gameOver: false,
    winner: null, // 胜者玩家索引数组（可为多个=平局）
  };
}

/**
 * 确保至少 3 个浅滩的顶牌是 strength<=0 的小鱼（小阴影）。
 * 优先洗乱"含小卡但顶牌不是小卡"的浅滩（有概率把小卡翻上来）；
 * 若小卡集中到无法局部达成（如 2 个浅滩各含 3 张小卡），则整副重洗重发兜底。
 */
function ensureSmallTops(shoals, rng) {
  const isSmallTop = (s) => CARD_BY_ID[s[0]].strength <= 0;
  const smallCount = () => shoals.filter(isSmallTop).length;
  let guard = 0;
  while (smallCount() < 3 && guard++ < 200) {
    const candidates = shoals
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !isSmallTop(s) && s.some((id) => CARD_BY_ID[id].strength <= 0));
    if (candidates.length === 0) {
      const all = [];
      for (const s of shoals) all.push(...s);
      const shuffled = rng.shuffle(all);
      for (let i = 0; i < shoals.length; i++) {
        shoals[i] = shuffled.slice(i * CARDS_PER_SHOAL, (i + 1) * CARDS_PER_SHOAL);
      }
      continue;
    }
    const { s, i } = candidates[0];
    shoals[i] = rng.shuffle(s);
  }
}

/** 深拷贝状态（不可变更新用） */
export function cloneState(state) {
  return structuredClone(state);
}

/** 某玩家当前钩子数 = 已钓获鱼 hooks（提供钩数）之和 */
export function getHooks(state, playerIndex) {
  const p = state.players[playerIndex];
  return p.caught.reduce((sum, id) => sum + CARD_BY_ID[id].hooks, 0);
}

/** 全部已钓获数量（用于终局判定） */
export function getTotalCaught(state) {
  return state.players.reduce((n, p) => n + p.caught.length, 0);
}

/** 浅滩剩余总卡数 */
export function getRemainingInShoals(state) {
  return state.shoals.reduce((n, s) => n + s.length, 0);
}

export { TOTAL_CARDS };
