/**
 * M5 Solo 流程控制：玩家 vs 脚本对手。
 * UI 无关（可单测）：管理状态、玩家动作派发、脚本自动行动、结算评价。
 * 特色机制（压迫节奏 / 星级评价）见 docs/RULES.md 第十一章。
 */
import { createInitialState } from '../core/gameState.js';
import { applyAction, PHASE } from '../core/stateMachine.js';
import { getResults } from '../core/scoring.js';
import { CARD_BY_ID } from '../core/cards.js';
import { chooseScriptAction, SCRIPT_NAME, TARGETS } from './soloScript.js';

export class SoloController {
  /**
   * @param {{playerName:string, seed:number, first?:'player'|'script'}} opts
   */
  constructor({ playerName, seed, first = 'player' }) {
    const names = first === 'player' ? [playerName, SCRIPT_NAME] : [SCRIPT_NAME, playerName];
    this.state = createInitialState({ seed, playerNames: names });
    this.playerIndex = first === 'player' ? 0 : 1;
    this.scriptIndex = first === 'player' ? 1 : 0;
    this.seed = seed;
    this.onUpdate = null; // (state) => void
    this.onGameOver = null; // () => void
  }

  isPlayerTurn() {
    return this.state.currentPlayer === this.playerIndex && this.state.phase !== PHASE.GAME_OVER;
  }

  isScriptTurn() {
    return this.state.currentPlayer === this.scriptIndex && this.state.phase !== PHASE.GAME_OVER;
  }

  /** 玩家派发动作（返回错误信息或 null） */
  dispatch(action) {
    if (!this.isPlayerTurn()) return '还没轮到你行动';
    const res = applyAction(this.state, action);
    if (res.error) return res.error;
    this.state = res.state;
    this.onUpdate?.(this.state);
    if (this.state.phase === PHASE.GAME_OVER) this.onGameOver?.();
    return null;
  }

  /** 脚本执行一个动作（确定性剧本决策） */
  runScriptAction() {
    if (!this.isScriptTurn()) return false;
    const action = chooseScriptAction(this.state);
    if (!action) return false;
    const res = applyAction(this.state, action);
    if (res.error) return false;
    this.state = res.state;
    this.onUpdate?.(this.state);
    if (this.state.phase === PHASE.GAME_OVER) this.onGameOver?.();
    return true;
  }

  /** 实时特色目标进度（对局中展示；终局时与 getEvaluation 一致），见 RULES.md 11.6 */
  getLiveGoals() {
    const s = this.state;
    const me = s.players[this.playerIndex];
    const results = getResults(s);
    const myScore = results.find((r) => r.playerIndex === this.playerIndex).score;
    const scriptScore = results.find((r) => r.playerIndex === this.scriptIndex).score;
    const grabbed = me.caught.filter((id) => TARGETS.includes(id)).length;
    const foulCount = me.caught.filter((id) => CARD_BY_ID[id].type === 'foul').length;
    return {
      beatScript: { done: myScore > scriptScore, text: `${myScore} > ${scriptScore}` },
      caughtKraken: { done: me.caught.includes('kraken'), text: me.caught.includes('kraken') ? '已钓到' : '未钓到' },
      noFoul: { done: foulCount === 0, text: foulCount === 0 ? '无污秽' : `钓到 ${foulCount} 条污秽` },
      grabbedTargets: { done: grabbed >= 3, text: `${grabbed}/3` },
    };
  }

  /** 结算评价：特色目标达成情况 + 星级 + 等级（见 RULES.md 11.6） */
  getEvaluation() {
    const live = this.getLiveGoals();
    const goals = Object.fromEntries(Object.entries(live).map(([k, v]) => [k, v.done]));
    const stars = Object.values(goals).filter(Boolean).length;
    const rank = stars <= 1 ? '浅滩之耻' : stars === 2 ? '勉强及格' : stars === 3 ? '合格渔夫' : '深海传奇';
    const results = getResults(this.state);
    return {
      goals,
      stars,
      rank,
      myResult: results.find((r) => r.playerIndex === this.playerIndex),
      scriptResult: results.find((r) => r.playerIndex === this.scriptIndex),
    };
  }
}
