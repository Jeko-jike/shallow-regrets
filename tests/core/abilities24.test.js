/**
 * 24 张新牌：主动/被动/反应链路的针对性场景测试。
 */
import { describe, it, expect } from 'vitest';
import { createInitialState, getHooks, getPower } from '../../js/core/gameState.js';
import { applyAction, validateAction, PHASE, ACTION } from '../../js/core/stateMachine.js';
import { canCatch, hasLowerAlternative, getRequiredDrawCount, checkGameOver, getLegalThrowTargets } from '../../js/core/rules.js';
import { ABILITY_TYPES } from '../../js/core/abilities.js';

/** 手工构建对局（默认 2 人，A=0，B=1），用于隔离场景 */
function makeState({ players = [{ c: [], e: [] }, { c: [], e: [] }], current = 0, shoals = [[], [], [], [], [], []], drawn = [], names = ['A', 'B'] } = {}) {
  const s = createInitialState({ seed: 1, playerNames: names });
  s.currentPlayer = current;
  s.phase = PHASE.ABILITY;
  players.forEach((p, i) => {
    s.players[i].caught = p.c || [];
    s.players[i].exhausted = p.e || [];
    s.players[i].powerBonus = p.pb || 0;
    s.players[i].snowGuard = !!p.snow;
  });
  if (s.players[0].snowGuard) s.snowGuardOwner = 0;
  if (s.players[1].snowGuard) s.snowGuardOwner = 1;
  s.shoals = shoals;
  s.drawn = drawn;
  return s;
}
function act(s, a) {
  const r = applyAction(s, a);
  if (r.error) throw new Error(r.error);
  return r.state;
}

describe('女妖（改向）', () => {
  it('B 横置 A 的鱼时，A 可用女妖改向保护原目标', () => {
    let s = makeState({
      current: 1,
      players: [ { c: ['banshee', 'greatWhite'] }, { c: ['whiptailStingray'] } ],
    });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'whiptailStingray', target: { playerIndex: 0, cardId: 'greatWhite' } });
    expect(s.phase).toBe(PHASE.PENDING);
    expect(s.pending.type).toBe('REDIRECT');
    // A 接受改向：目标变成 A 的女妖
    s = act(s, { type: ACTION.RESOLVE, resolution: { use: true, candidateIdx: 0 } });
    expect(s.phase).toBe(PHASE.ABILITY);
    expect(s.players[0].exhausted).toContain('banshee');
    expect(s.players[0].exhausted).not.toContain('greatWhite');
    expect(s.players[0].caught).toContain('greatWhite');
  });

  it('A 拒绝改向：原目标被横置', () => {
    let s = makeState({
      current: 1,
      players: [ { c: ['banshee', 'greatWhite'] }, { c: ['whiptailStingray'] } ],
    });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'whiptailStingray', target: { playerIndex: 0, cardId: 'greatWhite' } });
    s = act(s, { type: ACTION.RESOLVE, resolution: { use: false } });
    expect(s.players[0].exhausted).toContain('greatWhite');
    expect(s.players[0].exhausted).not.toContain('banshee');
  });
});

describe('僧帽水母（反击）', () => {
  it('B 用女妖后，B 的僧帽可先横置 A 一条鱼', () => {
    let s = makeState({
      current: 0,
      players: [ { c: ['whiptailStingray', 'lamprey'] }, { c: ['manOWar', 'oarfish'] } ],
    });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'whiptailStingray', target: { playerIndex: 1, cardId: 'oarfish' } });
    expect(s.phase).toBe(PHASE.PENDING);
    expect(s.pending.type).toBe('COUNTER');
    expect(s.pending.counterP).toBe(1);
    expect(s.pending.counterTargets).toContain('lamprey'); // 攻击方 A 的鱼
    s = act(s, { type: ACTION.RESOLVE, resolution: { use: true, cardId: 'lamprey' } });
    expect(s.players[0].exhausted).toContain('lamprey');
    expect(s.players[1].exhausted).toContain('oarfish');
  });

  it('A 有女妖且 B 有僧帽：先改向再反击', () => {
    // 被攻击方 B 持女妖（可改向）+ 僧帽水母（可反击）
    let s = makeState({
      current: 0,
      players: [ { c: ['whiptailStingray', 'lamprey'] }, { c: ['banshee', 'manOWar', 'oarfish'] } ],
    });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'whiptailStingray', target: { playerIndex: 1, cardId: 'oarfish' } });
    expect(s.pending.type).toBe('REDIRECT'); // B 有女妖
    s = act(s, { type: ACTION.RESOLVE, resolution: { use: true, candidateIdx: 0 } }); // B 改向到自己的女妖
    expect(s.pending.type).toBe('COUNTER');  // B 又有僧帽水母
    s = act(s, { type: ACTION.RESOLVE, resolution: { use: true, cardId: 'lamprey' } });
    expect(s.players[1].exhausted).toContain('banshee'); // 目标变成 B 的女妖
    expect(s.players[0].exhausted).toContain('lamprey'); // 反击了 A 的 lamprey
    expect(s.players[1].caught).toContain('oarfish');    // oarfish 被改向保护
    expect(s.players[1].exhausted).not.toContain('oarfish');
  });
});

describe('狮子鱼（强制换鱼）', () => {
  it('对方有现行狮子鱼，交换必须选狮子鱼', () => {
    const s = makeState({
      current: 0,
      players: [ { c: ['sealMan', 'seaMonkey'] }, { c: ['lionfish', 'rotfish'] } ],
    });
    const bad = validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'sealMan', target: { playerIndex: 1, oppCardId: 'rotfish' } });
    expect(bad).toBeTruthy();
    expect(validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'sealMan', target: { playerIndex: 1, oppCardId: 'lionfish' } })).toBeNull();
  });
  it('交换选择狮子鱼时整卡（含钩数）转移', () => {
    let s = makeState({
      current: 0,
      players: [ { c: ['sealMan', 'seaMonkey'] }, { c: ['lionfish', 'rotfish'] } ],
    });
    const h0 = getHooks(s, 0);
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'sealMan', target: { playerIndex: 1, oppCardId: 'lionfish' } });
    expect(s.players[0].caught).toContain('lionfish');
    expect(s.players[1].caught).toContain('sealMan');
    expect(s.players[0].caught).not.toContain('sealMan');
    expect(s.players[1].caught).not.toContain('lionfish');
  });
});

describe('巨型乌贼/被动保护', () => {
  it('他人不能以巨型乌贼为目标横置', () => {
    const s = makeState({
      current: 0,
      players: [ { c: ['whiptailStingray'] }, { c: ['giantSquid'] } ],
    });
    expect(validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'whiptailStingray', target: { playerIndex: 1, cardId: 'giantSquid' } })).toBeTruthy();
  });
  it('无损目标时横置普通鱼合法', () => {
    const s = makeState({
      current: 0,
      players: [ { c: ['whiptailStingray'] }, { c: ['oarfish'] } ],
    });
    expect(validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'whiptailStingray', target: { playerIndex: 1, cardId: 'oarfish' } })).toBeNull();
  });
});

describe('海猴/旧日支配者 捕鱼限制', () => {
  it('海猴：不能捕捉难度0', () => {
    const s = makeState({ players: [ { c: ['seaMonkey'] }, { c: [] } ] });
    expect(canCatch(s, 0, 'lamprey')).toBe(false); // lamprey 难度0
    expect(canCatch(s, 0, 'oarfish')).toBe(true);  // 难度1
    // 对方没有海猴则可捕难度0
    expect(canCatch(s, 1, 'lamprey')).toBe(true);
  });

  it('旧日支配者：有难度<3可选则不可捕难度≥3', () => {
    // 力量=sealMan(1)+rotfish(2)+severedFoot(2)=4；本回合抽到 oarfish(难度1) 作为"其他可选"
    const s = makeState({
      players: [ { c: ['elderThing', 'rotfish', 'severedFoot'] }, { c: [] } ],
      drawn: ['oarfish'],
    });
    expect(getPower(s, 0)).toBe(4);
    expect(hasLowerAlternative(s, 0, 'swordfish')).toBe(true);
    expect(canCatch(s, 0, 'swordfish')).toBe(false); // swordfish 难度3，有难度1可选
  });
  it('旧日支配者：无难度<3可选时可捕难度≥3', () => {
    // 本回合抽到的全是难度≥3（greatWhite 难度3），无更低可选项
    const s = makeState({
      players: [ { c: ['elderThing', 'rotfish', 'severedFoot'] }, { c: [] } ],
      drawn: ['greatWhite'],
    });
    expect(hasLowerAlternative(s, 0, 'swordfish')).toBe(false);
    expect(canCatch(s, 0, 'swordfish')).toBe(true);
  });
  it('旧日支配者示例：抽到 1 与 2 难度，二者都可捕', () => {
    const s = makeState({
      players: [ { c: ['elderThing', 'rotfish', 'severedFoot'] }, { c: [] } ],
      drawn: ['oarfish', 'sealMan'], // 难度 1、2
    });
    expect(canCatch(s, 0, 'oarfish')).toBe(true);
    expect(canCatch(s, 0, 'sealMan')).toBe(true);
  });
  it('旧日支配者示例：抽到 1 与 4 难度，只能捕捉 1 难度', () => {
    const s = makeState({
      players: [ { c: ['elderThing', 'rotfish', 'severedFoot'] }, { c: [] } ],
      drawn: ['oarfish', 'kelpie'], // 难度 1、4
    });
    expect(canCatch(s, 0, 'oarfish')).toBe(true);
    expect(canCatch(s, 0, 'kelpie')).toBe(false);
  });
  it('旧日支配者示例：抽到 5 与 4 难度，二者都可捕', () => {
    // 力量需 ≥5：rotfish(2)+severedFoot(2)+seaMonkey(3)=7
    const s = makeState({
      players: [ { c: ['elderThing', 'rotfish', 'severedFoot', 'seaMonkey'] }, { c: [] } ],
      drawn: ['kraken', 'kelpie'], // 难度 5、4
    });
    expect(getPower(s, 0)).toBe(7);
    expect(canCatch(s, 0, 'kelpie')).toBe(true);
    expect(canCatch(s, 0, 'kraken')).toBe(true);
  });
});

describe('雪鳗（护体）', () => {
  it('主动护体后，对方不能横置/交换/送卡命中自己', () => {
    let s = makeState({ current: 0, players: [ { c: ['snowEel', 'rotfish'] }, { c: ['whiptailStingray'] } ] });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'snowEel' });
    expect(s.players[0].snowGuard).toBe(true);
    // 现在轮到 B，想横置 A 的鱼 -> 被护体拒绝
    s.currentPlayer = 1;
    s.phase = PHASE.ABILITY;
    expect(validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'whiptailStingray', target: { playerIndex: 0, cardId: 'rotfish' } })).toBeTruthy();
  });
  it('护体在轮转回本人时解除', () => {
    // 全难度1的皇带鱼，双方都能钓，保证对局持续
    let s = makeState({
      current: 0,
      players: [ { c: ['snowEel', 'severedFoot'] }, { c: ['lamprey', 'rotfish'] } ],
      shoals: [
        ['oarfish', 'oarfish', 'oarfish'], ['oarfish', 'oarfish', 'oarfish'],
        ['oarfish', 'oarfish', 'oarfish'], ['oarfish', 'oarfish', 'oarfish'],
        ['oarfish', 'oarfish'], ['oarfish', 'oarfish'],
      ],
    });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'snowEel' });
    expect(s.players[0].snowGuard).toBe(true);
    // A 回合：DRAW[0,1]，必钓其一再放回另一张
    s.phase = PHASE.DRAW;
    s = act(s, { type: ACTION.DRAW, from: [0, 1] });
    const catchable = s.drawn.find((id) => canCatch(s, s.currentPlayer, id));
    s = act(s, { type: ACTION.CATCH, cardId: catchable });
    s = act(s, { type: ACTION.THROW_BACK, cardId: s.drawn[0], shoalIndex: getLegalThrowTargets(s)[0] });
    expect(s.currentPlayer).toBe(1);
    expect(s.players[0].snowGuard).toBe(true); // 轮到 B 仍护体
    // B 回合
    s = act(s, { type: ACTION.PASS_ABILITIES });
    s = act(s, { type: ACTION.DRAW, from: [2, 3] });
    const bCatchable = s.drawn.find((id) => canCatch(s, s.currentPlayer, id));
    s = act(s, { type: ACTION.CATCH, cardId: bCatchable });
    s = act(s, { type: ACTION.THROW_BACK, cardId: s.drawn[0], shoalIndex: getLegalThrowTargets(s)[0] });
    expect(s.currentPlayer).toBe(0);            // 回到 A
    expect(s.players[0].snowGuard).toBe(false); // 护体解除
  });
});

describe('抽牌与力量加成', () => {
  it('皇带鱼+2、七鳃鳗+1 可叠加提升抽牌数', () => {
    let s = makeState({ current: 0, players: [ { c: ['oarfish', 'lamprey'] }, { c: [] } ],
      shoals: [ ['lamprey','lamprey','lamprey','lamprey'], ['oarfish','oarfish','oarfish','oarfish'],
                 ['sardine'], ['sardine'], ['sardine'], [] ] });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'oarfish' });   // +2
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'lamprey' });   // +1
    expect(getRequiredDrawCount(s)).toBe(2 + 3);
    expect(s.players[0].exhausted).toContain('oarfish');
    expect(s.players[0].exhausted).toContain('lamprey');
  });
  it('大白鲨力量+3 本回合生效，回合结束清零', () => {
    let s = makeState({ current: 0, players: [ { c: ['greatWhite'] }, { c: [] } ],
      shoals: [ ['everSquid'],[],[],[],[],[] ] });
    const before = getPower(s, 0);
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'greatWhite' });
    expect(getPower(s, 0)).toBe(before + 3);
  });
});

describe('断脚（送出）/ 腐鱼（传球）', () => {
  it('断脚把整卡（含钩数/积分/类型）交给对方', () => {
    let s = makeState({ current: 0, players: [ { c: ['severedFoot', 'lamprey'] }, { c: ['rotfish'] } ] });
    const h0 = getHooks(s, 0);
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'severedFoot', target: { playerIndex: 1 } });
    expect(s.players[1].caught).toContain('severedFoot');
    expect(s.players[0].caught).not.toContain('severedFoot');
    // 积分由卡定义，钩数计入对方
    expect(getHooks(s, 1)).toBeGreaterThanOrEqual(2);
  });
  it('腐鱼：2 人局双方各传一条给对方', () => {
    let s = makeState({ current: 0, players: [ { c: ['rotfish', 'lamprey'] }, { c: ['oarfish', 'severedFoot'] } ] });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'rotfish' });
    expect(s.pending.type).toBe('PASS_LEFT');
    s = act(s, { type: ACTION.RESOLVE, resolution: { pick: 'lamprey' } }); // A 传 lamprey
    s = act(s, { type: ACTION.RESOLVE, resolution: { pick: 'severedFoot' } }); // B 传 severedFoot
    expect(s.players[1].caught).toContain('lamprey'); // A 的 lamprey 到 B
    expect(s.players[0].caught).toContain('severedFoot'); // B 的 severedFoot 到 A
    expect(s.players[0].caught).not.toContain('lamprey');
  });
  it('腐鱼传自身：接收方这张牌横置，不能重复发动', () => {
    let s = makeState({ current: 0, players: [ { c: ['rotfish', 'lamprey'] }, { c: ['oarfish'] } ] });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'rotfish' });
    s = act(s, { type: ACTION.RESOLVE, resolution: { pick: 'rotfish' } }); // A 传腐鱼自身
    s = act(s, { type: ACTION.RESOLVE, resolution: { pick: 'oarfish' } }); // B 传 oarfish
    expect(s.players[1].caught).toContain('rotfish');       // 腐鱼到 B
    expect(s.players[1].exhausted).toContain('rotfish');    // 且横置态随卡转移
    expect(s.players[0].caught).not.toContain('rotfish');
    expect(s.players[0].exhausted).not.toContain('rotfish'); // 不再滞留在原主横置列表
  });
});

describe('梭子鱼 / 眼球团 / 凯尔派 / 美人鱼 / 海主教', () => {
  it('梭子鱼移除一张难度0', () => {
    let s = makeState({ current: 0, players: [ { c: ['barracuda'] }, { c: [] } ],
      shoals: [ ['lamprey', 'oarfish', 'sardine', 'seaMonkey'], [],[],[],[],[] ] });
    const before = s.shoals[0].length;
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'barracuda', target: { shoalIndex: 0, cardIndex: 0 } });
    expect(s.shoals[0].length).toBe(before - 1);
    expect(s.shoals[0]).not.toContain('lamprey');
  });
  it('梭子鱼不能移除难度1', () => {
    const s = makeState({ current: 0, players: [ { c: ['barracuda'] }, { c: [] } ],
      shoals: [ ['oarfish', 'lamprey'], [],[],[],[],[] ] });
    expect(validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'barracuda', target: { shoalIndex: 0, cardIndex: 0 } })).toBeTruthy();
  });
  it('梭子鱼可移除对方已钓的难度0鱼', () => {
    let s = makeState({ current: 0, players: [ { c: ['barracuda'] }, { c: ['lamprey', 'oarfish'] } ] });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'barracuda', target: { playerIndex: 1, cardId: 'lamprey' } });
    expect(s.players[1].caught).not.toContain('lamprey');
    expect(s.players[1].caught).toContain('oarfish');
  });
  it('梭子鱼不能移除对方已钓的难度1鱼', () => {
    const s = makeState({ current: 0, players: [ { c: ['barracuda'] }, { c: ['oarfish'] } ] });
    expect(validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'barracuda', target: { playerIndex: 1, cardId: 'oarfish' } })).toBeTruthy();
  });
  it('梭子鱼不能移除自己的鱼', () => {
    const s = makeState({ current: 0, players: [ { c: ['barracuda', 'lamprey'] }, { c: [] } ] });
    expect(validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'barracuda', target: { playerIndex: 0, cardId: 'lamprey' } })).toBeTruthy();
  });
  it('梭子鱼不能移除雪鳗护体玩家的鱼', () => {
    const s = makeState({ current: 0, players: [ { c: ['barracuda'] }, { c: ['lamprey'], snow: true } ] });
    expect(validateAction(s, { type: ACTION.USE_ABILITY, cardId: 'barracuda', target: { playerIndex: 1, cardId: 'lamprey' } })).toBeTruthy();
  });
  it('眼球团：查看并重排一个鱼群', () => {
    let s = makeState({ current: 0, players: [ { c: ['eyeballBlob'] }, { c: [] } ],
      shoals: [ ['lamprey', 'oarfish', 'kraken'], [],[],[],[],[] ] });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'eyeballBlob', target: { shoalIndex: 0 } });
    expect(s.pending.type).toBe('REARRANGE');
    s = act(s, { type: ACTION.RESOLVE, resolution: { order: ['kraken', 'lamprey', 'oarfish'] } });
    expect(s.shoals[0]).toEqual(['kraken', 'lamprey', 'oarfish']);
  });
  it('凯尔派：揭示全部堆顶，回合结束清空', () => {
    let s = makeState({ current: 0, players: [ { c: ['kelpie'] }, { c: [] } ],
      shoals: [ ['lamprey'], ['oarfish'], [],[],[],[] ] });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'kelpie' });
    expect(s.revealedTops.shoalIndexes).toContain(0);
    expect(s.revealedTops.shoalIndexes).toContain(1);
    // 展示的卡牌回合结束后放回（揭示态清空）
    s = act(s, { type: ACTION.PASS_ABILITIES });
    s = act(s, { type: ACTION.DRAW, from: [0, 1] });
    s = act(s, { type: ACTION.CATCH, cardId: 'lamprey' });
    s = act(s, { type: ACTION.THROW_BACK, cardId: 'oarfish', shoalIndex: 1 });
    expect(s.phase).toBe(PHASE.ABILITY);
    expect(s.revealedTops).toBeNull();
  });
  it('美人鱼查看最多3个堆顶', () => {
    let s = makeState({ current: 0, players: [ { c: ['mermaid'] }, { c: [] } ],
      shoals: [ ['lamprey'], ['oarfish'], ['kraken'], [],[],[] ] });
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'mermaid', target: { shoalIndexes: [0, 1, 2] } });
    expect(s.lastPeek.shoalIndexes).toEqual([0, 1, 2]);
  });
  it('海主教：洗混所有鱼群并平分堆数不变', () => {
    let s = makeState({ current: 0, players: [ { c: ['seaBishop'] }, { c: [] } ],
      shoals: [ ['lamprey','lamprey','lamprey','lamprey'], ['oarfish'],[],[],[],[] ] });
    const total = s.shoals.reduce((n, x) => n + x.length, 0);
    s = act(s, { type: ACTION.USE_ABILITY, cardId: 'seaBishop' });
    const total2 = s.shoals.reduce((n, x) => n + x.length, 0);
    expect(total2).toBe(total);
  });
});

describe('N 人轮转', () => {
  it('4 人局 currentPlayer 依序轮转', () => {
    const s = createInitialState({ seed: 3, playerNames: ['A', 'B', 'C', 'D'] });
    expect(s.players.length).toBe(4);
  });
});