/**
 * 动画辅助：翻牌 / 移动 / 抖动。
 * 基于 CSS transform+transition；关闭动画时仅移除 class，不影响对局结果。
 */

let enabled = true;

export function setAnimEnabled(v) {
  enabled = !!v;
  document.body.classList.toggle('no-anim', !enabled);
}

export function isAnimEnabled() {
  return enabled;
}

function replay(el, cls) {
  if (!enabled) return;
  el.classList.remove(cls);
  void el.offsetWidth; // 强制重排以重启动画
  el.classList.add(cls);
}

export function flipIn(el) {
  replay(el, 'flip-in');
}

export function cardMove(el) {
  replay(el, 'card-move');
}

export function shake(el) {
  replay(el, 'shake');
}
