/**
 * 核心 → UI 的解耦事件总线。
 * core 层只 emit 事件，不关心谁在听；UI 层只 on 事件，不反向依赖 core。
 * 返回的 unsubscribe 用于清理监听，避免内存泄漏。
 */

export function createEventBus() {
  const handlers = new Map();

  return {
    /** 订阅事件，返回取消订阅函数 */
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => this.off(event, fn);
    },
    off(event, fn) {
      const set = handlers.get(event);
      if (set) set.delete(fn);
    },
    /** 触发事件；同一事件的所有监听按注册顺序同步执行 */
    emit(event, payload) {
      const set = handlers.get(event);
      if (!set) return;
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (err) {
          // 单个监听器异常不影响其它监听器
          console.error(`[eventBus] handler error on "${event}"`, err);
        }
      }
    },
    /** 清空所有监听（页面卸载/模式切换时使用） */
    clear() {
      handlers.clear();
    },
  };
}
