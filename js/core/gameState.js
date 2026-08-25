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
/** 开局至少保证多少个浅滩顶牌为"易钓小鱼"（strength=0，卡背显示难度 0 / 1-2 / 3-5 中的 0） */
export const MIN_SMALL_TOPS = 4;

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
  if (!hasEnoughSmallTops(shoals)) throw new Error('ensureSmallTops 未保证至少 3 个易钓顶牌');

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

/** 是否至少 MIN_SMALL_TOPS 个浅滩的顶牌是"易钓小鱼"（strength<=0，小阴影） */
function hasEnoughSmallTops(shoals, min = MIN_SMALL_TOPS) {
  return shoals.filter((s) => s.length > 0 && isSmallTopId(s[0])).length >= min;
}

/** 某牌是否为易钓小鱼（strength<=0） */
export function isSmallTopId(id) {
  return CARD_BY_ID[id].strength <= 0;
}

/**
 * 尽量保证多个浅滩的顶牌是 strength<=0 的小鱼（小阴影）。
 * 确定性构造（不依赖随机重试）：统计易钓顶牌数，不足时把"埋在浅滩里（position>0）"的
 * 易钓小鱼与"顶牌非易钓且非空"浅滩的顶牌交换，使易钓顶牌数逐步满足。
 * 安全约定：只在非空浅滩间交换，绝不触碰空浅滩的 [0]，因此对局中途（存在空浅滩）也可安全调用；
 * 若剩余易钓牌不足（如对局近尾声仅剩 1 张小鱼），则尽力而为，多出的要求放弃而非破坏状态。
 * 开局（18 张整副、浅滩全满）总能凑齐 MIN_SMALL_TOPS 个易钓顶牌，由 createInitialState 严格校验。
 */
export function ensureSmallTops(shoals) {
  const isSmallTopAt = (s) => s.length > 0 && isSmallTopId(s[0]);
  const need = MIN_SMALL_TOPS - shoals.filter(isSmallTopAt).length;
  if (need <= 0) return;
  // 目标浅滩：非空且顶牌非易钓（空浅滩没有"顶牌需要改"）
  const dst = [];
  for (let i = 0; i < shoals.length && dst.length < need; i++) {
    if (shoals[i].length > 0 && !isSmallTopAt(shoals[i])) dst.push(i);
  }
  if (dst.length === 0) return;
  // 收集所有"埋在浅滩里"（position>0）的易钓小鱼
  const candidates = [];
  shoals.forEach((s, i) =>
    s.forEach((id, k) => {
      if (isSmallTopId(id) && k > 0) candidates.push({ shoalIdx: i, cardIdx: k });
    }),
  );
  // 逐个补顶：把候选易钓牌与其目标浅滩的顶牌交换（两浅滩均非空，保持张数不变）
  for (const di of dst) {
    const c = candidates.shift();
    if (!c) break;
    const src = shoals[c.shoalIdx];
    if (!src || c.cardIdx >= src.length) continue;
    const smallCard = src[c.cardIdx]; // 先保存易钓牌，防止被覆盖丢失
    const dstTop = shoals[di][0]; // 目标顶牌（非易钓）
    src[c.cardIdx] = dstTop;
    shoals[di][0] = smallCard;
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
