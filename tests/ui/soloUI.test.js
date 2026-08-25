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

  it('回归：玩家回合结束后自动轮到脚本回合（脚本意图与日志显示）', async () => {
    vi.useFakeTimers();
    try {
      soloUI.startSolo({ playerName: '你', seed: 42, first: 'player' });
      const c = soloUI.__getController();
      expect($('#soloIntent').textContent).toContain('等待你的行动');
      // —— 通过 UI 驱动一个完整玩家回合 ——
      // 1) 能力阶段：跳过（按钮位于抽出牌区下方）
      clickText('.dc-skip', '跳过能力阶段');
      // 2) 抽牌阶段：点两个不同浅滩（每浅滩一张）后确认
      const backs = $$('.shoal-stack .card-back.selectable');
      expect(backs.length).toBeGreaterThan(0);
      click(backs[0]);
      const other = $$('.shoal-stack .card-back.selectable').find(
        (b) => b.dataset.shoal !== backs[0].dataset.shoal
      );
      if (other && $$('#shoalsRow .shoal-badge').length < 2) click(other);
      clickText('.dc-ctx .btn', '确认抽牌');
      // 3) 钓走/放回：循环处理抽出牌直到玩家回合结束
      let guard = 0;
      while (c.isPlayerTurn() && c.state.phase !== 'gameOver' && guard++ < 10) {
        const catchBtn = $$('.dc-actions .btn').find((b) => b.textContent === '钓走' && !b.disabled);
        if (catchBtn) {
          click(catchBtn);
          continue;
        }
        const throwBtn = $$('.dc-actions .btn').find((b) => b.textContent === '放回' && !b.disabled);
        if (throwBtn) {
          click(throwBtn);
          const target = $('.shoal-stack .card-back.selectable');
          if (target) {
            click(target);
            continue;
          }
        }
        break;
      }
      // 玩家回合结束 → 脚本回合被自动调度（意图区不再是等待文案）
      expect(c.isScriptTurn()).toBe(true);
      expect($('#soloIntent').textContent).not.toContain('等待你的行动');
      // 脚本按节奏行动并写入日志
      let wait = 0;
      while ($$('#soloLog .sp-log-item').length === 0 && wait++ < 30) {
        await vi.advanceTimersByTimeAsync(700);
      }
      expect($$('#soloLog .sp-log-item').length).toBeGreaterThan(0);
      expect($$('#soloLog .sp-log-item')[0].querySelector('.sp-li-who').textContent).toContain('渔夫与青蛙');
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
