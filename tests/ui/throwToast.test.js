// @vitest-environment jsdom
/**
 * 回归：放回阶段点击"非法（非高亮）浅滩"必须给出明确 toast 反馈，不再静默无响应。
 * 修复：js/ui/boardInteraction.js onShoalClick CATCH 分支补上 toast。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInitialState } from '../../js/core/gameState.js';
import { PHASE } from '../../js/core/stateMachine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf-8');

let createBoardInteraction;
let modal;

beforeAll(async () => {
  document.body.innerHTML = html; // 先注入 DOM，再加载依赖 DOM 的 UI 模块（modal 在导入期 query 元素）
  createBoardInteraction = (await import('../../js/ui/boardInteraction.js')).createBoardInteraction;
  modal = await import('../../js/ui/modal.js');
});

/** 构造放回阶段：玩家 0 处于 CATCH，正要把某牌放回（throwCardId 已设） */
function catchThrowState() {
  const s = createInitialState({ seed: 1, playerNames: ['A', 'B'] });
  s.currentPlayer = 0;
  s.phase = PHASE.CATCH;
  s.drawn = ['oarfish', 'mermaid'];
  // 浅滩0 有牌非满（合法放回目标）；浅滩3 满堆 4 张（非法，不可放回）
  s.shoals = [['lamprey'], [], [], ['lamprey', 'oarfish', 'kraken', 'mermaid'], [], []];
  return { s, ui: { selectedShoals: [], throwCardId: 'mermaid', abilityCardId: null }, dispatchCalls: [] };
}

describe('放回非法浅滩有反馈（不再静默）', () => {
  it('点非高亮/非法浅滩弹 toast，且不派发放回动作；合法浅滩正常放回', () => {
    const { s, ui, dispatchCalls } = catchThrowState();
    const toast = vi.spyOn(modal, 'showToast').mockImplementation(() => {});
    const interaction = createBoardInteraction({
      getState: () => s,
      getUi: () => ui,
      dispatch: (a) => { dispatchCalls.push(a); return true; },
      renderAll: () => {},
    });
    // 浅滩3 是满堆(4 张) → 非法放回目标
    interaction.onShoalClick(3);
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toContain('放回');
    expect(ui.throwCardId).toBe('mermaid'); // 未清除，仍处于放回状态
    expect(dispatchCalls).toEqual([]); // 未错误派发放回
    // 合法目标（空浅滩 1）→ 正常放回，无 toast 干扰
    interaction.onShoalClick(1);
    expect(ui.throwCardId).toBeNull();
    expect(dispatchCalls).toEqual([{ type: 'THROW_BACK', cardId: 'mermaid', shoalIndex: 1 }]);
  });
});