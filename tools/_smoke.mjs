import { createInitialState } from '../js/core/gameState.js';
import { applyAction, PHASE, ACTION } from '../js/core/stateMachine.js';
import { getCatchableDrawn, getDrawableShoals, getLegalThrowTargets, canCatch } from '../js/core/rules.js';

function chooseDraw(s, n) {
  const cur = s.currentPlayer;
  const full = getDrawableShoals(s);
  if (!full.length) return [];
  const picks = [];
  for (let k = 0; k < n; k++) {
    let best = full.find((i) => !picks.includes(i) && canCatch(s, cur, s.shoals[i][0]));
    if (best === undefined) {
      best = full.find((i) => !picks.includes(i) && s.shoals[i].length >= 2 && canCatch(s, cur, s.shoals[i][1]));
    }
    if (best === undefined) best = full.find((i) => !picks.includes(i));
    if (best === undefined) best = full[0];
    picks.push(best);
  }
  return picks;
}

function runGreen(seed, names) {
  let s = createInitialState({ seed, playerNames: names });
  let steps = 0;
  const cap = 2000;
  while (!s.gameOver && steps < cap) {
    steps++;
    let r;
    if (s.phase === PHASE.PENDING) {
      const pend = s.pending;
      let res = {};
      if (pend.type === 'REDIRECT') { res = { use: steps % 2 === 0, candidateIdx: 0 }; }
      else if (pend.type === 'COUNTER') { res = pend.counterTargets.length ? { use: true, cardId: pend.counterTargets[0] } : { use: false }; }
      else if (pend.type === 'REARRANGE') { res = { order: [...pend.cards] }; }
      else if (pend.type === 'PASS_LEFT') {
        const own = s.players[pend.playerIndices[pend.current]];
        res = own.caught.length ? { pick: own.caught[0] } : { pick: null };
      }
      r = applyAction(s, { type: ACTION.RESOLVE, resolution: res });
    } else if (s.phase === PHASE.ABILITY) {
      // 尝试发动第一个可用主动能力（只走无风险的 draw/power），否则跳过
      const me = s.players[s.currentPlayer];
      const use = me.caught.find((id) => !me.exhausted.includes(id));
      let used = false;
      if (use) {
        const r1 = applyAction(s, { type: ACTION.USE_ABILITY, cardId: 'greatWhite' });
        if (!r1.error && r1.state && r1.state.phase !== PHASE.PENDING) { r = r1; used = true; }
      }
      if (!used) r = applyAction(s, { type: ACTION.PASS_ABILITIES });
    } else if (s.phase === PHASE.DRAW) {
      const n = Math.min(2, getDrawableShoals(s).length);
      r = applyAction(s, { type: ACTION.DRAW, from: chooseDraw(s, n) });
    } else if (s.phase === PHASE.CATCH) {
      const catchable = getCatchableDrawn(s);
      if (catchable.length && !s.caughtThisTurn) {
        r = applyAction(s, { type: ACTION.CATCH, cardId: catchable[0] });
      } else {
        const drawnPick = s.drawn[0];
        const legal = getLegalThrowTargets(s)[0];
        r = applyAction(s, { type: ACTION.THROW_BACK, cardId: drawnPick, shoalIndex: legal });
      }
    } else {
      throw new Error('unknown phase ' + s.phase);
    }
    if (r.error) throw new Error(`seed ${seed} step${steps} phase${s.phase} err: ${r.error} action=${JSON.stringify(r.action)}`);
    s = r.state;
  }
  if (!s.gameOver) {
    console.error('TIMEOUT seed', seed, 'phase', s.phase, 'turn', s.turn, 'current', s.currentPlayer,
      'pending', JSON.stringify(s.pending),
      'players', s.players.map((p, i) => `${i}:c${p.caught.length}/e${p.exhausted.length}/pow${p.powerBonus}`).join(' '),
      'shoals', s.shoals.map((sh) => sh.length).join(','));
    throw new Error(`seed ${seed} did not finish (steps ${steps})`);
  }
  return steps;
}

let total = 0;
for (let seed = 1; seed <= 60; seed++) {
  const steps = runGreen(seed, ['A', 'B']);
  total += steps;
}
console.log('2p runs OK, avg steps', Math.round(total / 60));

// 4 人局
let t4 = 0;
for (let seed = 1; seed <= 20; seed++) {
  t4 += runGreen(seed, ['A', 'B', 'C', 'D']);
}
console.log('4p runs OK, avg steps', Math.round(t4 / 20));