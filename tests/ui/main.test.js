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
import { CARDS, CARD_BY_ID } from '../../js/core/cards.js';

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
    const confirmBtn = () => $$('.dc-ctx .btn').find((b) => b.textContent.includes('确认抽牌'));
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
      clickText('.dc-ctx .btn', '确认抽牌');
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
        ['lamprey', 'barracuda', 'whiptailStingray'],
        [], // 空浅滩（唯一放回目标）
        ['kraken'],
        ['rotfish'],
        ['lamprey', 'oarfish'],
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

describe('卡背难度区间 difficultyRange（固定三段）', () => {
  it('回归：难度 0 → "0"，1/2 → "1-2"，3/4/5 → "3-5"', () => {
    expect(render.difficultyRange(0)).toBe('0');
    expect(render.difficultyRange(1)).toBe('1-2');
    expect(render.difficultyRange(2)).toBe('1-2');
    expect(render.difficultyRange(3)).toBe('3-5');
    expect(render.difficultyRange(4)).toBe('3-5');
    expect(render.difficultyRange(5)).toBe('3-5');
  });

  it('不变式：逐一校验全部卡，每张卡的卡背分段都包含其自身所需钩数（一一对应，防"背 0-1 却是 strength 5"）', () => {
    for (const c of CARDS) {
      const seg = render.difficultyRange(c.strength);
      const nums = seg.split('-').map(Number);
      const lo = nums[0];
      const hi = nums[nums.length - 1];
      expect(c.strength, `${c.id} strength=${c.strength} seg=${seg}`).toBeGreaterThanOrEqual(lo);
      expect(c.strength, `${c.id} strength=${c.strength} seg=${seg}`).toBeLessThanOrEqual(hi);
      expect(seg, `${c.id}`).not.toBe('0-1');
    }
  });

  it('renderShoals：卡背文本 = 该浅滩位置真实卡的 difficultyRange（顶牌由真实卡决定其卡背）', () => {
    const state = { shoals: [['kraken'], ['lamprey'], []] };
    const el = document.createElement('div');
    render.renderShoals(el, state, { shoalClickable: () => false }, {});
    const texts = Array.from(el.querySelectorAll('.shoal-stack .card-back .cb-range'))
      .map((n) => n.textContent);
    // 克拉肯 strength=5 → "3-5"；七鳃鳗 strength=0 → "0"（绝非 "0-1"）
    expect(texts).toEqual(['3-5', '0']);
    expect(render.difficultyRange(CARD_BY_ID.kraken.strength)).toBe('3-5');
    expect(render.difficultyRange(CARD_BY_ID.lamprey.strength)).toBe('0');
  });

  it('renderShoals 层序：视觉最上层的卡背 = shoal[0]（顶牌），而非栈底', () => {
    // shoal = [七鳃鳗(0), 永动鱿鱼(2), 克拉肯(5)]
    // 顶牌（会被抽到的）是七鳃鳗 → 视觉最上层应显示 "0"
    // 如果层序反了，最上层会是克拉肯 → 显示 "3-5"（即截图里的 bug）
    const state = { shoals: [['lamprey', 'everSquid', 'kraken']] };
    const el = document.createElement('div');
    render.renderShoals(el, state, { shoalClickable: () => false }, {});
    const backs = Array.from(el.querySelectorAll('.shoal-stack .card-back'));
    expect(backs.length).toBe(3);
    // DOM 顺序即视觉叠放顺序：最后一个元素在最上层
    const topBack = backs[backs.length - 1];
    expect(topBack.querySelector('.cb-range').textContent).toBe('0');
    // 再核对各层：第 1 个（最底）应是克拉肯(5) "3-5"，中间永动鱿鱼(2) "1-2"，最顶七鳃鳗(0) "0"
    const badges = backs.map((b) => b.querySelector('.cb-range').textContent);
    expect(badges).toEqual(['3-5', '1-2', '0']);
  });
});

describe('renderPlayersBar：联机在线/掉线徽标', () => {
  const state = {
    currentPlayer: 0,
    players: [
      { id: 0, name: '虾米', caught: [], exhausted: 0, snowGuard: false, powerBonus: 0 },
      { id: 1, name: '蓝鳍', caught: [], exhausted: 0, snowGuard: false, powerBonus: 0 },
    ],
  };

  it('联机传入 meta：在线玩家显示"在线"，掉线玩家显示"掉线·AI托管"', () => {
    const el = document.createElement('div');
    const meta = [
      { id: 0, name: '虾米', connected: true, ai: false },
      { id: 1, name: '蓝鳍', connected: false, ai: true },
    ];
    render.renderPlayersBar(el, state, meta);
    const badges = el.querySelectorAll('.p-status');
    expect(badges.length).toBe(2);
    expect(badges[0].classList.contains('online')).toBe(true);
    expect(badges[0].textContent).toBe('在线');
    expect(badges[1].classList.contains('offline')).toBe(true);
    expect(badges[1].textContent).toBe('掉线·AI托管');
  });

  it('非联机（不传 meta）不渲染徽标，兼容离线模式', () => {
    const el = document.createElement('div');
    render.renderPlayersBar(el, state);
    expect(el.querySelectorAll('.p-status').length).toBe(0);
  });
});
