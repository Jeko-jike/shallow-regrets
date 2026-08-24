// @vitest-environment jsdom
/**
 * M5 Solo 挑战 UI 集成测试（jsdom）。
 * 验证：首页 → M5 设置 → 开始挑战 → 棋盘与 Solo 面板渲染 → 脚本自动行动与日志 → 结算评价。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chooseAction } from '../../js/ai/heuristicAI.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', '..', 'index.html'), 'utf-8');

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function clickText(sel, text) {
  const el = $$(sel).find((b) => b.textContent.trim().includes(text));
  expect(el, `未找到按钮: ${sel} 含 "${text}"`).toBeTruthy();
  click(el);
}

let soloUI;

beforeAll(async () => {
  document.body.innerHTML = html;
  await import('../../js/main.js');
  soloUI = await import('../../js/ui/soloUI.js');
});

describe('M5 Solo 挑战', () => {
  it('首页 → M5 设置 → 开始挑战（玩家先手）', () => {
    click($('[data-mode="m5"]'));
    expect($('#modalTitle').textContent).toContain('Solo 挑战');
    clickText('.modal-actions .btn', '开始挑战');

    expect($('#game').classList.contains('active')).toBe(true);
    expect($('#gameTitle').textContent).toContain('Solo 挑战');
    expect($('#soloPanel').style.display).not.toBe('none');
    expect($('#btnCoverToggle').style.display).toBe('none');
    // 棋盘渲染：6 浅滩、2 玩家
    expect($$('#shoalsRow .shoal').length).toBe(6);
    expect($$('#playersBar .player-chip').length).toBe(2);
    // 对手信息：6 张目标卡
    expect($$('#soloTargets .solo-target').length).toBe(6);
    // 特色目标：4 项
    expect($$('#soloGoals .solo-goal').length).toBe(4);
    // 玩家回合可交互（操作区可见）
    expect($('#actionBar').style.display).not.toBe('none');
    expect($('#soloIntent').textContent).toContain('等待你的行动');
  });

  it('脚本先手时自动行动并记录日志', async () => {
    vi.useFakeTimers();
    try {
      soloUI.startSolo({ playerName: '你', seed: 42, first: 'script' });
      expect($('#soloIntent').textContent).not.toBe('等待你的行动…');
      let guard = 0;
      while ($$('#soloLog .sp-log-item').length === 0 && guard++ < 30) {
        await vi.advanceTimersByTimeAsync(700);
      }
      expect($$('#soloLog .sp-log-item').length).toBeGreaterThan(0);
      const first = $$('#soloLog .sp-log-item')[0];
      expect(first.querySelector('.sp-li-desc').textContent.length).toBeGreaterThan(0);
      expect(first.querySelector('.sp-li-who').textContent).toContain('渔夫与青蛙');
    } finally {
      vi.useRealTimers();
    }
  });

  it('结算：特色目标与评价展示', () => {
    soloUI.startSolo({ playerName: '你', seed: 42, first: 'player' });
    const c = soloUI.__getController();
    // 驱动到终局：脚本回合用 runScriptAction，玩家回合用启发式 AI 代替（仅测试）
    let guard = 0;
    while (c.state.phase !== 'gameOver' && guard++ < 500) {
      if (c.isScriptTurn()) {
        c.runScriptAction();
      } else if (c.isPlayerTurn()) {
        const action = chooseAction(c.state);
        if (!action || c.dispatch(action)) break;
      } else {
        break;
      }
    }
    expect(c.state.phase).toBe('gameOver');
    expect($('#result').classList.contains('active')).toBe(true);
    expect($('#soloResult').style.display).not.toBe('none');
    expect($$('#soloResult .solo-eval-goal').length).toBe(4);
    expect($('#soloResult .solo-eval-rank').textContent.length).toBeGreaterThan(0);
    expect($('#soloResult .solo-eval-stars').textContent).toMatch(/[★☆]{4}/);
  });

  it('结算页返回首页并停止 Solo', () => {
    click($('#btnResultHome'));
    expect($('#home').classList.contains('active')).toBe(true);
    expect(soloUI.isSolo()).toBe(false);
    expect($('#soloPanel').style.display).toBe('none');
    expect($('#soloResult').style.display).toBe('none');
    expect($('#gameTitle').textContent).toBe('浅滩鱼悔');
  });
});
