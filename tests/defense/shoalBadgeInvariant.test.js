/**
 * 防线测试：卡背徽标 ⇔ 实际翻开的卡 严格一一对应（用户诉求核心）。
 *
 * 覆盖整局：用 SpectateController 以确定性种子前后端到端跑 AI 对战，回放每个动作；
 * 每次 DRAW 前按“来源浅滩 + 层位(k)”算出该层应显示的卡背徽标
 * (`difficultyRange(该层真实卡的 strength)`)，抽牌后断言实际拿到的每一张卡
 * 的 `difficultyRange` 与该徽标完全一致。任一未来回归（抽牌下标错位、
 * 徽标/数据源漂移、卡背改用非 strength 字段）都会被此测试拦下。
 */
import { describe, it, expect } from 'vitest';
import { SpectateController } from '../../js/spectate/spectate.js';
import { createInitialState } from '../../js/core/gameState.js';
import { applyAction, PHASE } from '../../js/core/stateMachine.js';
import { difficultyRange } from '../../js/ui/render.js';
import { CARD_BY_ID } from '../../js/core/cards.js';

const NAMES = ['AI 甲', 'AI 乙'];

function replayAndVerify(seed) {
  const ctl = new SpectateController({ names: NAMES, seed, mode: 'manual' });
  ctl.finishNow();
  const actions = ctl.log.entries.map((e) => e.action);
  const state = createInitialState({ seed, playerNames: NAMES });
  let cur = state;

  for (const action of actions) {
    if (action.type === 'DRAW') {
      // 逐来源浅滩 + 逐层位预测该层应显示的徽标
      const cnt = {};
      const expected = [];
      for (const j of action.from) {
        const layer = cnt[j] ?? 0;
        const cellCard = CARD_BY_ID[cur.shoals[j][layer]];
        expected.push({ shoal: j, layer, badge: difficultyRange(cellCard.strength) });
        cnt[j] = layer + 1;
      }
      const before = cur.drawn.length;
      const res = applyAction(cur, action);
      if (res.error) continue; // 非发动作被拒绝：控制器状态不变，回放同样跳过（确定性一致）
      cur = res.state;
      const gained = cur.drawn.slice(before);
      expect(gained.length).toBe(action.from.length);
      gained.forEach((id, idx) => {
        const got = difficultyRange(CARD_BY_ID[id].strength);
        expect(
          got,
          `seed=${seed} 来源浅滩${expected[idx].shoal} 层${expected[idx].layer} 显示徽标=${expected[idx].badge} 但抽到 ${CARD_BY_ID[id].name}(${CARD_BY_ID[id].strength}钩) => ${got}`
        ).toBe(expected[idx].badge);
      });
      continue;
    }
    const res = applyAction(cur, action);
    if (res.error) continue; // 同上：被拒绝的动作不推进状态
    cur = res.state;
  }

  // 回放必须与控制器真实对局终局一致，证明“回放 == 实际发生了什么”
  expect(cur.phase).toBe(PHASE.GAME_OVER);
  expect(cur.turn).toBe(ctl.state.turn);
  expect(cur.shoals).toEqual(ctl.state.shoals);
  expect(cur.players).toEqual(ctl.state.players);
  return actions.length;
}

describe('防线：卡背徽标 ⇔ 实际翻开卡 一一对应（整局多种子）', () => {
  it('每个种子整局抽牌，抽到的每张卡 difficultyRange 都等于其来源层显示徽标', () => {
    for (let seed = 1; seed <= 60; seed++) {
      replayAndVerify(seed);
    }
  });

  it('极大/极小/有代表性 seed 同样通过', () => {
    for (const seed of [0, 7, 42, 999, 20260825, 123456789]) {
      replayAndVerify(seed);
    }
  });
});
