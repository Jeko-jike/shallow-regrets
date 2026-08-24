/**
 * 屏幕切换：首页 / 联机大厅 / 对局页 / 结算页。
 * M4 观战复用对局页（#game），不新增独立屏幕。
 */
const SCREENS = ['home', 'game', 'result', 'lobby'];

export function showScreen(name) {
  for (const id of SCREENS) {
    document.getElementById(id).classList.toggle('active', id === name);
  }
}
