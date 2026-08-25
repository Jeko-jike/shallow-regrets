// @vitest-environment jsdom
/**
 * M1 本地热座 UI 集成测试（jsdom 模拟真实点击流）。
 * 验证：首页 → M1 设置 → 开局 → 遮挡层 → 能力跳过 → 抽牌 → 钓走/放回 → 回合切换。
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as render from '../../js/ui/render.js';

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

beforeAll(async () => {
  document.body.innerHTML = html;
  // 加载前端入口（模块级代码在 DOM 就绪后执行）
  await import('../../js/main.js');
});

describe('M1 本地热座', () => {
  it('首页渲染五种模式入口', () => {
    expect($('#home').classList.contains('active')).toBe(true);
    expect($$('.mode-card').length).toBe(5);
    expect($('#btnRules')).toBeTruthy();
    expect($('#btnSettings')).toBeTruthy();
  });

  it('完整对局流程：设置 → 开局 → 抽牌 → 钓走/放回 → 回合切换', () => {
    // 1. 点击 M1 模式卡片 → 设置弹窗
    click($('[data-mode="m1"]'));
    expect($('#modalOverlay').classList.contains('active')).toBe(true);
    expect($('#modalTitle').textContent).toContain('本地对战');

    // 2. 点击"开始对局"
    clickText('.modal-actions .btn', '开始对局');
    expect($('#game').classList.contains('active')).toBe(true);
    expect($('#turnInfo').textContent).toContain('第 1 回合');
    expect($('#turnInfo').textContent).toContain('能力阶段');

    // 3. 开局遮挡层出现，确认后关闭
    expect($('#turnCover').style.display).toBe('flex');
    click($('#tcBtn'));
    expect($('#turnCover').style.display).toBe('none');

    // 4. 能力阶段：跳过（按钮位于抽出牌区下方）
    clickText('.dc-skip', '跳过能力阶段');
    expect($('#turnInfo').textContent).toContain('抽牌阶段');

    // 5. 抽牌阶段：选 2 个浅滩 → 确认按钮启用
    const confirmBtn = () => $$('#actionBar .btn').find((b) => b.textContent.includes('确认抽牌'));
    expect(confirmBtn().disabled).toBe(true);
    const backs = $$('#shoalsRow .shoal .card-back');
    expect(backs.length).toBeGreaterThanOrEqual(6);
    click(backs[0]); // 浅滩1
    expect($('#statusLine').textContent).toContain('已选 1/2');
    click($$('#shoalsRow .shoal')[1].querySelector('.card-back')); // 浅滩2
    expect($('#statusLine').textContent).toContain('已选 2/2');
    expect(confirmBtn().disabled).toBe(false);
    click(confirmBtn());

    // 6. 钓走/放回阶段：先钓可钓的，再放回其余
    expect($('#turnInfo').textContent).toContain('钓走/放回');
    expect($$('#drawnCards .drawn-card-slot').length).toBe(2);

    let guard = 0;
    while ($$('#drawnCards .drawn-card-slot').length > 0 && guard++ < 5) {
      const slots = $$('#drawnCards .drawn-card-slot');
      const catchable = slots.find((s) => !s.querySelector('.dc-actions .btn-primary').disabled);
      if (catchable) {
        click(catchable.querySelector('.dc-actions .btn-primary'));
        continue;
      }
      // 无可钓（或已钓一条）→ 放回
      const slot = slots[0];
      click(slot.querySelector('.dc-actions .btn:not(.btn-primary)'));
      const target = $$('#shoalsRow .shoal').find((s) => s.classList.contains('highlight'));
      expect(target, '应存在高亮的放回目标浅滩').toBeTruthy();
      click(target.querySelector('.card-back'));
    }

    // 7. 回合结束 → 轮到玩家2（遮挡开启）
    expect($('#turnInfo').textContent).toContain('玩家2');
    expect($('#turnCover').style.display).toBe('flex');
    click($('#tcBtn'));
    expect($('#turnCover').style.display).toBe('none');
  });

  it('M2 单人 AI：玩家操作后 AI 自动行动', async () => {
    vi.useFakeTimers();
    try {
      // 返回首页再进入 M2
      click($('#btnBackHome'));
      expect($('#home').classList.contains('active')).toBe(true);

      click($('[data-mode="m2"]'));
      expect($('#modalTitle').textContent).toContain('单人 AI');
      clickText('.modal-actions .btn', '开始对局');
      expect($('#game').classList.contains('active')).toBe(true);
      // M2 不启用遮挡
      expect($('#turnCover').style.display).not.toBe('flex');

      // 玩家回合：跳过能力 → 选 2 浅滩 → 确认抽牌 → 钓走/放回
      clickText('.dc-skip', '跳过能力阶段');
      click($$('#shoalsRow .shoal')[0].querySelector('.card-back'));
      click($$('#shoalsRow .shoal')[1].querySelector('.card-back'));
      clickText('#actionBar .btn', '确认抽牌');
      let guard = 0;
      while ($$('#drawnCards .drawn-card-slot').length > 0 && guard++ < 5) {
        const slots = $$('#drawnCards .drawn-card-slot');
        const catchable = slots.find((s) => !s.querySelector('.dc-actions .btn-primary').disabled);
        if (catchable) {
          click(catchable.querySelector('.dc-actions .btn-primary'));
          continue;
        }
        const slot = slots[0];
        click(slot.querySelector('.dc-actions .btn:not(.btn-primary)'));
        const target = $$('#shoalsRow .shoal').find((s) => s.classList.contains('highlight'));
        expect(target, '应存在高亮的放回目标浅滩').toBeTruthy();
        click(target.querySelector('.card-back'));
      }

      // 轮到 AI
      expect($('#turnInfo').textContent).toContain('AI 渔夫');

      // 推进定时器直到 AI 回合结束（回到玩家回合）
      let aiGuard = 0;
      while ($('#turnInfo').textContent.includes('AI 渔夫') && aiGuard++ < 60) {
        await vi.advanceTimersByTimeAsync(700);
      }
      expect($('#turnInfo').textContent).not.toContain('AI 渔夫');
      expect($('#turnInfo').textContent).toContain('你');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('render：回归——空浅滩可作为放回目标被点击', () => {
  it('空浅滩可点时会整堆高亮并可触发 onShoalClick（不卡死）', () => {
    const state = {
      shoals: [
        ['sardine', 'clownfish', 'pufferfish'],
        [], // 空浅滩（唯一放回目标）
        ['kraken'],
        ['jellyfish'],
        ['lamprey', 'foot'],
        [],
      ],
      turn: 1,
      currentPlayer: 0,
      phase: 'catch',
      drawn: [],
      players: [],
    };
    const hits = [];
    const el = document.createElement('div');
    render.renderShoals(
      el,
      state,
      { shoalClickable: (i) => i === 1 || i === 5, canInteract: true },
      { onShoalClick: (i) => hits.push(i) },
    );
    // 空浅滩【1】被标记为可点目标
    const clickableEmpty = el.querySelector('.shoal.empty .shoal-stack.selectable');
    expect(clickableEmpty).toBeTruthy();
    click(clickableEmpty);
    expect(hits).toContain(1);
  });
});
