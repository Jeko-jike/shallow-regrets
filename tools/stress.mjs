/**
 * 深度随机压力测试：驱动真实 AI（heuristicAI.chooseAction）进行完整对局，
 * 跨大量种子检测：死锁/不终局、非法动作被拒、状态不变量被破坏（卡牌唯一性 / 守恒 / 浅滩牌型 / 幂等）。
 * 用法：node tools/stress.mjs [--2p N] [--4p N] [--seedS base]
 */
import { createInitialState } from '../js/core/gameState.js';
import { applyAction, PHASE } from '../js/core/stateMachine.js';
import { chooseAction } from '../js/ai/heuristicAI.js';
import { CARD_BY_ID } from '../js/core/cards.js';

const cap = 600;   // 每局动作上限（防死锁护栏）
let arg = {
  p2: 500,
  p4: 150,
  seedBase: 1,
};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--2p') arg.p2 = Number(process.argv[++i]);
  else if (a === '--4p') arg.p4 = Number(process.argv[++i]);
  else if (a === '--seedBase') arg.seedBase = Number(process.argv[++i]);
}

/** 多层不变量校验，返回错误字符串数组 */
function validateState(s, seed, step) {
  const errs = [];
  // 1) 卡牌唯一性 & 合法 id：浅滩 ∪ 全体已钓区
  const seen = new Set();
  const place = [];
  s.shoals.forEach((sh, i) => sh.forEach((id, k) => {
    if (seen.has(id)) errs.push(`卡牌重复 ${id}（浅滩${i}#${k}）`);
    seen.add(id);
    if (!CARD_BY_ID[id]) errs.push(`未知卡id ${id}（浅滩${i}#${k}）`);
    place.push(`s${i}#${k}`);
  }));
  s.players.forEach((p, pi) => p.caught.forEach((id, k) => {
    if (seen.has(id)) errs.push(`卡牌重复 ${id}（玩家${pi}已钓#${k}）`);
    seen.add(id);
    if (!CARD_BY_ID[id]) errs.push(`未知卡id ${id}（玩家${pi}已钓#${k}）`);
    place.push(`p${pi}#${k}`);
  }));
  // 2) exhausted ⊆ 全体已钓区并集（横置态随卡转移：断脚/腐鱼传到新主人处仍是横置的）
  const allCaught = new Set();
  s.players.forEach((p) => p.caught.forEach((id) => allCaught.add(id)));
  s.players.forEach((p, pi) =>
    p.exhausted.forEach((id) => {
      if (!allCaught.has(id)) errs.push(`exhausted 中的 ${id} 不在任何玩家的 caught 中`);
    })
  );
  // 3) drawn 应来自某些浅滩（临时持有不违反唯一性，但应合法）
  s.drawn.forEach((id) => {
    if (!CARD_BY_ID[id]) errs.push(`未知卡id ${id} 在 drawn 中`);
  });
  // 4) 数值合法
  if (![PHASE.ABILITY, PHASE.DRAW, PHASE.CATCH, PHASE.GAME_OVER, PHASE.PENDING].includes(s.phase)) {
    errs.push(`未知阶段 ${s.phase}`);
  }
  if (typeof s.caughtThisTurn !== 'number' || Number.isNaN(s.caughtThisTurn)) errs.push('caughtThisTurn 非数字');
  if (s.powerBonus !== undefined && s.players.some((p) => Number.isNaN(p.powerBonus))) errs.push('powerBonus 为 NaN');
  return errs;
}

function runGame(seed, names) {
  let s = createInitialState({ seed, playerNames: names });
  const actions = [];
  let rejectedStreak = 0;
  let lastKey = '';
  for (let step = 0; step < cap; step++) {
    if (s.phase === PHASE.GAME_OVER) {
      if (!s.winner || s.winner.length === 0) return { seed, actions, fail: `终局但 winner 为空` };
      return { seed, actions, fail: null, steps: step };
    }
    const before = JSON.stringify([s.phase, s.currentPlayer, s.turn, s.players.map((p) => p.caught.join(',')).join('|'), s.shoals.map((sh) => sh.join(',')).join('/'), s.pending ? s.pending.type : '']);
    const action = chooseAction(s);
    if (!action) return { seed, actions, fail: `step${step} chooseAction 返回空` };
    const res = applyAction(s, action);
    if (res.error) {
      // 记录一次非法动作；连续被拒说明 AI 决策与规则不匹配（死锁风险或规则漏洞）
      if (before === lastKey) rejectedStreak++;
      else rejectedStreak = 1;
      if (rejectedStreak >= 15) {
        return { seed, actions, fail: `step${step} 连续${rejectedStreak}次非法动作被拒，处于僵局。动作=${JSON.stringify(action)} err=${res.error} 阶段=${s.phase} pending=${s.pending ? s.pending.type : '无'}` };
      }
      lastKey = before;
      s.actions.push({ t: 'rejected', a: action, err: res.error });
      continue;
    }
    lastKey = '';
    rejectedStreak = 0;
    s = res.state;
    actions.push(action);

    const errs = validateState(s, seed, step);
    if (errs.length) {
      return { seed, actions, fail: `step${step} 不变量被破坏：\n  ` + errs.join('\n  ') };
    }
  }
  return { seed, actions, fail: `未在 ${cap} 步内终局，阶段=${s.phase} turn=${s.turn}` };
}

function batch(name, count, baseSeed, names) {
  console.log(`\n=== ${name}（${count} 局，seed ${baseSeed}..${baseSeed + count - 1}）===`);
  let ok = 0, totalSteps = 0, maxSteps = 0;
  const failures = [];
  for (let i = 0; i < count; i++) {
    const seed = baseSeed + i;
    const r = runGame(seed, names);
    if (r.fail) {
      failures.push({ seed, fail: r.fail });
      console.log(`  ✗ seed ${seed}: ${r.fail}`);
    } else {
      ok++;
      totalSteps += r.steps;
      if (r.steps > maxSteps) maxSteps = r.steps;
    }
  }
  console.log(`  通过 ${ok}/${count}，平均 ${count ? Math.round(totalSteps / Math.max(1, ok)) : 0} 步，最长 ${maxSteps} 步`);
  return failures;
}

let totalFail = [];
totalFail = totalFail.concat(batch('2人局', arg.p2, arg.seedBase, ['A', 'B']));
totalFail = totalFail.concat(batch('4人局', arg.p4, arg.seedBase, ['A', 'B', 'C', 'D']));

if (totalFail.length) {
  console.log(`\n*** 共 ${totalFail.length} 个失败种子 ***`);
  for (const f of totalFail.slice(0, 20)) {
    console.log(`\n[seed ${f.seed}]\n${f.fail}`);
  }
  process.exitCode = 1;
} else {
  console.log('\n✅ 压力测试全部通过');
}