// @vitest-environment jsdom
/**
 * M4 AI 斗蛐蛐观战 UI 集成测试（jsdom）。
 * 验证：首页 → M4 设置 → 开始观战 → 棋盘渲染 → 手动回合推进 → 日志 → 立即结束 → 结算 → 返回首页 → 自动模式终局。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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

let spectateUI;

beforeAll(async () => {
  document.body.innerHTML = html;
  await import('../../js/main.js');
  spectateUI = await import('../../js/ui/spectateUI.js');
});

describe('M4 AI 斗蛐蛐观战', () => {
  it('首页 → M4 设置 → 开始观战（手动模式）', () => {
    click($('[data-mode="m4"]'));
    expect($('#modalTitle').textContent).toContain('AI 斗蛐蛐');
    // 切到手动模式
    click($('#m4Mode [data-mode="manual"]'));
    clickText('.modal-actions .btn', '开始观战');

    expect($('#game').classList.contains('active')).toBe(true);
    expect($('#gameTitle').textContent).toContain('AI 斗蛐蛐');
    expect($('#spectatePanel').style.display).not.toBe('none');
    expect($('#actionBar').style.display).toBe('none');
    expect($('#btnCoverToggle').style.display).toBe('none');
    // 手动模式显示手动按钮
    expect($('#spManualWrap').style.display).not.toBe('none');
    // 棋盘渲染：6 浅滩、2 玩家、观战抽出牌无操作按钮
    expect($$('#shoalsRow .shoal').length).toBe(6);
    expect($$('#playersBar .player-chip').length).toBe(2);
    expect($('#spStatus').textContent).toContain('手动');
  });

  it('手动推进：下一回合产生日志，立即结束到结算页', () => {
    expect($$('#spLog .sp-log-item').length).toBe(0);
    click($('#spNextTurn'));
    expect($$('#spLog .sp-log-item').length).toBeGreaterThan(0);
    // 日志条目含 描述 与 决策理由（可观测）
    const first = $$('#spLog .sp-log-item')[0];
    expect(first.querySelector('.sp-li-desc').textContent.length).toBeGreaterThan(0);
    expect(first.querySelector('.sp-li-reason').textContent.length).toBeGreaterThan(0);
    expect(first.querySelector('.sp-li-turn').textContent).toContain('回合');

    // 立即结束本局
    click($('#spFinish'));
    expect($('#result').classList.contains('active')).toBe(true);
    expect($('#resultSubtitle').textContent.length).toBeGreaterThan(0);
    expect($$('#resultGrid .result-card').length).toBe(2);
  });

  it('结算页返回首页并停止观战', () => {
    click($('#btnResultHome'));
    expect($('#home').classList.contains('active')).toBe(true);
    expect(spectateUI.isSpectating()).toBe(false);
    expect($('#spectatePanel').style.display).toBe('none');
    expect($('#actionBar').style.display).not.toBe('none');
    expect($('#gameTitle').textContent).toBe('浅滩鱼悔');
  });

  it('自动模式：速度档位推进并最终终局', async () => {
    vi.useFakeTimers();
    try {
      spectateUI.startSpectate({ names: ['AI 甲', 'AI 乙'], seed: 42, mode: 'auto', speed: 'fast' });
      expect($('#spManualWrap').style.display).toBe('none');
      expect($('#spStatus').textContent).toContain('自动');

      let guard = 0;
      while (!$('#result').classList.contains('active') && guard++ < 4000) {
        await vi.advanceTimersByTimeAsync(500);
      }
      expect($('#result').classList.contains('active')).toBe(true);
      expect($$('#resultGrid .result-card').length).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
