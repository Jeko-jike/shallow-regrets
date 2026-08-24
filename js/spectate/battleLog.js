/**
 * 战斗日志（M4）：AI 决策过程与战斗反馈记录，可回放。
 * 纯数据：每条记录含 回合/行动方/阶段/动作/描述/评估理由/结算结果。
 */

/** 创建空战斗日志 */
export function createBattleLog() {
  return { entries: [] };
}

/**
 * 追加一条日志。
 * @param {{entries:object[]}} log
 * @param {object} entry {turn, playerIndex, phase, action, description, reason, result}
 */
export function addEntry(log, entry) {
  log.entries.push({ ...entry, t: Date.now() });
  return log;
}

/** 导出为可回放的 JSON 字符串（含 seed 与完整动作序列） */
export function toReplay(log, seed) {
  return JSON.stringify(
    {
      seed,
      actions: log.entries.map((e) => e.action),
      log: log.entries,
    },
    null,
    2
  );
}

/** 从回放 JSON 恢复日志（用于回放/调试） */
export function fromReplay(json) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    return { seed: data.seed, actions: data.actions || [], entries: data.log || [] };
  } catch {
    return null;
  }
}
