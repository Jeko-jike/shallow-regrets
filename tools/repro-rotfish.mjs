/**
 * 复现腐鱼（pass_left）卡死：模拟 M2 人机模式 AI 发动腐鱼。
 */
import { createInitialState } from '../js/core/gameState.js';
import { applyAction, ACTION, PHASE } from '../js/core/stateMachine.js';
import { chooseAction } from '../js/ai/heuristicAI.js';
import { autoResolution } from '../js/core/abilities.js';

function makeState() {
  const s = createInitialState({ seed: 1, playerNames: ['你', 'AI 渔夫'] });
  s.currentPlayer = 1; // AI 回合
  s.phase = PHASE.ABILITY;
  s.players[0].caught = ['lamprey', 'oarfish', 'rotfish', 'barracuda', 'kraken'];
  s.players[1].caught = ['rotfish', 'severedFoot', 'seaMonkey', 'whiptailStingray', 'greatWhite', 'kelpie'];
  s.shoals = [
    ['lamprey', 'lamprey', 'lamprey', 'lamprey'],
    ['oarfish', 'oarfish', 'oarfish', 'oarfish'],
    ['barracuda'], ['dayOctopus'], ['whiptailStingray'], ['seaMonkey'],
  ];
  return s;
}

let s = makeState();
let guard = 0;
while (s.phase !== PHASE.GAME_OVER && guard++ < 50) {
  const action = chooseAction(s);
  console.log(`[${s.phase}] ${JSON.stringify(action)}`);
  if (!action) { console.log('NO ACTION - STUCK'); break; }
  const res = applyAction(s, action);
  if (res.error) { console.log('ERROR:', res.error); break; }
  s = res.state;
  if (s.phase === PHASE.PENDING) {
    // 模拟人类逐个消解 pending
    let g2 = 0;
    while (s.phase === PHASE.PENDING && g2++ < 10) {
      const res2 = applyAction(s, { type: ACTION.RESOLVE, resolution: autoResolution(s) });
      if (res2.error) { console.log('RESOLVE ERROR:', res2.error); process.exit(1); }
      s = res2.state;
    }
  }
}
console.log('FINAL PHASE:', s.phase, 'turn:', s.turn);
