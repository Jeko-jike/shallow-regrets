/**
 * M4 AI 斗蛐蛐观众编排：创建 AI 对战、回合调度、自动/手动模式、速度档位。
 * 不触碰 DOM（可单测）；由 spectateUI 绑定渲染。
 *
 * 竞态约束：回合推进由单一串行调度器驱动（step → runOneAction → schedule），
 * 速度档位仅改变 setTimeout 间隔，绝不改变对局结果（applyAction 确定性 + 种子随机）。
 */
import { createInitialState } from '../core/gameState.js';
import { applyAction, PHASE } from '../core/stateMachine.js';
import { chooseAction } from '../ai/heuristicAI.js';
import { describeAction, explainDecision } from '../ai/aiDecision.js';
import { createBattleLog, addEntry, toReplay } from './battleLog.js';

/** 速度档位 → 每动作间隔（ms） */
export const SPEED_MS = { slow: 3000, medium: 1500, fast: 500 };

export class SpectateController {
  /**
   * @param {{names:string[], seed:number, speed?:string, mode?:string}} opts
   *   mode: 'auto' | 'manual'
   */
  constructor({ names, seed, speed = 'medium', mode = 'auto' }) {
    this.state = createInitialState({ seed, playerNames: names });
    this.log = createBattleLog();
    this.mode = mode;
    this.speed = speed;
    this.running = false;
    this.timer = null;
    this.onUpdate = null; // (state) => void
    this.onGameOver = null; // () => void
    this.onLog = null; // (entry) => void
  }

  getSpeedMs() {
    return SPEED_MS[this.speed] || SPEED_MS.medium;
  }

  /** 自动模式：开始连续执行 */
  start() {
    if (this.state.phase === PHASE.GAME_OVER) return;
    this.running = true;
    this.schedule();
  }

  pause() {
    this.running = false;
    clearTimeout(this.timer);
  }

  /** 切换模式：auto 立即开始，manual 停止并等待手动推进 */
  setMode(mode) {
    this.mode = mode;
    if (mode === 'auto') this.start();
    else this.pause();
  }

  /** 切换速度档位（不影响对局结果） */
  setSpeed(speed) {
    this.speed = speed;
    if (this.mode === 'auto' && this.running) {
      clearTimeout(this.timer);
      this.schedule();
    }
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.step(), this.getSpeedMs());
  }

  /** 串行调度器：执行一个动作，然后按模式决定是否继续 */
  step() {
    if (!this.running || this.state.phase === PHASE.GAME_OVER) return;
    this.runOneAction();
    if (this.state.phase === PHASE.GAME_OVER) {
      this.running = false;
      this.onGameOver?.();
      return;
    }
    if (this.mode === 'auto' && this.running) this.schedule();
  }

  /** 执行一个动作：AI 决策 → 记录理由 → 应用 → 记日志 → 通知渲染 */
  runOneAction() {
    const action = chooseAction(this.state);
    if (!action) return;
    const playerIndex = this.state.currentPlayer;
    const turn = this.state.turn;
    const reason = explainDecision(this.state, action);
    const description = describeAction(this.state, action);
    const res = applyAction(this.state, action);
    if (res.error) {
      addEntry(this.log, {
        turn,
        playerIndex,
        phase: this.state.phase,
        action,
        description: `${description}（非法，被拒绝）`,
        reason,
        result: ['rejected'],
      });
      this.onLog?.(this.log.entries[this.log.entries.length - 1]);
      return;
    }
    this.state = res.state;
    addEntry(this.log, {
      turn,
      playerIndex,
      phase: res.state.phase,
      action,
      description,
      reason,
      result: res.events,
    });
    this.onLog?.(this.log.entries[this.log.entries.length - 1]);
    this.onUpdate?.(this.state);
  }

  /** 手动模式：推进一个完整回合（直到换人或终局） */
  nextTurn() {
    if (this.state.phase === PHASE.GAME_OVER) return;
    const startPlayer = this.state.currentPlayer;
    let guard = 0;
    while (this.state.phase !== PHASE.GAME_OVER && this.state.currentPlayer === startPlayer && guard++ < 10) {
      this.runOneAction();
    }
    if (this.state.phase === PHASE.GAME_OVER) this.onGameOver?.();
  }

  /** 手动模式：自动推进 N 个回合（短间隔） */
  autoAdvanceTurns(n) {
    let count = 0;
    const tick = () => {
      if (this.state.phase === PHASE.GAME_OVER) {
        this.onGameOver?.();
        return;
      }
      this.nextTurn();
      count++;
      if (count < n && this.state.phase !== PHASE.GAME_OVER) {
        this.timer = setTimeout(tick, 120);
      } else if (this.state.phase === PHASE.GAME_OVER) {
        this.onGameOver?.();
      }
    };
    tick();
  }

  /** 立即结束本局：同步跑完剩余对局（结果与慢速观看一致） */
  finishNow() {
    this.pause();
    let guard = 0;
    while (this.state.phase !== PHASE.GAME_OVER && guard++ < 500) {
      this.runOneAction();
    }
    if (this.state.phase === PHASE.GAME_OVER) this.onGameOver?.();
  }

  /** 导出回放 JSON */
  exportReplay() {
    return toReplay(this.log, this.state.seed);
  }
}
